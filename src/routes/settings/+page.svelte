<script lang="ts">
  import SettingsPanel from "$lib/components/SettingsPanel.svelte";
</script>

<div class="settings-page glass">
  <SettingsPanel expanded />
</div>

<style>
  .settings-page {
    height: 100%;
    padding: 24px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 20px;
    grid-column: 1 / -1;
  }
</style>
