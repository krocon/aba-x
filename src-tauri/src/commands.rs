//! Thin command layer: resolve the app data folder, run the blocking file work off the async
//! runtime, hand everything else to the pure modules.

use std::path::PathBuf;

use serde_json::Value;
use tauri::{AppHandle, Manager};

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
