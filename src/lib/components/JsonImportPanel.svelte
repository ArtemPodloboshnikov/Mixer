<script lang="ts">
  import { app, type ModelEntry } from "$lib/stores.svelte";
  import { t } from "$lib/i18n";
  import { buildGlbBytes, exportGlb, type ExportPayload } from "$lib/tauriApi";

  let jsonText = $state("");
  let parsedManifest = $state<any | null>(null);
  let validationError = $state<string | null>(null);
  let saving = $state(false);
  let previewModelId = $state<string | null>(null);

  const PLACEHOLDER = `{
    "nodes": [
      {
        "name": "cube",
        "positions": [
          -1,-1, 1,   1,-1, 1,   1, 1, 1,  -1, 1, 1,
           1,-1,-1,  -1,-1,-1,  -1, 1,-1,   1, 1,-1,
          -1,-1,-1,  -1,-1, 1,  -1, 1, 1,  -1, 1,-1,
           1,-1, 1,   1,-1,-1,   1, 1,-1,   1, 1, 1,
          -1, 1, 1,   1, 1, 1,   1, 1,-1,  -1, 1,-1,
          -1,-1,-1,   1,-1,-1,   1,-1, 1,  -1,-1, 1
        ],
        "indices": [
           0, 1, 2,   0, 2, 3,
           4, 5, 6,   4, 6, 7,
           8, 9,10,   8,10,11,
          12,13,14,  12,14,15,
          16,17,18,  16,18,19,
          20,21,22,  20,22,23
        ],
        "materialName": "default"
      }
    ],
    "animations": [
        {
          "name": "spin",
          "channels": [
            {
              "nodeIndex": 0,
              "path": "rotation",
              "times": [0.0, 1.0, 2.0, 3.0, 4.0],
              "values": [
                0.0, 0.0, 0.0, 1.0,
                0.0, 0.3826834, 0.0, 0.9238795,
                0.0, 0.7071068, 0.0, 0.7071068,
                0.0, 0.9238795, 0.0, 0.3826834,
                0.0, 1.0, 0.0, 0.0
              ]
            },
            {
              "nodeIndex": 0,
              "path": "translation",
              "times": [0.0, 1.0, 2.0, 3.0, 4.0],
              "values": [
                0.0, 0.0, 0.0,
                0.0, 0.5, 0.0,
                0.0, 1.0, 0.0,
                0.0, 0.5, 0.0,
                0.0, 0.0, 0.0
              ]
            }
          ]
        }
      ]
  }`;

  // ============================================================
  //  ВАЛИДАЦИЯ
  // ============================================================
  function validateManifest(data: any): string | null {
    if (!data || typeof data !== "object") {
      return t("json.err.notObject");
    }
    if (!Array.isArray(data.nodes)) {
      return t("json.err.nodesMissing");
    }
    if (data.nodes.length === 0) {
      return t("json.err.nodesEmpty");
    }

    for (let i = 0; i < data.nodes.length; i++) {
      const n = data.nodes[i];
      if (typeof n !== "object" || n === null) {
        return t("json.err.nodeNotObject", { i });
      }
      if (typeof n.name !== "string") {
        return t("json.err.nodeName", { i });
      }
      if (!Array.isArray(n.positions)) {
        return t("json.err.nodePositionsArray", { i });
      }
      if (!Array.isArray(n.indices)) {
        return t("json.err.nodeIndicesArray", { i });
      }
      if (n.positions.length % 3 !== 0) {
        return t("json.err.positionsLength", { i });
      }
      if (n.indices.length % 3 !== 0) {
        return t("json.err.indicesLength", { i });
      }
      if (n.positions.some((v: any) => typeof v !== "number")) {
        return t("json.err.positionsNumbers", { i });
      }
      if (n.indices.some((v: any) => typeof v !== "number")) {
        return t("json.err.indicesNumbers", { i });
      }
    }

    if (data.animations !== undefined && !Array.isArray(data.animations)) {
      return t("json.err.animationsArray");
    }

    return null;
  }

  // ============================================================
  //  ПАРСИНГ + PREVIEW
  // ============================================================
  async function parseInput() {
    validationError = null;
    parsedManifest = null;

    // Убираем предыдущее превью, чтобы не висело в сцене
    removePreview();

    if (!jsonText.trim()) {
      validationError = t("json.empty");
      return;
    }

    let data: any;
    try {
      let cleaned = jsonText.trim();
      cleaned = cleaned
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/```\s*$/i, "")
        .trim();
      const first = cleaned.indexOf("{");
      const last = cleaned.lastIndexOf("}");
      if (first !== -1 && last > first) cleaned = cleaned.slice(first, last + 1);

      data = JSON.parse(cleaned);
    } catch (e: any) {
      validationError = t("json.err.parse", { msg: e?.message ?? String(e) });
      app.setStatus(validationError, "error");
      return;
    }

    const err = validateManifest(data);
    if (err) {
      validationError = err;
      app.setStatus(err, "error");
      return;
    }

    parsedManifest = data;
    app.setStatus(t("json.valid"), "success");

    // Сразу собираем превью в памяти
    await buildPreview(data);
  }

  function makePayload(data: any, filename: string): ExportPayload {
    return {
      outputDir: "",
      filename,
      nodes: data.nodes.map((n: any) => ({
        name: n.name,
        positions: n.positions,
        indices: n.indices,
        materialName: n.materialName ?? "default",
      })),
      animations: (data.animations ?? []).map((a: any) => ({
        name: a.name,
        channels: (a.channels ?? []).map((c: any) => ({
          nodeIndex: c.nodeIndex,
          path: c.path,
          times: c.times,
          values: c.values,
        })),
      })),
    };
  }

  async function buildPreview(data: any) {
    try {
      const bytes = await buildGlbBytes(makePayload(data, "preview.glb"));
      const blob = new Blob([bytes], { type: "model/gltf-binary" });
      const url = URL.createObjectURL(blob);

      const entry: ModelEntry = {
        id: crypto.randomUUID(),
        name: t("json.previewName"),
        url,
        isReference: false,
        visible: true,
        animations: [],
      };

      app.addModel(entry);
      app.activeModelId = entry.id;
      previewModelId = entry.id;
      app.setStatus(t("json.previewReady"), "success");
    } catch (e: any) {
      app.setStatus(`${t("json.previewError")}: ${e?.message ?? e}`, "error");
    }
  }

  function removePreview() {
    if (!previewModelId) return;
    const idx = app.models.findIndex((m) => m.id === previewModelId);
    if (idx !== -1) {
      const [removed] = app.models.splice(idx, 1);
      URL.revokeObjectURL(removed.url);
      if (app.activeModelId === previewModelId) {
        app.activeModelId = app.models[0]?.id ?? null;
      }
    }
    previewModelId = null;
  }

  // ============================================================
  //  СОХРАНЕНИЕ
  // ============================================================
  async function saveGlb() {
    if (!parsedManifest) return;
    if (!app.exportDir) {
      app.setStatus(t("status.exportDirMissing"), "error");
      return;
    }

    saving = true;
    try {
      const payload = makePayload(
        parsedManifest,
        `imported_${Date.now()}.glb`
      );
      payload.outputDir = app.exportDir;

      const outPath = await exportGlb(payload);
      app.setStatus(t("json.saved", { path: outPath }), "success");

      // Убираем превью — оно уже сохранено на диск
      removePreview();
    } catch (e: any) {
      app.setStatus(`${t("json.saveError")}: ${e?.message ?? e}`, "error");
    } finally {
      saving = false;
    }
  }

  function clearInput() {
    removePreview();
    jsonText = "";
    parsedManifest = null;
    validationError = null;
  }

  function pasteExample() {
    removePreview();
    jsonText = PLACEHOLDER;
    parseInput();
  }

  // ============================================================
  //  СМЕНА ВКЛАДКИ — удаляем превью
  // ============================================================
  $effect(() => {
    // Реагируем на переключение вкладки: как только chatTab != "json",
    // снимаем превью со сцены
    if (app.chatTab !== "json") {
      removePreview();
    }
  });
</script>

<div class="json-panel glass">
  <header class="panel-header">
    <span class="title">{t("json.title")}</span>
    <div class="actions">
      <button class="btn btn-ghost small" onclick={pasteExample}>
        {t("json.example")}
      </button>
      <button class="btn btn-ghost small" onclick={clearInput}>
        {t("chat.clear")}
      </button>
    </div>
  </header>

  <textarea
    bind:value={jsonText}
    oninput={parseInput}
    placeholder={PLACEHOLDER}
    spellcheck="false"
    class="json-input"
  ></textarea>

  {#if validationError}
    <div class="status error">
      <span class="dot"></span>
      <span>{validationError}</span>
    </div>
  {:else if parsedManifest}
    <div class="status success">
      <span class="dot"></span>
      <span>{t("json.summary", { nodes: parsedManifest.nodes.length })}</span>
    </div>
  {/if}

  <div class="footer-actions">
    <button
      class="btn"
      onclick={saveGlb}
      disabled={!parsedManifest || saving}
    >
      {saving ? "…" : t("json.save")}
    </button>
  </div>
</div>

<style>
  .json-panel {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    padding: 14px;
    gap: 10px;
  }

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .title {
    font-weight: 600;
    color: var(--text-0);
    font-size: 13px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .actions {
    display: flex;
    gap: 6px;
  }

  .small {
    padding: 4px 10px;
    font-size: 12px;
  }

  .json-input {
    flex: 1;
    min-height: 200px;
    font-family: var(--font-mono);
    font-size: 12px;
    line-height: 1.5;
    padding: 10px 12px;
    border-radius: 10px;
    resize: none;
    white-space: pre;
    overflow: auto;
  }

  .status {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    border-radius: 8px;
    font-size: 12px;
    line-height: 1.4;
  }

  .status.success {
    background: rgba(74, 223, 159, 0.08);
    border: 1px solid rgba(74, 223, 159, 0.25);
    color: var(--success);
  }

  .status.error {
    background: rgba(255, 74, 106, 0.08);
    border: 1px solid rgba(255, 74, 106, 0.25);
    color: var(--danger);
  }

  .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: currentColor;
    box-shadow: 0 0 8px currentColor;
    flex-shrink: 0;
  }

  .footer-actions {
    display: flex;
    gap: 6px;
  }

  .footer-actions button {
    flex: 1;
  }
</style>
