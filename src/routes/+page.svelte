<script lang="ts">
  import Viewport from "$lib/components/Viewport.svelte";
  import ChatPanel from "$lib/components/ChatPanel.svelte";
  import ModelList from "$lib/components/ModelList.svelte";
  import JsonImportPanel from "$lib/components/JsonImportPanel.svelte";
  import { app } from "$lib/stores.svelte";
  import { t } from "$lib/i18n";
</script>

<div class="viewport-area glass">
  <Viewport />
</div>

<div class="side-area">
  <div class="top-row">
    <ModelList />
  </div>

  <div class="tabs glass">
    <button
      class="tab"
      class:active={app.chatTab === "chat"}
      onclick={() => (app.chatTab = "chat")}
    >
      {t("common.tabChat")}
    </button>
    <button
      class="tab"
      class:active={app.chatTab === "json"}
      onclick={() => (app.chatTab = "json")}
    >
      JSON
    </button>
  </div>

  <div class="tab-content">
    {#if app.chatTab === "chat"}
      <ChatPanel />
    {:else}
      <JsonImportPanel />
    {/if}
  </div>
</div>

<style>
  .viewport-area {
    grid-column: 1;
    grid-row: 1;
    padding: 0;
    overflow: hidden;
    min-height: 0;
  }

  .side-area {
    grid-column: 2;
    grid-row: 1;
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-height: 0;
  }

  .top-row {
    display: flex;
    gap: 8px;
    align-items: stretch;
    flex-shrink: 0;
  }

  .top-row > :global(.model-list) {
    flex: 1;
  }

  .tabs {
    display: flex;
    padding: 4px;
    gap: 4px;
    flex-shrink: 0;
  }

  .tab {
    flex: 1;
    padding: 8px 12px;
    border-radius: 8px;
    background: transparent;
    border: none;
    color: var(--text-1);
    font-family: inherit;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.18s ease;
  }

  .tab:hover {
    color: var(--orange-2);
  }

  .tab.active {
    background: rgba(255, 122, 26, 0.14);
    color: var(--orange-1);
    box-shadow: 0 0 12px rgba(255, 122, 26, 0.20);
  }

  .tab-content {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
</style>
