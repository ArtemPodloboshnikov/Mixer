<script lang="ts">
  import { Canvas, T } from "@threlte/core";
  import { GLTF, OrbitControls, Grid } from "@threlte/extras";
  import * as THREE from "three";
  import { app, type ModelEntry } from "$lib/stores.svelte";
  import { describeGltf } from "$lib/referenceDescriber";
  import { t } from "$lib/i18n";
  import Animator from "./Animator.svelte";
  import Dropdown from "./Dropdown.svelte";
  import SelectionBox from "./SelectionBox.svelte";
  import ClickHandler from "./ClickHandler.svelte";
  import NodeListPanel from "./NodeListPanel.svelte";
  import TimelineRange from "./TimelineRange.svelte";

  let gltfRefs = $state<Record<string, any>>({});
  let mixers = $state<Record<string, THREE.AnimationMixer>>({});
  let actions: Record<string, THREE.AnimationAction | null> = {};

  let activeAnimations = $state<string[]>([]);
  // Ссылки на исходные материалы, чтобы вернуть их при снятии выделения
  let highlightedObjects: THREE.Mesh[] = [];
  let originalEmissives = new Map<THREE.Mesh, number>();
  let lastModelId: string | null = null;
  let lastAnimation: string = "";

  function clearHighlight() {
    for (const [mesh, intensity] of originalEmissives.entries()) {
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (mat && mat.emissive) {
        mat.emissiveIntensity = intensity;
      }
    }
    originalEmissives.clear();
    highlightedObjects = [];
  }

  function handleGltfLoad(entry: ModelEntry, gltf: any) {
    if (!gltf || gltfRefs[entry.id]) return;
    gltfRefs[entry.id] = gltf;
    app.registerGltf(entry.id, gltf);
    mixers[entry.id] = new THREE.AnimationMixer(gltf.scene);

    // Даём имена безымянным узлам и собираем список
    let counter = 0;
    const names: string[] = [];
    gltf.scene.traverse((obj: THREE.Object3D) => {
      if (!obj.name) obj.name = `node_${counter++}`;
      if ((obj as THREE.Mesh).isMesh) {
        names.push(obj.name);
      }
    });
    app.setModelNodeNames(names);

    const description = describeGltf(gltf);
    app.setModelDescription(entry.id, description);

    const anims: string[] = gltf.animations.map(
      (a: THREE.AnimationClip) => a.name
    );

    if (entry.id === app.activeModelId) {
      activeAnimations = anims;
      if (anims.length > 0) {
        app.selectedAnimation = anims[0];
        playAnimation(entry.id, anims[0]);
      }
    }
  }

  function playAnimation(modelId: string, name: string, autoplay = true) {
    const mixer = mixers[modelId];
    const ref = gltfRefs[modelId];
    if (!mixer || !ref) return;

    const clip = ref.animations.find(
      (a: THREE.AnimationClip) => a.name === name
    );
    if (!clip) return;

    actions[modelId]?.stop();
    const action = mixer.clipAction(clip);
    action.reset();

    action.play();
    action.paused = !autoplay;
    actions[modelId] = action;
  }

  function onAnimationChange() {
    const id = app.activeModelId;
    if (!id) return;

    // Пользователь выбрал анимацию — значит хочет её видеть
    app.setModelPlaying(id, true);

    // Проигрываем action сразу, не дожидаясь $effect
    const action = actions[id];
    if (action) action.paused = false;
  }

  $effect(() => {
    const id = app.activeModelId;
    if (!id) return;
    if (!app.isScrubbing) return;
    const action = actions[id];
    if (!action) return;
    action.time = app.currentAnimationTime;
    const mixer = mixers[id];
    if (mixer) mixer.update(0.0001);
  });

  // При смене активной модели обновляем список анимаций
  $effect(() => {
    const id = app.activeModelId;
    if (!id) {
      activeAnimations = [];
      return;
    }

    const ref = gltfRefs[id];
    if (ref) {
      activeAnimations = ref.animations.map(
        (a: THREE.AnimationClip) => a.name
      );
    }
  });

  // При смене выбранной анимации — проигрываем её
  $effect(() => {
    const id = app.activeModelId;
    const anim = app.selectedAnimation;

    if (!id || !anim) return;

    // Вызываем только если реально изменились модель или анимация
    if (id === lastModelId && anim === lastAnimation) return;

    lastModelId = id;
    lastAnimation = anim;
    playAnimation(id, anim);
  });

  $effect(() => {
    const id = app.activeModelId;
    if (!id) return;
    const playing = app.isModelPlaying(id);
    const action = actions[id];
    if (action) action.paused = !playing;
  });

  $effect(() => {
    // при смене модели — снимаем выделение
    app.selectedNodeName = null;
    app.clearRange();
    clearHighlight();
  });

  // Обновляем duration при смене модели/анимации
  $effect(() => {
    const id = app.activeModelId;
    const anim = app.selectedAnimation;
    if (!id || !anim) {
      app.currentAnimationDuration = 0;
      return;
    }
    const ref = gltfRefs[id];
    const clip = ref?.animations.find(
      (a: THREE.AnimationClip) => a.name === anim
    );
    if (clip) {
      app.currentAnimationDuration = clip.duration;
    }
  });

  // Синхронизируем currentTime с action
  $effect(() => {
    const id = app.activeModelId;
    const action = id ? actions[id] : null;
    if (!action) return;

    // Слушаем обновления в Animator через $state,
    // либо используем interval на 30 fps
    const interval = setInterval(() => {
      if (app.isScrubbing) return;
      if (action) {
        app.currentAnimationTime = action.time;
      }
    }, 33);

    return () => clearInterval(interval);
  });
</script>

<div class="viewport" class:select-mode={app.viewportMode === "select"}>
  <Canvas shadows>
    <ClickHandler />
    <SelectionBox />
    <Animator {mixers} {actions} />

    <T.PerspectiveCamera makeDefault position={[6, 5, 6]} fov={45} />

    <OrbitControls
      enableDamping
      dampingFactor={0.08}
      minDistance={2}
      maxDistance={40}
      target={[0, 1.5, 0]}
      enabled={app.viewportMode === "navigate"}
    />

    <T.AmbientLight intensity={0.35} />
    <T.DirectionalLight
      position={[8, 12, 6]}
      intensity={1.4}
      color="#ffd9b0"
      castShadow
    />
    <T.PointLight
      position={[0, 3, 0]}
      intensity={12}
      color="#ff9f4a"
      distance={10}
    />
    <T.PointLight
      position={[0, 2, 0]}
      intensity={8}
      color="#9b6dff"
      distance={8}
    />

    <T.Group position={[0, -0.01, 0]}>
      <Grid
        gridSize={40}
        cellColor="#2a2733"
        sectionColor="#ff7a1a"
        sectionSize={5}
        fadeDistance={30}
        fadeStrength={1}
        infiniteGrid
      />
    </T.Group>

    {#each app.models as entry (entry.id)}
      {#if entry.visible}
        <T.Group
        >
            <GLTF
              url={entry.url}
              onload={(gltf) => handleGltfLoad(entry, gltf)}
              position={entry.isReference ? [5, 0, 0] : [0, 0, 0]}
            />
        </T.Group>
      {/if}
    {/each}
  </Canvas>

  <NodeListPanel />

  <TimelineRange />
  <div class="hud-bottom glass">
      <button
        class="btn btn-ghost play-btn"
        onclick={() => {
          const id = app.activeModelId;
          if (!id) return;
          const next = !app.isModelPlaying(id);
          app.setModelPlaying(id, next);
          // Сразу применим к action этой модели
          const action = actions[id];
          if (action) action.paused = !next;
        }}
        title={app.isModelPlaying(app.activeModelId ?? "") ? t("viewport.pause") : t("viewport.play")}
      >
        {app.isModelPlaying(app.activeModelId ?? "") ? t("viewport.pause") : t("viewport.play")}
      </button>

    <Dropdown
      bind:value={app.selectedAnimation}
      options={activeAnimations}
      placeholder={t("viewport.animation")}
      disabled={activeAnimations.length === 0}
      minWidth="180px"
      onChange={onAnimationChange}
    />

    <!-- Переключатель режима -->
    <div class="mode-switch">
      <button
        class="mode-btn"
        class:active={app.viewportMode === "navigate"}
        onclick={() => (app.viewportMode = "navigate")}
        title="Навигация камерой"
      >
        ✋
      </button>
      <button
        class="mode-btn"
        class:active={app.viewportMode === "select"}
        onclick={() => (app.viewportMode = "select")}
        title="Выделение узлов"
      >
        ➤
      </button>
    </div>
  </div>
</div>

<style>
  .viewport {
    position: relative;
    width: 100%;
    height: 100%;
    border-radius: 14px;
    overflow: hidden;
    background:
      radial-gradient(circle at 30% 20%, rgba(255, 122, 26, 0.06), transparent 40%),
      radial-gradient(circle at 70% 80%, rgba(155, 109, 255, 0.08), transparent 45%),
      #0a0810;
  }

  .viewport.select-mode :global(canvas) {
    cursor: crosshair !important;
  }

  .hud-bottom {
    position: absolute;
    bottom: 12px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: 10px;
    align-items: center;
    padding: 8px 14px;
  }

  .play-btn {
    min-width: 110px;
    text-align: center;
  }

  .mode-switch {
    display: flex;
    gap: 4px;
    padding: 4px;
    border-radius: 10px;
    background: rgba(10, 8, 16, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.10);
  }

  .mode-btn {
    width: 32px;
    height: 32px;
    display: grid;
    place-items: center;
    border-radius: 8px;
    background: transparent;
    border: none;
    color: var(--text-2);
    font-size: 14px;
    cursor: pointer;
    transition: all 0.18s ease;
  }

  .mode-btn:hover {
    color: var(--orange-2);
  }

  .mode-btn.active {
    background: rgba(255, 122, 26, 0.14);
    color: var(--orange-1);
    box-shadow: 0 0 12px rgba(255, 122, 26, 0.20);
  }
</style>
