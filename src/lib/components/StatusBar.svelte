<script lang="ts">
  import { app } from "$lib/stores.svelte";
  import { t } from "$lib/i18n";
</script>

<div class="status-bar glass" class:error={app.statusKind === "error"} class:success={app.statusKind === "success"}>
  <span class="indicator"></span>
  <span class="text">{app.statusText}</span>
  <span class="spacer"></span>
  <span class="mono dim">
    LLM: {app.llmConfig.provider}/{app.llmConfig.model}
    {#if app.runningPid}· PID {app.runningPid}{/if}
  </span>
</div>

<style>
  .status-bar {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 16px;
    font-size: 12px;
    color: var(--text-1);
  }

  .indicator {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--orange-1);
    box-shadow: 0 0 10px var(--orange-1);
    transition: all 0.2s ease;
  }

  .status-bar.error .indicator {
    background: var(--danger);
    box-shadow: 0 0 10px var(--danger);
  }

  .status-bar.success .indicator {
    background: var(--success);
    box-shadow: 0 0 10px var(--success);
  }

  .text {
    color: var(--text-0);
  }

  .spacer {
    flex: 1;
  }

  .dim {
    color: var(--text-2);
  }
</style>
