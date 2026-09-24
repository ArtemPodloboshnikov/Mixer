<script lang="ts">
  import { app } from "$lib/stores.svelte";
  import { pickAndAddModel } from "$lib/modelLoader";
  import { convertModel } from "$lib/tauriApi";
  import { t } from "$lib/i18n";
  import Dropdown from "./Dropdown.svelte";

  const formats = ["glb", "gltf", "obj", "ply", "stl"];
  let targetFormat = $state("obj");
  let converting = $state(false);

  async function add(isRef: boolean) {
    try {
      await pickAndAddModel(isRef);
    } catch (e: any) {
      app.setStatus(`${t("status.loadingError")}: ${e?.message ?? e}`, "error");
    }
  }

  async function doConvert() {
    const model = app.activeModel;
    if (!model) {
      app.setStatus(t("status.select3DModelFirst"), "error");
      return;
    }
    if (!model.filePath) {
      app.setStatus(t("status.convertNoPath"), "error");
      return;
    }
    if (!app.exportDir) {
      app.setStatus(t("status.exportDirMissing"), "error");
      return;
    }
    if (targetFormat === "glb") {
      // GLB уже есть — нечего конвертировать
      app.setStatus(t("status.convertSameFormat"), "info");
      return;
    }

    converting = true;
    app.setStatus(t("status.converting"), "info");

    try {
      const baseName = model.name.replace(/\.[^.]+$/, "");
      const result = await convertModel(
        model.filePath,
        targetFormat,
        app.exportDir,
        baseName
      );
      app.setStatus(
        t("status.convertSuccess", { path: result.outputPath }),
        "success"
      );
    } catch (e: any) {
      app.setStatus(
        t("status.convertError", { msg: e?.message ?? String(e) }),
        "error"
      );
    } finally {
      converting = false;
    }
  }
</script>

<div class="model-list glass">
  <header>
    <h3>{t("models.title")}</h3>
    <div class="actions">
      <button class="btn small" onclick={() => add(false)}>
        {t("models.addObject")}
      </button>
      <button class="btn btn-ghost small" onclick={() => add(true)}>
        {t("models.addReference")}
      </button>
    </div>
  </header>

  <div class="items scrollable">
    {#if app.models.length === 0}
      <div class="empty">{t("models.empty")}</div>
    {/if}

    {#each app.models as model (model.id)}
      <div
        class="item"
        class:active={model.id === app.activeModelId}
        role="button"
        tabindex="0"
        onclick={() => (app.activeModelId = model.id)}
        onkeydown={(e) => e.key === "Enter" && (app.activeModelId = model.id)}
      >
        <div class="info">
          <div class="name" title={model.name}>{model.name}</div>
          <div class="meta">
            {#if model.isReference}
              <span class="tag ref">{t("models.tagReference")}</span>
            {/if}
            {#if model.animations.length}
              <span class="tag">
                {t("models.tagAnims", { n: model.animations.length })}
              </span>
            {/if}
          </div>
        </div>
        <button
          class="icon-btn"
          title={model.visible ? t("models.hide") : t("models.show")}
          onclick={(e) => {
            e.stopPropagation();
            model.visible = !model.visible;
            app.models = [...app.models];
          }}
        >
          {model.visible ? "👁" : "🚫"}
        </button>
        <button
          class="icon-btn danger"
          title={t("models.delete")}
          onclick={(e) => {
            e.stopPropagation();
            app.removeModel(model.id);
          }}
        >
          ✕
        </button>
      </div>
    {/each}
  </div>

  <!-- ===================== КОНВЕРТЕР ===================== -->
  <div class="converter">
    <div class="converter-label">{t("models.convertTo")}</div>
    <div class="converter-row">
      <Dropdown
        bind:value={targetFormat}
        options={formats}
        placeholder={t("models.format")}
        minWidth="90px"
        openDown
      />
      <button
        class="btn small convert-btn"
        onclick={doConvert}
        disabled={converting || !app.activeModel || !app.exportDir}
      >
        {converting ? "…" : t("models.convert")}
      </button>
    </div>
  </div>
</div>

<style>
  .model-list {
    display: flex;
    flex-direction: column;
    padding: 12px;
    gap: 10px;
    min-height: 140px;
    max-height: 260px;
    position: relative;
    z-index: 1;
  }

  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
  }

  h3 {
    margin: 0;
    font-size: 13px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-1);
    font-weight: 600;
  }

  .actions {
    display: flex;
    gap: 6px;
  }

  .small {
    padding: 4px 10px;
    font-size: 12px;
  }

  .items {
    display: flex;
    flex-direction: column;
    gap: 6px;
    flex: 1;
    min-height: 0;
  }

  .empty {
    color: var(--text-2);
    font-size: 12px;
    padding: 8px 4px;
    text-align: center;
  }

  .item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 10px;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.06);
    background: rgba(10, 8, 16, 0.4);
    cursor: pointer;
    transition: all 0.16s ease;
  }

  .item:hover {
    border-color: var(--glass-border-hover);
    background: rgba(255, 122, 26, 0.06);
  }

  .item.active {
    border-color: var(--orange-1);
    background: rgba(255, 122, 26, 0.12);
    box-shadow: 0 0 16px rgba(255, 122, 26, 0.20);
  }

  .info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .name {
    color: var(--text-0);
    font-size: 13px;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .meta {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }

  .tag.ref {
    background: rgba(255, 122, 26, 0.15);
    border-color: rgba(255, 122, 26, 0.30);
    color: var(--orange-2);
  }

  .icon-btn {
    background: transparent;
    border: none;
    color: var(--text-2);
    font-size: 14px;
    padding: 4px 6px;
    border-radius: 6px;
    line-height: 1;
  }

  .icon-btn:hover {
    background: rgba(255, 255, 255, 0.06);
    color: var(--text-0);
  }

  .icon-btn.danger:hover {
    color: var(--danger);
    background: rgba(255, 74, 106, 0.12);
  }

  .converter {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding-top: 10px;
    border-top: 1px solid rgba(255, 255, 255, 0.05);
    margin-top: 4px;
  }

  .converter-label {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-2);
    font-weight: 600;
  }

  .converter-row {
    display: flex;
    gap: 6px;
    align-items: stretch;
  }

  .converter-row :global(.dropdown) {
    flex: 0 0 auto;
  }

  .convert-btn {
    flex: 1;
    min-width: 0;
  }
</style>
