//! ABA-X1 desktop shell. Deliberately thin: all mathematics runs in TypeScript (identical in the
//! web build); Rust only persists documents and reports app data.

mod about;
mod commands;
mod error;
mod storage;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            commands::storage_load,
            commands::storage_save,
            commands::storage_remove,
            commands::get_app_info,
        ])
        .run(tauri::generate_context!())
        .expect("error while running ABA-X1");
}
