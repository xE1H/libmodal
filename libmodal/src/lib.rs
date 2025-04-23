//! Common library for Modal client operations, meant to be called via C FFI.
//!
//! Modal has an established client library for Python. The goal of `libmodal`
//! is not to replace this, but to provide a performant and correct systems
//! library for some core Modal operations that can be used by other languages,
//! implemented using a common Tokio-based async runtime.
//!
//! The design is similar to the AWS CRT (libcrt) or PyTorch's libtorch, which
//! are also FFI codebases that expose complex behavior to different languages'
//! libraries, consistently.
//!
//! Anything language-specific lives outside `libmodal`. But network behavior,
//! gRPC, retries, and low-level input queueing all belong here.

#![deny(unsafe_code)]
#![warn(missing_docs)]

use std::sync::Arc;

pub mod client;
pub mod config;
pub mod ffi;
pub mod proto;

/// User-facing errors across the Modal client.
#[derive(Debug, Clone, thiserror::Error, strum::EnumDiscriminants)]
#[strum_discriminants(
    vis(pub),
    name(ErrorVariant),
    derive(strum::Display, strum::EnumString)
)]
pub enum Error {
    /// Failed to load or parse configuration file.
    #[error("failed to load or parse config file: {0}")]
    ConfigError(String),

    /// Missing authentication credentials.
    #[error("missing auth, please set MODAL_TOKEN_ID / MODAL_TOKEN_SECRET or use ~/.modal.toml")]
    ConfigMissing,

    /// Transport error, such as connection issues or request failures.
    #[error("{0}")]
    GrpcError(#[from] tonic::Status),

    /// Transport error, such as connection issues or request failures.
    #[error("gRPC transport error: {0}")]
    TransportError(Arc<tonic::transport::Error>),
}

impl From<tonic::transport::Error> for Error {
    // Written out because `tonic::transport::Error` does not implement Clone.
    fn from(err: tonic::transport::Error) -> Self {
        Error::TransportError(Arc::new(err))
    }
}

/// Alias for a `Result` with the error type `libmodal::Error`.
pub type Result<T> = std::result::Result<T, Error>;
