import { open } from "@tauri-apps/plugin-dialog";
import { readFile } from "@tauri-apps/plugin-fs";
import { app, type ModelEntry } from "./stores.svelte";
import { t } from "./i18n";

export async function pickAndAddModel(
  isReference: boolean,
  path?: string
): Promise<ModelEntry | null> {
  const filePath = path || await open({
    multiple: false,
    filters: [{ name: "GLB / GLTF", extensions: ["glb", "gltf"] }],
  });
  if (!filePath) return null;

  const bytes = await readFile(filePath);
  const ext = filePath.split(".").pop()?.toLowerCase();
  const mime = ext === "glb" ? "model/gltf-binary" : "model/gltf+json";
  const blob = new Blob([bytes], { type: mime });
  const url = URL.createObjectURL(blob);

  const filename = filePath.split(/[\\/]/).pop() ?? "model";
  const entry: ModelEntry = {
    id: crypto.randomUUID(),
    name: filename,
    url,
    filePath,
    isReference,
    visible: true,
    animations: [],
  };
  app.addModel(entry);
  app.setStatus(t("status.loading", { name: filename }), "success");
  return entry;
}

export async function pickExportDir(): Promise<string | null> {
  const dir = await open({ directory: true });
  if (!dir) return null;
  app.exportDir = dir as string;
  app.setStatus(t("status.exportDirSet", { dir: dir as string }), "success");
  return dir as string;
}

export async function pickLocalModelsDir(): Promise<string | null> {
  const dir = await open({ directory: true });
  if (!dir) return null;
  app.localModelsDir = dir as string;
  return dir as string;
}
