<script lang="ts">
  import Viewport from "$lib/components/Viewport.svelte";
  import ChatPanel from "$lib/components/ChatPanel.svelte";
  import ModelList from "$lib/components/ModelList.svelte";
</script>

<section class="viewport-area glass">
    <Viewport />
</section>

<section class="side-area">
    <ModelList />
    <ChatPanel />
</section>

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
</style>
