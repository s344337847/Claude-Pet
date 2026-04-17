use crate::pet_manager::PetManager;
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    routing::post,
    Json, Router,
};
use serde::Deserialize;
use std::net::SocketAddr;
use std::sync::Arc;

#[derive(Clone)]
pub struct ServerState {
    pub pet_manager: Arc<PetManager>,
}

#[derive(Deserialize)]
pub struct EventBody {
    pub session_id: Option<String>,
    pub cwd: Option<String>,
}

async fn handle_event(
    State(state): State<Arc<ServerState>>,
    Path(event): Path<String>,
    body: Option<Json<EventBody>>,
) -> impl IntoResponse {
    let session_id = body.as_ref().and_then(|b| b.session_id.clone());
    let cwd = body.as_ref().and_then(|b| b.cwd.clone());
    state.pet_manager.handle_event(event, session_id, cwd);
    StatusCode::OK
}

pub async fn start_server(pet_manager: Arc<PetManager>) -> Result<u16, String> {
    for port in 9876..=9880 {
        let addr = SocketAddr::from(([127, 0, 0, 1], port));
        let state = Arc::new(ServerState {
            pet_manager: pet_manager.clone(),
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
