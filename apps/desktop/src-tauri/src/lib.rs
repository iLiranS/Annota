use std::io::{Read, Write};
use std::net::TcpListener;
use tauri::{Emitter, Window};
use image::{imageops::FilterType};
use std::fs::File;

#[tauri::command]
async fn compress_image_native(
    source_path: String,
    output_path: String,
    max_dimension: u32,
    mut quality: u8,
) -> Result<(u32, u32), String> {
    let img = image::open(&source_path)
        .map_err(|e| format!("Failed to open image: {}", e))?;

    // Speed Optimization: Changed Lanczos3 to Triangle (Bilinear). 
    // It is significantly faster and perfect for downscaling.
    let resized = if img.width() > max_dimension || img.height() > max_dimension {
        img.resize(max_dimension, max_dimension, FilterType::Triangle)
    } else {
        img
    };

    let out_width = resized.width();
    let out_height = resized.height();

    let mut out_file = File::create(&output_path)
        .map_err(|e| format!("Failed to create output: {}", e))?;

    // Size Optimization: Mobile compression is usually more aggressive.
    // If your frontend passes 80, we bump it down slightly on desktop to match mobile sizes.
    if quality > 60 {
        quality -= 15; 
    }

    let mut encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut out_file, quality);
    encoder.encode_image(&resized)
        .map_err(|e| format!("Failed to compress: {}", e))?;

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
        .invoke_handler(tauri::generate_handler![start_auth_listener, compress_image_native])
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_store::Builder::default().build())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
