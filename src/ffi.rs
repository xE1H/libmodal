//! C ABI bindings to Modal.
//!
//! This is the public "extern" API, discovered by cbindgen.

#![allow(unsafe_code)]

use std::sync::LazyLock;

/// System allocator used so memory can be shared with malloc() / free().
#[global_allocator]
static GLOBAL: std::alloc::System = std::alloc::System;

/// Global Tokio runtime used by all operations.
static RUNTIME: LazyLock<tokio::runtime::Runtime> = LazyLock::new(|| {
    tokio::runtime::Builder::new_multi_thread()
        .worker_threads(1)
        .enable_all()
        .build()
        // If this fails, it's a critical error in libmodal.
        .expect("libmodal failed to initialize tokio runtime")
});

type DoFn = unsafe extern "C" fn(x: i32, y: i32) -> i32;

/// Add two numbers.
#[unsafe(no_mangle)]
pub extern "C" fn add_two_numbers(x: i32, y: i32) {
    // Initialize the runtime.
    let _ = tokio::runtime::Builder::new_multi_thread()
        .worker_threads(1)
        .enable_all()
        .build()
        .unwrap();
}
