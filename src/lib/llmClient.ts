import OpenAI from "openai";
import { app, type ChatMessage } from "./stores.svelte";
import { exportGlb, type ExportPayload } from "./tauriApi";
import { buildReferenceBlock } from "./referenceDescriber";
import { t } from "./i18n";
import { pickAndAddModel } from "./modelLoader";

let client: OpenAI | null = null;
let clientKey = "";

// =====================================================================
//  ОПРЕДЕЛЕНИЕ ЛОКАЛЬНОГО ENDPOINT
// =====================================================================

function isLocalEndpoint(): boolean {
  const cfg = app.llmConfig;

  // Локальные провайдеры — те, что не требуют API-ключа
  const isLocalProvider =
    cfg.provider === "llama-sidecar" ||
    cfg.provider === "ollama" ||
    cfg.provider === "lmstudio";

  // URL указывает на localhost, loopback или локальную сеть
  const isLocalUrl =
    cfg.baseURL.includes("127.0.0.1") ||
    cfg.baseURL.includes("localhost") ||
    /^http:\/\/192\.168\.\d+\.\d+/.test(cfg.baseURL) ||
    /^http:\/\/10\.\d+\.\d+\.\d+/.test(cfg.baseURL) ||
    /^http:\/\/172\.(1[6-9]|2\d|3[01])\.\d+\.\d+/.test(cfg.baseURL);

  return isLocalProvider || isLocalUrl;
}

// Таймаут 10 минут — локальные модели на CPU могут генерировать
// ответ дольше 2-3 минут, стандартных 120 секунд недостаточно.
const REQUEST_TIMEOUT_MS = 600_000;

function getClient(): OpenAI {
  const cfg = app.llmConfig;
  const local = isLocalEndpoint();
  const effectiveKey = local ? "sk-no-key-required" : cfg.apiKey;

  if (!local && !cfg.apiKey) {
    throw new Error(t("error.noApiKey"));
  }

  const key = `${cfg.baseURL}|${effectiveKey}`;
  if (!client || clientKey !== key) {
    client = new OpenAI({
      baseURL: cfg.baseURL,
      apiKey: effectiveKey,
      dangerouslyAllowBrowser: true,
      timeout: REQUEST_TIMEOUT_MS,
    });
    clientKey = key;
  }
  return client;
}

// =====================================================================
//  СИСТЕМНЫЙ ПРОМПТ — ТРЕБУЕТ JSON-МАНИФЕСТ
// =====================================================================

const SYSTEM_PROMPT = `You are a procedural 3D model generator for the "Mixer" editor.

Respond with VALID JSON only. No markdown fences, no explanations, no comments.
Response format:
{
  "nodes": [
    {
      "name": "node_name",
      "positions": [x0,y0,z0, x1,y1,z1, ...],
      "indices": [i0,i1,i2, ...],
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
          "values": [qx,qy,qz,qw, qx,qy,qz,qw, ...]
        }
      ]
    }
  ]
}

Rules:
- "positions" is a flat array of floats (triples x,y,z).
- "indices" is a flat array of unsigned integers (triples of vertices per triangle).
- "path" must be one of: "translation", "rotation", "scale".
- "rotation" uses quaternions in [x,y,z,w] order.
- All numbers must be plain numbers, not strings, not null.
- If no animation is needed, return "animations": [].
- Never wrap the JSON in triple backticks.
- Never output text before or after the JSON.`;

// =====================================================================
//  ПАРСИНГ JSON-МАНИФЕСТА ИЗ ОТВЕТА
// =====================================================================

interface ManifestNode {
  name: string;
  positions: number[];
  indices: number[];
  materialName: string;
}

interface ManifestChannel {
  nodeIndex: number;
  path: "translation" | "rotation" | "scale";
  times: number[];
  values: number[];
}

interface ManifestAnimation {
  name: string;
  channels: ManifestChannel[];
}

interface Manifest {
  nodes: ManifestNode[];
  animations?: ManifestAnimation[];
}

/**
 * Извлекает JSON-манифест из ответа LLM.
 * Модель иногда добавляет ```json ... ``` или лишний текст.
 */
function tryParseManifest(text: string): Manifest | null {
  if (!text) return null;

  let cleaned = text.trim();

  // Убираем markdown-обёртки
  cleaned = cleaned
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  // Если модель написала текст до JSON — вырезаем первую { ... } скобку
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }

  try {
    const parsed = JSON.parse(cleaned);
    if (!parsed || !Array.isArray(parsed.nodes)) return null;
    return parsed as Manifest;
  } catch {
    return null;
  }
}

/**
 * Экспортирует манифест в GLB через Rust-команду.
 * Возвращает путь к сохранённому файлу или null при ошибке.
 */
async function exportManifest(manifest: Manifest): Promise<string | null> {
  if (!app.exportDir) {
    app.setStatus(t("status.exportDirMissing"), "error");
    return null;
  }

  const payload: ExportPayload = {
    outputDir: app.exportDir,
    filename: `generated_${Date.now()}.glb`,
    nodes: manifest.nodes.map((n) => ({
      name: n.name,
      positions: n.positions,
      indices: n.indices,
      materialName: n.materialName ?? "default",
    })),
    animations: (manifest.animations ?? []).map((a) => ({
      name: a.name,
      channels: a.channels.map((c) => ({
        nodeIndex: c.nodeIndex,
        path: c.path,
        times: c.times,
        values: c.values,
      })),
    })),
  };

  try {
    const outPath = await exportGlb(payload);
    return outPath;
  } catch (e: any) {
    app.setStatus(
      t("status.exportError", { msg: e?.message ?? String(e) }),
      "error"
    );
    return null;
  }
}

// =====================================================================
//  ОТПРАВКА СООБЩЕНИЯ
// =====================================================================

export async function sendMessage(
  userText: string,
  onDelta: (chunk: string) => void
): Promise<void> {
  const cfg = app.llmConfig;

  app.messages.push({ role: "user", content: userText });
  const assistantMsg: ChatMessage = {
    role: "assistant",
    content: "",
    streaming: true,
  };
  app.messages.push(assistantMsg);

  const referenceBlock = buildReferenceBlock(
    app.models,
    app.modelDescriptions
  );

  const systemContent = SYSTEM_PROMPT + referenceBlock;

  const apiMessages = [
    { role: "system" as const, content: systemContent },
    ...app.messages
      .filter((m) => !m.streaming)
      .map((m) => ({ role: m.role, content: m.content })),
  ];

  // Создаём контроллер ДО запроса, чтобы кнопка "Стоп" могла его прервать.
  const controller = new AbortController();
  app.activeAbort = controller;

  let receivedAnyToken = false;
  let wasAborted = false;

  try {
    app.setStatus(t("status.generating"), "info");

    const stream = await getClient().chat.completions.create(
      {
        model: cfg.model,
        messages: apiMessages,
        stream: true,
      },
      {
        signal: controller.signal,
        timeout: REQUEST_TIMEOUT_MS,
      }
    );

    for await (const chunk of stream) {
      if (controller.signal.aborted) break;
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        receivedAnyToken = true;
        assistantMsg.content += delta;
        const lastIdx = app.messages.length - 1;
        app.messages[lastIdx] = { ...assistantMsg };
        app.messages = [...app.messages];
        onDelta(delta);
      }
    }

    assistantMsg.streaming = false;

    // ---------- Прервано пользователем ----------
    if (controller.signal.aborted) {
      wasAborted = true;
      if (!assistantMsg.content) {
        assistantMsg.content = t("chat.aborted");
      } else {
        assistantMsg.content += "\n\n" + t("chat.abortedSuffix");
      }
      app.setStatus(t("status.stopped"), "info");
      app.messages = [...app.messages];
      return;
    }

    // ---------- Пустой ответ ----------
    if (!receivedAnyToken) {
      assistantMsg.content = t("chat.emptyResponse");
      app.setStatus(t("status.emptyResponse"), "error");
      app.messages = [...app.messages];
      return;
    }

    // ---------- Нормальный ответ ----------
    app.setStatus(t("status.responseReceived"), "success");
    app.messages = [...app.messages];

    // Пробуем распарсить ответ как JSON-манифест и экспортировать GLB
    const manifest = tryParseManifest(assistantMsg.content);
    if (manifest && manifest.nodes.length > 0) {
      app.setStatus(
        t("status.manifestParsed", { n: manifest.nodes.length }),
        "info"
      );
      const outPath = await exportManifest(manifest);
      if (outPath) {
        await pickAndAddModel(false, outPath)
        app.setStatus(
          t("status.glbSaved", { path: outPath }),
          "success"
        );
      }
    }
  } catch (err: any) {
    assistantMsg.streaming = false;

    // OpenAI SDK бросает APIUserAbortError при abort.
    const aborted =
      err?.name === "AbortError" ||
      err?.name === "APIUserAbortError" ||
      controller.signal.aborted;

    if (aborted) {
      wasAborted = true;
      if (!assistantMsg.content) {
        assistantMsg.content = t("chat.aborted");
      } else {
        assistantMsg.content += "\n\n" + t("chat.abortedSuffix");
      }
      app.setStatus(t("status.stopped"), "info");
    } else {
      assistantMsg.content =
        assistantMsg.content ||
        `⚠ ${t("chat.error")}: ${err?.message ?? String(err)}`;
      app.setStatus(
        t("status.llmError", { msg: err?.message ?? String(err) }),
        "error"
      );
    }

    app.messages = [...app.messages];
  } finally {
    if (app.activeAbort === controller) {
      app.activeAbort = null;
    }
    void wasAborted;
  }
}

// =====================================================================
//  УПРАВЛЕНИЕ ГЕНЕРАЦИЕЙ
// =====================================================================

/** Прерывает текущий запрос к LLM. */
export function stopGeneration(): void {
  if (app.activeAbort) {
    app.activeAbort.abort();
    app.setStatus(t("status.stopping"), "info");
  }
}

export function clearChat() {
  // Если что-то генерируется — сначала остановим
  if (app.activeAbort) stopGeneration();
  app.messages = [];
}
