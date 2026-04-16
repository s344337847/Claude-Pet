use crate::state::StateManager;
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    routing::post,
    Router,
};
use std::net::SocketAddr;
use std::sync::Arc;

#[derive(Clone)]
pub struct ServerState {
    pub state_manager: Arc<StateManager>,
}

async fn handle_event(
    State(state): State<Arc<ServerState>>,
    Path(event): Path<String>,
) -> impl IntoResponse {
    state.state_manager.handle_event(event);
    StatusCode::OK
}

pub async fn start_server(state_manager: Arc<StateManager>) -> Result<u16, String> {
    for port in 9876..=9880 {
        let addr = SocketAddr::from(([127, 0, 0, 1], port));
        let state = Arc::new(ServerState {
            state_manager: state_manager.clone(),
        });

        let app = Router::new()
            .route("/v1/event/:event", post(handle_event))
            .layer(tower_http::cors::CorsLayer::permissive())
            .with_state(state);

        match tokio::net::TcpListener::bind(addr).await {
            Ok(listener) => {
                tokio::spawn(async move {
                    let _ = axum::serve(listener, app).await;
                });
                return Ok(port);
            }
            Err(_) => continue,
        }
    }
    Err("No available port in range 9876-9880".to_string())
}
