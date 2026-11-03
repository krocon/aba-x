//! Desktop shell shared by every ABA calculator (prompt 025, ADR 0007/0008). Deliberately thin: all
//! mathematics runs in TypeScript (identical in the web build); Rust persists documents,
//! writes/reads export files, builds the native menu. Each app crate only adds its context:
//! `aba_shell::builder().run(tauri::generate_context!())`.

mod about;
mod app_menu;
mod commands;
mod error;
mod files;
mod storage;

use tauri::{Emitter, Wry};

/// Plugins, menu events and the IPC commands every app shares.
pub fn builder() -> tauri::Builder<Wry> {
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
}
