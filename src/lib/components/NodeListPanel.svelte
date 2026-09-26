<script lang="ts">
  import { app } from "$lib/stores.svelte";
  import { t } from "$lib/i18n";

  function selectNode(name: string) {
    app.selectedNodeName = name;
    app.setStatus(t("status.nodeSelected", { name }), "info");
  }
</script>

{#if app.viewportMode === "select" && app.modelNodeNames.length > 0}
  <aside class="node-panel glass">
    <header class="panel-header">
      <span class="panel-title">{t("viewport.nodes")}</span>
      <span class="panel-count mono">{app.modelNodeNames.length}</span>
    </header>

    <ul class="node-list scrollable">
      {#each app.modelNodeNames as name (name)}
        <li>
          <button
            class="node-item"
            class:active={app.selectedNodeName === name}
            onclick={() => selectNode(name)}
          >
            <span class="node-dot"></span>
            <span class="node-name" title={name}>{name}</span>
          </button>
        </li>
      {/each}
    </ul>
  </aside>
{/if}

<style>
  .node-panel {
    position: absolute;
    top: 12px;
    right: 12px;
    width: 220px;
    max-height: calc(100% - 100px);
    display: flex;
    flex-direction: column;
    padding: 10px;
    gap: 8px;
    z-index: 10;
    pointer-events: auto;
  }

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 6px;
    border-bottom: 1px solid rgba(255, 122, 26, 0.15);
  }

  .panel-title {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--orange-2);
    font-weight: 700;
  }

  .panel-count {
    font-size: 11px;
    color: var(--text-2);
  }

  .node-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
    list-style: none;
    margin: 0;
    padding: 0;
    overflow-y: auto;
    min-height: 0;
  }

  .node-item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    border-radius: 8px;
    background: transparent;
    border: 1px solid transparent;
    color: var(--text-1);
    font-family: inherit;
    font-size: 12px;
    text-align: left;
    cursor: pointer;
    transition: all 0.14s ease;
  }

  .node-item:hover {
    background: rgba(255, 122, 26, 0.08);
    color: var(--orange-2);
  }

  .node-item.active {
    background: rgba(255, 122, 26, 0.14);
    border-color: var(--orange-1);
    color: var(--orange-1);
    box-shadow: 0 0 12px rgba(255, 122, 26, 0.20);
  }

  .node-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--text-2);
    flex-shrink: 0;
    transition: all 0.14s ease;
  }

  .node-item.active .node-dot {
    background: var(--orange-1);
    box-shadow: 0 0 8px var(--orange-1);
  }

  .node-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
