const composer = document.querySelector("#composer");
const promptInput = document.querySelector("#promptInput");
const messageList = document.querySelector("#messageList");
const userTemplate = document.querySelector("#userMessageTemplate");
const agentTemplate = document.querySelector("#agentMessageTemplate");
const previewFrame = document.querySelector("#previewFrame");
const codeFrame = document.querySelector("#codeFrame code");
const artifactTitle = document.querySelector("#artifactTitle");
const statusLabel = document.querySelector(".agent-status");
const navItems = document.querySelectorAll(".nav-item");
const tabs = document.querySelectorAll(".view-tabs button");
const chips = document.querySelectorAll(".prompt-chips button");
const themeButtons = document.querySelectorAll(".theme-dot");

let currentArtifact = null;

const initialArtifact = {
  title: "Kinetic glass card",
  html: `<section class="agent-artifact">
  <div class="artifact-glow"></div>
  <div class="artifact-shell">
    <p class="artifact-kicker">Generated UI motion concept</p>
    <h2>Kinetic glass card</h2>
    <p>Layered light, glass texture, and precise hover motion for a premium agent-style interface.</p>
    <button class="artifact-button">Launch motion</button>
  </div>
</section>`,
  css: `.agent-artifact {
  --ink: #111827;
  --accent: #45d8ff;
  --hot: #ff4f8b;
  --paper: #f8fafc;
  position: relative;
  display: grid;
  min-height: 320px;
  place-items: center;
  overflow: hidden;
  border-radius: 8px;
  color: var(--paper);
  background:
    radial-gradient(circle at 30% 20%, rgb(69 216 255 / .42), transparent 34%),
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
}`,
  js: `document.querySelector(".artifact-button").addEventListener("click", (event) => {
  event.currentTarget.animate(
    [
      { transform: "scale(1)" },
      { transform: "scale(.94)" },
      { transform: "scale(1.04)" },
      { transform: "scale(1)" }
    ],
    { duration: 520, easing: "cubic-bezier(.2, .9, .2, 1)" }
  );
});`
};

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setStatus(label, isThinking = false) {
  statusLabel.lastChild.textContent = ` ${label}`;
  document.body.classList.toggle("thinking", isThinking);
}

function appendMessage(type, text) {
  const template = type === "user" ? userTemplate : agentTemplate;
  const node = template.content.firstElementChild.cloneNode(true);
  node.querySelector(".bubble").innerHTML = `<p>${escapeHtml(text)}</p>`;
  messageList.append(node);
  messageList.scrollTop = messageList.scrollHeight;
}

function setActiveNav(activeItem) {
  navItems.forEach((item) => {
    item.classList.toggle("active", item === activeItem);
  });
}

function setActiveArtifactView(view) {
  tabs.forEach((item) => {
    const isActive = item.dataset.view === view;
    item.classList.toggle("active", isActive);
  });

  const showCode = view === "code";
  document.querySelector("#previewFrame").classList.toggle("hidden", showCode);
  document.querySelector("#codeFrame").classList.toggle("hidden", !showCode);
}

function renderArtifact(artifact) {
  currentArtifact = artifact;
  artifactTitle.textContent = artifact.title;
  previewFrame.innerHTML = `${artifact.html}<style>${artifact.css}</style>`;
  const script = document.createElement("script");
  script.textContent = artifact.js;
  previewFrame.append(script);
  codeFrame.textContent = `<!-- HTML -->\n${artifact.html}\n\n/* CSS */\n${artifact.css}\n\n// JavaScript\n${artifact.js}`;
}

function startNewCreation(activeItem) {
  setActiveNav(activeItem);
  setActiveArtifactView("preview");
  promptInput.value = "";
  renderArtifact(initialArtifact);
  appendMessage("agent", "Create mode is ready. Describe the animation, component, or interaction you want me to build next.");
  promptInput.focus();
}

async function generateArtifact(prompt) {
  setStatus("Thinking", true);
  appendMessage("user", prompt);

  try {
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt })
    });

    const artifact = await response.json();

    if (!response.ok) {
      throw new Error(artifact.error || "The agent could not generate a response.");
    }

    renderArtifact(artifact);
    appendMessage("agent", artifact.summary);
    setStatus("Ready");
  } catch (error) {
    appendMessage("agent", error.message);
    setStatus("Ready");
  }
}

composer.addEventListener("submit", (event) => {
  event.preventDefault();
  const prompt = promptInput.value.trim();
  if (!prompt) return;
  promptInput.value = "";
  generateArtifact(prompt);
});

chips.forEach((chip) => {
  chip.addEventListener("click", () => {
    promptInput.value = chip.textContent;
    promptInput.focus();
  });
});

navItems.forEach((item) => {
  item.addEventListener("click", () => {
    if (item.dataset.nav === "create") {
      startNewCreation(item);
      return;
    }

    setActiveNav(item);
    appendMessage("agent", `${item.textContent.trim()} will be connected next. For now, Create is ready for new animation prompts.`);
  });
});

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    setActiveArtifactView(tab.dataset.view);
  });
});

themeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    themeButtons.forEach((item) => item.classList.toggle("active", item === button));
    document.body.dataset.theme = button.dataset.theme;
  });
});

renderArtifact(initialArtifact);
