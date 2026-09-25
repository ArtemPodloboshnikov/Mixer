<script lang="ts">
  import { app, type LlmProvider } from "$lib/stores.svelte";
  import { pickExportDir, pickLocalModelsDir } from "$lib/modelLoader";
  import {
    scanLocalModels,
    startLlamaSidecar,
    startOllama,
    stopLlmProcess,
    type UpdateInfo,
    downloadAndInstallUpdate,
    checkForUpdate,
    checkLocalApi,
  } from "$lib/tauriApi";
    import { t } from "$lib/i18n";
    import Dropdown from "./Dropdown.svelte";
    import { onMount } from "svelte";
    import { getVersion } from "@tauri-apps/api/app";

  let { onClose, expanded = false }: { onClose?: () => void; expanded?: boolean } =
    $props();

  let currentVersion = $state("");
  let updateInfo = $state<UpdateInfo | null>(null);
  let checking = $state(false);
  let downloading = $state(false);
  let downloadPercent = $state(0);
  let providerChecking = $state(false);
  /** Список моделей, полученный от сервера после проверки подключения. */
  let availableModels = $state<string[]>([]);

  /** Показывать ли Dropdown — только если список не пуст. */
  const hasModelList = $derived(availableModels.length > 0);

  const providers: { value: LlmProvider; label: string; baseURL: string }[] = [
    {
      value: "openai",
      label: "OpenAI",
      baseURL: "https://api.openai.com/v1",
    },
    {
      value: "anthropic",
      label: "Anthropic (OpenAI-compat)",
      baseURL: "https://api.anthropic.com/v1",
    },
    {
      value: "openrouter",
      label: "OpenRouter",
      baseURL: "https://openrouter.ai/api/v1",
    },
    {
      value: "llama-sidecar",
      label: `llama.cpp (${t("common.builtin")})`,
      baseURL: "http://127.0.0.1:8080/v1",
    },
    {
      value: "ollama",
      label: `Ollama (${t("common.external")})`,
      baseURL: "http://127.0.0.1:11434/v1",
    },
    {
      value: "lmstudio",
      label: `LM Studio (${t("common.external")})`,
      baseURL: "http://127.0.0.1:1234/v1",
    }
  ];

  const serverPresets = [
    { name: "llama-server", port: 8080 },
    { name: "Ollama", port: 11434 },
    { name: "LM Studio", port: 1234 },
  ];

  async function checkUpdates() {
    checking = true;
    try {
      updateInfo = await checkForUpdate();
      if (!updateInfo) {
        app.setStatus(t("settings.upToDate"), "success");
      }
    } catch (e: any) {
      app.setStatus(
        t("settings.updateError", { msg: e?.message ?? String(e) }),
        "error"
      );
    } finally {
      checking = false;
    }
  }

  async function installUpdate() {
    if (!updateInfo) return;
    downloading = true;
    try {
      await downloadAndInstallUpdate((percent) => {
        downloadPercent = percent;
      });
    } catch (e: any) {
      app.setStatus(
        t("settings.updateError", { msg: e?.message ?? String(e) }),
        "error"
      );
      downloading = false;
    }
  }

  async function testProvider() {
    const url = app.llmConfig.baseURL.trim().replace(/\/+$/, "");
    if (!url) {
      app.setStatus(t("status.providerUrlEmpty"), "error");
      return;
    }

    providerChecking = true;
    app.setStatus(t("status.providerChecking", { url }), "info");

    try {
      // checkLocalApi ждёт базовый URL без /v1 — убираем суффикс
      const base = url.endsWith("/v1") ? url.slice(0, -3) : url;
      const result = await checkLocalApi(base);

      if (result.available) {
        // Сохраняем список моделей для Dropdown
        availableModels = result.models;

        // Если текущая модель не из списка — подставляем первую
        if (
          result.models.length > 0 &&
          !result.models.includes(app.llmConfig.model)
        ) {
          app.llmConfig.model = result.models[0];
        }

        app.setStatus(
          t("status.providerReachable", {
            url,
            count: result.models.length,
          }),
          "success"
        );
      } else {
        availableModels = [];
        app.setStatus(
          t("status.providerUnreachable", { url }),
          "error"
        );
      }
    } catch (e: any) {
      availableModels = [];
      app.setStatus(
        t("status.providerCheckError", { msg: e?.message ?? String(e) }),
        "error"
      );
    } finally {
      providerChecking = false;
    }
  }

  /** Является ли текущий провайдер локальным */
  function isLocalProvider(): boolean {
    return (
      app.llmConfig.provider === "llama-sidecar" ||
      app.llmConfig.provider === "ollama"
    );
  }

  function onProviderChange(value: LlmProvider) {
    const prov = providers.find((p) => p.value === value);
    app.llmConfig.provider = value;
    if (prov) app.llmConfig.baseURL = prov.baseURL;

    availableModels = [];
    // Локальные провайдеры не используют API-ключ
    if (isLocalProvider()) {
      app.llmConfig.apiKey = "";
    }
  }

  async function refreshLocalModels() {
    if (!app.localModelsDir) return;
    try {
      app.setStatus(t("status.scanning"), "info");
      const list = await scanLocalModels(app.localModelsDir);
      app.localModels = list;
      app.llmConfig.model = list[0].name;
      app.setStatus(t("status.modelsFound", { n: list.length }), "success");
    } catch (e: any) {
      app.setStatus(`${t("status.scanError")}: ${e?.message ?? e}`, "error");
    }
  }

  async function browseLocalModelsDir() {
    const dir = await pickLocalModelsDir();
    if (dir) await refreshLocalModels();
  }

  /** Запуск встроенного llama-server.exe как sidecar */
  async function launchSidecar() {
    if (!app.selectedModelPath) {
      app.setStatus(t("status.selectModelFirst"), "error");
      return;
    }
    try {
      const filename = app.selectedModelPath.split(/[\\/]/).pop() ?? "model";
      const modelName = filename.replace(/\.gguf$/i, "");

      const info = await startLlamaSidecar(app.selectedModelPath, app.localApiPort);
      app.runningPid = info.pid;
      app.llmConfig.provider = "llama-sidecar";
      app.llmConfig.baseURL = info.baseUrl;
      app.llmConfig.model = modelName;

      app.setStatus(t("status.sidecarReady", { pid: info.pid }), "success");
    } catch (e: any) {
      app.setStatus(`${t("status.sidecarError")}: ${e?.message ?? e}`, "error");
    }
  }

  /** Запуск внешнего OpenAI-совместимого сервера (Ollama) */
  async function launchLocalApi(provider: "ollama" | "lmstudio") {
    const base = app.localApiBase;

    app.setStatus(t("status.localApiChecking", { url: base }), "info");
    const ok = await checkLocalApi(base);

    if (!ok.available) {
      app.setStatus(
        t("status.localApiNotResponding", { url: base }),
        "error"
      );
      return;
    }

    app.llmConfig.provider = provider;
    app.llmConfig.baseURL = `${base}/v1`;

    if (ok.models.length > 0) {
      availableModels = ok.models;
      if (!ok.models.includes(app.llmConfig.model)) {
        app.llmConfig.model = ok.models[0];
      }
    }

    app.setStatus(
      t("status.localApiDetected", {
        url: base,
        count: ok.models.length,
      }),
      "success"
    );

    if (provider === "ollama" && app.runningPid == null) {
      try {
        const info = await startOllama(app.llmConfig.model, app.localApiPort);
        app.runningPid = info.pid;
        app.setStatus(
          t("status.ollamaStarted", { pid: info.pid }),
          "success"
        );
      } catch {}
    }
  }

  async function killProcess() {
    if (app.runningPid == null) return;
    try {
      await stopLlmProcess(app.runningPid);
      app.runningPid = null;
      app.setStatus(t("status.processStopped"), "info");
    } catch (e: any) {
      app.setStatus(`${t("status.stopError")}: ${e?.message ?? e}`, "error");
    }
  }

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024)
      return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  }

  onMount(async () => {
    try {
      currentVersion = await getVersion();
    } catch {
      currentVersion = "1.0.0";
    }
  });
</script>

<div class="settings-panel glass" class:expanded>
  <header>
    <h3>{t("nav.settings")}</h3>
    <div class="header-actions">
        <button class="btn small" onclick={() => app.saveSettings()}>
        💾 {t("common.save")}
        </button>
        {#if onClose && !expanded}
        <button class="btn btn-ghost small" onclick={onClose}>✕</button>
        {/if}
    </div>
  </header>

  <div class="scrollable content">
    <!-- ===================== ИНТЕРФЕЙС ===================== -->
    <section class="section">
        <div class="section-title">{t("settings.interface")}</div>

        <div class="field">
            <label class="label" for="language">{t("settings.language")}</label>
            <div class="lang-switch">
            <button
                class="lang-btn"
                class:active={app.language === "ru"}
                onclick={() => (app.language = "ru")}
            >
                {t("settings.languageRu")}
            </button>
            <button
                class="lang-btn"
                class:active={app.language === "en"}
                onclick={() => (app.language = "en")}
            >
                {t("settings.languageEn")}
            </button>
            </div>
        </div>
    </section>

    <!-- ===================== ПРОВАЙДЕР LLM ===================== -->
    <section class="section">
      <div class="section-title">{t("provider.title")}</div>

      <div class="field">
        <label class="label" for="provider">{t("provider.label")}</label>

        <Dropdown
          bind:value={app.llmConfig.provider}
          options={providers.map((p) => ({ value: p.value, label: p.label }))}
          placeholder={t("provider.label")}
          minWidth="100%"
          onChange={(v) => onProviderChange(v as LlmProvider)}
          openDown
        />
      </div>

      <div class="field">
        <label class="label" for="baseurl">{t("provider.baseURL")}</label>
        <input id="baseurl" bind:value={app.llmConfig.baseURL} />
      </div>

      <div class="field">
        <label class="label" for="apikey">{t("provider.apiKey")}</label>
        <input
          id="apikey"
          type="password"
          bind:value={app.llmConfig.apiKey}
          placeholder={isLocalProvider() ? t("provider.apiKeyPlaceholder") : "sk-..."}
          disabled={isLocalProvider()}
        />
      </div>

    {#if hasModelList}
      <div class="field">
        <label class="label" for="model">{t("provider.model")}</label>
          <Dropdown
            bind:value={app.llmConfig.model}
            options={availableModels}
            minWidth="100%"
            openDown
          />

          <div class="hint">
            {t("provider.modelsAvailable", { n: availableModels.length })}
          </div>
      </div>
    {/if}

      <div class="field">
        <button
          class="btn test-provider-btn"
          onclick={testProvider}
          disabled={providerChecking}
        >
          {providerChecking ? t("provider.testing") : t("provider.test")}
        </button>
        <div class="hint">{t("provider.testHint")}</div>
      </div>
    </section>

    <!-- ===================== ЛОКАЛЬНЫЕ МОДЕЛИ ===================== -->
    <section class="section">
      <div class="section-title">{t("local.title")}</div>

      <!-- Папка с .gguf -->
      <div class="field">
        <label class="label" for="localdir">{t("local.dir")}</label>
        <div class="row">
          <input
            id="localdir"
            bind:value={app.localModelsDir}
            placeholder="/path/to/models"
          />
          <button class="btn btn-ghost" onclick={browseLocalModelsDir}>…</button>
        </div>
      </div>

      {#if app.localModels.length > 0}
        <div class="models-list">
          {#each app.localModels as m}
            <div class="model-row" class:selected={app.selectedModelPath === m.path}>
              <div class="model-info">
                <div class="model-name">{m.name}</div>
                <div class="model-meta mono">{formatSize(m.sizeBytes)}</div>
              </div>
              <button
                class="btn small"
                onclick={() => (app.selectedModelPath = m.path)}
                disabled={app.runningPid != null}
              >
                ✓
              </button>
            </div>
          {/each}
        </div>
      {/if}

      <!-- ============ Порт и пресеты ============ -->
      <div class="field">
        <label class="label" for="localport">{t("local.port")}</label>
        <div class="port-row">
          {#each serverPresets as preset}
            <button
              class="btn btn-ghost port-preset"
              class:active={app.localApiPort === preset.port}
              onclick={() => app.localApiPort = preset.port}
              type="button"
            >
              {preset.name}
            </button>
          {/each}
          <input
            id="localport"
            type="number"
            min="1"
            max="65535"
            bind:value={app.localApiPort}
            class="port-input"
          />
        </div>
      </div>

      <!-- ============ Запуск ============ -->
      <div class="row">
        <button
          class="btn"
          onclick={launchSidecar}
          disabled={!app.selectedModelPath || app.runningPid != null}
        >
          ▶ llama-server
        </button>
        <button
          class="btn btn-ghost"
          onclick={() => launchLocalApi("ollama")}
          disabled={app.runningPid != null}
        >
          ▶ Ollama
        </button>
        <button
          class="btn btn-ghost"
          onclick={() => launchLocalApi("lmstudio")}
          disabled={app.runningPid != null}
        >
          ▶ LM Studio
        </button>
      </div>

      {#if app.runningPid != null}
        <div class="status-row">
          <span class="tag">{t("local.running", { pid: app.runningPid })}</span>
          <button class="btn btn-danger small" onclick={killProcess}>
            {t("local.stop")}
          </button>
        </div>
      {/if}
    </section>

    <!-- ===================== РЕФЕРЕНСЫ ===================== -->
    <section class="section">
      <div class="section-title">{t("settings.references")}</div>

      <div class="field">
        <label class="label" for="maxverts">{t("settings.maxVerts")}</label>
        <input
          id="maxverts"
          type="number"
          min="8"
          max="2048"
          step="8"
          bind:value={app.maxVertsPerNode}
        />
        <div class="hint">{t("settings.maxVertsHint")}</div>
      </div>
    </section>

    <!-- ===================== ЭКСПОРТ ===================== -->
    <section class="section">
      <div class="section-title">{t("export.title")}</div>

      <div class="field">
        <label class="label" for="exportdir">{t("export.dir")}</label>
        <div class="row">
          <input
            id="exportdir"
            bind:value={app.exportDir}
            placeholder="/path/to/output"
          />
          <button class="btn btn-ghost" onclick={pickExportDir}>…</button>
        </div>
      </div>
    </section>

    <!-- ===================== ОБНОВЛЕНИЯ ===================== -->
    <section class="section">
      <div class="section-title">{t("settings.updates")}</div>

      <div class="field">
        <span class="label">{t("settings.currentVersion")}</span>
        <div class="version-row">
          <span class="version-badge mono">v{currentVersion}</span>
          <button
            class="btn small"
            onclick={checkUpdates}
            disabled={checking || downloading}
          >
            {checking ? t("settings.checking") : t("settings.checkUpdate")}
          </button>
        </div>
      </div>

      {#if updateInfo}
        <div class="update-info">
          <div class="update-header">
            <span class="update-version">
              {t("settings.updateAvailable", { version: updateInfo.version })}
            </span>
          </div>

          {#if downloading}
            <div class="download-progress">
              <div class="download-bar">
                <div
                  class="download-fill"
                  style="width: {downloadPercent}%"
                ></div>
              </div>
              <span class="download-label">
                {t("settings.downloading", { percent: downloadPercent })}
              </span>
            </div>
          {:else}
            <button class="btn" onclick={installUpdate}>
              {t("settings.installUpdate")}
            </button>
          {/if}
        </div>
      {/if}
    </section>
  </div>
</div>

<style>
  .settings-panel {
    display: flex;
    flex-direction: column;
    padding: 14px;
    gap: 12px;
    max-height: 480px;
  }

  .settings-panel.expanded {
    max-height: none;
    flex: 1;
  }

  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .header-actions {
    display: flex;
    gap: 6px;
    align-items: center;
  }

  h3 {
    margin: 0;
    font-size: 13px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-1);
    font-weight: 600;
  }

  .small {
    padding: 4px 10px;
    font-size: 12px;
  }

  .content {
    display: flex;
    flex-direction: column;
    gap: 18px;
    padding-right: 4px;
  }

  .section {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .section-title {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.10em;
    color: var(--orange-2);
    font-weight: 700;
    padding-bottom: 4px;
    border-bottom: 1px solid rgba(255, 122, 26, 0.15);
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .row {
    display: flex;
    gap: 6px;
  }

  .row input {
    flex: 1;
  }

  .row button {
    flex-shrink: 0;
    min-width: 40px;
    padding: 8px 10px;
  }

  .models-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    max-height: 160px;
    overflow-y: auto;
    padding-right: 2px;
  }

  .model-row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 8px;
    border-radius: 8px;
    background: rgba(10, 8, 16, 0.4);
    border: 1px solid rgba(255, 255, 255, 0.05);
    transition: all 0.15s ease;
  }

  .model-row.selected {
    border-color: var(--orange-1);
    background: rgba(255, 122, 26, 0.08);
  }

  .model-info {
    flex: 1;
    min-width: 0;
  }

  .model-name {
    font-size: 12px;
    color: var(--text-0);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .model-meta {
    font-size: 10px;
    color: var(--text-2);
  }

  .status-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 6px 0;
  }

  .lang-switch {
    display: flex;
    gap: 6px;
  }

  .lang-btn {
    flex: 1;
    padding: 8px 12px;
    border-radius: 10px;
    background: rgba(10, 8, 16, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.10);
    color: var(--text-1);
    font-family: inherit;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.18s ease;
  }

  .lang-btn:hover {
    border-color: var(--glass-border-hover);
    color: var(--orange-2);
  }

  .lang-btn.active {
    background: rgba(255, 122, 26, 0.14);
    border-color: var(--orange-1);
    color: var(--orange-1);
    box-shadow: 0 0 12px rgba(255, 122, 26, 0.20);
  }

  .hint {
    font-size: 11px;
    color: var(--text-2);
    line-height: 1.4;
  }

  .port-row {
    display: flex;
    gap: 6px;
    align-items: stretch;
  }

  .port-preset {
    flex: 0 0 auto;
    padding: 8px 12px;
    font-size: 12px;
    white-space: nowrap;
  }

  .port-preset.active {
    background: rgba(255, 122, 26, 0.14);
    border-color: var(--orange-1);
    color: var(--orange-1);
    box-shadow: 0 0 12px rgba(255, 122, 26, 0.20);
  }

  .port-input {
    flex: 1;
    min-width: 80px;
    text-align: center;
  }

  .version-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .version-badge {
    padding: 6px 10px;
    border-radius: 8px;
    background: rgba(255, 122, 26, 0.10);
    border: 1px solid rgba(255, 122, 26, 0.25);
    color: var(--orange-2);
    font-size: 12px;
  }

  .update-info {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px;
    border-radius: 10px;
    background: rgba(155, 109, 255, 0.06);
    border: 1px solid rgba(155, 109, 255, 0.20);
  }

  .update-header {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .update-version {
    font-weight: 600;
    color: var(--purple-2);
    font-size: 13px;
  }

  .download-progress {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .download-bar {
    height: 6px;
    border-radius: 3px;
    background: rgba(255, 255, 255, 0.08);
    overflow: hidden;
  }

  .download-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--orange-1), var(--purple-1));
    transition: width 0.2s ease;
  }

  .download-label {
    font-size: 11px;
    color: var(--text-2);
    text-align: center;
  }
</style>
