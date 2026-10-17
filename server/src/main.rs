mod access_control;
mod announcements;
mod api;
mod assets;
mod auth;
mod common;
mod config;
mod data_export;
mod error;
mod group;
mod items;
mod mfa;
mod oauth;
mod passkeys;
mod realtime;
mod reauth;
mod reports;
mod schedule;
mod security_log;
mod state;
mod super_admin;
mod system;
mod system_announcements;
mod todos;
mod user;

use anyhow::Context;
use axum::Router;
use config::Config;
use sqlx::postgres::PgPoolOptions;
use state::AppState;
use tower_http::{
    compression::CompressionLayer,
    cors::{AllowHeaders, AllowMethods, CorsLayer},
    request_id::{MakeRequestUuid, SetRequestIdLayer},
    trace::TraceLayer,
};
use tracing::info;
use tracing_subscriber::{EnvFilter, layer::SubscriberExt, util::SubscriberInitExt};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::registry()
        .with(
            EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info,server=debug,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer().json())
        .init();

    let config = Config::from_env().context("Failed to load configuration")?;

    let port = config.port;

    let cors_origin = config.cors_origin.clone();

    let db = PgPoolOptions::new()
        .max_connections(20)
        .connect(&config.database_url)
        .await
        .context("Failed to connect to database")?;

    sqlx::migrate!("./migrations")
        .run(&db)
        .await
        .context("Failed to run migrations")?;

    info!("Database connected and migrations applied.");

    let state = AppState::new(db, config)?;

    assets::sweep::spawn(state.db.clone(), state.cloudinary.clone());

    let (api, _) = api::router(&state);

    let cors = CorsLayer::new()
        .allow_origin(
            cors_origin
                .parse::<axum::http::HeaderValue>()
                .context("Invalid CORS_ORIGIN")?,
        )
        .allow_credentials(true)
        .allow_methods(AllowMethods::list([
            axum::http::Method::GET,
            axum::http::Method::POST,
            axum::http::Method::PUT,
            axum::http::Method::PATCH,
            axum::http::Method::DELETE,
            axum::http::Method::OPTIONS,
        ]))
        .allow_headers(AllowHeaders::list([
            axum::http::header::CONTENT_TYPE,
            axum::http::header::AUTHORIZATION,
            axum::http::HeaderName::from_static("x-csrf-token"),
        ]));

    let realtime = state.realtime.clone();
    realtime.spawn_listener(state.config.database_url.clone());

    let app = Router::new()
        .merge(api.with_state(state))
        .layer(cors)
        .layer(CompressionLayer::new())
        .layer(TraceLayer::new_for_http())
        .layer(SetRequestIdLayer::x_request_id(MakeRequestUuid));

    let addr = std::net::SocketAddr::from(([0, 0, 0, 0], port));

    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .context("Failed to bind TCP listener")?;

    info!("Server listening on {addr}");

    axum::serve(listener, app)
        .with_graceful_shutdown(async move {
            shutdown_signal().await;
            realtime.close();
        })
        .await
        .context("Server error")?;

    Ok(())
}

/// Every deploy replaces the container with SIGTERM. Requests in flight must
/// still finish: a refresh cut off after its rotation commits leaves the
/// browser holding a spent token, and replaying that later revokes the whole
/// session as theft.
async fn shutdown_signal() {
    let ctrl_c = async {
        if tokio::signal::ctrl_c().await.is_err() {
            std::future::pending::<()>().await;
        }
    };

    #[cfg(unix)]
    let terminate = async {
        match tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate()) {
            Ok(mut sigterm) => {
                sigterm.recv().await;
            }
            Err(_) => std::future::pending::<()>().await,
        }
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        () = ctrl_c => {},
        () = terminate => {},
    }

    info!("Shutting down after requests in flight finish");
}
