import { invoke } from "@tauri-apps/api/core";
import { relaunch } from "@tauri-apps/plugin-process";
import { check } from "@tauri-apps/plugin-updater";

// =====================================================================
//  ЭКСПОРТ GLB
// =====================================================================

export interface ExportNode {
  name: string;
  positions: number[];
  indices: number[];
  materialName: string;
}

export interface ExportChannel {
  nodeIndex: number;
  path: "translation" | "rotation" | "scale";
  times: number[];
  values: number[];
}

export interface ExportAnimation {
  name: string;
  channels: ExportChannel[];
}

export interface ExportPayload {
  outputDir: string;
  filename: string;
  nodes: ExportNode[];
  animations: ExportAnimation[];
}

export interface ConvertResult {
  outputPath: string;
  format: string;
}

export async function exportGlb(payload: ExportPayload): Promise<string> {
  return await invoke<string>("export_glb", { payload });
}

export async function convertModel(
  inputPath: string,
  format: string,
  outputDir: string,
  baseName: string
): Promise<ConvertResult> {
  return await invoke<ConvertResult>("convert_model", {
    payload: { inputPath, format, outputDir, baseName },
  });
}

// =====================================================================
//  ЛОКАЛЬНЫЕ МОДЕЛИ (.gguf)
// =====================================================================

export interface LocalModelInfo {
  name: string;
  path: string;
  sizeBytes: number;
}

export async function scanLocalModels(dir: string): Promise<LocalModelInfo[]> {
  return await invoke<LocalModelInfo[]>("scan_local_models", { dir });
}

// =====================================================================
//  ЗАПУСК LLM: SIDECAR (встроенный llama-server.exe)
// =====================================================================

export interface RunningProcessInfo {
  pid: number;
  kind: "sidecar" | "external";
  baseUrl: string;
}

export async function startLlamaSidecar(
  modelPath: string,
  port: number
): Promise<RunningProcessInfo> {
  return await invoke<RunningProcessInfo>("start_local_llm_sidecar", {
    modelPath,
    port,
  });
}

// =====================================================================
//  ЗАПУСК LLM: OLLAMA (внешний процесс)
// =====================================================================

export async function startOllama(
  modelName: string,
  port: number
): Promise<RunningProcessInfo> {
  return await invoke<RunningProcessInfo>("start_ollama", {
    modelName,
    port,
  });
}

// =====================================================================
//  ОСТАНОВКА ПРОЦЕССА (универсальная)
// =====================================================================

export async function stopLlmProcess(pid: number): Promise<void> {
  return await invoke("stop_llm_process", { pid });
}

// =====================================================================
//  ДИАГНОСТИКА
// =====================================================================

export interface LocalApiCheckResult {
  available: boolean;
  url: string;
  models: string[];
}

export async function listRunningProcesses(): Promise<number[]> {
  return await invoke<number[]>("list_running_processes");
}

export async function checkLocalApi(url: string): Promise<LocalApiCheckResult> {
  return await invoke<LocalApiCheckResult>("check_openai_compatible", { url });
}
// =====================================================================
//  ОБНОВЛЕНИЯ
// =====================================================================

export interface UpdateInfo {
  version: string;
  date: string;
  body: string;
}

export async function checkForUpdate(): Promise<UpdateInfo | null> {
  const update = await check();
  if (!update) return null;
  return {
    version: update.version,
    date: update.date ?? "",
    body: update.body ?? "",
  };
}

export async function downloadAndInstallUpdate(
  onProgress: (percent: number) => void
): Promise<void> {
  const update = await check();
  if (!update) throw new Error("No update available");

  let downloaded = 0;
  let contentLength = 0;

  await update.downloadAndInstall((event) => {
    switch (event.event) {
      case "Started":
        contentLength = event.data.contentLength ?? 0;
        onProgress(0);
        break;
      case "Progress":
        downloaded += event.data.chunkLength;
        if (contentLength > 0) {
          onProgress(Math.round((downloaded / contentLength) * 100));
        }
        break;
      case "Finished":
        onProgress(100);
        break;
    }
  });

  await relaunch();
}
