//! Communication with the Modal control plane and servers.

use std::{str::FromStr, sync::Arc, time::Duration};

use tonic::{
    Request, Status,
    metadata::{MetadataMap, MetadataValue},
    service::{Interceptor, interceptor::InterceptedService},
    transport::{Channel, ClientTlsConfig, Endpoint},
};
use tracing::warn;

use crate::{
    config::Profile,
    proto::{
        MAX_MESSAGE_SIZE,
        client::{ClientType, modal_client_client::ModalClientClient},
    },
};

/// gRPC client for the Modal client library.
#[derive(Debug)]
pub struct GrpcClient {
    /// gRPC client for public API RPCs.
    client: ModalClientClient<InterceptedService<Channel, AuthInterceptor>>,

    /// Profile containing authentication details.
    profile: Arc<Profile>,
}

impl GrpcClient {
    /// Crate a new client with the given API server URL.
    pub async fn new(profile: Arc<Profile>) -> crate::Result<Self> {
        let endpoint = Endpoint::from_shared(profile.server_url.clone())?
            .buffer_size(4096) // Max concurrent requests
            .connect_timeout(Duration::from_secs(10))
            .http2_keep_alive_interval(Duration::from_secs(20))
            .initial_stream_window_size(64 * 1024 * 1024) // 64 MB
            .initial_connection_window_size(64 * 1024 * 1024) // 64 MB
            .keep_alive_while_idle(true)
            .keep_alive_timeout(Duration::from_secs(30))
            // Set webpki roots to match the Python library (certifi).
            .tls_config(ClientTlsConfig::new().with_webpki_roots())?;

        let channel = endpoint.connect().await?;

        let auth_interceptor = AuthInterceptor {
            profile: profile.clone(),
        };
        let client = ModalClientClient::with_interceptor(channel, auth_interceptor)
            .max_decoding_message_size(MAX_MESSAGE_SIZE)
            .max_encoding_message_size(MAX_MESSAGE_SIZE);

        Ok(Self { client, profile })
    }
}

struct AuthInterceptor {
    profile: Arc<Profile>,
}

impl Interceptor for AuthInterceptor {
    fn call(&mut self, mut req: Request<()>) -> Result<Request<()>, Status> {
        let meta = req.metadata_mut();
        add_meta(meta, "x-modal-client-type", i32::from(ClientType::Libmodal));
        add_meta(meta, "x-modal-client-version", "424242"); // TODO
        add_meta(meta, "x-modal-token-id", &self.profile.token_id);
        add_meta(meta, "x-modal-token-secret", &self.profile.token_secret);
        Ok(req)
    }
}

fn add_meta(meta: &mut MetadataMap, key: &'static str, value: impl std::fmt::Display) {
    let value = value.to_string();
    if let Ok(val) = MetadataValue::from_str(&value) {
        meta.insert(key, val);
    } else {
        warn!("failed to insert metadata: {key}={value}");
    }
}
