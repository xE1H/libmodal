//! Generated protobuf client definitions for `libmodal`.

#![allow(clippy::derive_partial_eq_without_eq)]

/// 100 MiB limit on gRPC messages, set to be the same as the API server.
pub const MAX_MESSAGE_SIZE: usize = 100 * 1024 * 1024;

pub mod client {
    tonic::include_proto!("modal.client");
}
