use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConvertPayload {
    #[serde(rename = "inputPath")]
    pub input_path: String,
    pub format: String, // "gltf" | "obj" | "ply" | "stl"
    #[serde(rename = "outputDir")]
    pub output_dir: String,
    #[serde(rename = "baseName")]
    pub base_name: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConvertResult {
    pub output_path: String,
    pub format: String,
}

/// Читает GLB и возвращает (JSON-строка glTF, бинарный буфер).
/// Если на входе .gltf — читает его напрямую (буфер пока не поддерживается).
fn load_gltf(input_path: &str) -> Result<(serde_json::Value, Vec<u8>), String> {
    let bytes = fs::read(input_path).map_err(|e| e.to_string())?;

    if bytes.len() < 12 {
        return Err("Файл слишком мал".into());
    }

    // GLB magic
    if &bytes[0..4] == b"glTF" {
        // Парсим GLB-контейнер
        let mut offset = 12;
        let mut json_bytes: Option<Vec<u8>> = None;
        let mut bin_bytes: Vec<u8> = Vec::new();

        while offset + 8 <= bytes.len() {
            let chunk_len = u32::from_le_bytes([
                bytes[offset],
                bytes[offset + 1],
                bytes[offset + 2],
                bytes[offset + 3],
            ]) as usize;
            let chunk_type = &bytes[offset + 4..offset + 8];
            offset += 8;

            if offset + chunk_len > bytes.len() {
                return Err("Повреждённый GLB-контейнер".into());
            }

            let chunk = &bytes[offset..offset + chunk_len];
            offset += chunk_len;

            if chunk_type == b"JSON" {
                json_bytes = Some(chunk.to_vec());
            } else if chunk_type == b"BIN\x00" {
                bin_bytes = chunk.to_vec();
            }
        }

        let json_bytes = json_bytes.ok_or("В GLB нет JSON-чанка")?;
        let json: serde_json::Value =
            serde_json::from_slice(&json_bytes).map_err(|e| e.to_string())?;
        Ok((json, bin_bytes))
    } else {
        // Пробуем как JSON
        let json: serde_json::Value = serde_json::from_slice(&bytes).map_err(|e| e.to_string())?;
        Ok((json, Vec::new()))
    }
}

/// Извлекает позиции и индексы всех мешей glTF.
fn extract_meshes(
    gltf: &serde_json::Value,
    bin: &[u8],
) -> Result<Vec<(Vec<[f32; 3]>, Vec<u32>)>, String> {
    let mut result = Vec::new();

    let meshes = match gltf["meshes"].as_array() {
        Some(m) => m,
        None => return Ok(result),
    };

    let accessors = gltf["accessors"].as_array();
    let buffer_views = gltf["bufferViews"].as_array();

    for mesh in meshes {
        let primitives = match mesh["primitives"].as_array() {
            Some(p) => p,
            None => continue,
        };

        for prim in primitives {
            let pos_acc_idx = match prim["attributes"]["POSITION"].as_u64() {
                Some(i) => i as usize,
                None => continue,
            };

            let positions = read_accessor_vec3(accessors, buffer_views, bin, pos_acc_idx)?;

            let indices = if let Some(idx) = prim["indices"].as_u64() {
                read_accessor_scalar(accessors, buffer_views, bin, idx as usize)?
            } else {
                (0..positions.len() as u32).collect()
            };

            result.push((positions, indices));
        }
    }

    Ok(result)
}

fn read_accessor_vec3(
    accessors: Option<&Vec<serde_json::Value>>,
    buffer_views: Option<&Vec<serde_json::Value>>,
    bin: &[u8],
    accessor_idx: usize,
) -> Result<Vec<[f32; 3]>, String> {
    let accessors = accessors.ok_or("Нет accessors")?;
    let buffer_views = buffer_views.ok_or("Нет bufferViews")?;

    let acc = &accessors[accessor_idx];
    let bv_idx = acc["bufferView"].as_u64().ok_or("Нет bufferView")? as usize;
    let count = acc["count"].as_u64().ok_or("Нет count")? as usize;
    let bv = &buffer_views[bv_idx];

    let offset = bv["byteOffset"].as_u64().unwrap_or(0) as usize
        + acc["byteOffset"].as_u64().unwrap_or(0) as usize;

    let mut out = Vec::with_capacity(count);
    for i in 0..count {
        let base = offset + i * 12;
        if base + 12 > bin.len() {
            return Err("Выход за границы буфера".into());
        }
        let x = f32::from_le_bytes([bin[base], bin[base + 1], bin[base + 2], bin[base + 3]]);
        let y = f32::from_le_bytes([bin[base + 4], bin[base + 5], bin[base + 6], bin[base + 7]]);
        let z = f32::from_le_bytes([bin[base + 8], bin[base + 9], bin[base + 10], bin[base + 11]]);
        out.push([x, y, z]);
    }
    Ok(out)
}

fn read_accessor_scalar(
    accessors: Option<&Vec<serde_json::Value>>,
    buffer_views: Option<&Vec<serde_json::Value>>,
    bin: &[u8],
    accessor_idx: usize,
) -> Result<Vec<u32>, String> {
    let accessors = accessors.ok_or("Нет accessors")?;
    let buffer_views = buffer_views.ok_or("Нет bufferViews")?;

    let acc = &accessors[accessor_idx];
    let bv_idx = acc["bufferView"].as_u64().ok_or("Нет bufferView")? as usize;
    let count = acc["count"].as_u64().ok_or("Нет count")? as usize;
    let component_type = acc["componentType"].as_u64().unwrap_or(5123);
    let bv = &buffer_views[bv_idx];

    let offset = bv["byteOffset"].as_u64().unwrap_or(0) as usize
        + acc["byteOffset"].as_u64().unwrap_or(0) as usize;

    let mut out = Vec::with_capacity(count);
    let size = match component_type {
        5121 => 1usize, // UNSIGNED_BYTE
        5123 => 2usize, // UNSIGNED_SHORT
        5125 => 4usize, // UNSIGNED_INT
        _ => 2usize,
    };

    for i in 0..count {
        let base = offset + i * size;
        if base + size > bin.len() {
            return Err("Выход за границы буфера (indices)".into());
        }
        let v = match size {
            1 => bin[base] as u32,
            2 => u16::from_le_bytes([bin[base], bin[base + 1]]) as u32,
            4 => u32::from_le_bytes([bin[base], bin[base + 1], bin[base + 2], bin[base + 3]]),
            _ => 0,
        };
        out.push(v);
    }
    Ok(out)
}

// =====================================================================
//  СЕРИАЛИЗАТОРЫ
// =====================================================================

fn write_obj(
    meshes: &[(Vec<[f32; 3]>, Vec<u32>)],
    base_name: &str,
    out_dir: &PathBuf,
) -> Result<String, String> {
    let mut out = String::new();
    out.push_str(&format!("# Converted from {}\n", base_name));

    let mut vertex_offset: u32 = 1;
    for (positions, indices) in meshes {
        out.push_str("o mesh\n");
        for p in positions {
            out.push_str(&format!("v {} {} {}\n", p[0], p[1], p[2]));
        }
        for tri in indices.chunks(3) {
            if tri.len() < 3 {
                continue;
            }
            out.push_str(&format!(
                "f {} {} {}\n",
                tri[0] + vertex_offset,
                tri[1] + vertex_offset,
                tri[2] + vertex_offset
            ));
        }
        vertex_offset += positions.len() as u32;
    }

    let path = out_dir.join(format!("{}.obj", base_name));
    fs::write(&path, out).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

fn write_ply(
    meshes: &[(Vec<[f32; 3]>, Vec<u32>)],
    base_name: &str,
    out_dir: &PathBuf,
) -> Result<String, String> {
    let total_verts: usize = meshes.iter().map(|(v, _)| v.len()).sum();
    let total_tris: usize = meshes.iter().map(|(_, i)| i.len() / 3).sum();

    let mut out = String::new();
    out.push_str("ply\nformat ascii 1.0\n");
    out.push_str(&format!("element vertex {}\n", total_verts));
    out.push_str("property float x\nproperty float y\nproperty float z\n");
    out.push_str(&format!("element face {}\n", total_tris));
    out.push_str("property list uchar int vertex_indices\n");
    out.push_str("end_header\n");

    for (positions, _) in meshes {
        for p in positions {
            out.push_str(&format!("{} {} {}\n", p[0], p[1], p[2]));
        }
    }

    let mut offset: u32 = 0;
    for (positions, indices) in meshes {
        for tri in indices.chunks(3) {
            if tri.len() < 3 {
                continue;
            }
            out.push_str(&format!(
                "3 {} {} {}\n",
                tri[0] + offset,
                tri[1] + offset,
                tri[2] + offset
            ));
        }
        offset += positions.len() as u32;
    }

    let path = out_dir.join(format!("{}.ply", base_name));
    fs::write(&path, out).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

fn write_stl(
    meshes: &[(Vec<[f32; 3]>, Vec<u32>)],
    base_name: &str,
    out_dir: &PathBuf,
) -> Result<String, String> {
    let mut out = String::new();
    out.push_str("solid model\n");

    for (positions, indices) in meshes {
        for tri in indices.chunks(3) {
            if tri.len() < 3 {
                continue;
            }
            let a = positions[tri[0] as usize];
            let b = positions[tri[1] as usize];
            let c = positions[tri[2] as usize];

            // Нормаль
            let ux = b[0] - a[0];
            let uy = b[1] - a[1];
            let uz = b[2] - a[2];
            let vx = c[0] - a[0];
            let vy = c[1] - a[1];
            let vz = c[2] - a[2];
            let nx = uy * vz - uz * vy;
            let ny = uz * vx - ux * vz;
            let nz = ux * vy - uy * vx;
            let len = (nx * nx + ny * ny + nz * nz).sqrt().max(1e-8);
            let n = [nx / len, ny / len, nz / len];

            out.push_str(&format!(
                "facet normal {} {} {}\n  outer loop\n",
                n[0], n[1], n[2]
            ));
            out.push_str(&format!("    vertex {} {} {}\n", a[0], a[1], a[2]));
            out.push_str(&format!("    vertex {} {} {}\n", b[0], b[1], b[2]));
            out.push_str(&format!("    vertex {} {} {}\n", c[0], c[1], c[2]));
            out.push_str("  endloop\nendfacet\n");
        }
    }
    out.push_str("endsolid model\n");

    let path = out_dir.join(format!("{}.stl", base_name));
    fs::write(&path, out).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

fn write_gltf(
    gltf: &serde_json::Value,
    bin: &[u8],
    base_name: &str,
    out_dir: &PathBuf,
) -> Result<String, String> {
    let mut gltf_copy = gltf.clone();

    // Встраиваем бинарный буфер как data URI
    use base64::Engine;
    let b64 = base64::engine::general_purpose::STANDARD.encode(bin);
    let data_uri = format!("data:application/octet-stream;base64,{}", b64);

    if let Some(buffers) = gltf_copy["buffers"].as_array_mut() {
        if let Some(b) = buffers.get_mut(0) {
            b["uri"] = serde_json::Value::String(data_uri);
            b["byteLength"] = serde_json::Value::Number(bin.len().into());
        }
    }

    let json_str = serde_json::to_string(&gltf_copy).map_err(|e| e.to_string())?;

    let path = out_dir.join(format!("{}.gltf", base_name));
    fs::write(&path, json_str).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn convert_model(payload: ConvertPayload) -> Result<ConvertResult, String> {
    let (gltf, bin) = load_gltf(&payload.input_path)?;

    let out_dir = PathBuf::from(&payload.output_dir);
    if !out_dir.exists() {
        fs::create_dir_all(&out_dir).map_err(|e| e.to_string())?;
    }

    let output_path = match payload.format.as_str() {
        "gltf" => write_gltf(&gltf, &bin, &payload.base_name, &out_dir)?,
        "obj" | "ply" | "stl" => {
            let meshes = extract_meshes(&gltf, &bin)?;
            if meshes.is_empty() {
                return Err("В модели не найдено ни одного меша".into());
            }
            match payload.format.as_str() {
                "obj" => write_obj(&meshes, &payload.base_name, &out_dir)?,
                "ply" => write_ply(&meshes, &payload.base_name, &out_dir)?,
                "stl" => write_stl(&meshes, &payload.base_name, &out_dir)?,
                _ => unreachable!(),
            }
        }
        other => return Err(format!("Неподдерживаемый формат: {}", other)),
    };

    Ok(ConvertResult {
        output_path,
        format: payload.format,
    })
}
