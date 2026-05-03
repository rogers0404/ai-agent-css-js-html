const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");
const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";

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

const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5.2";

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
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
    summary: `I designed a ${concept} with ${motion}. The code is split into HTML, CSS, and JavaScript so you can move it into any front-end project.`,
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
  "summary": "brief explanation written to the user",
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
- The JavaScript must not use external libraries or network requests.`;
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
    title: String(payload.title || "Generated UI animation").trim(),
    summary: String(payload.summary || "I generated a UI animation artifact from your prompt.").trim(),
    html: String(payload.html || "").trim(),
    css: String(payload.css || "").trim(),
    js: String(payload.js || "").trim()
  };

  if (!artifact.html || !artifact.css) {
    throw new Error("OpenAI returned an incomplete UI artifact.");
  }

  return artifact;
}

async function generateWithOpenAi(prompt) {
  if (!process.env.OPENAI_API_KEY) {
    return {
      ...buildAgentReply(prompt),
      provider: "local",
      summary: "OPENAI_API_KEY is not configured yet, so I used the local fallback generator. Add your key in .env to start using OpenAI prompts."
    };
  }

  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      input: buildOpenAiPrompt(prompt)
    })
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = payload.error?.message || `OpenAI request failed with status ${response.status}.`;
    throw new Error(message);
  }

  const text = payload.output_text || payload.output?.flatMap((item) => item.content || [])
    .filter((item) => item.type === "output_text")
    .map((item) => item.text)
    .join("\n");
  const artifact = normalizeArtifact(extractJson(text));

  return {
    ...artifact,
    provider: "openai",
    model: OPENAI_MODEL
  };
}

async function handleApi(req, res) {
  try {
    const raw = await readBody(req);
    const body = raw ? JSON.parse(raw) : {};
    const prompt = String(body.prompt || "").trim();

    if (!prompt) {
      sendJson(res, 400, { error: "Prompt is required." });
      return;
    }

    sendJson(res, 200, await generateWithOpenAi(prompt));
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
}

function serveStatic(req, res) {
  const safeUrl = req.url === "/" ? "/index.html" : decodeURIComponent(req.url.split("?")[0]);
  const filePath = path.normalize(path.join(PUBLIC_DIR, safeUrl));

  if (!filePath.startsWith(PUBLIC_DIR)) {
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
  console.log(`OpenAI model: ${OPENAI_MODEL}`);
});
