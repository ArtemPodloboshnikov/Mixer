<script lang="ts">
  import { useThrelte } from "@threlte/core";
  import * as THREE from "three";
  import { app } from "$lib/stores.svelte";

  const { scene } = useThrelte();

  let boxHelper: THREE.BoxHelper | null = null;
  let currentTarget: THREE.Object3D | null = null;

  $effect(() => {
    const nodeName = app.selectedNodeName;
    const modelId = app.activeModelId;

    // Убираем старую обводку
    if (boxHelper) {
      scene.remove(boxHelper);
      boxHelper.dispose();
      boxHelper = null;
      currentTarget = null;
    }

    if (!nodeName || !modelId) return;

    const gltf = app.getGltf(modelId);
    if (!gltf) return;

    // Ищем узел по имени
    let target: THREE.Object3D | null = null;
    gltf.scene.traverse((obj: THREE.Object3D) => {
      if (obj.name === nodeName) target = obj;
    });
    if (!target) return;

    // Создаём обводку
    boxHelper = new THREE.BoxHelper(target, 0xff7a1a);
    (boxHelper.material as THREE.LineBasicMaterial).transparent = true;
    (boxHelper.material as THREE.LineBasicMaterial).depthTest = false;
    (boxHelper.material as THREE.LineBasicMaterial).linewidth = 2;
    boxHelper.renderOrder = 999;
    currentTarget = target;

    scene.add(boxHelper);
  });

  // Обновляем обводку каждый кадр — если меш двигается анимацией
  $effect(() => {
    const id = setInterval(() => {
      if (boxHelper && currentTarget) {
        boxHelper.setFromObject(currentTarget);
      }
    }, 16);
    return () => clearInterval(id);
  });
</script>
