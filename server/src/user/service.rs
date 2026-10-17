use super::dto::{
    DismissibleNotice, ItemIdsDto, PreferencesDto, UpdatePreferencesDto, VisibilityDto,
    VisibilityStatus,
};
use crate::{
    error::{AppError, AppResult},
    realtime::event::{AccountTopic, GroupTopic, Notice, publish},
    state::AppState,
};
use serde_json::json;
use sqlx::PgPool;
use uuid::Uuid;

pub struct UserService {
    db: PgPool,
}

impl UserService {
    pub fn from_state(state: &AppState) -> Self {
        Self {
            db: state.db.clone(),
        }
    }

    pub async fn update_personalization(&self, user_id: Uuid, personalized: bool) -> AppResult<()> {
        sqlx::query!(
            r#"UPDATE users SET personalized = $1 WHERE id = $2 RETURNING personalized"#,
            personalized,
            user_id
        )
        .fetch_optional(&self.db)
        .await?
        .ok_or_else(|| AppError::not_found("User not found"))?;

        sqlx::query!(
            r#"INSERT INTO user_activity (user_id, type, meta) VALUES ($1, 'profile:personalization:update', $2)"#,
            user_id, json!({ "personalized": personalized })
        ).execute(&self.db).await?;

        publish(&self.db, [Notice::account(user_id, AccountTopic::Profile)]).await?;

        Ok(())
    }

    /// Saves the settings named in `changes` and keeps every other one. A page's
    /// settings (`tasks`, `schedule`, ...) arrive one at a time, so they extend
    /// the stored ones instead of replacing them. Merging inside a single
    /// statement keeps two settings saved at once from overwriting each other.
    pub async fn update_preferences(
        &self,
        user_id: Uuid,
        changes: &UpdatePreferencesDto,
    ) -> AppResult<PreferencesDto> {
        let preferences = sqlx::query_scalar!(
            r#"WITH updated AS (
                   UPDATE users u
                   SET preferences = u.preferences || COALESCE((
                       SELECT jsonb_object_agg(
                           change.key,
                           CASE WHEN jsonb_typeof(change.value) = 'object'
                                 AND jsonb_typeof(u.preferences -> change.key) = 'object'
                                THEN (u.preferences -> change.key) || change.value
                                ELSE change.value
                           END)
                       FROM jsonb_each($2::jsonb) AS change
                   ), '{}'::jsonb)
                   WHERE u.id = $1
                   RETURNING u.preferences
               ),
               logged AS (
                   INSERT INTO user_activity (user_id, type, meta)
                   SELECT $1, 'profile:preferences:update', $2 FROM updated
               )
               SELECT preferences AS "preferences!" FROM updated"#,
            user_id,
            json!(changes)
        )
        .fetch_optional(&self.db)
        .await?
        .ok_or_else(|| AppError::not_found("User not found"))?;

        publish(&self.db, [Notice::account(user_id, AccountTopic::Profile)]).await?;

        Ok(PreferencesDto::from_stored(preferences))
    }

    pub async fn dismiss_notice(&self, user_id: Uuid, notice: DismissibleNotice) -> AppResult<()> {
        // Appending inside a single statement keeps concurrent dismissals from
        // overwriting each other, and repeats neither duplicate the entry nor
        // log activity again.
        sqlx::query!(
            r#"WITH dismissed AS (
                   UPDATE users
                   SET preferences = jsonb_set(
                       preferences,
                       '{dismissedNotices}',
                       COALESCE(preferences->'dismissedNotices', '[]'::jsonb) || to_jsonb($2::text)
                   )
                   WHERE id = $1
                     AND NOT COALESCE(preferences->'dismissedNotices', '[]'::jsonb) ? $2
                   RETURNING id
               )
               INSERT INTO user_activity (user_id, type, meta)
               SELECT id, 'profile:notice:dismiss', $3 FROM dismissed"#,
            user_id,
            notice.as_str(),
            json!({ "notice": notice.as_str() })
        )
        .execute(&self.db)
        .await?;

        publish(&self.db, [Notice::account(user_id, AccountTopic::Profile)]).await?;

        Ok(())
    }

    pub async fn update_setup(
        &self,
        user_id: Uuid,
        tenant_id: Uuid,
        courses: Vec<(Uuid, Uuid)>,
    ) -> AppResult<()> {
        let (subject_ids, course_ids): (Vec<Uuid>, Vec<Uuid>) = courses.iter().copied().unzip();

        if !courses.is_empty() {
            let valid_count = sqlx::query_scalar!(
                r#"SELECT COUNT(*)
                   FROM unnest($1::uuid[], $2::uuid[]) AS t(subject_id, course_id)
                   JOIN courses c ON c.id = t.course_id AND c.subject_id = t.subject_id
                   JOIN subjects s ON s.id = t.subject_id
                   WHERE s.tenant_id = $3"#,
                &subject_ids,
                &course_ids,
                tenant_id
            )
            .fetch_one(&self.db)
            .await?
            .unwrap_or(0);

            if valid_count != courses.len() as i64 {
                return Err(AppError::bad_request("Invalid course selection."));
            }
        }

        let mut tx = self.db.begin().await?;

        sqlx::query!(
            r#"UPDATE user_roles SET done_course_setup = true
               WHERE user_id = $1 AND tenant_id = $2"#,
            user_id,
            tenant_id
        )
        .execute(&mut *tx)
        .await?;

        // Only this group's selection is replaced; the user's courses in other
        // groups stay untouched.
        sqlx::query!(
            r#"DELETE FROM user_courses
               WHERE user_id = $1
                 AND subject_id IN (SELECT id FROM subjects WHERE tenant_id = $2)"#,
            user_id,
            tenant_id
        )
        .execute(&mut *tx)
        .await?;

        if !courses.is_empty() {
            sqlx::query!(
                r#"INSERT INTO user_courses (user_id, subject_id, course_id)
                   SELECT $1, t.subject_id, t.course_id
                   FROM unnest($2::uuid[], $3::uuid[]) AS t(subject_id, course_id)"#,
                user_id,
                &subject_ids,
                &course_ids
            )
            .execute(&mut *tx)
            .await?;
        }

        let courses_json: Vec<_> = courses
            .iter()
            .map(|(s, c)| json!({ "subjectId": s, "courseId": c }))
            .collect();

        sqlx::query!(
            r#"INSERT INTO user_activity (user_id, type, meta) VALUES ($1, 'profile:setup:complete', $2)"#,
            user_id, json!({ "courses": courses_json })
        ).execute(&mut *tx).await?;

        publish(
            &mut *tx,
            [Notice::member(user_id, tenant_id, GroupTopic::Courses)],
        )
        .await?;
        tx.commit().await?;

        Ok(())
    }

    /// Clears the member's courses in this group and asks for them again.
    pub async fn reset_setup(&self, user_id: Uuid, tenant_id: Uuid) -> AppResult<()> {
        let mut tx = self.db.begin().await?;

        sqlx::query!(
            r#"UPDATE user_roles SET done_course_setup = false
               WHERE user_id = $1 AND tenant_id = $2"#,
            user_id,
            tenant_id
        )
        .execute(&mut *tx)
        .await?;

        sqlx::query!(
            r#"DELETE FROM user_courses
               WHERE user_id = $1
                 AND subject_id IN (SELECT id FROM subjects WHERE tenant_id = $2)"#,
            user_id,
            tenant_id
        )
        .execute(&mut *tx)
        .await?;

        publish(
            &mut *tx,
            [Notice::member(user_id, tenant_id, GroupTopic::Courses)],
        )
        .await?;
        tx.commit().await?;

        Ok(())
    }

    pub async fn get_checks(&self, user_id: Uuid) -> AppResult<ItemIdsDto> {
        let item_ids = sqlx::query_scalar!(
            r#"SELECT item_id FROM keep_checked WHERE user_id = $1"#,
            user_id
        )
        .fetch_all(&self.db)
        .await?;

        Ok(ItemIdsDto { item_ids })
    }

    pub async fn get_pins(&self, user_id: Uuid) -> AppResult<ItemIdsDto> {
        let item_ids = sqlx::query_scalar!(
            r#"SELECT item_id FROM pinned_items WHERE user_id = $1"#,
            user_id
        )
        .fetch_all(&self.db)
        .await?;

        Ok(ItemIdsDto { item_ids })
    }

    pub async fn get_visibility(&self, user_id: Uuid) -> AppResult<VisibilityDto> {
        let rows = sqlx::query!(
            r#"SELECT item_id, status AS "status: VisibilityStatus"
               FROM user_item_visibility WHERE user_id = $1"#,
            user_id
        )
        .fetch_all(&self.db)
        .await?;

        let mut visibility = VisibilityDto {
            archived: vec![],
            kept: vec![],
        };
        for row in rows {
            match row.status {
                Some(VisibilityStatus::Archived) => visibility.archived.push(row.item_id),
                Some(VisibilityStatus::Kept) => visibility.kept.push(row.item_id),
                None => {}
            }
        }

        Ok(visibility)
    }

    pub async fn set_visibility(
        &self,
        tenant_id: Uuid,
        item_id: Uuid,
        user_id: Uuid,
        status: VisibilityStatus,
    ) -> AppResult<()> {
        sqlx::query!(
            r#"SELECT id FROM items WHERE id = $1 AND tenant_id = $2"#,
            item_id,
            tenant_id
        )
        .fetch_optional(&self.db)
        .await?
        .ok_or_else(|| AppError::not_found("Item not found."))?;

        let mut tx = self.db.begin().await?;

        // An upsert, so two tabs archiving at once still leave a single row.
        sqlx::query!(
            r#"INSERT INTO user_item_visibility (item_id, user_id, status) VALUES ($1, $2, $3)
               ON CONFLICT (item_id, user_id)
               DO UPDATE SET status = EXCLUDED.status, archived_at = now()"#,
            item_id,
            user_id,
            status as VisibilityStatus
        )
        .execute(&mut *tx)
        .await?;

        sqlx::query!(
            r#"INSERT INTO user_activity (user_id, type, meta) VALUES ($1, 'item:visibility:set', $2)"#,
            user_id, json!({ "itemId": item_id, "status": status })
        ).execute(&mut *tx).await?;

        publish(&mut *tx, [marks_changed(user_id, tenant_id)]).await?;
        tx.commit().await?;

        Ok(())
    }

    pub async fn remove_visibility(
        &self,
        tenant_id: Uuid,
        item_id: Uuid,
        user_id: Uuid,
    ) -> AppResult<()> {
        sqlx::query!(
            r#"DELETE FROM user_item_visibility WHERE item_id = $1 AND user_id = $2"#,
            item_id,
            user_id
        )
        .execute(&self.db)
        .await?;

        sqlx::query!(
            r#"INSERT INTO user_activity (user_id, type, meta) VALUES ($1, 'item:visibility:remove', $2)"#,
            user_id, json!({ "itemId": item_id })
        ).execute(&self.db).await?;

        publish(&self.db, [marks_changed(user_id, tenant_id)]).await?;

        Ok(())
    }

    pub async fn log_page_load(&self, user_id: Uuid, user_agent: &str) -> AppResult<()> {
        // Byte slicing would panic on a multi-byte UTF-8 boundary.
        let ua: String = user_agent.chars().take(100).collect();
        sqlx::query!(
            r#"INSERT INTO user_activity (user_id, type, meta) VALUES ($1, 'page:load', $2)"#,
            user_id,
            json!({ "userAgent": ua })
        )
        .execute(&self.db)
        .await?;

        Ok(())
    }

    pub async fn check_item(&self, tenant_id: Uuid, item_id: Uuid, user_id: Uuid) -> AppResult<()> {
        sqlx::query!(
            r#"SELECT id FROM items WHERE id = $1 AND tenant_id = $2"#,
            item_id,
            tenant_id
        )
        .fetch_optional(&self.db)
        .await?
        .ok_or_else(|| AppError::not_found("Not found."))?;

        let mut tx = self.db.begin().await?;

        // An upsert, so checking from two tabs at once is not a conflict.
        sqlx::query!(
            r#"INSERT INTO keep_checked (item_id, user_id, checked_at) VALUES ($1, $2, now())
               ON CONFLICT (item_id, user_id) DO UPDATE SET checked_at = now()"#,
            item_id,
            user_id
        )
        .execute(&mut *tx)
        .await?;

        sqlx::query!(
            r#"DELETE FROM user_item_visibility WHERE item_id = $1 AND user_id = $2"#,
            item_id,
            user_id
        )
        .execute(&mut *tx)
        .await?;

        sqlx::query!(
            r#"INSERT INTO user_activity (user_id, type, meta) VALUES ($1, 'item:check', $2)"#,
            user_id,
            json!({ "itemId": item_id })
        )
        .execute(&mut *tx)
        .await?;

        publish(&mut *tx, [marks_changed(user_id, tenant_id)]).await?;
        tx.commit().await?;

        Ok(())
    }

    pub async fn uncheck_item(
        &self,
        tenant_id: Uuid,
        item_id: Uuid,
        user_id: Uuid,
    ) -> AppResult<()> {
        sqlx::query!(
            r#"DELETE FROM keep_checked WHERE item_id = $1 AND user_id = $2"#,
            item_id,
            user_id
        )
        .execute(&self.db)
        .await?;

        sqlx::query!(
            r#"INSERT INTO user_activity (user_id, type, meta) VALUES ($1, 'item:uncheck', $2)"#,
            user_id,
            json!({ "itemId": item_id })
        )
        .execute(&self.db)
        .await?;

        publish(&self.db, [marks_changed(user_id, tenant_id)]).await?;

        Ok(())
    }

    pub async fn pin_item(&self, tenant_id: Uuid, item_id: Uuid, user_id: Uuid) -> AppResult<()> {
        sqlx::query!(
            r#"SELECT id FROM items WHERE id = $1 AND tenant_id = $2"#,
            item_id,
            tenant_id
        )
        .fetch_optional(&self.db)
        .await?
        .ok_or_else(|| AppError::not_found("Not found."))?;

        sqlx::query!(
            r#"INSERT INTO pinned_items (item_id, user_id, pinned_at) VALUES ($1, $2, now())
               ON CONFLICT (item_id, user_id) DO UPDATE SET pinned_at = now()"#,
            item_id,
            user_id
        )
        .execute(&self.db)
        .await?;

        sqlx::query!(
            r#"INSERT INTO user_activity (user_id, type, meta) VALUES ($1, 'item:pin', $2)"#,
            user_id,
            json!({ "itemId": item_id })
        )
        .execute(&self.db)
        .await?;

        publish(&self.db, [marks_changed(user_id, tenant_id)]).await?;

        Ok(())
    }

    pub async fn unpin_item(&self, tenant_id: Uuid, item_id: Uuid, user_id: Uuid) -> AppResult<()> {
        sqlx::query!(
            r#"DELETE FROM pinned_items WHERE item_id = $1 AND user_id = $2"#,
            item_id,
            user_id
        )
        .execute(&self.db)
        .await?;

        sqlx::query!(
            r#"INSERT INTO user_activity (user_id, type, meta) VALUES ($1, 'item:unpin', $2)"#,
            user_id,
            json!({ "itemId": item_id })
        )
        .execute(&self.db)
        .await?;

        publish(&self.db, [marks_changed(user_id, tenant_id)]).await?;

        Ok(())
    }
}

/// A member's checks, pins and archive change only what they see.
const fn marks_changed(user_id: Uuid, group_id: Uuid) -> Notice {
    Notice::member(user_id, group_id, GroupTopic::TaskMarks)
}
