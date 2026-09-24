mod convert;
mod glb;
mod local_llm;

use glb::export_glb;
use local_llm::{
    check_llama_server_available, check_ollama_available, list_running_processes,
    scan_local_models, start_local_llm_sidecar, start_ollama, stop_llm_process,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            export_glb,
            scan_local_models,
            start_local_llm_sidecar,
            start_ollama,
            stop_llm_process,
            list_running_processes,
            check_ollama_available,
            check_llama_server_available,
            convert::convert_model,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
