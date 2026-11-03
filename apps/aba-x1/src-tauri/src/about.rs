//! Data for the About dialog: version (tauri.conf.json → package.json) and platform.

use serde::Serialize;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppInfo {
    pub name: String,
    pub version: String,
    pub os: &'static str,
    pub arch: &'static str,
}

pub fn app_info(name: &str, version: &str) -> AppInfo {
    AppInfo {
        name: name.to_owned(),
        version: version.to_owned(),
        os: std::env::consts::OS,
        arch: std::env::consts::ARCH,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reports_the_running_platform() {
        let info = app_info("ABA-X1", "1.2.3");
        assert_eq!(info.version, "1.2.3");
        assert_eq!(info.os, std::env::consts::OS);
        assert!(!info.arch.is_empty());
    }
}
