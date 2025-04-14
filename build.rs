use std::{env, path::Path};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let crate_dir = env::var("CARGO_MANIFEST_DIR")?;
    let crate_dir = Path::new(&crate_dir);

    let protos = vec![
        crate_dir
            .join("modal-client/modal_proto/api.proto")
            .canonicalize()?,
        crate_dir
            .join("modal-client/modal_proto/options.proto")
            .canonicalize()?,
    ];

    let includes = vec![crate_dir.join("modal-client").canonicalize()?];

    tonic_build::configure()
        .generate_default_stubs(true)
        .bytes(["."])
        .btree_map(["."])
        .emit_rerun_if_changed(false)
        .compile_protos(&protos, &includes)?;

    for proto in protos {
        println!("cargo:rerun-if-changed={}", proto.display());
    }

    cbindgen::Builder::new()
        .with_crate(crate_dir)
        .generate()
        .expect("Unable to generate bindings")
        .write_to_file("bindings.h");

    Ok(())
}
