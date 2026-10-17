//! Live updates. A change is published through Postgres `NOTIFY`, so it
//! reaches every server instance and only once its transaction commits; each
//! instance fans it out to the event streams of the users it concerns.

pub mod event;
pub mod handlers;
pub mod hub;
pub mod routes;
