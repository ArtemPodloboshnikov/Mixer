<script lang="ts">
    import { t } from "$lib/i18n";
  import { app } from "$lib/stores.svelte";

  let trackEl: HTMLDivElement | undefined = $state();

  // Кто сейчас перетаскивается: "start" | "end" | "playhead" | null
  let dragging: "start" | "end" | "playhead" | null = null;
  let wasPlayingBeforeScrub = false;

  function timeFromPointer(clientX: number): number {
    if (!trackEl) return 0;
    const rect = trackEl.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return ratio * app.currentAnimationDuration;
  }

  function onTrackPointerDown(e: PointerEvent) {
    const id = app.activeModelId;
    if (!id) return;

    dragging = "playhead";
    wasPlayingBeforeScrub = app.isModelPlaying(id);
    app.setModelPlaying(id, false);
    app.isScrubbing = true;

    onPointerMove(e);

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
  }

  function onMarkerPointerDown(e: PointerEvent, which: "start" | "end") {
    e.stopPropagation();
    dragging = which;
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
  }

  function onPointerMove(e: PointerEvent) {
    const time = timeFromPointer(e.clientX);

    if (dragging === "playhead") {
      app.currentAnimationTime = time;
    } else if (dragging === "start") {
      const end = app.rangeEnd ?? app.currentAnimationDuration;
      app.setRange(time, end);
    } else if (dragging === "end") {
      const start = app.rangeStart ?? 0;
      app.setRange(start, time);
    }
  }

  function onPointerUp() {
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("pointercancel", onPointerUp);

    if (dragging === "playhead") {
      app.isScrubbing = false;
      const id = app.activeModelId;
      if (id && wasPlayingBeforeScrub) {
        app.setModelPlaying(id, true);
      }
    }
    dragging = null;
  }

  function clearRange(e: MouseEvent) {
    e.stopPropagation();
    app.clearRange();
  }

  function onTrackDoubleClick(e: MouseEvent) {
    const time = timeFromPointer(e.clientX);

    if (app.rangeStart === null) {
      app.rangeStart = time;
      app.rangeEnd = time;
    } else if (app.rangeEnd === null || app.rangeStart === app.rangeEnd) {
      app.rangeEnd = time;
    } else {
      // Оба маркера уже есть — сбрасываем и ставим заново
      app.setRange(time, time);
    }
  }

  const rangeLeft = $derived(
    app.rangeStart !== null && app.currentAnimationDuration > 0
      ? (app.rangeStart / app.currentAnimationDuration) * 100
      : 0
  );
  const rangeRight = $derived(
    app.rangeEnd !== null && app.currentAnimationDuration > 0
      ? (app.rangeEnd / app.currentAnimationDuration) * 100
      : 0
  );
  const playheadLeft = $derived(
    app.currentAnimationDuration > 0
      ? (app.currentAnimationTime / app.currentAnimationDuration) * 100
      : 0
  );
</script>

{#if app.currentAnimationDuration > 0}
  <div class="timeline glass">
    <span class="timeline-time mono">
      {app.currentAnimationTime.toFixed(2)}s
    </span>

    <div
      class="timeline-track"
      ondblclick={onTrackDoubleClick}
      onpointerdown={onTrackPointerDown}
      bind:this={trackEl}
    >
      <!-- Фоновая полоса -->
      <div class="track-bg"></div>

      <!-- Выделенный отрезок -->
      {#if app.hasRange}
        <div
          class="track-range"
          style="left: {rangeLeft}%; width: {rangeRight - rangeLeft}%"
        ></div>

        <div
          class="track-marker start"
          style="left: {rangeLeft}%"
          onpointerdown={(e) => onMarkerPointerDown(e, "start")}
          title={`Start: ${app.rangeStart?.toFixed(2)}s`}
        ></div>

        <div
          class="track-marker end"
          style="left: {rangeRight}%"
          onpointerdown={(e) => onMarkerPointerDown(e, "end")}
          title={`End: ${app.rangeEnd?.toFixed(2)}s`}
        ></div>
      {/if}

      <!-- Проигранная часть до playhead -->
      <div class="track-fill" style="width: {playheadLeft}%"></div>

      <!-- Playhead -->
      <div class="track-thumb" style="left: {playheadLeft}%"></div>
    </div>

    {#if app.hasRange}
      <button
        class="range-clear"
        onclick={clearRange}
        title={t("status.clearRange")}
      >
        ✕
      </button>
    {/if}

    <span class="timeline-time mono">
      {app.currentAnimationDuration.toFixed(2)}s
    </span>
  </div>
{/if}

<style>
  .timeline {
    position: absolute;
    bottom: 78px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 14px;
    width: min(520px, 80%);
  }

  .timeline-time {
    font-size: 11px;
    color: var(--text-2);
    min-width: 44px;
    text-align: center;
    user-select: none;
  }

  .timeline-track {
    position: relative;
    flex: 1;
    height: 20px;
    display: flex;
    align-items: center;
    cursor: pointer;
    user-select: none;
    touch-action: none;
  }

  .track-bg {
    position: absolute;
    left: 0;
    right: 0;
    height: 4px;
    border-radius: 2px;
    background: rgba(255, 255, 255, 0.08);
  }

  .track-range {
    position: absolute;
    height: 8px;
    top: 50%;
    transform: translateY(-50%);
    border-radius: 2px;
    background: rgba(155, 109, 255, 0.35);
    border: 1px solid rgba(155, 109, 255, 0.6);
    pointer-events: none;
  }

  .track-fill {
    position: absolute;
    left: 0;
    height: 4px;
    border-radius: 2px;
    background: var(--orange-1);
    pointer-events: none;
  }

  .track-thumb {
    position: absolute;
    top: 50%;
    width: 14px;
    height: 14px;
    margin-left: -7px;
    margin-top: -7px;
    border-radius: 50%;
    background: var(--orange-1);
    box-shadow: 0 0 10px rgba(255, 122, 26, 0.6);
    pointer-events: none;
  }

  .track-marker {
    position: absolute;
    top: 50%;
    width: 10px;
    height: 20px;
    margin-left: -5px;
    margin-top: -10px;
    border-radius: 3px;
    background: var(--purple-2);
    box-shadow: 0 0 8px rgba(155, 109, 255, 0.7);
    cursor: ew-resize;
    z-index: 2;
  }

  .track-marker.start::after,
  .track-marker.end::after {
    content: "";
    position: absolute;
    left: 50%;
    top: -2px;
    width: 2px;
    height: 24px;
    margin-left: -1px;
    background: var(--purple-2);
    opacity: 0.8;
  }

  .range-clear {
    width: 24px;
    height: 24px;
    border-radius: 6px;
    background: rgba(255, 74, 106, 0.12);
    border: 1px solid rgba(255, 74, 106, 0.3);
    color: var(--danger);
    font-size: 12px;
    cursor: pointer;
    transition: all 0.15s ease;
    user-select: none;
  }

  .range-clear:hover {
    background: rgba(255, 74, 106, 0.22);
  }
</style>
