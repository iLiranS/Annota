use std::fs; // Changed from std::fs::File
use std::io::{Read, Write};
use std::net::TcpListener;
use tauri::{Emitter, Window};
use image::imageops::FilterType;
use webp::Encoder;
use font_kit::source::SystemSource;
use argon2::{Algorithm, Argon2, Params, Version};

#[tauri::command]
fn get_system_fonts() -> Vec<String> {
    let source = SystemSource::new();
    let mut fonts = source.all_families().unwrap_or_default();
    fonts.sort(); // alphabetical order
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
async fn compress_image_native(
    source_path: String,
    output_path: String,
    max_dimension: u32,
    quality: u8,
) -> Result<(u32, u32), String> {
    
    // Read the file and let the `image` crate guess the format from the bytes
    let img = image::ImageReader::open(&source_path)
        .map_err(|e| format!("Failed to open file: {}", e))?
        .with_guessed_format()
        .map_err(|e| format!("Failed to guess format from bin file: {}", e))?
        .decode()
        .map_err(|e| format!("Failed to decode image: {}", e))?;

    // Downscale if necessary
    let resized = if img.width() > max_dimension || img.height() > max_dimension {
        img.resize(max_dimension, max_dimension, FilterType::Triangle)
    } else {
        img
    };

    let out_width = resized.width();
    let out_height = resized.height();

    // Create the WebP encoder
    let encoder: Encoder = Encoder::from_image(&resized)
        .map_err(|e| format!("Failed to create WebP encoder: {:?}", e))?;

    // Encode
    let webp_memory = if quality == 100 {
        encoder.encode_lossless()
    } else {
        encoder.encode(quality as f32)
    };

    // Save directly to disk
    fs::write(&output_path, &*webp_memory)
        .map_err(|e| format!("Failed to save WebP to disk: {}", e))?;

    Ok((out_width, out_height))
}


#[tauri::command]
async fn start_auth_listener(window: Window) -> Result<(), String> {
    // We run this in a new thread so it doesn't freeze the app while waiting
    std::thread::spawn(move || {
        // Listen on the port we set in our OAuth provider
        let listener = TcpListener::bind("127.0.0.1:8484").expect("Failed to bind to port 8484");
        
        // Wait for the browser to redirect here in a loop so we can handle multiple requests
        for stream in listener.incoming() {
            if let Ok(mut stream) = stream {
                let mut buffer = [0; 4096];
                if stream.read(&mut buffer).is_ok() {
                    let request = String::from_utf8_lossy(&buffer[..]).to_string();
                    
                    // If the browser is sending back the JS extracted hash
                    if request.starts_with("GET /_tauri_callback") {
                        let response = "HTTP/1.1 200 OK\r\nAccess-Control-Allow-Origin: *\r\n\r\n";
                        let _ = stream.write_all(response.as_bytes());
                        let _ = window.emit("oauth-callback", request);
                        break;
                    } 
                    // If Supabase gave us query parameters directly (PKCE flow)
                    else if request.contains("GET /?code=") || request.contains("GET /?error=") {
                        let response = "HTTP/1.1 200 OK\r\n\r\n<html><body><h2>Authentication successful!</h2><p>You can close this tab and return to Annota.</p><script>window.close()</script></body></html>";
                        let _ = stream.write_all(response.as_bytes());
                        let _ = window.emit("oauth-callback", request);
                        break;
                    } 
                    // Otherwise, the tokens are likely trapped in the URL Hash fragment! 
                    // We return HTML that extracts the hash and calls /_tauri_callback
                    else {
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
        .invoke_handler(tauri::generate_handler![start_auth_listener, compress_image_native, get_system_fonts,argon2id])
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_window_state::Builder::default().with_state_flags(tauri_plugin_window_state::StateFlags::all()).build())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
