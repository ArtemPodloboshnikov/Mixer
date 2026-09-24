use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Deserialize)]
pub struct ExportPayload {
    #[serde(rename = "outputDir")]
    pub output_dir: String,
    pub filename: String,
    pub nodes: Vec<ExportNode>,
    pub animations: Vec<ExportAnimation>,
}

#[derive(Debug, Deserialize)]
pub struct ExportNode {
    pub name: String,
    /// Плоский массив: [x0,y0,z0, x1,y1,z1, ...]
    pub positions: Vec<f32>,
    pub indices: Vec<u32>,
    #[serde(rename = "materialName")]
    pub material_name: String,
}

#[derive(Debug, Deserialize)]
pub struct ExportAnimation {
    pub name: String,
    pub channels: Vec<ExportChannel>,
}

#[derive(Debug, Deserialize)]
pub struct ExportChannel {
    #[serde(rename = "nodeIndex")]
    pub node_index: usize,
    pub path: String,
    pub times: Vec<f32>,
    pub values: Vec<f32>,
}

#[derive(Debug, Serialize)]
struct BufferView {
    #[serde(rename = "buffer")]
    buffer: u32,
    #[serde(rename = "byteOffset")]
    byte_offset: u32,
    #[serde(rename = "byteLength")]
    byte_length: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    target: Option<u32>,
}

#[derive(Debug, Serialize)]
struct Accessor {
    #[serde(rename = "bufferView")]
    buffer_view: u32,
    #[serde(rename = "componentType")]
    component_type: u32,
    count: u32,
    #[serde(rename = "type")]
    ty: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    min: Option<Vec<f32>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    max: Option<Vec<f32>>,
}

#[derive(Debug, Serialize)]
struct MeshPrimitive {
    attributes: std::collections::HashMap<String, u32>,
    indices: u32,
    material: u32,
}

#[derive(Debug, Serialize)]
struct Mesh {
    name: String,
    primitives: Vec<MeshPrimitive>,
}

#[derive(Debug, Serialize)]
struct GltfNode {
    mesh: u32,
    name: String,
}

#[derive(Debug, Serialize)]
struct Sampler {
    input: u32,
    output: u32,
    interpolation: String,
}

#[derive(Debug, Serialize)]
struct Channel {
    sampler: u32,
    target: ChannelTarget,
}

#[derive(Debug, Serialize)]
struct ChannelTarget {
    node: u32,
    path: String,
}

#[derive(Debug, Serialize)]
struct Animation {
    name: String,
    samplers: Vec<Sampler>,
    channels: Vec<Channel>,
}

#[derive(Debug, Serialize)]
struct Asset {
    version: String,
    generator: String,
}

#[derive(Debug, Serialize)]
struct Scene {
    nodes: Vec<u32>,
}

#[derive(Debug, Serialize)]
struct BufferDef {
    #[serde(rename = "byteLength")]
    byte_length: u32,
}

#[derive(Debug, Serialize)]
struct Gltf {
    asset: Asset,
    scene: u32,
    scenes: Vec<Scene>,
    nodes: Vec<GltfNode>,
    meshes: Vec<Mesh>,
    materials: Vec<serde_json::Value>,
    accessors: Vec<Accessor>,
    #[serde(rename = "bufferViews")]
    buffer_views: Vec<BufferView>,
    buffers: Vec<BufferDef>,
    animations: Vec<Animation>,
}

struct Builder {
    bin: Vec<u8>,
    buffer_views: Vec<BufferView>,
    accessors: Vec<Accessor>,
}

impl Builder {
    fn new() -> Self {
        Self {
            bin: Vec::new(),
            buffer_views: Vec::new(),
            accessors: Vec::new(),
        }
    }

    fn pad4(&mut self) {
        while self.bin.len() % 4 != 0 {
            self.bin.push(0);
        }
    }

    fn push_u8(
        &mut self,
        bytes: &[u8],
        component_type: u32,
        ty: &str,
        count: u32,
        minmax: Option<(Vec<f32>, Vec<f32>)>,
        target: Option<u32>,
    ) -> u32 {
        self.pad4();
        let byte_offset = self.bin.len() as u32;
        self.bin.extend_from_slice(bytes);
        let byte_length = bytes.len() as u32;
        self.buffer_views.push(BufferView {
            buffer: 0,
            byte_offset,
            byte_length,
            target,
        });
        let (min, max) = match minmax {
            Some((a, b)) => (Some(a), Some(b)),
            None => (None, None),
        };
        self.accessors.push(Accessor {
            buffer_view: (self.buffer_views.len() - 1) as u32,
            component_type,
            count,
            ty: ty.to_string(),
            min,
            max,
        });
        (self.accessors.len() - 1) as u32
    }

    fn push_f32(
        &mut self,
        data: &[f32],
        ty: &str,
        count: u32,
        minmax: Option<(Vec<f32>, Vec<f32>)>,
        target: Option<u32>,
    ) -> u32 {
        let bytes = bytemuck::cast_slice(data);
        self.push_u8(bytes, 5126, ty, count, minmax, target)
    }

    fn push_u32(&mut self, data: &[u32], target: Option<u32>) -> u32 {
        let bytes = bytemuck::cast_slice(data);
        self.push_u8(bytes, 5125, "SCALAR", data.len() as u32, None, target)
    }
}

fn min_max_vec3(positions: &[f32]) -> (Vec<f32>, Vec<f32>) {
    let mut min = [f32::MAX; 3];
    let mut max = [f32::MIN; 3];
    for chunk in positions.chunks(3) {
        for i in 0..3 {
            if chunk[i] < min[i] {
                min[i] = chunk[i];
            }
            if chunk[i] > max[i] {
                max[i] = chunk[i];
            }
        }
    }
    (min.to_vec(), max.to_vec())
}

fn min_max_scalar(values: &[f32]) -> (Vec<f32>, Vec<f32>) {
    let mut min = f32::MAX;
    let mut max = f32::MIN;
    for &v in values {
        if v < min {
            min = v;
        }
        if v > max {
            max = v;
        }
    }
    (vec![min], vec![max])
}

#[tauri::command]
pub fn export_glb(payload: ExportPayload) -> Result<String, String> {
    let mut b = Builder::new();
    let mut meshes: Vec<Mesh> = Vec::new();
    let mut gltf_nodes: Vec<GltfNode> = Vec::new();
    let mut materials: Vec<serde_json::Value> = Vec::new();

    // Для каждой ноды собираем позиции, индексы и материал.
    for (i, node) in payload.nodes.iter().enumerate() {
        let count = (node.positions.len() / 3) as u32;
        let (mn, mx) = min_max_vec3(&node.positions);
        let pos_acc = b.push_f32(&node.positions, "VEC3", count, Some((mn, mx)), Some(34962));
        let idx_acc = b.push_u32(&node.indices, Some(34963));

        materials.push(serde_json::json!({
            "name": node.material_name,
            "pbrMetallicRoughness": {
                "baseColorFactor": [0.85, 0.55, 0.25, 1.0],
                "metallicFactor": 0.1,
                "roughnessFactor": 0.6,
            }
        }));

        let mut attrs = std::collections::HashMap::new();
        attrs.insert("POSITION".to_string(), pos_acc);

        meshes.push(Mesh {
            name: node.name.clone(),
            primitives: vec![MeshPrimitive {
                attributes: attrs,
                indices: idx_acc,
                material: (materials.len() - 1) as u32,
            }],
        });

        gltf_nodes.push(GltfNode {
            mesh: i as u32,
            name: node.name.clone(),
        });
    }

    // Анимации.
    let mut animations_json: Vec<Animation> = Vec::new();
    for anim in &payload.animations {
        let mut samplers: Vec<Sampler> = Vec::new();
        let mut channels: Vec<Channel> = Vec::new();

        for ch in &anim.channels {
            let times_count = ch.times.len() as u32;
            let (tmin, tmax) = min_max_scalar(&ch.times);
            let t_acc = b.push_f32(&ch.times, "SCALAR", times_count, Some((tmin, tmax)), None);

            let ty = match ch.path.as_str() {
                "translation" | "scale" => "VEC3",
                "rotation" => "VEC4",
                _ => "VEC3",
            };
            let v_acc = b.push_f32(&ch.values, ty, times_count, None, None);

            samplers.push(Sampler {
                input: t_acc,
                output: v_acc,
                interpolation: "LINEAR".to_string(),
            });
            channels.push(Channel {
                sampler: (samplers.len() - 1) as u32,
                target: ChannelTarget {
                    node: ch.node_index as u32,
                    path: ch.path.clone(),
                },
            });
        }

        animations_json.push(Animation {
            name: anim.name.clone(),
            samplers,
            channels,
        });
    }

    b.pad4();
    let bin_length = b.bin.len() as u32;

    let scene_nodes: Vec<u32> = (0..gltf_nodes.len() as u32).collect();

    let gltf = Gltf {
        asset: Asset {
            version: "2.0".to_string(),
            generator: "magic-city-editor".to_string(),
        },
        scene: 0,
        scenes: vec![Scene { nodes: scene_nodes }],
        nodes: gltf_nodes,
        meshes,
        materials,
        accessors: b.accessors,
        buffer_views: b.buffer_views,
        buffers: vec![BufferDef {
            byte_length: bin_length,
        }],
        animations: animations_json,
    };

    let mut json_bytes = serde_json::to_vec(&gltf).map_err(|e| e.to_string())?;
    while json_bytes.len() % 4 != 0 {
        json_bytes.push(b' ');
    }

    // Сборка GLB.
    let total_length = 12 + 8 + json_bytes.len() as u32 + 8 + bin_length;
    let mut glb: Vec<u8> = Vec::with_capacity(total_length as usize);

    glb.extend_from_slice(b"glTF");
    glb.extend_from_slice(&2u32.to_le_bytes());
    glb.extend_from_slice(&total_length.to_le_bytes());

    glb.extend_from_slice(&(json_bytes.len() as u32).to_le_bytes());
    glb.extend_from_slice(b"JSON");
    glb.extend_from_slice(&json_bytes);

    glb.extend_from_slice(&bin_length.to_le_bytes());
    glb.extend_from_slice(b"BIN\x00");
    glb.extend_from_slice(&b.bin);

    let mut out_path = PathBuf::from(&payload.output_dir);
    out_path.push(&payload.filename);
    fs::write(&out_path, &glb).map_err(|e| e.to_string())?;

    Ok(out_path.to_string_lossy().to_string())
}
