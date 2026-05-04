const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");
const DATA_DIR = path.join(__dirname, "data");
const CHAT_STORE_PATH = path.join(DATA_DIR, "chats.json");
const GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const MAX_BODY_BYTES = 100_000;
const MAX_PROMPT_LENGTH = 2_000;
const MAX_ARTIFACT_FIELD_LENGTH = 60_000;

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon"
};

function loadEnvFile() {
  const envPath = path.join(__dirname, ".env");

  if (!fs.existsSync(envPath)) {
    return;
  }

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const equalIndex = trimmed.indexOf("=");
    const key = trimmed.slice(0, equalIndex).trim();
    let value = trimmed.slice(equalIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnvFile();

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

function applySecurityHeaders(res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
}

function truncateText(value, maxLength) {
  const text = String(value || "").trim();

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength - 1).trim()}...`;
}

function isValidChatId(chatId) {
  return typeof chatId === "string" && /^[a-z0-9-]{1,80}$/i.test(chatId);
}

function validateArtifactSafety(artifact) {
  const blockedJs = /\b(fetch|XMLHttpRequest|WebSocket|EventSource|importScripts)\b|navigator\.sendBeacon|document\.cookie|localStorage|sessionStorage/i;
  const blockedHtml = /<script\b|<iframe\b|\son[a-z]+\s*=/i;
  const blockedCss = /@import\b|url\(\s*["']?\s*https?:/i;

  if (blockedHtml.test(artifact.html)) {
    throw new Error("Generated HTML included disallowed script, frame, or inline event content.");
  }

  if (blockedCss.test(artifact.css)) {
    throw new Error("Generated CSS included a disallowed external import or remote asset.");
  }

  if (blockedJs.test(artifact.js)) {
    throw new Error("Generated JavaScript included disallowed storage, cookie, or network access.");
  }
}

function ensureChatStore() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(CHAT_STORE_PATH)) {
    fs.writeFileSync(CHAT_STORE_PATH, JSON.stringify({ chats: [] }, null, 2));
  }
}

function readChatStore() {
  ensureChatStore();

  try {
    const store = JSON.parse(fs.readFileSync(CHAT_STORE_PATH, "utf8"));
    return {
      chats: Array.isArray(store.chats) ? store.chats : []
    };
  } catch (error) {
    return { chats: [] };
  }
}

function writeChatStore(store) {
  ensureChatStore();
  fs.writeFileSync(CHAT_STORE_PATH, JSON.stringify(store, null, 2));
}

function createChat() {
  const now = new Date().toISOString();

  return {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    title: "New chat",
    pinned: false,
    pinnedAt: null,
    messages: [],
    artifact: null,
    createdAt: now,
    updatedAt: now
  };
}

function summarizeChat(chat) {
  const lastMessage = chat.messages.at(-1);

  return {
    id: chat.id,
    title: truncateText(chat.title, 64),
    pinned: Boolean(chat.pinned),
    updatedAt: chat.updatedAt,
    preview: lastMessage ? truncateText(lastMessage.text, 120) : "No messages yet"
  };
}

function getChatSummaries() {
  return readChatStore().chats
    .slice()
    .sort((a, b) => {
      if (Boolean(a.pinned) !== Boolean(b.pinned)) {
        return Boolean(b.pinned) - Boolean(a.pinned);
      }

      if (Boolean(a.pinned) && Boolean(b.pinned)) {
        return new Date(a.pinnedAt || a.updatedAt) - new Date(b.pinnedAt || b.updatedAt);
      }

      return new Date(b.updatedAt) - new Date(a.updatedAt);
    })
    .map(summarizeChat);
}

function findChatById(store, chatId) {
  if (!isValidChatId(chatId)) {
    return null;
  }

  return store.chats.find((item) => item.id === chatId) || null;
}

function findOrCreateChat(chatId) {
  const store = readChatStore();
  let chat = isValidChatId(chatId) ? store.chats.find((item) => item.id === chatId) : null;

  if (!chat) {
    chat = createChat();
    store.chats.push(chat);
  }

  return { store, chat };
}

function saveGeneratedChat(chatId, prompt, artifact) {
  const { store, chat } = findOrCreateChat(chatId);
  const now = new Date().toISOString();
  const agentText = artifact.summary;

  chat.messages.push({ role: "user", text: prompt, createdAt: now });
  chat.messages.push({ role: "agent", text: agentText, createdAt: now });
  chat.artifact = artifact;
  chat.updatedAt = now;

  if (chat.title === "New chat") {
    chat.title = truncateText(artifact.title || prompt, 48);
  }

  writeChatStore(store);

  return chat;
}

function saveFailedChat(chatId, prompt, errorMessage) {
  const { store, chat } = findOrCreateChat(chatId);
  const now = new Date().toISOString();

  chat.messages.push({ role: "user", text: prompt, createdAt: now });
  chat.messages.push({ role: "agent", text: errorMessage, createdAt: now });
  chat.updatedAt = now;

  if (chat.title === "New chat") {
    chat.title = truncateText(prompt, 48) || "Generation error";
  }

  writeChatStore(store);

  return chat;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (Buffer.byteLength(body) > MAX_BODY_BYTES) {
        reject(new Error("Request body is too large."));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function buildAgentReply(prompt) {
  const cleanPrompt = String(prompt || "").trim();
  const lower = cleanPrompt.toLowerCase();

  let concept = "kinetic glass card";
  let palette = ["#111827", "#00c2ff", "#ff477e", "#f8fafc"];
  let motion = "springy hover lift, soft light sweep, and staggered entrance timing";

  if (lower.includes("button")) {
    concept = "magnetic action button";
    palette = ["#111827", "#4ade80", "#22d3ee", "#f8fafc"];
    motion = "cursor-follow glow, press compression, and ripple feedback";
  } else if (lower.includes("loader") || lower.includes("loading")) {
    concept = "orbital loading system";
    palette = ["#0f172a", "#a78bfa", "#38bdf8", "#f8fafc"];
    motion = "looping orbital paths, delayed trails, and pulse breathing";
  } else if (lower.includes("menu") || lower.includes("nav")) {
    concept = "liquid command navigation";
    palette = ["#101010", "#f59e0b", "#14b8a6", "#f4f4f5"];
    motion = "sliding selection rail, elastic underline, and layered reveal";
  } else if (lower.includes("card") || lower.includes("dashboard")) {
    concept = "responsive analytics card";
    palette = ["#111827", "#60a5fa", "#f97316", "#f9fafb"];
    motion = "depth parallax, animated metric count, and chart stroke drawing";
  }

  const html = `<section class="agent-artifact ${concept.replace(/\s+/g, "-")}">
  <div class="artifact-glow"></div>
  <div class="artifact-shell">
    <p class="artifact-kicker">Generated UI motion concept</p>
    <h2>${concept}</h2>
    <p>${motion} designed for modern HTML, CSS, and JavaScript interfaces.</p>
    <button class="artifact-button">Launch motion</button>
  </div>
</section>`;

  const css = `.agent-artifact {
  --ink: ${palette[0]};
  --accent: ${palette[1]};
  --hot: ${palette[2]};
  --paper: ${palette[3]};
  position: relative;
  display: grid;
  min-height: 320px;
  place-items: center;
  overflow: hidden;
  border-radius: 8px;
  color: var(--paper);
  background:
    radial-gradient(circle at 30% 20%, color-mix(in srgb, var(--accent) 42%, transparent), transparent 34%),
    linear-gradient(135deg, var(--ink), #050505);
}
.artifact-glow {
  position: absolute;
  width: 210px;
  aspect-ratio: 1;
  border-radius: 999px;
  background: var(--hot);
  filter: blur(54px);
  opacity: .42;
  animation: drift 6s ease-in-out infinite alternate;
}
.artifact-shell {
  position: relative;
  width: min(78%, 440px);
  padding: 28px;
  border: 1px solid rgb(255 255 255 / .22);
  border-radius: 8px;
  background: rgb(255 255 255 / .1);
  backdrop-filter: blur(18px);
  transform: translateY(0);
  animation: arrive .7s cubic-bezier(.2, .9, .2, 1) both;
}
.artifact-kicker {
  margin: 0 0 10px;
  color: var(--accent);
  font-size: 12px;
  text-transform: uppercase;
}
.artifact-shell h2 {
  margin: 0;
  font-size: clamp(30px, 7vw, 54px);
  line-height: .96;
}
.artifact-shell p {
  line-height: 1.6;
}
.artifact-button {
  border: 0;
  border-radius: 999px;
  padding: 12px 18px;
  color: var(--ink);
  background: var(--paper);
  cursor: pointer;
  transition: transform .25s ease, box-shadow .25s ease;
}
.artifact-button:hover {
  transform: translateY(-3px) scale(1.02);
  box-shadow: 0 18px 42px rgb(0 0 0 / .28);
}
@keyframes arrive {
  from { opacity: 0; transform: translateY(22px) scale(.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes drift {
  from { transform: translate(-80px, -30px); }
  to { transform: translate(90px, 60px); }
}`;

  const js = `document.querySelector(".artifact-button").addEventListener("click", (event) => {
  event.currentTarget.animate(
    [
      { transform: "scale(1)" },
      { transform: "scale(.94)" },
      { transform: "scale(1.04)" },
      { transform: "scale(1)" }
    ],
    { duration: 520, easing: "cubic-bezier(.2, .9, .2, 1)" }
  );
});`;

  return {
    title: concept,
    summary: `Created a ${concept} with ${motion}.`,
    html,
    css,
    js
  };
}

function buildOpenAiPrompt(prompt) {
  return `You are AnimationJS-CSS, an expert UI animation agent.

Create one production-ready front-end animation concept from the user's request.

User request:
${prompt}

Return only valid JSON with this exact shape:
{
  "title": "short concept name",
  "summary": "one concise professional sentence, max 180 characters",
  "html": "HTML markup only for the generated artifact",
  "css": "CSS only, scoped to the artifact classes",
  "js": "JavaScript only, scoped to the artifact markup"
}

Requirements:
- Specialize in HTML, CSS, and JavaScript UI animations.
- The artifact must be visually impressive, polished, responsive, and usable inside the preview panel.
- Keep class names scoped and avoid changing global body/html styles.
- Do not include markdown fences, comments outside code strings, or explanatory text outside the JSON.
- Use accessible semantic HTML where practical.
- Prefer CSS transitions, keyframes, custom properties, and lightweight JavaScript interactions.
- The JavaScript must not use external libraries or network requests.
- Keep the summary polished, direct, and free of extra implementation notes.`;
}

function extractJson(text) {
  const trimmed = String(text || "").trim();

  try {
    return JSON.parse(trimmed);
  } catch (error) {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");

    if (start === -1 || end === -1 || end <= start) {
      throw error;
    }

    return JSON.parse(trimmed.slice(start, end + 1));
  }
}

function normalizeArtifact(payload) {
  const artifact = {
    title: truncateText(payload.title || "Generated UI animation", 80),
    summary: truncateText(payload.summary || "Generated a polished UI animation artifact.", 180),
    html: truncateText(payload.html || "", MAX_ARTIFACT_FIELD_LENGTH),
    css: truncateText(payload.css || "", MAX_ARTIFACT_FIELD_LENGTH),
    js: truncateText(payload.js || "", MAX_ARTIFACT_FIELD_LENGTH)
  };

  if (!artifact.html || !artifact.css) {
    throw new Error("Gemini returned an incomplete UI artifact.");
  }

  validateArtifactSafety(artifact);

  return artifact;
}

function getGeminiText(payload) {
  return payload.candidates?.flatMap((candidate) => candidate.content?.parts || [])
    .filter((part) => typeof part.text === "string")
    .map((part) => part.text)
    .join("\n") || "";
}

async function generateWithGemini(prompt) {
  if (!process.env.GEMINI_API_KEY) {
    return {
      ...buildAgentReply(prompt),
      provider: "local",
      summary: "Generated a polished local preview while Gemini is not configured."
    };
  }

  const model = encodeURIComponent(GEMINI_MODEL);
  const response = await fetch(`${GEMINI_API_BASE_URL}/${model}:generateContent`, {
    method: "POST",
    headers: {
      "x-goog-api-key": process.env.GEMINI_API_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            { text: buildOpenAiPrompt(prompt) }
          ]
        }
      ],
      generationConfig: {
        responseMimeType: "application/json"
      }
    })
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = payload.error?.message || `Gemini request failed with status ${response.status}.`;
    throw new Error(message);
  }

  const text = getGeminiText(payload);
  const artifact = normalizeArtifact(extractJson(text));

  return {
    ...artifact,
    provider: "gemini",
    model: GEMINI_MODEL
  };
}

async function handleApi(req, res) {
  let body = {};
  let prompt = "";

  try {
    const raw = await readBody(req);
    body = raw ? JSON.parse(raw) : {};
    prompt = String(body.prompt || "").trim();

    if (!prompt) {
      sendJson(res, 400, { error: "Prompt is required." });
      return;
    }

    if (prompt.length > MAX_PROMPT_LENGTH) {
      sendJson(res, 413, { error: `Prompt must be ${MAX_PROMPT_LENGTH} characters or fewer.` });
      return;
    }

    const artifact = await generateWithGemini(prompt);
    const chat = saveGeneratedChat(body.chatId, prompt, artifact);

    sendJson(res, 200, {
      artifact,
      chat: summarizeChat(chat)
    });
  } catch (error) {
    const payload = { error: error.message };

    if (prompt) {
      payload.chat = summarizeChat(saveFailedChat(body.chatId, prompt, error.message));
    }

    sendJson(res, 500, payload);
  }
}

function handleChats(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "GET" && url.pathname === "/api/chats") {
    sendJson(res, 200, { chats: getChatSummaries() });
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/chats") {
    const store = readChatStore();
    const chat = createChat();
    store.chats.push(chat);
    writeChatStore(store);
    sendJson(res, 201, { chat });
    return true;
  }

  const match = url.pathname.match(/^\/api\/chats\/([^/]+)$/);

  if (req.method === "GET" && match) {
    const store = readChatStore();
    const chatId = decodeURIComponent(match[1]);

    if (!isValidChatId(chatId)) {
      sendJson(res, 400, { error: "Invalid chat id." });
      return true;
    }

    const chat = store.chats.find((item) => item.id === chatId);

    if (!chat) {
      sendJson(res, 404, { error: "Chat not found." });
      return true;
    }

    sendJson(res, 200, { chat });
    return true;
  }

  if (req.method === "PATCH" && match) {
    handleChatUpdate(req, res, decodeURIComponent(match[1]));
    return true;
  }

  if (req.method === "DELETE" && match) {
    const store = readChatStore();
    const chatId = decodeURIComponent(match[1]);

    if (!isValidChatId(chatId)) {
      sendJson(res, 400, { error: "Invalid chat id." });
      return true;
    }

    const chatIndex = store.chats.findIndex((item) => item.id === chatId);

    if (chatIndex === -1) {
      sendJson(res, 404, { error: "Chat not found." });
      return true;
    }

    store.chats.splice(chatIndex, 1);
    writeChatStore(store);
    sendJson(res, 200, { deleted: true, chatId });
    return true;
  }

  return false;
}

async function handleChatUpdate(req, res, chatId) {
  try {
    if (!isValidChatId(chatId)) {
      sendJson(res, 400, { error: "Invalid chat id." });
      return;
    }

    const raw = await readBody(req);
    const body = raw ? JSON.parse(raw) : {};
    const store = readChatStore();
    const chat = findChatById(store, chatId);

    if (!chat) {
      sendJson(res, 404, { error: "Chat not found." });
      return;
    }

    if (Object.prototype.hasOwnProperty.call(body, "title")) {
      const title = truncateText(body.title, 64);

      if (!title) {
        sendJson(res, 400, { error: "Chat title is required." });
        return;
      }

      chat.title = title;
    }

    if (Object.prototype.hasOwnProperty.call(body, "pinned")) {
      const nextPinned = Boolean(body.pinned);

      if (nextPinned && !chat.pinned) {
        chat.pinnedAt = new Date().toISOString();
      }

      if (!nextPinned) {
        chat.pinnedAt = null;
      }

      chat.pinned = nextPinned;
    }

    chat.updatedAt = new Date().toISOString();
    writeChatStore(store);
    sendJson(res, 200, { chat: summarizeChat(chat) });
  } catch (error) {
    sendJson(res, 400, { error: error.message || "Could not update chat." });
  }
}

function handleHealth(req, res) {
  if (req.method !== "GET" || req.url !== "/api/health") {
    return false;
  }

  sendJson(res, 200, {
    status: "ok",
    provider: process.env.GEMINI_API_KEY ? "gemini" : "local",
    model: GEMINI_MODEL,
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString()
  });

  return true;
}

function serveStatic(req, res) {
  let safeUrl = "/index.html";

  try {
    safeUrl = req.url === "/" ? "/index.html" : decodeURIComponent(req.url.split("?")[0]);
  } catch (error) {
    res.writeHead(400);
    res.end("Bad request");
    return;
  }

  const filePath = path.normalize(path.join(PUBLIC_DIR, safeUrl));
  const relativePath = path.relative(PUBLIC_DIR, filePath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404);
      res.end(req.method === "HEAD" ? undefined : "Not found");
      return;
    }

    const ext = path.extname(filePath);
    res.writeHead(200, { "Content-Type": mimeTypes[ext] || "application/octet-stream" });
    res.end(req.method === "HEAD" ? undefined : data);
  });
}

const server = http.createServer((req, res) => {
  applySecurityHeaders(res);

  if (handleHealth(req, res)) {
    return;
  }

  if (req.url.startsWith("/api/chats") && handleChats(req, res)) {
    return;
  }

  if (req.method === "POST" && req.url === "/api/generate") {
    handleApi(req, res);
    return;
  }

  if (req.method === "GET" || req.method === "HEAD") {
    serveStatic(req, res);
    return;
  }

  res.writeHead(405);
  res.end("Method not allowed");
});

server.listen(PORT, () => {
  console.log(`AnimationJS-CSS is running at http://localhost:${PORT}`);
  console.log(`Gemini model: ${GEMINI_MODEL}`);
});
