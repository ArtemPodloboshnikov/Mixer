# Mixer

<p align="center">
  <img src="/src-tauri/icons/128x128@2x.png" alt="App logo" />
</p>

<p align="center">
    <img src="/screenshots/app.png" alt="Main window" />
</p>

---

## About

**Mixer** is a desktop application built with Tauri v2 and SvelteKit for working with procedural 3D models. The core idea: describe in plain language what you want to create or change, and the built-in LLM assistant generates a JSON manifest that the app turns into a ready-to-use GLB file.

The app is designed for local-first workflows — connect to **Ollama**, **LM Studio**, or the bundled **llama-server** without an internet connection. Cloud providers (OpenAI, Anthropic, OpenRouter) are also supported.

---

## Download

Built binaries are available in the **[Releases](https://github.com/ArtemPodloboshnikov/Mixer/releases)** section of this repository.

Choose the installer for your platform (Windows `.msi` / `.exe`, Linux `.deb` / `.AppImage`, macOS `.dmg`) and follow the installer prompts.

---

## Features

### 3D viewport
- Load `.glb` and `.gltf` models.
- Mouse camera controls (orbit, zoom, pan).
- Scene grid with orange accent.
- Soft lighting with warm and purple light sources.

### Models and animations
- List of loaded models with names and tags.
- **Reference models** — non-editable models passed to the LLM as style and structure inspiration.
- Select a time segment of the animation and edit it using LLM.
- Select a node in the 3D model and edit only that node via LLM.
- Select a node and a time segment, and change the animation of the selected node within the selected time segment via LLM.

### LLM assistant
- Built-in chat with streaming output.
- Providers: **OpenAI**, **Anthropic**, **OpenRouter**, **llama.cpp (sidecar)**, **Ollama**, **LM Studio**.
- Manual port input field for custom configurations.

### Local models
- Scan a folder for `.gguf` files.
- Launch the bundled `llama-server.exe` as a sidecar.
- GPU acceleration via `-ngl` (when CUDA libraries are present).
- Connect to external servers: Ollama (`11434`), LM Studio (`1234`).

### Reference models
- Each reference is automatically described: mesh count, vertex count, triangle count, bounding box, animation list, top-level node names.
- Optional **geometry extraction** for each mesh (positions + indices) with uniform downsampling.
- Vertices-per-node limit is configurable in the UI (`Max vertices per node`).
- All reference descriptions are injected into the LLM system prompt.

### Format conversion
- Supported directions: **GLB → GLTF, OBJ, PLY, STL**.
- GLTF export embeds the buffer as base64 (self-contained file).
- Output files are saved to the export folder.

### Interface
- Fully available in Russian and English (toggle in settings).
- Status bar showing current state and active provider.

### Export
- Export folder is configurable in the UI.
- Automatic GLB export after the LLM returns a valid JSON manifest.

---

## Tech stack

| Layer | Stack |
|---|---|
| **Frontend** | Svelte 5, SvelteKit, TypeScript |
| **3D** | Three.js, Threlte (`@threlte/core`, `@threlte/extras`) |
| **Desktop** | Tauri v2 |
| **Backend** | Rust |
| **LLM** | OpenAI SDK (unified client for cloud and local APIs) |
| **Local models** | llama.cpp (`llama-server` sidecar), Ollama, LM Studio |

---

## Building from source

### Steps

```bash
git clone https://github.com/ArtemPodloboshnikov/Mixer.git
cd mixer
npm install
npm run tauri dev
```

For a production build:

```bash
npm run tauri build
```

The installer will appear in `src-tauri/target/release/bundle/`.

---

## Setting up a local LLM

### Option 1: Ollama

```bash
ollama pull qwen3:4b
ollama serve
```

In the app: **Settings → Local models** → port `11434` → **▶ Ollama** → status "Ollama started".

### Option 2: LM Studio

1. Launch LM Studio.
2. Enable **Local Server** (default port `1234`).
3. Load a model.
4. In the app: **Settings → Local models** → click **▶ LM Studio** → status "LM Studio connected".

### Option 3: bundled llama-server

1. Download `llama-b*-bin-win-cu12-x64.zip` from [github.com/ggml-org/llama.cpp](https://github.com/ggml-org/llama.cpp/releases).
2. Copy all files to `src-tauri/binaries/`.
3. In the app, select the folder with `.gguf` models, pick a model, and click **▶ llama-server**.

---

## JSON manifest format

The LLM responds with strictly valid JSON, no markdown fences:

```json
{
  "nodes": [
    {
      "name": "tower",
      "positions": [0,0,0, 1,0,0, 1,1,0, 0,1,0],
      "indices": [0,1,2, 0,2,3],
      "materialName": "default"
    }
  ],
  "animations": [
    {
      "name": "idle",
      "channels": [
        {
          "nodeIndex": 0,
          "path": "rotation",
          "times": [0.0, 1.0, 2.0],
          "values": [0,0,0,1, 0,0.38,0,0.92, 0,0.71,0,0.71]
        }
      ]
    }
  ]
}
```

**Rules:**
- `positions` — flat array of floats (x,y,z triples).
- `indices` — flat array of uints (vertex triples per triangle).
- `path` — one of `translation`, `rotation`, `scale`.
- `rotation` uses quaternions `[x,y,z,w]`.
- If no animation is needed — `"animations": []`.

The app parses the response, extracts the JSON even if wrapped in markdown, and saves the GLB to the export folder.

---

## License

MIT
