import * as THREE from "three";
import { app, type ModelEntry } from "./stores.svelte";

/**
 * Округление до 3 знаков — экономит символы, точность для 3D более чем достаточная.
 */
function round3(v: number): number {
  return Math.round(v * 1000) / 1000;
}

/**
 * Извлекает геометрию каждого меша в компактном виде.
 * Возвращает массив с именами, позициями и индексами, при необходимости — прореженными.
 */
export function extractGeometry(gltf: any): Array<{
  name: string;
  positions: number[];
  indices: number[];
  vertexCount: number;
  originalCount: number;
}> {
  if (!gltf || !gltf.scene) return [];

  const maxVerts = Math.max(8, Math.min(2048, app.maxVertsPerNode));

  const result: Array<{
    name: string;
    positions: number[];
    indices: number[];
    vertexCount: number;
    originalCount: number;
  }> = [];

  gltf.scene.traverse((obj: THREE.Object3D) => {
    if (!(obj as THREE.Mesh).isMesh) return;

    const mesh = obj as THREE.Mesh;
    const geom = mesh.geometry as THREE.BufferGeometry;
    if (!geom) return;

    const posAttr = geom.getAttribute("position") as THREE.BufferAttribute;
    if (!posAttr) return;

    const indexAttr = geom.index;
    const originalCount = posAttr.count;

    // Позиции в мировых координатах
    const allPositions: number[] = [];
    const tmp = new THREE.Vector3();
    for (let i = 0; i < originalCount; i++) {
      tmp.set(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
      mesh.localToWorld(tmp);
      allPositions.push(round3(tmp.x), round3(tmp.y), round3(tmp.z));
    }

    // Индексы
    let allIndices: number[] = [];
    if (indexAttr) {
      for (let i = 0; i < indexAttr.count; i++) {
        allIndices.push(indexAttr.getX(i));
      }
    } else {
      for (let i = 0; i < originalCount; i++) allIndices.push(i);
    }

    // Прореживание, если вершин слишком много
    let positions = allPositions;
    let indices = allIndices;

    if (originalCount > maxVerts) {
      const step = Math.ceil(originalCount / maxVerts);
      positions = [];
      const kept = new Map<number, number>();
      let newIdx = 0;

      for (let i = 0; i < originalCount; i += step) {
        positions.push(
          allPositions[i * 3],
          allPositions[i * 3 + 1],
          allPositions[i * 3 + 2]
        );
        kept.set(i, newIdx++);
      }

      indices = [];
      for (let i = 0; i < allIndices.length; i += 3) {
        const a = kept.get(allIndices[i]);
        const b = kept.get(allIndices[i + 1]);
        const c = kept.get(allIndices[i + 2]);
        if (a !== undefined && b !== undefined && c !== undefined) {
          indices.push(a, b, c);
        }
      }
    }

    result.push({
      name: mesh.name || obj.name || `mesh_${result.length}`,
      positions,
      indices,
      vertexCount: positions.length / 3,
      originalCount,
    });
  });

  return result;
}

/**
 * Строит компактное текстовое описание GLB-модели для передачи в LLM.
 * Включает: типы объектов, bbox, анимации, имена top-level нод и геометрию.
 */
export function describeGltf(gltf: any): string {
  if (!gltf || !gltf.scene) return "";

  const scene: THREE.Object3D = gltf.scene;

  // ---- Считаем типы объектов ----
  let meshCount = 0;
  let pointsCount = 0;
  let lineCount = 0;
  let groupCount = 0;
  let totalTriangles = 0;
  let totalVertices = 0;

  scene.traverse((obj: THREE.Object3D) => {
    if ((obj as THREE.Mesh).isMesh) {
      meshCount++;
      const geom = (obj as THREE.Mesh).geometry as THREE.BufferGeometry;
      if (geom) {
        const pos = geom.getAttribute("position");
        if (pos) totalVertices += pos.count;
        if (geom.index) {
          totalTriangles += geom.index.count / 3;
        } else if (pos) {
          totalTriangles += pos.count / 3;
        }
      }
    } else if ((obj as THREE.Points).isPoints) {
      pointsCount++;
    } else if ((obj as THREE.Line).isLine) {
      lineCount++;
    } else if (obj.type === "Group") {
      groupCount++;
    }
  });

  // ---- Bounding box ----
  const box = new THREE.Box3().setFromObject(scene);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  // ---- Анимации ----
  const animations: string[] = (gltf.animations ?? []).map(
    (a: THREE.AnimationClip) => `${a.name} (${a.duration.toFixed(2)}s)`
  );

  // ---- Top-level имена ----
  const topNames = scene.children
    .map((c: THREE.Object3D) => c.name || c.type)
    .slice(0, 20);

  // ---- Геометрия ----
  const geometry = extractGeometry(gltf);

  // ---- Сборка описания ----
  const lines: string[] = [];

  lines.push(`- Meshes: ${meshCount}`);
  if (pointsCount > 0) lines.push(`- Points: ${pointsCount}`);
  if (lineCount > 0) lines.push(`- Lines: ${lineCount}`);
  if (groupCount > 0) lines.push(`- Groups: ${groupCount}`);
  lines.push(`- Vertices: ${totalVertices}`);
  lines.push(`- Triangles: ${Math.round(totalTriangles)}`);
  lines.push(
    `- Bounding box: size [${size.x.toFixed(2)}, ${size.y.toFixed(2)}, ${size.z.toFixed(2)}], center [${center.x.toFixed(2)}, ${center.y.toFixed(2)}, ${center.z.toFixed(2)}]`
  );
  lines.push(
    animations.length > 0
      ? `- Animations: ${animations.join(", ")}`
      : `- Animations: none`
  );
  if (topNames.length > 0) {
    lines.push(`- Top-level nodes: ${topNames.join(", ")}`);
  }

  // ---- Блок геометрии ----
  if (geometry.length > 0) {
    lines.push(`- Geometry (top-level meshes):`);
    for (const g of geometry) {
      const note =
        g.originalCount > g.vertexCount
          ? ` (simplified from ${g.originalCount})`
          : "";
      lines.push(`  * ${g.name}: ${g.vertexCount} verts${note}`);
      lines.push(`    positions: [${g.positions.join(",")}]`);
      lines.push(`    indices: [${g.indices.join(",")}]`);
    }
  }

  return lines.join("\n");
}

/**
 * Формирует блок "Reference models" для системного промпта.
 */
export function buildReferenceBlock(
  models: ModelEntry[],
  descriptions: Record<string, string>
): string {
  const refs = models.filter((m) => m.isReference && descriptions[m.id]);
  if (refs.length === 0) return "";

  const parts = refs.map((m) => {
    return `Reference model "${m.name}":\n${descriptions[m.id]}`;
  });

  return `\n\nReference models for style and structure inspiration:\n\n${parts.join("\n\n")}`;
}
