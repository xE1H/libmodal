//! Shared connections, including with the Modal control plane.

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
        client::{
            AppGetOrCreateRequest, ClientType, ObjectCreationType,
            modal_client_client::ModalClientClient,
        },
    },
};

pub(crate) type GrpcClient = ModalClientClient<InterceptedService<Channel, AuthInterceptor>>;

/// Client object for all Modal API calls.
///
/// This is cheaply cloneable. You typically should only need to create one of
/// these per program.
#[derive(Clone, Debug)]
pub struct Client {
    grpc_client: GrpcClient,
    profile: Arc<Profile>,
}

impl Client {
    /// Create a new client with the given profile.
    pub fn new(profile: Arc<Profile>) -> crate::Result<Self> {
        let grpc_channel = create_grpc_channel(&profile)?;
        let auth_interceptor = AuthInterceptor {
            profile: profile.clone(),
        };
        let grpc_client = ModalClientClient::with_interceptor(grpc_channel, auth_interceptor)
            .max_decoding_message_size(MAX_MESSAGE_SIZE)
            .max_encoding_message_size(MAX_MESSAGE_SIZE);
        Ok(Self {
            grpc_client,
            profile,
        })
    }

    /// Create a new client from the environment.
    pub fn from_env() -> crate::Result<Self> {
        let profile = Arc::new(Profile::from_env(None)?);
        Self::new(profile)
    }

    /// Create a gRPC client. The `grpc_client` methods take mutable receivers,
    /// so cloning makes them easier to call.
    pub(crate) fn grpc(&self) -> GrpcClient {
        self.grpc_client.clone()
    }

    /// Look up an app, returning its ID.
    pub async fn lookup_app(
        &self,
        name: &str,
        environment: Option<&str>,
        create_if_missing: bool,
    ) -> crate::Result<String> {
        let req = AppGetOrCreateRequest {
            app_name: name.into(),
            environment_name: env_param(environment, &self.profile),
            object_creation_type: if create_if_missing {
                ObjectCreationType::CreateIfMissing as i32
            } else {
                ObjectCreationType::Unspecified as i32
            },
        };
        let resp = self.grpc().app_get_or_create(req).await?;
        Ok(resp.into_inner().app_id)
    }
}

fn env_param(environment: Option<&str>, profile: &Profile) -> String {
    environment
        .map(|env| env.to_string())
        .or_else(|| profile.environment.clone())
        .unwrap_or_default()
}

fn create_grpc_channel(profile: &Profile) -> crate::Result<Channel> {
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

    Ok(endpoint.connect_lazy())
}

#[derive(Clone)]
pub(crate) struct AuthInterceptor {
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
