import {
  loadSettingsFromStore,
  saveSettingsToStore,
  type PersistedSettings,
} from "./settingsStore";
import { t } from "./i18n";

export type AppLanguage = "ru" | "en";

export interface ModelEntry {
  id: string;
  name: string;
  url: string;
  filePath?: string;
  isReference: boolean;
  visible: boolean;
  animations: string[];
  description?: string;
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  streaming?: boolean;
}

export type LlmProvider =
  | "openai"
  | "anthropic"
  | "openrouter"
  | "llama-sidecar"
  | "ollama"
  | "lmstudio";

export interface LLMConfig {
  provider: LlmProvider;
  baseURL: string;
  apiKey: string;
  model: string;
}

export interface LocalModel {
  name: string;
  path: string;
  sizeBytes: number;
}

export type LlmMode = "external-api" | "ollama" | "llama-sidecar";

class AppState {
  /** Сколько вершин на ноду попадает в описание референса. */
  maxVertsPerNode = $state<number>(128);
  language = $state<AppLanguage>("ru");
  /** AbortController текущего запроса к LLM. null = нет активного запроса. */
  activeAbort = $state<AbortController | null>(null);
  models = $state<ModelEntry[]>([]);
  activeModelId = $state<string | null>(null);
  selectedAnimation = $state<string>("");
  playingByModel = $state<Record<string, boolean>>({});

  userInput = $state("");
  messages = $state<ChatMessage[]>([]);
  /** Кэш описаний моделей для передачи в LLM. */
  modelDescriptions = $state<Record<string, string>>({});

  llmConfig = $state<LLMConfig>({
    provider: "openai",
    baseURL: "https://api.openai.com/v1",
    apiKey: "",
    model: "gpt-4o-mini",
  });

  localModels = $state<LocalModel[]>([]);
  localModelsDir = $state<string>("");

  llmMode = $state<LlmMode>("external-api");

  /** PID запущенного процесса (для ollama или llama-server) */
  runningPid = $state<number | null>(null);

  /** Единый порт для локального OpenAI-совместимого сервера
   *  (Ollama: 11434, LM Studio: 1234, llama.cpp: 8080) */
  localApiPort = $state<number>(8080);

  /** Путь к выбранной .gguf-модели */
  selectedModelPath = $state<string>("");

  exportDir = $state<string>("");

  statusText = $state<string>("");
  statusKind = $state<"info" | "error" | "success">("info");

  /** Полный базовый URL локального сервера (всегда 127.0.0.1). */
  get localApiBase(): string {
    return `http://127.0.0.1:${this.localApiPort}`;
  }

  get activeModel(): ModelEntry | undefined {
    return this.models.find((m) => m.id === this.activeModelId);
  }

  get isGenerating(): boolean {
    return this.activeAbort !== null;
  }

  addModel(entry: ModelEntry) {
    this.models.push(entry);
    if (!this.activeModelId) this.activeModelId = entry.id;
  }

  removeModel(id: string) {
    const idx = this.models.findIndex((m) => m.id === id);
    if (idx === -1) return;
    const [removed] = this.models.splice(idx, 1);
    URL.revokeObjectURL(removed.url);
    if (this.activeModelId === id) {
      this.activeModelId = this.models[0]?.id ?? null;
    }
    const { [id]: _, ...rest } = this.modelDescriptions;
    this.modelDescriptions = rest;
  }

  setStatus(text: string, kind: "info" | "error" | "success" = "info") {
    this.statusText = text;
    this.statusKind = kind;
  }

  /** Сохраняет настройки в JSON-файл через плагин Store. */
  async saveSettings() {
    try {
      const data: PersistedSettings = {
        llmConfig: $state.snapshot(this.llmConfig) as PersistedSettings["llmConfig"],
        localModelsDir: this.localModelsDir,
        exportDir: this.exportDir,
        localApiPort: this.localApiPort,
        selectedModelPath: this.selectedModelPath,
        maxVertsPerNode: this.maxVertsPerNode,
        language: this.language,
      };
      await saveSettingsToStore(data);
      this.setStatus(t("status.settingsSaved"), "success");
    } catch (e: any) {
      this.setStatus(
        t("status.settingsSaveError", { msg: e?.message ?? String(e) }),
        "error"
      );
    }
  }

  /** Загружает настройки из JSON-файла при старте. */
  async loadSettings() {
    try {
      const data = await loadSettingsFromStore();
      if (data.llmConfig) Object.assign(this.llmConfig, data.llmConfig);
      if (data.localModelsDir) this.localModelsDir = data.localModelsDir;
      if (data.exportDir) this.exportDir = data.exportDir;
      if (data.localApiPort) this.localApiPort = data.localApiPort;
      if (data.selectedModelPath) this.selectedModelPath = data.selectedModelPath;
      if (data.maxVertsPerNode) this.maxVertsPerNode = data.maxVertsPerNode;
      if (data.language) this.language = data.language;
    } catch (e: any) {
      this.setStatus(
        t("status.settingsLoadError", { msg: e?.message ?? String(e) }),
        "error"
      );
    }
  }

  setModelDescription(id: string, description: string) {
    this.modelDescriptions = {
      ...this.modelDescriptions,
      [id]: description,
    };
  }

  isModelPlaying(id: string): boolean {
    return this.playingByModel[id] ?? true;
  }

  setModelPlaying(id: string, value: boolean) {
    this.playingByModel = { ...this.playingByModel, [id]: value };
  }
}

export const app = new AppState();
