//! ABA-X1 desktop app: the shared shell (`crates/shell`) with this app's context
//! (tauri.conf.json: identifier, window, icons).

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    aba_shell::builder()
        .run(tauri::generate_context!())
        .expect("error while running ABA-X1");
}
