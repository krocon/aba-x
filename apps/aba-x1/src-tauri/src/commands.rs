//! Thin command layer: resolve the app data folder, run the blocking file work off the async
//! runtime, hand everything else to the pure modules.

use std::path::PathBuf;

use serde_json::Value;
use tauri::{AppHandle, Manager};

use crate::app_menu::{self, MenuSpec};
use crate::files;

use crate::about::{self, AppInfo};
use crate::error::AppError;
use crate::storage::{self, LoadedDoc};

fn data_dir(app: &AppHandle) -> Result<PathBuf, AppError> {
    app.path()
        .app_data_dir()
        .map_err(|e| AppError::new("no_data_dir", e.to_string()))
}

async fn blocking<T: Send + 'static>(
    f: impl FnOnce() -> Result<T, AppError> + Send + 'static,
) -> Result<T, AppError> {
    tauri::async_runtime::spawn_blocking(f)
        .await
        .map_err(|e| AppError::new("io", e.to_string()))?
}

#[tauri::command]
pub async fn storage_load(app: AppHandle, key: String) -> Result<LoadedDoc, AppError> {
    let dir = data_dir(&app)?;
    blocking(move || storage::load(&dir, &key)).await
}

#[tauri::command]
pub async fn storage_save(app: AppHandle, key: String, value: Value) -> Result<(), AppError> {
    let dir = data_dir(&app)?;
    blocking(move || storage::save(&dir, &key, &value)).await
}

#[tauri::command]
pub async fn storage_remove(app: AppHandle, key: String) -> Result<(), AppError> {
    let dir = data_dir(&app)?;
    blocking(move || storage::remove(&dir, &key)).await
}

#[tauri::command]
pub fn get_app_info(app: AppHandle) -> AppInfo {
    let pkg = app.package_info();
    about::app_info(&pkg.name, &pkg.version.to_string())
}

#[tauri::command]
pub async fn files_write_text(path: String, text: String) -> Result<String, AppError> {
    blocking(move || files::write(&path, text.as_bytes()).map(|()| files::display_name(&path)))
        .await
}

#[tauri::command]
pub async fn files_write_bytes(path: String, bytes: Vec<u8>) -> Result<String, AppError> {
    blocking(move || files::write(&path, &bytes).map(|()| files::display_name(&path))).await
}

#[tauri::command]
pub async fn files_read_text(path: String) -> Result<String, AppError> {
    blocking(move || files::read_text(&path)).await
}

/// Replaces the native menu bar (validated spec from the frontend's menu model).
#[tauri::command]
pub fn set_app_menu(app: AppHandle, spec: MenuSpec) -> Result<(), AppError> {
    app_menu::validate(&spec)?;
    let menu =
        app_menu::build(&app, &spec).map_err(|e| AppError::new("invalid_menu", e.to_string()))?;
    app.set_menu(menu)
        .map(|_| ())
        .map_err(|e| AppError::new("invalid_menu", e.to_string()))
}
