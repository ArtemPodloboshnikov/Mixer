import { app, type AppLanguage } from "./stores.svelte";

type Dict = Record<string, string>;

const ru: Dict = {
  // Общие
  "common.save": "Сохранить",
  "common.builtin": "встроенный",
  "common.external": "внешняя",

  // Навигация
  "nav.editor": "Редактор",
  "nav.settings": "Настройки",

  // Модели
  "models.title": "Модели",
  "models.addObject": "+ Объект",
  "models.addReference": "+ Референс",
  "models.empty": "Нет загруженных моделей",
  "models.tagReference": "референс",
  "models.tagAnims": "{n} аним.",
  "models.hide": "Скрыть",
  "models.show": "Показать",
  "models.delete": "Удалить",
  "models.convertTo": "Конвертировать в",
  "models.format": "Формат",
  "models.convert": "Конвертировать",

  // Провайдер
  "provider.title": "LLM Провайдер",
  "provider.label": "Провайдер",
  "provider.baseURL": "Base URL",
  "provider.apiKey": "API ключ",
  "provider.apiKeyPlaceholder": "не требуется для локальных моделей",
  "provider.model": "Модель",
  "provider.localWarning": "Для облачного провайдера не задан API-ключ",
  "provider.test": "Проверить подключение",
  "provider.testing": "Проверяю...",
  "provider.testHint": "Отправляет запрос к /v1/models и показывает список доступных моделей.",
  "provider.modelsAvailable": "Получено моделей: {n}. Выберите из списка.",

  // Локальные модели
  "local.title": "Локальные модели",
  "local.dir": "Папка с моделями (.gguf)",
  "local.port": "Порт",
  "local.detect": "Проверить OpenAI-совместимый сервер",
  "local.cannotStartRemote": "Удалённый сервер запускается вручную на своей машине",
  "local.running": "работает · PID {pid}",
  "local.stop": "Остановить",

  // Экспорт
  "export.title": "Экспорт",
  "export.dir": "Папка экспорта",

  // Настройки — интерфейс
  "settings.interface": "Интерфейс",
  "settings.language": "Язык интерфейса",
  "settings.languageRu": "Русский",
  "settings.languageEn": "English",
  "settings.pageSubtitle": "Подключение LLM, локальные модели и экспорт.",

  // Настройки — референсы
  "settings.references": "Референсы",
  "settings.maxVerts": "Максимум вершин на ноду",
  "settings.maxVertsHint":
    "Меньше — компактнее промпт, но грубее форма. Больше — точнее, но не влезает в контекст.",

  // Настройки — обновления
  "settings.updates": "Обновления",
  "settings.checkUpdate": "Проверить обновления",
  "settings.checking": "Проверка...",
  "settings.upToDate": "У вас последняя версия",
  "settings.updateAvailable": "Доступна версия {version}",
  "settings.installUpdate": "Установить обновление",
  "settings.downloading": "Загрузка... {percent}%",
  "settings.updateError": "Ошибка обновления: {msg}",
  "settings.currentVersion": "Текущая версия",

  // Чат
  "chat.title": "LLM Ассистент",
  "chat.clear": "Очистить",
  "chat.empty": "Опиши, что хочешь изменить в модели.",
  "chat.hint":
    "Например: «Добавь ещё один ярус башен по кругу» или «Уменьши рунные кольца».",
  "chat.placeholder":
    "Введите промт… (Enter — отправить, Shift+Enter — новая строка)",
  "chat.you": "Ты",
  "chat.ai": "ИИ",
  "chat.stop": "Остановить генерацию",
  "chat.send": "Отправить",
  "chat.aborted": "⏹ Генерация прервана.",
  "chat.abortedSuffix": "⏹ …прервано пользователем.",
  "chat.emptyResponse":
    "⚠ Сервер вернул пустой ответ. Проверьте, что имя модели в настройках совпадает с загруженной моделью.",
  "chat.error": "Ошибка",

  // Статусы
  "status.ready": "Готово",
  "status.generating": "Генерация ответа...",
  "status.responseReceived": "Ответ получен",
  "status.emptyResponse": "Пустой ответ от сервера",
  "status.stopped": "Генерация остановлена",
  "status.stopping": "Останавливаю генерацию...",
  "status.settingsSaved": "Настройки сохранены",
  "status.loading": "Загружено: {name}",
  "status.manifestParsed": "Манифест получен: {n} нод. Экспортирую GLB...",
  "status.glbSaved": "GLB сохранён: {path}",
  "status.exportDirMissing": "Манифест получен, но не задана папка экспорта",
  "status.exportError": "Ошибка экспорта GLB: {msg}",
  "status.llmError": "Ошибка LLM: {msg}",
  "status.loadingError": "Ошибка загрузки",
  "status.scanning": "Сканирую папку с моделями...",
  "status.modelsFound": "Найдено моделей: {n}",
  "status.scanError": "Ошибка сканирования",
  "status.selectModelFirst": "Сначала выберите .gguf-модель",
  "status.sidecarReady": "llama-server готов (PID {pid})",
  "status.sidecarError": "Не удалось запустить llama-server",
  "status.ollamaStarted": "Ollama запущена (PID {pid})",
  "status.ollamaError": "Не удалось запустить Ollama",
  "status.cannotStartRemote": "Нельзя запустить удалённый сервер из приложения",
  "status.processStopped": "Процесс остановлен",
  "status.stopError": "Ошибка остановки",
  "status.settingsSaveError": "Ошибка сохранения настроек: {msg}",
  "status.settingsLoadError": "Не удалось загрузить настройки: {msg}",
  "status.converting": "Конвертирую модель...",
  "status.convertSuccess": "Готово: {path}",
  "status.convertError": "Ошибка конвертации: {msg}",
  "status.convertNoPath": "У модели нет пути к исходному файлу",
  "status.convertSameFormat": "Модель уже в формате GLB",
  "status.select3DModelFirst": "Сначала выберите 3D модель",
  "status.lmStudioDetected": "LM Studio подключён на порту {port}",
  "status.lmStudioNotResponding":
    "LM Studio не отвечает на порту {port}. Запустите LM Studio и включите Local Server.",
  "status.localApiChecking": "Проверяю сервер: {url}...",
  "status.localApiDetected": "Подключено к {url} ({count} моделей)",
  "status.localApiNotResponding": "Сервер не отвечает: {url}",
  "status.exportDirSet": "Папка экспорта: {dir}",
  "status.providerUrlEmpty": "Base URL не задан — заполните поле выше.",
  "status.providerChecking": "Проверяю сервер: {url}...",
  "status.providerReachable": "Сервер отвечает: {url} ({count} модели)",
  "status.providerUnreachable": "Сервер не отвечает: {url}",
  "status.providerCheckError": "Ошибка проверки: {msg}",
  "status.nothingSelected": "Ничего не выделено",
  "status.clearRange": "Сбросить отрезок",
  "status.nodeSelected": "Узел выделен",

  // Вьюпорт
  "viewport.play": "▶ Играть",
  "viewport.pause": "⏸ Пауза",
  "viewport.animation": "— анимация —",
  "viewport.noModel": "нет модели",
  "viewport.nodes": "Узлы",

  // Ошибки
  "error.noApiKey":
    "Для облачного провайдера не задан API-ключ. Откройте настройки.",
};

const en: Dict = {
  // Common
  "common.save": "Save",
  "common.builtin": "built-in",
  "common.external": "external",

  // Navigation
  "nav.editor": "Editor",
  "nav.settings": "Settings",

  // Models
  "models.title": "Models",
  "models.addObject": "+ Object",
  "models.addReference": "+ Reference",
  "models.empty": "No models loaded",
  "models.tagReference": "reference",
  "models.tagAnims": "{n} anim.",
  "models.hide": "Hide",
  "models.show": "Show",
  "models.delete": "Delete",
  "models.convertTo": "Convert to",
  "models.format": "Format",
  "models.convert": "Convert",

  // Provider
  "provider.title": "LLM Provider",
  "provider.label": "Provider",
  "provider.baseURL": "Base URL",
  "provider.apiKey": "API key",
  "provider.apiKeyPlaceholder": "not required for local models",
  "provider.model": "Model",
  "provider.localWarning": "No API key configured for cloud provider",
  "provider.test": "Test connection",
  "provider.testing": "Testing...",
  "provider.testHint": "Sends a request to /v1/models and lists the available models.",
  "provider.modelsAvailable": "Models received: {n}. Pick from the list.",

  // Local models
  "local.title": "Local models",
  "local.dir": "Models folder (.gguf)",
  "local.port": "Port",
  "local.detect": "Check OpenAI-compatible server",
  "local.cannotStartRemote":
    "Remote server must be started manually on its own machine",
  "local.running": "running · PID {pid}",
  "local.stop": "Stop",

  // Export
  "export.title": "Export",
  "export.dir": "Export folder",

  // Settings — interface
  "settings.interface": "Interface",
  "settings.language": "Interface language",
  "settings.languageRu": "Russian",
  "settings.languageEn": "English",
  "settings.pageSubtitle": "LLM provider, local models, and export.",

  // Settings — references
  "settings.references": "References",
  "settings.maxVerts": "Max vertices per node",
  "settings.maxVertsHint":
    "Lower — smaller prompt, coarser shape. Higher — more accurate, may overflow context.",

  // Settings — updates
  "settings.updates": "Updates",
  "settings.checkUpdate": "Check for updates",
  "settings.checking": "Checking...",
  "settings.upToDate": "You have the latest version",
  "settings.updateAvailable": "Version {version} is available",
  "settings.installUpdate": "Install update",
  "settings.downloading": "Downloading... {percent}%",
  "settings.updateError": "Update error: {msg}",
  "settings.currentVersion": "Current version",

  // Chat
  "chat.title": "LLM Assistant",
  "chat.clear": "Clear",
  "chat.empty": "Describe what you want to change in the model.",
  "chat.hint":
    "For example: “Add another ring of towers” or “Shrink the rune rings”.",
  "chat.placeholder":
    "Enter a prompt… (Enter — send, Shift+Enter — new line)",
  "chat.you": "You",
  "chat.ai": "AI",
  "chat.stop": "Stop generation",
  "chat.send": "Send",
  "chat.aborted": "⏹ Generation interrupted.",
  "chat.abortedSuffix": "⏹ …interrupted by user.",
  "chat.emptyResponse":
    "⚠ Server returned an empty response. Check that the model name in settings matches the loaded model.",
  "chat.error": "Error",

  // Statuses
  "status.ready": "Ready",
  "status.generating": "Generating response...",
  "status.responseReceived": "Response received",
  "status.emptyResponse": "Empty response from server",
  "status.stopped": "Generation stopped",
  "status.stopping": "Stopping generation...",
  "status.settingsSaved": "Settings saved",
  "status.loading": "Loaded: {name}",
  "status.manifestParsed": "Manifest parsed: {n} nodes. Exporting GLB...",
  "status.glbSaved": "GLB saved: {path}",
  "status.exportDirMissing":
    "Manifest received, but export folder is not set",
  "status.exportError": "GLB export error: {msg}",
  "status.llmError": "LLM error: {msg}",
  "status.loadingError": "Loading error",
  "status.scanning": "Scanning models folder...",
  "status.modelsFound": "Models found: {n}",
  "status.scanError": "Scan error",
  "status.selectModelFirst": "Select a .gguf model first",
  "status.sidecarReady": "llama-server ready (PID {pid})",
  "status.sidecarError": "Failed to start llama-server",
  "status.ollamaStarted": "Ollama started (PID {pid})",
  "status.ollamaError": "Failed to start Ollama",
  "status.cannotStartRemote": "Cannot start a remote server from the app",
  "status.processStopped": "Process stopped",
  "status.stopError": "Stop error",
  "status.settingsSaveError": "Settings save error: {msg}",
  "status.settingsLoadError": "Failed to load settings: {msg}",
  "status.converting": "Converting model...",
  "status.convertSuccess": "Done: {path}",
  "status.convertError": "Conversion error: {msg}",
  "status.convertNoPath": "Model has no source file path",
  "status.convertSameFormat": "Model is already in GLB format",
  "status.select3DModelFirst": "Select a 3D model first",
  "status.lmStudioDetected": "LM Studio connected on port {port}",
  "status.lmStudioNotResponding":
    "LM Studio is not responding on port {port}. Start LM Studio and enable Local Server.",
  "status.localApiChecking": "Checking server: {url}...",
  "status.localApiDetected": "Connected to {url} ({count} models)",
  "status.localApiNotResponding": "Server is not responding: {url}",
  "status.exportDirSet": "Export folder: {dir}",
  "status.providerUrlEmpty": "Base URL is empty — fill in the field above.",
  "status.providerChecking": "Checking server: {url}...",
  "status.providerReachable": "Server responds: {url} ({count} models)",
  "status.providerUnreachable": "Server is not responding: {url}",
  "status.providerCheckError": "Check error: {msg}",
  "status.nothingSelected": "Nothing selected",
  "status.clearRange": "Clear range",
  "status.nodeSelected": "Node selected",

  // Viewport
  "viewport.play": "▶ Play",
  "viewport.pause": "⏸ Pause",
  "viewport.animation": "— animation —",
  "viewport.noModel": "no model",
  "viewport.nodes": "Nodes",

  // Errors
  "error.noApiKey": "No API key configured for cloud provider. Open settings.",
};

const dictionaries: Record<AppLanguage, Dict> = { ru, en };

/**
 * Возвращает перевод по ключу для текущего языка интерфейса.
 * Поддерживает подстановку {name} через params.
 */
export function t(
  key: string,
  params?: Record<string, string | number>
): string {
  const dict = dictionaries[app.language] ?? ru;
  let str = dict[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      str = str.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
    }
  }
  return str;
}
