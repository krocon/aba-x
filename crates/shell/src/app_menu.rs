//! Native menu bar from a spec of the frontend (design 002, like FnF `app_menu.rs`): the menu model
//! lives in TypeScript (one model for the native and the HTML menu), Rust validates and builds it
//! and reports clicks as the event `menu` with the item id.

use std::collections::HashSet;

use serde::Deserialize;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{AppHandle, Runtime};

use crate::error::AppError;

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct MenuSpec {
    pub submenus: Vec<SubmenuSpec>,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SubmenuSpec {
    pub label: String,
    pub items: Vec<ItemSpec>,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum ItemSpec {
    Action {
        id: String,
        label: String,
        accelerator: Option<String>,
    },
    Separator,
    /// OS-provided items: undo, redo, cut, copy, paste, selectAll, hide, hideOthers, showAll,
    /// minimize, fullscreen, quit.
    Predefined {
        which: String,
    },
}

const PREDEFINED: &[&str] = &[
    "undo",
    "redo",
    "cut",
    "copy",
    "paste",
    "selectAll",
    "hide",
    "hideOthers",
    "showAll",
    "minimize",
    "fullscreen",
    "quit",
];

/// Checks labels, ids (unique, `[A-Za-z0-9-]{1,40}`) and predefined names.
pub fn validate(spec: &MenuSpec) -> Result<(), AppError> {
    let bad = |m: String| Err(AppError::new("invalid_menu", m));
    if spec.submenus.is_empty() || spec.submenus.len() > 12 {
        return bad("1–12 submenus expected".into());
    }
    let mut ids = HashSet::new();
    for sub in &spec.submenus {
        if sub.label.trim().is_empty() {
            return bad("empty submenu label".into());
        }
        for item in &sub.items {
            match item {
                ItemSpec::Action { id, label, .. } => {
                    let id_ok = !id.is_empty()
                        && id.len() <= 40
                        && id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-');
                    if !id_ok {
                        return bad(format!("invalid id {id:?}"));
                    }
                    if label.trim().is_empty() {
                        return bad(format!("empty label for {id}"));
                    }
                    if !ids.insert(id.clone()) {
                        return bad(format!("duplicate id {id}"));
                    }
                }
                ItemSpec::Predefined { which } if !PREDEFINED.contains(&which.as_str()) => {
                    return bad(format!("unknown predefined item {which}"));
                }
                _ => {}
            }
        }
    }
    Ok(())
}

pub fn build<R: Runtime>(app: &AppHandle<R>, spec: &MenuSpec) -> tauri::Result<Menu<R>> {
    let menu = Menu::new(app)?;
    for sub in &spec.submenus {
        let submenu = Submenu::new(app, &sub.label, true)?;
        for item in &sub.items {
            match item {
                ItemSpec::Action {
                    id,
                    label,
                    accelerator,
                } => {
                    let it = MenuItem::with_id(app, id, label, true, accelerator.as_deref())?;
                    submenu.append(&it)?;
                }
                ItemSpec::Separator => submenu.append(&PredefinedMenuItem::separator(app)?)?,
                ItemSpec::Predefined { which } => {
                    let it = match which.as_str() {
                        "undo" => PredefinedMenuItem::undo(app, None)?,
                        "redo" => PredefinedMenuItem::redo(app, None)?,
                        "cut" => PredefinedMenuItem::cut(app, None)?,
                        "copy" => PredefinedMenuItem::copy(app, None)?,
                        "paste" => PredefinedMenuItem::paste(app, None)?,
                        "selectAll" => PredefinedMenuItem::select_all(app, None)?,
                        "hide" => PredefinedMenuItem::hide(app, None)?,
                        "hideOthers" => PredefinedMenuItem::hide_others(app, None)?,
                        "showAll" => PredefinedMenuItem::show_all(app, None)?,
                        "minimize" => PredefinedMenuItem::minimize(app, None)?,
                        "fullscreen" => PredefinedMenuItem::fullscreen(app, None)?,
                        _ => PredefinedMenuItem::quit(app, None)?,
                    };
                    submenu.append(&it)?;
                }
            }
        }
        menu.append(&submenu)?;
    }
    Ok(menu)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn action(id: &str) -> ItemSpec {
        ItemSpec::Action {
            id: id.into(),
            label: "Label".into(),
            accelerator: None,
        }
    }

    fn spec(items: Vec<ItemSpec>) -> MenuSpec {
        MenuSpec {
            submenus: vec![SubmenuSpec {
                label: "File".into(),
                items,
            }],
        }
    }

    #[test]
    fn accepts_a_normal_menu_and_parses_camel_case_json() {
        let json = r#"{"submenus":[{"label":"Edit","items":[{"kind":"predefined","which":"copy"},{"kind":"separator"},{"kind":"action","id":"copy-result","label":"Copy result","accelerator":"CmdOrCtrl+Shift+C"}]}]}"#;
        let s: MenuSpec = serde_json::from_str(json).unwrap();
        assert!(validate(&s).is_ok());
    }

    #[test]
    fn rejects_bad_ids_duplicates_and_unknown_predefined_items() {
        assert!(validate(&spec(vec![action("a b")])).is_err());
        assert!(validate(&spec(vec![action("a"), action("a")])).is_err());
        let p = ItemSpec::Predefined {
            which: "format-disk".into(),
        };
        assert!(validate(&spec(vec![p])).is_err());
        assert!(validate(&MenuSpec { submenus: vec![] }).is_err());
    }
}
