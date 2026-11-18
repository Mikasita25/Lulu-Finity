use serde_json::Value;
use std::{fs, io, path::Path};
use tauri::Url;

const TRANSFER_DIRS: &[&str] = &["media", "alert-sounds", "lulu-local-voices"];
const PROFILE_FILES: &[&str] = &[
    "economy.json",
    "rankings.json",
    "online-voice-catalog-v1.json",
    "tiktok-gift-catalog-cache.json",
];

pub fn migrate(source: &Path, target: &Path) -> io::Result<()> {
    let settings = source.join("settings.json");
    if target.exists() || !settings.is_file() {
        return Ok(());
    }
    let parent = target
        .parent()
        .ok_or_else(|| io::Error::other("Ruta de datos de Lulu Finity no válida."))?;
    fs::create_dir_all(parent)?;
    let staging = parent.join(".lulu-finity-rust-migration");
    if staging.exists() {
        fs::remove_dir_all(&staging)?;
    }
    fs::create_dir(&staging)?;
    let result = (|| {
        let mut settings: Value = serde_json::from_reader(fs::File::open(settings)?)
            .unwrap_or_else(|_| serde_json::json!({}));
        rebase_media(&mut settings, source, target);
        if let Some(settings) = settings.as_object_mut() {
            for field in ["overlayToken", "overlayRelaySecret", "activeHttpsSources"] {
                settings.remove(field);
            }
        }
        serde_json::to_writer_pretty(fs::File::create(staging.join("settings.json"))?, &settings)?;
        for name in PROFILE_FILES {
            let file = source.join(name);
            if file.is_file() {
                fs::copy(file, staging.join(name))?;
            }
        }
        for name in TRANSFER_DIRS {
            let dir = source.join(name);
            if dir.is_dir() {
                copy_tree(&dir, &staging.join(name))?;
            }
        }
        fs::rename(&staging, target)
    })();
    if result.is_err() {
        let _ = fs::remove_dir_all(staging);
    }
    result
}

fn copy_tree(source: &Path, target: &Path) -> io::Result<()> {
    fs::create_dir_all(target)?;
    for item in fs::read_dir(source)? {
        let item = item?;
        let kind = item.file_type()?;
        let destination = target.join(item.file_name());
        if kind.is_dir() {
            copy_tree(&item.path(), &destination)?;
        } else if kind.is_file() {
            fs::copy(item.path(), destination)?;
        }
    }
    Ok(())
}

fn rebase_media(value: &mut Value, source: &Path, target: &Path) {
    match value {
        Value::String(text) => {
            if let Some(file) = Url::parse(text)
                .ok()
                .and_then(|url| url.to_file_path().ok())
            {
                if let Some(to) = migrated_file(&file, source, target) {
                    if let Ok(url) = Url::from_file_path(to) {
                        *text = url.to_string();
                    }
                }
            } else if let Some(to) = migrated_file(Path::new(text), source, target) {
                *text = to.to_string_lossy().into_owned();
            }
        }
        Value::Array(values) => values
            .iter_mut()
            .for_each(|value| rebase_media(value, source, target)),
        Value::Object(values) => values
            .values_mut()
            .for_each(|value| rebase_media(value, source, target)),
        _ => {}
    }
}

fn migrated_file(file: &Path, source: &Path, target: &Path) -> Option<std::path::PathBuf> {
    let relative = file.strip_prefix(source).ok()?;
    let folder = relative.iter().next()?.to_str()?;
    TRANSFER_DIRS
        .contains(&folder)
        .then(|| target.join(relative))
}
