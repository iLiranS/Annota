fn main() {
    println!("cargo:rustc-env=LIBSQLITE3_FLAGS=-DSQLITE_ENABLE_FTS5");
    println!("cargo:rustc-check-cfg=cfg(mobile)"); // Silences the warning
    tauri_build::build();
}