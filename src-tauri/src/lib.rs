pub mod commands;
pub mod models;
pub mod pdf;

#[cfg(debug_assertions)]
use tauri::Manager;
use commands::document::{inspect_document, save_document_atomic};
use commands::pages::{rotate_page_cmd, delete_page_cmd, merge_pdfs_cmd};

#[tauri::command]
fn ping() -> &'static str {
    "pong"
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            ping,
            inspect_document,
            save_document_atomic,
            rotate_page_cmd,
            delete_page_cmd,
            merge_pdfs_cmd
        ])
        .setup(|_app| {
            #[cfg(debug_assertions)]
            {
                let _window = _app.get_webview_window("main").unwrap();
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
