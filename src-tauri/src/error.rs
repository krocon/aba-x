//! Errors that cross the IPC boundary: `{ code, message }` (camelCase like every DTO).

use serde::Serialize;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppError {
    /// Stable, machine-readable code (`invalid_key`, `io`, `corrupt`, `newer_schema`, …).
    pub code: &'static str,
    /// Human-readable detail for logs; the frontend shows its own text per code.
    pub message: String,
}

impl AppError {
    pub fn new(code: &'static str, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }

    pub fn io(err: &std::io::Error) -> Self {
        Self::new("io", err.to_string())
    }
}

impl std::fmt::Display for AppError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}: {}", self.code, self.message)
    }
}

impl std::error::Error for AppError {}
