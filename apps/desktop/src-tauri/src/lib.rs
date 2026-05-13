use std::fs;
use std::io::{Read, Write};
use std::net::TcpListener;
use tauri::{Emitter, Window, Manager};
use image::imageops::FilterType;
use webp::Encoder;
use font_kit::source::SystemSource;
use argon2::{Algorithm, Argon2, Params, Version};
use r2d2::Pool;
use r2d2_sqlite::SqliteConnectionManager;
use rusqlite::types::Value as SqlValue;
use std::sync::Mutex;
use base64::prelude::*;

// The Tauri state holding our connection pool and the path it belongs to
struct DbState(Mutex<Option<(String, Pool<SqliteConnectionManager>)>>);

// Helper to convert JSON values to SQLite values
fn json_to_sql(v: &serde_json::Value) -> SqlValue {
    match v {
        serde_json::Value::Null => SqlValue::Null,
        serde_json::Value::Bool(b) => SqlValue::Integer(if *b { 1 } else { 0 }),
        serde_json::Value::Number(n) => {
            if let Some(i) = n.as_i64() { SqlValue::Integer(i) }
            else if let Some(f) = n.as_f64() { SqlValue::Real(f) }
            else { SqlValue::Null }
        },
        serde_json::Value::String(s) => SqlValue::Text(s.clone()),
        _ => SqlValue::Text(v.to_string()),
    }
}
// Helper to normalize Windows paths so child/main windows always match
fn paths_match(p1: &str, p2: &str) -> bool {
    p1.to_lowercase().replace('\\', "/") == p2.to_lowercase().replace('\\', "/")
}

#[tauri::command]
async fn open_encrypted_db(
    state: tauri::State<'_, DbState>,
    db_path: String,
    encryption_key: String,
) -> Result<(), String> {
    if let Some(parent) = std::path::Path::new(&db_path).parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("Failed to create DB directory: {}", e))?;
    }

    // 1. Fast path using bulletproof helper
    {
        let pool_guard = state.0.lock().unwrap();
        if let Some((current_path, _)) = pool_guard.as_ref() {
            if paths_match(current_path, &db_path) {
                println!("[DB] Fast path hit! Connection already open.");
                return Ok(());
            }
        }
    }

    // 2. Migration check using bulletproof helper
    if std::path::Path::new(&db_path).exists() {
        let already_open = {
            let pool_guard = state.0.lock().unwrap();
            pool_guard.as_ref().map_or(false, |(p, _)| paths_match(p, &db_path))
        };

        if !already_open {
            let is_unencrypted = {
                if let Ok(test_conn) = rusqlite::Connection::open(&db_path) {
                    test_conn.query_row("SELECT 1 FROM sqlite_master LIMIT 1", [], |_| Ok(())).is_ok()
                } else {
                    false
                }
            };

            if is_unencrypted {
                println!("[DB] Unencrypted database detected. Running SQLCipher migration...");
                let backup_path = format!("{}.bak", db_path);
                std::fs::rename(&db_path, &backup_path).map_err(|e| e.to_string())?;

                let new_conn = rusqlite::Connection::open(&db_path).map_err(|e| e.to_string())?;
                new_conn.pragma_update(None, "key", &encryption_key).map_err(|e| e.to_string())?;

                new_conn.execute(
                    &format!("ATTACH DATABASE '{}' AS plaintext KEY '';", backup_path),
                    []
                ).map_err(|e| e.to_string())?;

                new_conn.query_row("SELECT sqlcipher_export('main')", [], |_| Ok(()))
                    .map_err(|e| e.to_string())?;
                new_conn.execute("DETACH DATABASE plaintext", []).map_err(|e| e.to_string())?;
                
                new_conn.close().map_err(|_| "Failed to close migration connection".to_string())?;
                println!("[DB] Migration complete.");
            }
        }
    }

    // 3. Build pool
    let encryption_key_clone = encryption_key.clone();
    let db_path_clone = db_path.clone();
    let manager = SqliteConnectionManager::file(&db_path_clone)
        .with_init(move |conn| {
            conn.pragma_update(None, "key", &encryption_key_clone)?;
            conn.pragma_update(None, "journal_mode", "WAL")?;
            conn.pragma_update(None, "foreign_keys", "ON")?;
            conn.pragma_update(None, "busy_timeout", 5000)?;
            Ok(())
        });

    let pool = Pool::builder()
        .max_size(4)
        .build(manager)
        .map_err(|e| format!("Failed to create pool: {}", e))?;

    // 4. Final check-and-set using bulletproof helper
    {
        let mut pool_guard = state.0.lock().unwrap();
        
        let is_duplicate = if let Some((current_path, _)) = pool_guard.as_ref() {
            paths_match(current_path, &db_path)
        } else {
            false
        };

        if is_duplicate {
            println!("[DB] Pool already initialised by another window, discarding duplicate.");
        } else {
            *pool_guard = Some((db_path, pool));
            println!("[DB] Pool initialised.");
        }
    }

    Ok(())
}

#[tauri::command]
async fn execute_sql(
    state: tauri::State<'_, DbState>,
    sql: String,
    params: Vec<serde_json::Value>,
) -> Result<(), String> {
    let sql_params: Vec<SqlValue> = params.iter().map(json_to_sql).collect();

    let pool = {
        let pool_guard = state.0.lock().unwrap();
        pool_guard.as_ref().ok_or("Database not initialized")?.1.clone()
    };

    // Offload the blocking C-bindings to a background OS thread
    tauri::async_runtime::spawn_blocking(move || -> Result<(), String> {
        let conn = pool.get().map_err(|e| e.to_string())?;
        conn.execute(&sql, rusqlite::params_from_iter(sql_params))
            .map_err(|e| e.to_string())?;
        Ok(())
    })
    .await
    .unwrap_or_else(|e| Err(format!("Thread crashed: {}", e)))
}

#[tauri::command]
fn is_db_ready(state: tauri::State<'_, DbState>) -> bool {
    let pool_guard = state.0.lock().unwrap();
    pool_guard.is_some()
}

#[tauri::command]
async fn select_sql(
    state: tauri::State<'_, DbState>,
    sql: String,
    params: Vec<serde_json::Value>,
) -> Result<Vec<Vec<serde_json::Value>>, String> {
    let sql_params: Vec<SqlValue> = params.iter().map(json_to_sql).collect();

    let pool = {
        let pool_guard = state.0.lock().unwrap();
        pool_guard.as_ref().ok_or("Database not initialized")?.1.clone()
    };

    // Offload the blocking C-bindings to a background OS thread
    tauri::async_runtime::spawn_blocking(move || -> Result<Vec<Vec<serde_json::Value>>, String> {
        let conn = pool.get().map_err(|e| e.to_string())?;
        let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
        let col_count = stmt.column_count();

        let rows = stmt.query_map(rusqlite::params_from_iter(sql_params), |row| {
            let mut row_arr = Vec::with_capacity(col_count);
            for i in 0..col_count {
                let val: serde_json::Value = match row.get_ref(i)? {
                    rusqlite::types::ValueRef::Null => serde_json::Value::Null,
                    rusqlite::types::ValueRef::Integer(n) => n.into(),
                    rusqlite::types::ValueRef::Real(f) => f.into(),
                    rusqlite::types::ValueRef::Text(s) => String::from_utf8_lossy(s).into_owned().into(),
                    rusqlite::types::ValueRef::Blob(b) => serde_json::Value::String(BASE64_STANDARD.encode(b)),
                };
                row_arr.push(val);
            }
            Ok(row_arr)
        }).map_err(|e| e.to_string())?;

        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
    })
    .await
    .unwrap_or_else(|e| Err(format!("Thread crashed: {}", e)))
}

#[tauri::command]
fn get_system_fonts() -> Vec<String> {
    let source = SystemSource::new();
    let mut fonts = source.all_families().unwrap_or_default();
    fonts.sort();
    fonts
}

#[tauri::command]
fn argon2id(
    message: Vec<u8>,
    nonce: Vec<u8>,
    memory: u32,
    passes: u32,
    parallelism: u32,
    tag_length: u32,
) -> Result<Vec<u8>, String> {
    let params = Params::new(memory, passes, parallelism, Some(tag_length as usize))
        .map_err(|e| format!("Invalid Argon2 params: {e}"))?;
    let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);
    let mut output = vec![0u8; tag_length as usize];
    argon2
        .hash_password_into(&message, &nonce, &mut output)
        .map_err(|e| format!("Argon2id failed: {e}"))?;
    Ok(output)
}

#[tauri::command]
fn compress_image_native(
    source_path: String,
    output_path: String,
    max_dimension: u32,
    quality: u8,
) -> Result<(u32, u32), String> {
    let img = image::ImageReader::open(&source_path)
        .map_err(|e| format!("Failed to open file: {}", e))?
        .with_guessed_format()
        .map_err(|e| format!("Failed to guess format from bin file: {}", e))?
        .decode()
        .map_err(|e| format!("Failed to decode image: {}", e))?;

    let resized = if img.width() > max_dimension || img.height() > max_dimension {
        img.resize(max_dimension, max_dimension, FilterType::Triangle)
    } else {
        img
    };

    let out_width = resized.width();
    let out_height = resized.height();

    let encoder: Encoder = Encoder::from_image(&resized)
        .map_err(|e| format!("Failed to create WebP encoder: {:?}", e))?;

    let webp_memory = if quality == 100 {
        encoder.encode_lossless()
    } else {
        encoder.encode(quality as f32)
    };

    fs::write(&output_path, &*webp_memory)
        .map_err(|e| format!("Failed to save WebP to disk: {}", e))?;

    Ok((out_width, out_height))
}

#[tauri::command]
async fn start_auth_listener(window: Window) -> Result<(), String> {
    std::thread::spawn(move || {
        let listener = TcpListener::bind("127.0.0.1:8484").expect("Failed to bind to port 8484");

        for stream in listener.incoming() {
            if let Ok(mut stream) = stream {
                let mut buffer = [0; 4096];
                if stream.read(&mut buffer).is_ok() {
                    let request = String::from_utf8_lossy(&buffer[..]).to_string();

                    if request.starts_with("GET /_tauri_callback") {
                        let response = "HTTP/1.1 200 OK\r\nAccess-Control-Allow-Origin: *\r\n\r\n";
                        let _ = stream.write_all(response.as_bytes());
                        let _ = window.emit("oauth-callback", request);
                        break;
                    } else if request.contains("GET /?code=") || request.contains("GET /?error=") {
                        let response = "HTTP/1.1 200 OK\r\n\r\n<html><body><h2>Authentication successful!</h2><p>You can close this tab and return to Annota.</p><script>window.close()</script></body></html>";
                        let _ = stream.write_all(response.as_bytes());
                        let _ = window.emit("oauth-callback", request);
                        break;
                    } else {
                        let response = "HTTP/1.1 200 OK\r\n\r\n<html><body><h2>Completing authentication...</h2><script>
                            let data = window.location.hash.substring(1) || window.location.search.substring(1);
                            fetch('/_tauri_callback?' + data).then(() => { window.close() });
                        </script></body></html>";
                        let _ = stream.write_all(response.as_bytes());
                    }
                }
            }
        }
    });

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
                let _ = window.emit("deep-link-windows", args);
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_window_state::Builder::default().with_state_flags(tauri_plugin_window_state::StateFlags::all()).build())
        .manage(DbState(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![
            start_auth_listener,
            is_db_ready,
            compress_image_native,
            get_system_fonts,
            argon2id,
            open_encrypted_db,
            execute_sql,
            select_sql
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
