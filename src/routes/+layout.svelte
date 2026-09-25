<script lang="ts">
  import "../app.css";
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import { app } from "$lib/stores.svelte";
  import { t } from "$lib/i18n";
  import { getVersion } from "@tauri-apps/api/app";
    import StatusBar from "$lib/components/StatusBar.svelte";
    import { scanLocalModels } from "$lib/tauriApi";

  let { children } = $props();

  let version = $state("");

  const navItems = $derived([
    { href: "/", label: t("nav.editor"), icon: "◇" },
    { href: "/settings", label: t("nav.settings"), icon: "⚙" },
  ]);

  onMount(async () => {
    await app.loadSettings();
    try {
      version = await getVersion();
    } catch {
      version = "0.0.0";
    }

    if (app.localModelsDir) {
      try {
        const list = await scanLocalModels(app.localModelsDir);
        app.localModels = list;
      } catch {}
    }
  });
</script>

<div class="app-shell">
  <aside class="sidebar glass">
    <div class="brand">
      <div class="brand-logo"><span style="height: 130%;">◈</span></div>
      <div class="brand-text">
        <div class="brand-title">Mixer</div>
      </div>
    </div>

    <nav>
      {#each navItems as item}
        <button
          class="nav-item"
          class:active={$page.url.pathname === item.href}
          onclick={() => goto(item.href)}
        >
          <span class="nav-icon">{item.icon}</span>
          <span>{item.label}</span>
        </button>
      {/each}
    </nav>

    <div class="sidebar-footer">
      <div class="version mono">v{version || "…"}</div>
    </div>
  </aside>

  <main class="main-content">
    {@render children()}
    <footer class="status-area">
      <StatusBar />
    </footer>
  </main>
</div>

<style>
  .app-shell {
    display: grid;
    grid-template-columns: 220px 1fr;
    height: 100vh;
    width: 100vw;
    gap: 14px;
    padding: 14px;
  }

  .sidebar {
    display: flex;
    flex-direction: column;
    padding: 18px 14px;
    gap: 24px;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 0 6px;
  }

  .brand-logo {
    width: 36px;
    height: 36px;
    display: grid;
    place-items: center;
    border-radius: 10px;
    background: linear-gradient(135deg, var(--orange-1), var(--purple-1));
    color: #0a0810;
    font-size: 32px;
    font-weight: 700;
    box-shadow: 0 0 20px rgba(255, 122, 26, 0.35);
  }

  .brand-title {
    font-weight: 700;
    color: var(--text-0);
    font-size: 18px;
    letter-spacing: 0.02em;
  }

  nav {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .nav-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border-radius: 10px;
    background: transparent;
    color: var(--text-1);
    text-align: left;
    border: 1px solid transparent;
  }

  .nav-item:hover {
    background: rgba(255, 122, 26, 0.08);
    color: var(--orange-2);
  }

  .nav-item.active {
    background: rgba(255, 122, 26, 0.14);
    border-color: rgba(255, 122, 26, 0.32);
    color: var(--orange-2);
    box-shadow: inset 0 0 20px rgba(255, 122, 26, 0.10);
  }

  .nav-icon {
    width: 20px;
    display: grid;
    place-items: center;
    font-size: 15px;
  }

  .sidebar-footer {
    margin-top: auto;
    padding: 0 6px;
    color: var(--text-2);
  }

  .main-content {
    overflow: hidden;
    height: 100%;
    display: grid;
    grid-template-columns: 1fr 380px;
    grid-template-rows: 1fr auto;
    gap: 14px;
    padding: 0;
  }

  .status-area {
    grid-column: 1 / -1;
    grid-row: 2;
  }
</style>
