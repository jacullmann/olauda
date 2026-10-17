use super::dto::{TodoCompletionDto, TodoContent, TodoDto, TodoMovedDto};
use crate::{
    common::encryption::{EncryptedPayload, EncryptionService},
    error::{AppError, AppResult},
    realtime::event::{AccountTopic, Notice, publish},
    state::AppState,
};
use fractional_index::FractionalIndex;
use serde_json::json;
use sqlx::{PgConnection, PgPool};
use uuid::Uuid;

pub struct TodoService {
    db: PgPool,
    enc: EncryptionService,
}

impl TodoService {
    pub fn from_state(state: &AppState) -> Self {
        Self {
            db: state.db.clone(),
            enc: state.encryption.clone(),
        }
    }

    pub async fn get_todos(&self, user_id: Uuid) -> AppResult<Vec<TodoDto>> {
        let todos = sqlx::query!(
            r#"SELECT id, encrypted_title, encrypted_description, completed, position, created_at, updated_at
               FROM encrypted_todos WHERE user_id = $1
               ORDER BY position ASC NULLS LAST, created_at ASC"#,
            user_id
        )
            .fetch_all(&self.db)
            .await?;

        let uid = user_id.to_string();

        let mut result = Vec::with_capacity(todos.len());

        for t in todos {
            let title_payload: EncryptedPayload = serde_json::from_value(t.encrypted_title)
                .map_err(|_| AppError::internal("Invalid encrypted title"))?;

            let title = self.enc.decrypt(&title_payload, &uid).await?;

            let description = match t.encrypted_description {
                Some(desc_val) => match serde_json::from_value::<EncryptedPayload>(desc_val) {
                    Ok(p) if !p.data.is_empty() => {
                        self.enc.decrypt(&p, &uid).await.unwrap_or_default()
                    }
                    _ => String::new(),
                },
                None => String::new(),
            };

            result.push(TodoDto {
                id: t.id,
                title,
                description,
                completed: t.completed,
                position: t.position.unwrap_or_default(),
                created_at: t.created_at,
                updated_at: t.updated_at,
            });
        }

        Ok(result)
    }

    pub async fn create_todo(&self, user_id: Uuid, content: &TodoContent) -> AppResult<TodoDto> {
        let uid = user_id.to_string();
        let enc_title = self.enc.encrypt(content.title(), &uid).await?;
        let enc_desc = self.enc.encrypt(content.description(), &uid).await?;

        let mut tx = self.db.begin().await?;

        lock_list(&mut tx, user_id).await?;
        let first = sqlx::query_scalar!(
            r#"SELECT position FROM encrypted_todos
               WHERE user_id = $1 AND position <> ''
               ORDER BY position COLLATE "C"
               LIMIT 1"#,
            user_id
        )
        .fetch_optional(&mut *tx)
        .await?
        .flatten();
        let position = position_in_slot(None, first.as_deref())?;

        let todo = sqlx::query!(
            r#"INSERT INTO encrypted_todos (user_id, encrypted_title, encrypted_description, position)
               VALUES ($1, $2, $3, $4)
               RETURNING id, completed, position, created_at, updated_at"#,
            user_id,
            enc_title.to_json(),
            enc_desc.to_json(),
            position.to_string(),
        )
        .fetch_one(&mut *tx)
        .await?;

        sqlx::query!(
            r#"INSERT INTO user_activity (user_id, type, meta) VALUES ($1, 'todo:create', $2)"#,
            user_id,
            json!({ "todoId": todo.id })
        )
        .execute(&mut *tx)
        .await?;

        publish(&mut *tx, [todos_changed(user_id)]).await?;
        tx.commit().await?;

        Ok(TodoDto {
            id: todo.id,
            title: content.title().to_owned(),
            description: content.description().to_owned(),
            completed: todo.completed,
            position: todo.position.unwrap_or_default(),
            created_at: todo.created_at,
            updated_at: todo.updated_at,
        })
    }

    pub async fn update_todo(
        &self,
        user_id: Uuid,
        id: Uuid,
        content: &TodoContent,
    ) -> AppResult<TodoDto> {
        let uid = user_id.to_string();
        let enc_title = self.enc.encrypt(content.title(), &uid).await?;
        let enc_desc = self.enc.encrypt(content.description(), &uid).await?;

        let mut tx = self.db.begin().await?;

        let updated = sqlx::query!(
            r#"UPDATE encrypted_todos
               SET encrypted_title = $1, encrypted_description = $2
               WHERE id = $3 AND user_id = $4
               RETURNING id, completed, position, created_at, updated_at"#,
            enc_title.to_json(),
            enc_desc.to_json(),
            id,
            user_id,
        )
        .fetch_optional(&mut *tx)
        .await?
        .ok_or_else(todo_not_found)?;

        sqlx::query!(
            r#"INSERT INTO user_activity (user_id, type, meta) VALUES ($1, 'todo:update', $2)"#,
            user_id,
            json!({ "todoId": id })
        )
        .execute(&mut *tx)
        .await?;

        publish(&mut *tx, [todos_changed(user_id)]).await?;
        tx.commit().await?;

        Ok(TodoDto {
            id: updated.id,
            title: content.title().to_owned(),
            description: content.description().to_owned(),
            completed: updated.completed,
            position: updated.position.unwrap_or_default(),
            created_at: updated.created_at,
            updated_at: updated.updated_at,
        })
    }

    /// Sets rather than flips the state, so a repeated or late request can
    /// never undo the one the user sent last.
    pub async fn set_completed(
        &self,
        user_id: Uuid,
        id: Uuid,
        completed: bool,
    ) -> AppResult<TodoCompletionDto> {
        let mut tx = self.db.begin().await?;

        let updated = sqlx::query!(
            r#"UPDATE encrypted_todos SET completed = $3
               WHERE id = $1 AND user_id = $2
               RETURNING id, completed, updated_at"#,
            id,
            user_id,
            completed
        )
        .fetch_optional(&mut *tx)
        .await?
        .ok_or_else(todo_not_found)?;

        sqlx::query!(
            r#"INSERT INTO user_activity (user_id, type, meta) VALUES ($1, 'todo:toggle', $2)"#,
            user_id,
            json!({ "todoId": id, "completed": completed })
        )
        .execute(&mut *tx)
        .await?;

        publish(&mut *tx, [todos_changed(user_id)]).await?;
        tx.commit().await?;

        Ok(TodoCompletionDto {
            id: updated.id,
            completed: updated.completed,
            updated_at: updated.updated_at,
        })
    }

    /// Moves the todo right below `after`, or to the top without one. The
    /// neighbours are looked up here rather than sent by the client, so a
    /// move never depends on positions the client has yet to learn.
    pub async fn move_todo(
        &self,
        user_id: Uuid,
        id: Uuid,
        after: Option<Uuid>,
    ) -> AppResult<TodoMovedDto> {
        let mut tx = self.db.begin().await?;

        lock_list(&mut tx, user_id).await?;
        // In the order the client shows: by position, compared bytewise like
        // the client does, then the todos without one.
        let list = sqlx::query!(
            r#"SELECT id, position FROM encrypted_todos
               WHERE user_id = $1
               ORDER BY NULLIF(position, '') COLLATE "C" NULLS LAST, completed, created_at DESC"#,
            user_id
        )
        .fetch_all(&mut *tx)
        .await?;
        if !list.iter().any(|todo| todo.id == id) {
            return Err(todo_not_found());
        }
        let others: Vec<_> = list.into_iter().filter(|todo| todo.id != id).collect();

        let slot = match after {
            None => 0,
            Some(after) => {
                others
                    .iter()
                    .position(|todo| todo.id == after)
                    .ok_or_else(todo_not_found)?
                    + 1
            }
        };
        let position_at = |i: usize| others.get(i).and_then(|todo| todo.position.as_deref());
        let position =
            position_in_slot(slot.checked_sub(1).and_then(position_at), position_at(slot))?
                .to_string();

        let updated = sqlx::query!(
            r#"UPDATE encrypted_todos SET position = $1 WHERE id = $2
               RETURNING id, updated_at"#,
            position,
            id
        )
        .fetch_one(&mut *tx)
        .await?;

        publish(&mut *tx, [todos_changed(user_id)]).await?;
        tx.commit().await?;

        Ok(TodoMovedDto {
            id: updated.id,
            position,
            updated_at: updated.updated_at,
        })
    }

    pub async fn delete_todo(&self, user_id: Uuid, id: Uuid) -> AppResult<()> {
        let mut tx = self.db.begin().await?;

        sqlx::query!(
            r#"DELETE FROM encrypted_todos WHERE id = $1 AND user_id = $2 RETURNING id"#,
            id,
            user_id
        )
        .fetch_optional(&mut *tx)
        .await?
        .ok_or_else(todo_not_found)?;

        sqlx::query!(
            r#"INSERT INTO user_activity (user_id, type, meta) VALUES ($1, 'todo:delete', $2)"#,
            user_id,
            json!({ "todoId": id })
        )
        .execute(&mut *tx)
        .await?;

        publish(&mut *tx, [todos_changed(user_id)]).await?;
        tx.commit().await?;

        Ok(())
    }
}

/// Serialises the writes that place one owner's todos until the transaction
/// ends, so two of them never pick the same gap. A row lock would miss a todo
/// inserted meanwhile.
async fn lock_list(conn: &mut PgConnection, user_id: Uuid) -> AppResult<()> {
    sqlx::query!(
        "SELECT FROM pg_advisory_xact_lock(hashtextextended('todos:' || $1::uuid, 0))",
        user_id
    )
    .execute(conn)
    .await?;

    Ok(())
}

/// A position between two neighbours, either of which is missing at an end
/// of the list. Todos from before the list could be arranged have an empty
/// position and count as missing too.
fn position_in_slot(prev: Option<&str>, next: Option<&str>) -> AppResult<FractionalIndex> {
    let parse = |position: Option<&str>| {
        position
            .filter(|position| !position.is_empty())
            .map(FractionalIndex::from_string)
            .transpose()
            .map_err(|_| AppError::internal("Invalid position encoding"))
    };

    Ok(match (parse(prev)?, parse(next)?) {
        (None, None) => FractionalIndex::default(),
        (Some(prev), None) => FractionalIndex::new_after(&prev),
        (None, Some(next)) => FractionalIndex::new_before(&next),
        (Some(prev), Some(next)) => FractionalIndex::new_between(&prev, &next)
            .ok_or_else(|| AppError::internal("Neighbouring todos share a position"))?,
    })
}

fn todo_not_found() -> AppError {
    AppError::not_found("Private entry not found")
}

/// Private tasks are the owner's alone; their other sessions follow along.
const fn todos_changed(user_id: Uuid) -> Notice {
    Notice::account(user_id, AccountTopic::Todos)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn places_a_todo_between_its_neighbours() {
        let first = FractionalIndex::default();
        let last = FractionalIndex::new_after(&first);

        let between = position_in_slot(Some(&first.to_string()), Some(&last.to_string())).unwrap();

        assert!(first < between && between < last);
        assert!(first.to_string() < between.to_string());
        assert!(between.to_string() < last.to_string());
    }

    #[test]
    fn places_a_todo_at_either_end() {
        let only = FractionalIndex::default();
        let stored = only.to_string();

        assert!(position_in_slot(None, Some(&stored)).unwrap() < only);
        assert!(position_in_slot(Some(&stored), None).unwrap() > only);
        assert_eq!(position_in_slot(None, None).unwrap(), only);
    }

    #[test]
    fn treats_todos_without_a_position_as_missing_neighbours() {
        let only = FractionalIndex::default();

        assert!(position_in_slot(Some(&only.to_string()), Some("")).unwrap() > only);
        assert_eq!(position_in_slot(Some(""), None).unwrap(), only);
    }
}
