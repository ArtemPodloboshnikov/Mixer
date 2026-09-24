use parking_lot::Mutex;
use serde::Serialize;
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use std::process::{Child, Command, Stdio};
use std::sync::OnceLock;
use std::time::Duration;
use tauri::Manager;
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;

// =====================================================================
//  СТРУКТУРЫ ДЛЯ ФРОНТЕНДА
// =====================================================================

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalModelInfo {
    pub name: String,
    pub path: String,
    #[serde(rename = "sizeBytes")]
    pub size_bytes: u64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RunningProcessInfo {
    pub pid: u32,
    /// "sidecar" для llama-server.exe, "external" для Ollama
    pub kind: String,
    /// Базовый URL для OpenAI-совместимого API
    pub base_url: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalApiCheckResult {
    pub available: bool,
    pub url: String,
    /// Список моделей, если сервер вернул его в /v1/models
    pub models: Vec<String>,
}

// =====================================================================
//  СОСТОЯНИЕ ПРОЦЕССОВ
// =====================================================================

static EXTERNAL_PROCESSES: OnceLock<Mutex<HashMap<u32, Child>>> = OnceLock::new();
static SIDECAR_PROCESSES: OnceLock<Mutex<HashMap<u32, CommandChild>>> = OnceLock::new();

fn external_processes() -> &'static Mutex<HashMap<u32, Child>> {
    EXTERNAL_PROCESSES.get_or_init(|| Mutex::new(HashMap::new()))
}

fn sidecar_processes() -> &'static Mutex<HashMap<u32, CommandChild>> {
    SIDECAR_PROCESSES.get_or_init(|| Mutex::new(HashMap::new()))
}

// =====================================================================
//  СКАНИРОВАНИЕ GGUF-МОДЕЛЕЙ
// =====================================================================

#[tauri::command]
pub fn scan_local_models(dir: String) -> Result<Vec<LocalModelInfo>, String> {
    let path = Path::new(&dir);
    if !path.is_dir() {
        return Err(format!("Не директория: {}", dir));
    }

    let mut out: Vec<LocalModelInfo> = Vec::new();
    let entries = fs::read_dir(path).map_err(|e| e.to_string())?;

    for entry in entries.flatten() {
        let p = entry.path();
        if !p.is_file() {
            continue;
        }

        let ext = p
            .extension()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_lowercase();

        if ext != "gguf" {
            continue;
        }

        let meta = entry.metadata().map_err(|e| e.to_string())?;
        out.push(LocalModelInfo {
            name: p
                .file_name()
                .and_then(|s| s.to_str())
                .unwrap_or("unknown")
                .to_string(),
            path: p.to_string_lossy().to_string(),
            size_bytes: meta.len(),
        });
    }

    Ok(out)
}

// =====================================================================
//  ЗАПУСК LLAMA-SERVER КАК SIDECAR (только для локальных моделей)
// =====================================================================

#[tauri::command]
pub async fn start_local_llm_sidecar(
    app: tauri::AppHandle,
    model_path: String,
    port: u16,
) -> Result<RunningProcessInfo, String> {
    if !Path::new(&model_path).exists() {
        return Err(format!("Модель не найдена: {}", model_path));
    }

    let args: Vec<String> = vec![
        "-m".into(),
        model_path.clone(),
        "--port".into(),
        port.to_string(),
        "--host".into(),
        "127.0.0.1".into(),
        "-c".into(),
        "4096".into(),
    ];

    let sidecar = app
        .shell()
        .sidecar("llama-server")
        .map_err(|e| format!("Не удалось создать sidecar-команду: {}", e))?;

    let binaries_dir = app
        .path()
        .resource_dir()
        .map_err(|e| format!("Не удалось получить resource_dir: {}", e))?
        .join("binaries");

    println!("[debug] sidecar working dir: {:?}", binaries_dir);

    let (mut rx, child) = sidecar
        .current_dir(binaries_dir)
        .args(args)
        .spawn()
        .map_err(|e| format!("Не удалось запустить llama-server: {}", e))?;

    let pid = child.pid();
    sidecar_processes().lock().insert(pid, child);

    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(line_bytes) => {
                    let line = String::from_utf8_lossy(&line_bytes);
                    println!("[llama-server stdout] {}", line.trim());
                }
                CommandEvent::Stderr(line_bytes) => {
                    let line = String::from_utf8_lossy(&line_bytes);
                    eprintln!("[llama-server stderr] {}", line.trim());
                }
                CommandEvent::Error(err) => {
                    eprintln!("[llama-server error] {}", err);
                }
                CommandEvent::Terminated(payload) => {
                    println!("[llama-server terminated] code={:?}", payload.code);
                    break;
                }
                _ => {}
            }
        }
    });

    Ok(RunningProcessInfo {
        pid,
        kind: "sidecar".to_string(),
        base_url: format!("http://127.0.0.1:{}/v1", port),
    })
}

// =====================================================================
//  ЗАПУСК OLLAMA ЛОКАЛЬНО (только для локальной машины)
// =====================================================================

#[tauri::command]
pub fn start_ollama(_model_name: String, port: u16) -> Result<RunningProcessInfo, String> {
    let child = Command::new("ollama")
        .args(["serve"])
        .env("OLLAMA_HOST", format!("127.0.0.1:{}", port))
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| {
            format!(
                "Не удалось запустить ollama: {}. Проверьте, что Ollama установлена и доступна в PATH.",
                e
            )
        })?;

    let pid = child.id();
    external_processes().lock().insert(pid, child);

    Ok(RunningProcessInfo {
        pid,
        kind: "external".to_string(),
        base_url: format!("http://127.0.0.1:{}/v1", port),
    })
}

// =====================================================================
//  УНИВЕРСАЛЬНАЯ ПРОВЕРКА OpenAI-СОВМЕСТИМОГО СЕРВЕРА
// =====================================================================

/// Проверяет, отвечает ли OpenAI-совместимый сервер по указанному URL.
///
/// Подходит для:
/// - локальной Ollama (`http://127.0.0.1:11434`)
/// - локального LM Studio (`http://127.0.0.1:1234`)
/// - встроенного llama-server (`http://127.0.0.1:8080`)
/// - **удалённого сервера** (`http://192.168.1.100:11434` или `https://my-server.com`)
///
/// Возвращает `available` и список моделей, если сервер вернул `/v1/models`.
#[tauri::command]
pub async fn check_openai_compatible(url: String) -> LocalApiCheckResult {
    let base = url.trim_end_matches('/').to_string();
    let models_url = format!("{}/v1/models", base);

    let client = match reqwest::Client::builder()
        .timeout(Duration::from_secs(5))
        .build()
    {
        Ok(c) => c,
        Err(e) => {
            eprintln!("[check_openai_compatible] client build error: {}", e);
            return LocalApiCheckResult {
                available: false,
                url: base,
                models: vec![],
            };
        }
    };

    match client.get(&models_url).send().await {
        Ok(resp) => {
            if !resp.status().is_success() {
                return LocalApiCheckResult {
                    available: false,
                    url: base,
                    models: vec![],
                };
            }

            // Пытаемся вытащить список id моделей из ответа
            let mut models: Vec<String> = vec![];
            if let Ok(json) = resp.json::<serde_json::Value>().await {
                if let Some(arr) = json.get("data").and_then(|d| d.as_array()) {
                    for item in arr {
                        if let Some(id) = item.get("id").and_then(|v| v.as_str()) {
                            models.push(id.to_string());
                        }
                    }
                }
            }

            LocalApiCheckResult {
                available: true,
                url: base,
                models,
            }
        }
        Err(e) => {
            eprintln!("[check_openai_compatible] request error: {}", e);
            LocalApiCheckResult {
                available: false,
                url: base,
                models: vec![],
            }
        }
    }
}

// =====================================================================
//  ОСТАНОВКА ПРОЦЕССОВ
// =====================================================================

#[tauri::command]
pub fn stop_llm_process(pid: u32) -> Result<(), String> {
    if let Some(child) = sidecar_processes().lock().remove(&pid) {
        child.kill().map_err(|e| e.to_string())?;
        return Ok(());
    }

    if let Some(mut child) = external_processes().lock().remove(&pid) {
        child.kill().map_err(|e| e.to_string())?;
        let _ = child.wait();
        return Ok(());
    }

    Err(format!("Процесс не найден: {}", pid))
}

// =====================================================================
//  ДИАГНОСТИКА
// =====================================================================

#[tauri::command]
pub fn list_running_processes() -> Vec<u32> {
    let mut pids = Vec::new();
    pids.extend(sidecar_processes().lock().keys().copied());
    pids.extend(external_processes().lock().keys().copied());
    pids
}
