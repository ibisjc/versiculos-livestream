// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use tauri::{AppHandle, Emitter};
use std::sync::Mutex;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

pub struct AppState {
    pub reference: Mutex<String>,
}

#[tauri::command]
fn set_valor(app: AppHandle, state: tauri::State<AppState>, reference: String) {
    *state.reference.lock().unwrap() = reference.clone();
    app.emit("reference-event", reference).unwrap();
}

#[tauri::command]
fn get_valor(state: tauri::State<AppState>) -> String {
    state.reference.lock().unwrap().clone()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState {
            reference: Mutex::new(String::new()),
        })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet, set_valor, get_valor])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}