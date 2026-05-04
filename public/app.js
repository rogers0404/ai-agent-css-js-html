const composer = document.querySelector("#composer");
const promptInput = document.querySelector("#promptInput");
const messageList = document.querySelector("#messageList");
const userTemplate = document.querySelector("#userMessageTemplate");
const agentTemplate = document.querySelector("#agentMessageTemplate");
const previewFrame = document.querySelector("#previewFrame");
const codeFrame = document.querySelector("#codeFrame code");
const artifactTitle = document.querySelector("#artifactTitle");
const agentStatusText = document.querySelector("#agentStatusText");
const navItems = document.querySelectorAll(".nav-item");
const tabs = document.querySelectorAll(".view-tabs button");
const chips = document.querySelectorAll(".prompt-chips button");
const themeButtons = document.querySelectorAll(".theme-dot");
const chatHistoryList = document.querySelector("#chatHistoryList");
const newChatButton = document.querySelector("#newChatButton");
const serverHealth = document.querySelector("#serverHealth");
const serverHealthText = document.querySelector("#serverHealthText");
const chatActionModal = document.querySelector("#chatActionModal");
const chatActionKicker = document.querySelector("#chatActionKicker");
const chatActionTitle = document.querySelector("#chatActionTitle");
const chatActionMessage = document.querySelector("#chatActionMessage");
const chatActionField = document.querySelector("#chatActionField");
const chatActionInput = document.querySelector("#chatActionInput");
const chatActionError = document.querySelector("#chatActionError");
const chatActionCancel = document.querySelector("#chatActionCancel");
const chatActionConfirm = document.querySelector("#chatActionConfirm");

let currentArtifact = null;
let activeChatId = null;
let latestChats = [];
let activeModalResolver = null;

const snippetPrompts = [
  {
    title: "Animated Button",
    text: "Design a refined magnetic action button with hover, press, and focus states."
  },
  {
    title: "Loading System",
    text: "Build a professional loading animation with accessible motion and a clear progress rhythm."
  },
  {
    title: "Dashboard Card",
    text: "Create a compact analytics card with animated metrics and subtle depth."
  }
];

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
  agentStatusText.textContent = label;
  document.body.classList.toggle("thinking", isThinking);
}

function setServerHealth(state, label) {
  serverHealth.dataset.state = state;
  serverHealthText.textContent = label;
}

async function refreshServerHealth() {
  const startedAt = performance.now();

  try {
    const response = await fetch("/api/health", { cache: "no-store" });
    const payload = await response.json();

    if (!response.ok || payload.status !== "ok") {
      throw new Error(payload.error || "Health check failed");
    }

    const latency = Math.max(1, Math.round(performance.now() - startedAt));
    setServerHealth("online", `${payload.provider} online - ${latency}ms`);
  } catch (error) {
    setServerHealth("offline", "Offline");
  }
}

function appendMessage(type, text) {
  const template = type === "user" ? userTemplate : agentTemplate;
  const node = template.content.firstElementChild.cloneNode(true);
  node.querySelector(".bubble").innerHTML = `<p>${escapeHtml(text)}</p>`;
  messageList.append(node);
  messageList.scrollTop = messageList.scrollHeight;
}

function clearMessages() {
  messageList.innerHTML = "";
}

function createAgentArticle() {
  const node = agentTemplate.content.firstElementChild.cloneNode(true);
  node.querySelector(".bubble").innerHTML = "";
  return node;
}

function renderMessages(messages) {
  clearMessages();

  if (!messages.length) {
    appendMessage("agent", "Create mode is ready. Describe the animation, component, or interaction you want me to build next.");
    return;
  }

  messages.forEach((message) => {
    appendMessage(message.role === "user" ? "user" : "agent", message.text);
  });
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
  previewFrame.srcdoc = buildPreviewDocument(artifact);
  codeFrame.textContent = `<!-- HTML -->\n${artifact.html}\n\n/* CSS */\n${artifact.css}\n\n// JavaScript\n${artifact.js}`;
}

function buildPreviewDocument(artifact) {
  const js = String(artifact.js || "").replaceAll("</script", "<\\/script");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
      * { box-sizing: border-box; }
      html, body { min-height: 100%; margin: 0; }
      body {
        display: grid;
        min-height: 100vh;
        padding: 18px;
        place-items: stretch;
        background: #07090d;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      ${artifact.css}
    </style>
  </head>
  <body>
    ${artifact.html}
    <script>
      try {
        ${js}
      } catch (error) {
        console.error("Artifact script error:", error);
      }
    </script>
  </body>
</html>`;
}

function renderChatHistory(chats) {
  chatHistoryList.innerHTML = "";

  if (!chats.length) {
    const empty = document.createElement("p");
    empty.className = "history-empty";
    empty.textContent = "No saved chats yet.";
    chatHistoryList.append(empty);
    return;
  }

  chats.forEach((chat) => {
    const row = document.createElement("article");
    row.className = "history-item";
    row.dataset.chatId = chat.id;
    row.classList.toggle("active", chat.id === activeChatId);
    row.classList.toggle("pinned", Boolean(chat.pinned));

    const openButton = document.createElement("button");
    openButton.className = "history-open";
    openButton.type = "button";
    openButton.addEventListener("click", () => loadChat(chat.id));

    const title = document.createElement("strong");
    title.textContent = chat.title;
    const preview = document.createElement("span");
    preview.textContent = chat.preview;
    openButton.append(title, preview);

    const actions = document.createElement("details");
    actions.className = "history-menu";
    actions.addEventListener("toggle", () => {
      if (!actions.open) return;

      document.querySelectorAll(".history-menu[open]").forEach((menu) => {
        if (menu !== actions) {
          menu.removeAttribute("open");
        }
      });
    });

    const actionTrigger = document.createElement("summary");
    actionTrigger.className = "history-menu-trigger";
    actionTrigger.setAttribute("aria-label", "Chat actions");
    actionTrigger.setAttribute("title", "Chat actions");

    const actionList = document.createElement("div");
    actionList.className = "history-actions";
    actionList.append(
      createChatActionButton(chat.pinned ? "Unpin" : "Pin", () => toggleChatPin(chat)),
      createChatActionButton("Rename", () => renameChat(chat)),
      createChatActionButton("Delete", () => deleteChat(chat), "danger")
    );

    actions.append(actionTrigger, actionList);
    row.append(openButton, actions);
    chatHistoryList.append(row);
  });
}

function createChatActionButton(label, onClick, variant = "") {
  const button = document.createElement("button");
  button.className = variant ? `history-action ${variant}` : "history-action";
  button.type = "button";
  button.textContent = label;
  button.setAttribute("aria-label", label);
  button.addEventListener("click", (event) => {
    event.currentTarget.closest(".history-menu")?.removeAttribute("open");
    onClick(event);
  });
  return button;
}

async function refreshChatHistory() {
  const response = await fetch("/api/chats");
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || "Could not load saved chats.");
  }

  latestChats = payload.chats;
  renderChatHistory(payload.chats);
}

async function updateChat(chatId, changes) {
  const response = await fetch(`/api/chats/${encodeURIComponent(chatId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(changes)
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || "Could not update chat.");
  }

  return payload.chat;
}

function closeChatModal(result) {
  chatActionModal.classList.add("hidden");
  chatActionConfirm.classList.remove("danger");
  chatActionError.classList.add("hidden");
  chatActionError.textContent = "";

  if (activeModalResolver) {
    activeModalResolver(result);
    activeModalResolver = null;
  }
}

function openChatModal(options) {
  return new Promise((resolve) => {
    activeModalResolver = resolve;
    chatActionKicker.textContent = options.kicker || "Chat action";
    chatActionTitle.textContent = options.title;
    chatActionMessage.textContent = options.message;
    chatActionConfirm.textContent = options.confirmLabel || "Confirm";
    chatActionConfirm.classList.toggle("danger", Boolean(options.danger));
    chatActionError.classList.add("hidden");
    chatActionError.textContent = "";

    const hasInput = Object.prototype.hasOwnProperty.call(options, "inputValue");
    chatActionField.classList.toggle("hidden", !hasInput);
    chatActionInput.value = hasInput ? options.inputValue : "";
    chatActionInput.placeholder = options.inputPlaceholder || "";
    chatActionModal.classList.remove("hidden");

    requestAnimationFrame(() => {
      if (hasInput) {
        chatActionInput.focus();
        chatActionInput.select();
      } else {
        chatActionConfirm.focus();
      }
    });
  });
}

function showChatModalError(message) {
  chatActionError.textContent = message;
  chatActionError.classList.remove("hidden");
}

async function toggleChatPin(chat) {
  const nextPinned = !chat.pinned;
  const confirmed = await openChatModal({
    title: nextPinned ? "Pin chat" : "Unpin chat",
    message: nextPinned
      ? `"${chat.title}" will stay at the top of your chat list.`
      : `"${chat.title}" will return to normal sorting.`,
    confirmLabel: nextPinned ? "Pin chat" : "Unpin chat"
  });

  if (!confirmed) {
    return;
  }

  try {
    await updateChat(chat.id, { pinned: nextPinned });
    await refreshChatHistory();
  } catch (error) {
    console.error(error);
  }
}

async function renameChat(chat) {
  const nextTitle = await openChatModal({
    title: "Rename chat",
    message: "Choose a short, clear name for this conversation.",
    confirmLabel: "Save name",
    inputValue: chat.title,
    inputPlaceholder: "Chat name"
  });

  if (nextTitle === false) {
    return;
  }

  const title = String(nextTitle).trim();

  if (!title) {
    return;
  }

  try {
    await updateChat(chat.id, { title });
    await refreshChatHistory();
  } catch (error) {
    console.error(error);
  }
}

async function deleteChat(chat) {
  const shouldDelete = await openChatModal({
    title: "Delete chat",
    message: `"${chat.title}" will be permanently removed from your saved chats.`,
    confirmLabel: "Delete chat",
    danger: true
  });

  if (!shouldDelete) {
    return;
  }

  const previousChats = latestChats.slice();
  latestChats = latestChats.filter((item) => item.id !== chat.id);
  activeChatId = activeChatId === chat.id ? null : activeChatId;
  renderChatHistory(latestChats);

  try {
    const response = await fetch(`/api/chats/${encodeURIComponent(chat.id)}`, {
      method: "DELETE"
    });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "Could not delete chat.");
    }
  } catch (error) {
    latestChats = previousChats;
    renderChatHistory(latestChats);
    console.error(error);
  }
}

chatActionCancel.addEventListener("click", () => closeChatModal(false));

chatActionConfirm.addEventListener("click", () => {
  if (chatActionField.classList.contains("hidden")) {
    closeChatModal(true);
    return;
  }

  const value = chatActionInput.value.trim();

  if (!value) {
    showChatModalError("Chat title is required.");
    chatActionInput.focus();
    return;
  }

  closeChatModal(value);
});

chatActionModal.addEventListener("click", (event) => {
  if (event.target === chatActionModal) {
    closeChatModal(false);
  }
});

chatActionInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    chatActionConfirm.click();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !chatActionModal.classList.contains("hidden")) {
    closeChatModal(false);
  }
});

function addActionButton(parent, label, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.addEventListener("click", onClick);
  parent.append(button);
  return button;
}

function renderSnippetsView(activeItem) {
  setActiveNav(activeItem);
  clearMessages();

  const intro = createAgentArticle();
  const introBubble = intro.querySelector(".bubble");
  const title = document.createElement("h3");
  title.textContent = "Reusable snippets";
  const copy = document.createElement("p");
  copy.textContent = "Start from a focused prompt or inspect the current artifact code by section.";
  introBubble.append(title, copy);
  messageList.append(intro);

  const promptArticle = createAgentArticle();
  const promptGrid = document.createElement("div");
  promptGrid.className = "action-grid";

  snippetPrompts.forEach((snippet) => {
    const card = document.createElement("section");
    card.className = "action-card";
    const heading = document.createElement("h3");
    heading.textContent = snippet.title;
    const body = document.createElement("p");
    body.textContent = snippet.text;
    const actions = document.createElement("div");
    actions.className = "action-row";
    addActionButton(actions, "Use prompt", () => {
      startNewCreation(document.querySelector('[data-nav="create"]'));
      promptInput.value = snippet.text;
      promptInput.focus();
    });
    card.append(heading, body, actions);
    promptGrid.append(card);
  });

  promptArticle.querySelector(".bubble").append(promptGrid);
  messageList.append(promptArticle);

  const codeArticle = createAgentArticle();
  const codeGrid = document.createElement("div");
  codeGrid.className = "action-grid";

  ["html", "css", "js"].forEach((key) => {
    const card = document.createElement("section");
    card.className = "action-card";
    const heading = document.createElement("h3");
    heading.textContent = key.toUpperCase();
    const body = document.createElement("p");
    body.textContent = currentArtifact?.[key]
      ? currentArtifact[key].slice(0, 120).replace(/\s+/g, " ").trim()
      : "No snippet is loaded yet.";
    const actions = document.createElement("div");
    actions.className = "action-row";
    addActionButton(actions, "View", () => {
      setActiveArtifactView("code");
      codeFrame.textContent = currentArtifact?.[key] || "";
    });
    addActionButton(actions, "Copy", () => copyText(currentArtifact?.[key] || ""));
    card.append(heading, body, actions);
    codeGrid.append(card);
  });

  codeArticle.querySelector(".bubble").append(codeGrid);
  messageList.append(codeArticle);
}

function renderArtifactsView(activeItem) {
  setActiveNav(activeItem);
  clearMessages();

  const article = createAgentArticle();
  const bubble = article.querySelector(".bubble");
  const heading = document.createElement("h3");
  heading.textContent = "Saved artifacts";
  const body = document.createElement("p");
  body.textContent = latestChats.length
    ? "Open a saved generation to restore its preview, code, and conversation."
    : "No saved artifacts yet. Generate an animation in Create mode to save one here.";
  bubble.append(heading, body);

  const grid = document.createElement("div");
  grid.className = "action-grid";

  latestChats.forEach((chat) => {
    const card = document.createElement("section");
    card.className = "action-card";
    const title = document.createElement("h3");
    title.textContent = chat.title;
    const preview = document.createElement("p");
    preview.textContent = chat.preview;
    const actions = document.createElement("div");
    actions.className = "action-row";
    addActionButton(actions, "Open", () => loadChat(chat.id));
    card.append(title, preview, actions);
    grid.append(card);
  });

  bubble.append(grid);
  messageList.append(article);
}

async function copyText(text) {
  if (!text) {
    appendMessage("agent", "There is no snippet content to copy yet.");
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
    appendMessage("agent", "Snippet copied.");
  } catch (error) {
    appendMessage("agent", "Copy was blocked by the browser. Open the Code view and select the snippet manually.");
  }
}

async function loadChat(chatId) {
  setStatus("Loading", true);

  try {
    const response = await fetch(`/api/chats/${encodeURIComponent(chatId)}`);
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "Could not load this chat.");
    }

    activeChatId = payload.chat.id;
    setActiveArtifactView("preview");
    renderMessages(payload.chat.messages);
    renderArtifact(payload.chat.artifact || initialArtifact);
    await refreshChatHistory();
    setStatus("Ready");
  } catch (error) {
    appendMessage("agent", error.message);
    setStatus("Ready");
  }
}

function startNewCreation(activeItem) {
  setActiveNav(activeItem);
  setActiveArtifactView("preview");
  activeChatId = null;
  promptInput.value = "";
  clearMessages();
  renderArtifact(initialArtifact);
  appendMessage("agent", "Create mode is ready. Describe the animation, component, or interaction you want me to build next.");
  refreshChatHistory().catch((error) => appendMessage("agent", error.message));
  promptInput.focus();
}

async function generateArtifact(prompt) {
  setStatus("Thinking", true);
  appendMessage("user", prompt);
  let payload = {};

  try {
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, chatId: activeChatId })
    });

    payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "The agent could not generate a response.");
    }

    activeChatId = payload.chat.id;
    renderArtifact(payload.artifact);
    appendMessage("agent", payload.artifact.summary);
    await refreshChatHistory();
    setStatus("Ready");
  } catch (error) {
    if (payload.chat) {
      activeChatId = payload.chat.id;
      refreshChatHistory().catch(() => {});
    }

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

newChatButton.addEventListener("click", () => {
  startNewCreation(document.querySelector('[data-nav="create"]'));
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

    if (item.dataset.nav === "snippets") {
      renderSnippetsView(item);
      return;
    }

    renderArtifactsView(item);
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
refreshChatHistory().catch((error) => appendMessage("agent", error.message));
refreshServerHealth();
setInterval(refreshServerHealth, 15000);
