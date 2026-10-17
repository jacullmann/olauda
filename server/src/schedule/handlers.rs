use super::{
    dto::{ScheduleDto, ScheduleSubsQuery, SubjectDto, SubstitutionDto},
    service::ScheduleService,
};
use crate::{common::extractors::TenantContext, error::AppResult, state::AppState};
use axum::{
    Json,
    extract::{Query, State},
};

/// The timetable as the member sees it.
#[utoipa::path(
    get,
    path = "/schedule",
    tag = "schedule",
    responses((status = 200, body = ScheduleDto)),
)]
pub async fn get_schedule(
    State(s): State<AppState>,
    tc: TenantContext,
) -> AppResult<Json<ScheduleDto>> {
    Ok(Json(
        ScheduleService::from_state(&s)
            .get_schedule(tc.tenant_id, Some(tc.user.user_id))
            .await?,
    ))
}

#[utoipa::path(
    get,
    path = "/schedule/subs",
    tag = "schedule",
    params(ScheduleSubsQuery),
    responses((status = 200, body = Vec<SubstitutionDto>)),
)]
pub async fn get_subs(
    State(s): State<AppState>,
    tc: TenantContext,
    Query(weeks): Query<ScheduleSubsQuery>,
) -> AppResult<Json<Vec<SubstitutionDto>>> {
    Ok(Json(
        ScheduleService::from_state(&s)
            .get_subs(tc.tenant_id, weeks)
            .await?,
    ))
}

#[utoipa::path(
    get,
    path = "/schedule/subjects",
    tag = "schedule",
    responses((status = 200, body = Vec<SubjectDto>)),
)]
pub async fn get_subjects(
    State(s): State<AppState>,
    tc: TenantContext,
) -> AppResult<Json<Vec<SubjectDto>>> {
    Ok(Json(
        ScheduleService::from_state(&s)
            .get_subjects(tc.tenant_id)
            .await?,
    ))
}
