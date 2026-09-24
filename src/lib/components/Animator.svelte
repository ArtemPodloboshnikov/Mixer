<script lang="ts">
  import { useTask } from "@threlte/core";
  import * as THREE from "three";

  // Компонент получает миксеры снаружи и обновляет их каждый кадр.
  let { mixers }: { mixers: Record<string, THREE.AnimationMixer> } = $props();

  useTask((delta) => {
    Object.values(mixers).forEach((m) => m.update(delta));
  });
</script>
