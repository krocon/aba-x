//! Persistence of the desktop app: one JSON document per key in the app data folder.
//!
//! The frontend owns the shape and the schema version of every document (`StorageApi`, the web
//! variant keeps the same documents in IndexedDB). This module only guarantees safe file
//! handling: validated keys (no paths), a size limit, atomic replacement (temp file + rename) and
//! a broken file that is set aside as `<key>.json.bad` instead of being lost or crashing the app.
//! Pure std – no Tauri, so everything is tested with a temp directory.

use std::fs::{self, File};
use std::io::Write;
use std::path::{Path, PathBuf};

use serde::Serialize;
use serde_json::Value;

use crate::error::AppError;

/// Upper bound for one document (history and saved functions stay far below).
pub const MAX_DOC_BYTES: usize = 8 * 1024 * 1024;

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LoadedDoc {
    /// `None` when the document does not exist (yet) or was set aside.
    pub value: Option<Value>,
    /// File name of the broken file that was moved aside, so the UI can tell the user.
    pub set_aside: Option<String>,
}

/// `a-z`, digits and `-`, starting with a letter, at most 32 characters – never a path.
pub fn validate_key(key: &str) -> Result<(), AppError> {
    let mut chars = key.chars();
    let ok = key.len() <= 32
        && chars.next().is_some_and(|c| c.is_ascii_lowercase())
        && chars.all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-');
    if ok {
        Ok(())
    } else {
        Err(AppError::new("invalid_key", format!("invalid key {key:?}")))
    }
}

fn doc_path(dir: &Path, key: &str) -> PathBuf {
    dir.join(format!("{key}.json"))
}

pub fn load(dir: &Path, key: &str) -> Result<LoadedDoc, AppError> {
    validate_key(key)?;
    let path = doc_path(dir, key);
    let bytes = match fs::read(&path) {
        Ok(b) => b,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
            return Ok(LoadedDoc {
                value: None,
                set_aside: None,
            });
        }
        Err(e) => return Err(AppError::io(&e)),
    };
    match serde_json::from_slice::<Value>(&bytes) {
        Ok(value) => Ok(LoadedDoc {
            value: Some(value),
            set_aside: None,
        }),
        Err(_) => {
            let bad = dir.join(format!("{key}.json.bad"));
            fs::rename(&path, &bad).map_err(|e| AppError::io(&e))?;
            Ok(LoadedDoc {
                value: None,
                set_aside: Some(format!("{key}.json.bad")),
            })
        }
    }
}

pub fn save(dir: &Path, key: &str, value: &Value) -> Result<(), AppError> {
    validate_key(key)?;
    let bytes = serde_json::to_vec_pretty(value).map_err(|e| AppError::new("io", e.to_string()))?;
    if bytes.len() > MAX_DOC_BYTES {
        return Err(AppError::new(
            "too_large",
            format!("{key}: {} bytes > {MAX_DOC_BYTES}", bytes.len()),
        ));
    }
    fs::create_dir_all(dir).map_err(|e| AppError::io(&e))?;
    write_atomic(&doc_path(dir, key), &bytes).map_err(|e| AppError::io(&e))
}

pub fn remove(dir: &Path, key: &str) -> Result<(), AppError> {
    validate_key(key)?;
    match fs::remove_file(doc_path(dir, key)) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(AppError::io(&e)),
    }
}

/// Temp file in the same folder, flushed to disk, then renamed over the target (replaces it on
/// every OS). A crash leaves either the old or the new document, never half of one.
fn write_atomic(path: &Path, bytes: &[u8]) -> std::io::Result<()> {
    let tmp = path.with_extension("json.tmp");
    {
        let mut f = File::create(&tmp)?;
        f.write_all(bytes)?;
        f.sync_all()?;
    }
    fs::rename(&tmp, path).inspect_err(|_| {
        let _ = fs::remove_file(&tmp);
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn keys_are_never_paths() {
        for ok in ["settings", "history", "a", "saved-functions-2"] {
            assert!(validate_key(ok).is_ok(), "{ok}");
        }
        for bad in [
            "",
            "../x",
            "a/b",
            "a\\b",
            "Settings",
            "1x",
            "-x",
            "x.json",
            "ä",
            &"x".repeat(33),
        ] {
            assert_eq!(validate_key(bad).unwrap_err().code, "invalid_key", "{bad}");
        }
    }

    #[test]
    fn missing_document_is_none() {
        let dir = tempfile::tempdir().unwrap();
        let doc = load(dir.path(), "settings").unwrap();
        assert_eq!(doc.value, None);
        assert_eq!(doc.set_aside, None);
    }

    #[test]
    fn save_then_load_round_trips_unicode() {
        let dir = tempfile::tempdir().unwrap();
        let sub = dir.path().join("not yet created");
        let value = json!({ "schemaVersion": 1, "expr": "∫₀¹ x² dx", "n": [1.5, -2] });
        save(&sub, "history", &value).unwrap();
        assert_eq!(load(&sub, "history").unwrap().value, Some(value));
        assert!(!sub.join("history.json.tmp").exists());
    }

    #[test]
    fn save_replaces_the_previous_document() {
        let dir = tempfile::tempdir().unwrap();
        save(dir.path(), "settings", &json!({ "a": 1 })).unwrap();
        save(dir.path(), "settings", &json!({ "a": 2 })).unwrap();
        assert_eq!(
            load(dir.path(), "settings").unwrap().value,
            Some(json!({ "a": 2 }))
        );
    }

    #[test]
    fn broken_file_is_set_aside() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join("settings.json"), b"{ not json").unwrap();
        let doc = load(dir.path(), "settings").unwrap();
        assert_eq!(doc.value, None);
        assert_eq!(doc.set_aside.as_deref(), Some("settings.json.bad"));
        assert!(dir.path().join("settings.json.bad").exists());
        assert!(!dir.path().join("settings.json").exists());
        // the next load starts clean
        assert_eq!(load(dir.path(), "settings").unwrap().set_aside, None);
    }

    #[test]
    fn too_large_is_refused_and_keeps_the_old_document() {
        let dir = tempfile::tempdir().unwrap();
        save(dir.path(), "history", &json!([1])).unwrap();
        let big = json!("x".repeat(MAX_DOC_BYTES));
        assert_eq!(
            save(dir.path(), "history", &big).unwrap_err().code,
            "too_large"
        );
        assert_eq!(load(dir.path(), "history").unwrap().value, Some(json!([1])));
    }

    #[test]
    fn remove_is_idempotent() {
        let dir = tempfile::tempdir().unwrap();
        save(dir.path(), "settings", &json!({})).unwrap();
        remove(dir.path(), "settings").unwrap();
        remove(dir.path(), "settings").unwrap();
        assert_eq!(load(dir.path(), "settings").unwrap().value, None);
    }
}
