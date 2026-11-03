//! Export/import files (design 002): the frontend asks the user for a path with the system
//! dialog, then hands it here. Paths must be absolute and name a file; writing is atomic, reading
//! is size-limited. Pure std, tested with a temp directory.

use std::fs;
use std::path::{Path, PathBuf};

use crate::error::AppError;
use crate::storage::write_atomic;

/// Upper bound for an imported file (export bundles stay far below).
pub const MAX_READ_BYTES: u64 = 16 * 1024 * 1024;

fn checked(path: &str) -> Result<PathBuf, AppError> {
    let p = PathBuf::from(path);
    if !p.is_absolute() || p.file_name().is_none() {
        return Err(AppError::new(
            "invalid_path",
            format!("not an absolute file path: {path}"),
        ));
    }
    Ok(p)
}

pub fn write(path: &str, bytes: &[u8]) -> Result<(), AppError> {
    let p = checked(path)?;
    if p.is_dir() {
        return Err(AppError::new("invalid_path", "the path is a folder"));
    }
    write_atomic(&p, bytes).map_err(|e| AppError::io(&e))
}

pub fn read_text(path: &str) -> Result<String, AppError> {
    let p = checked(path)?;
    let meta = fs::metadata(&p).map_err(|e| AppError::io(&e))?;
    if !meta.is_file() {
        return Err(AppError::new("invalid_path", "not a file"));
    }
    if meta.len() > MAX_READ_BYTES {
        return Err(AppError::new("too_large", format!("{} bytes", meta.len())));
    }
    let bytes = fs::read(&p).map_err(|e| AppError::io(&e))?;
    String::from_utf8(bytes).map_err(|_| AppError::new("not_text", "the file is not UTF-8 text"))
}

/// File name for messages ("saved aba-x-backup.json").
pub fn display_name(path: &str) -> String {
    Path::new(path)
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn writes_atomically_and_reads_back_unicode() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("Büro export.json");
        let p = path.to_str().unwrap();
        write(p, "{\"∫\":1}".as_bytes()).unwrap();
        write(p, "{\"∫\":2}".as_bytes()).unwrap();
        assert_eq!(read_text(p).unwrap(), "{\"∫\":2}");
        assert!(!dir.path().join("Büro export.json.tmp").exists());
        assert_eq!(display_name(p), "Büro export.json");
    }

    #[test]
    fn refuses_relative_paths_folders_and_binary() {
        assert_eq!(write("x.json", b"1").unwrap_err().code, "invalid_path");
        let dir = tempfile::tempdir().unwrap();
        let d = dir.path().to_str().unwrap();
        assert_eq!(write(d, b"1").unwrap_err().code, "invalid_path");
        assert_eq!(read_text(d).unwrap_err().code, "invalid_path");
        let bin = dir.path().join("b.png");
        fs::write(&bin, [0xff, 0xfe, 0x00]).unwrap();
        assert_eq!(
            read_text(bin.to_str().unwrap()).unwrap_err().code,
            "not_text"
        );
        let missing = dir.path().join("missing.json");
        assert_eq!(read_text(missing.to_str().unwrap()).unwrap_err().code, "io");
    }
}
