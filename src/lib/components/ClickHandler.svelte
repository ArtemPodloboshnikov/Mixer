<script lang="ts">
  import { useThrelte } from "@threlte/core";
  import * as THREE from "three";
  import { app } from "$lib/stores.svelte";
  import { t } from "$lib/i18n";

  const { camera, renderer } = useThrelte();

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  function onClick(e: MouseEvent) {
    if (app.viewportMode !== "select") return;

    const id = app.activeModelId;
    if (!id) return;

    const gltf = app.getGltf(id);
    if (!gltf) return;

    const canvas = renderer.domElement;
    const rect = canvas.getBoundingClientRect();

    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(pointer, camera.current);

    const hits = raycaster.intersectObject(gltf.scene, true);
    if (hits.length === 0) {
      app.selectedNodeName = null;
      app.setStatus(t("status.nothingSelected"), "info");
      return;
    }

    let node: THREE.Object3D | null = hits[0].object;
    while (node && !node.name) {
      node = node.parent;
    }

    if (!node) {
      app.selectedNodeName = null;
      return;
    }

    app.selectedNodeName = node.name;
    app.setStatus(t("status.nodeSelected", { name: node.name }), "info");
  }

  $effect(() => {
    const canvas = renderer.domElement;
    canvas.addEventListener("click", onClick);
    return () => canvas.removeEventListener("click", onClick);
  });
</script>
