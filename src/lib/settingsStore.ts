import { LazyStore } from "@tauri-apps/plugin-store";
import type { AppLanguage } from "./stores.svelte";

/**
 * Единый store для настроек приложения.
 * Файл будет лежать в app_data_dir/settings.json.
 */
export const settingsStore = new LazyStore("settings.json");

/** Ключ, под которым хранится весь объект настроек. */
const SETTINGS_KEY = "app-settings";

export interface PersistedSettings {
  llmConfig: {
    provider: string;
    baseURL: string;
    apiKey: string;
    model: string;
  };
  localModelsDir: string;
  exportDir: string;
  localApiUrl: string;
  localApiPort: number;
  selectedModelPath: string;
  maxVertsPerNode: number;
  language: AppLanguage;
}

export async function loadSettingsFromStore(): Promise<Partial<PersistedSettings>> {
  const data = await settingsStore.get<Partial<PersistedSettings>>(SETTINGS_KEY);
  return data ?? {};
}

export async function saveSettingsToStore(
  settings: PersistedSettings
): Promise<void> {
  await settingsStore.set(SETTINGS_KEY, settings);
  await settingsStore.save();
}
