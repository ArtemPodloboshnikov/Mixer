<script lang="ts">
  import Viewport from "$lib/components/Viewport.svelte";
  import ChatPanel from "$lib/components/ChatPanel.svelte";
  import ModelList from "$lib/components/ModelList.svelte";
  import StatusBar from "$lib/components/StatusBar.svelte";
</script>

<div class="editor-page">
  <section class="viewport-area glass">
    <Viewport />
  </section>

  <section class="side-area">
    <ModelList />
    <ChatPanel />
  </section>

  <footer class="status-area">
    <StatusBar />
  </footer>
</div>

<style>
  .editor-page {
    display: grid;
    grid-template-columns: 1fr 380px;
    grid-template-rows: 1fr auto;
    gap: 14px;
    height: 100%;
    padding: 0;
  }

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

  .status-area {
    grid-column: 1 / -1;
    grid-row: 2;
  }
</style>
