<script lang="ts">
  import { useTask } from "@threlte/core";
  import { interactivity } from "@threlte/extras";
  import * as THREE from "three";
  import { app } from "$lib/stores.svelte";

  let {
    mixers,
    actions,
  }: {
    mixers: Record<string, THREE.AnimationMixer>;
    actions: Record<string, THREE.AnimationAction | null>;
  } = $props();

  interactivity();

  useTask((delta) => {
    Object.values(mixers).forEach((m) => m.update(delta));

    // Пока пользователь тянет ползунок — не перезаписываем время
    if (app.isScrubbing) return;

    const id = app.activeModelId;
    if (!id) return;

    const action = actions[id];
    if (action && action.isRunning()) {
      app.currentAnimationTime = action.time;
    }
  });
</script>
