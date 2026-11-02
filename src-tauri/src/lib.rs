//! ABA-X1 desktop shell. Deliberately thin: all mathematics runs in TypeScript (identical in the
//! web build); Rust persists documents, writes/reads export files, builds the native menu.

mod about;
mod app_menu;
mod commands;
mod error;
mod files;
mod storage;

use tauri::Emitter;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .on_menu_event(|app, event| {
            // the frontend runs the action with this id (menu model in TypeScript)
            let _ = app.emit("menu", event.id().0.clone());
        })
        .invoke_handler(tauri::generate_handler![
            commands::storage_load,
            commands::storage_save,
            commands::storage_remove,
            commands::get_app_info,
            commands::files_write_text,
            commands::files_write_bytes,
            commands::files_read_text,
            commands::set_app_menu,
        ])
        .run(tauri::generate_context!())
        .expect("error while running ABA-X1");
}
