function readPath(payload, path) {
  return path.split(".").reduce((value, key) => {
    if (value && Object.prototype.hasOwnProperty.call(value, key)) {
      return value[key];
    }
    return undefined;
  }, payload);
}

function textValue(value) {
  if (value === undefined || value === null) {
    return "n/a";
  }
  return String(value);
}

function loadInitialSnapshot() {
  const node = document.getElementById("console-v2-snapshot");
  if (!node || !node.textContent) {
    return {};
  }
  try {
    return JSON.parse(node.textContent);
  } catch (error) {
    console.error("Console V2 snapshot parse failed", error);
    return {};
  }
}

function updateSnapshotFields(snapshot) {
  document.querySelectorAll("[data-v2-field]").forEach((element) => {
    const value = readPath(snapshot, element.dataset.v2Field);
    if (value !== undefined && value !== null) {
      element.textContent = textValue(value);
    }
  });
  document.querySelectorAll("[data-v2-style-width]").forEach((element) => {
    const value = Number(readPath(snapshot, element.dataset.v2StyleWidth));
    if (Number.isFinite(value)) {
      element.style.width = `${Math.max(0, Math.min(100, value))}%`;
    }
  });
  renderTraceTimeline(snapshot.runtimeTrace);
}

function renderTraceTimeline(trace) {
  const timeline = document.getElementById("v2-trace-timeline");
  if (!timeline) {
    return;
  }
  timeline.replaceChildren();
  const stages = trace && Array.isArray(trace.stages) ? trace.stages : [];
  if (!stages.length) {
    const empty = document.createElement("p");
    empty.className = "v2-empty";
    empty.textContent = "No runtime trace yet.";
    timeline.appendChild(empty);
    return;
  }
  stages.forEach((stage, index) => {
    const item = document.createElement("article");
    item.className = stage.status || "ok";
    const number = document.createElement("span");
    number.textContent = String(index + 1);
    const title = document.createElement("strong");
    title.textContent = stage.displayName || stage.name || "stage";
    const duration = document.createElement("em");
    duration.textContent = `${stage.durationMs ?? "n/a"} ms`;
    const summary = document.createElement("p");
    summary.textContent = stage.summary || "";
    item.append(number, title, duration, summary);
    timeline.appendChild(item);
  });
}

async function refreshSnapshot() {
  const shell = document.querySelector(".rin-v2-shell");
  if (!shell || !shell.dataset.snapshotUrl) {
    return null;
  }
  const response = await fetch(shell.dataset.snapshotUrl, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    return null;
  }
  const snapshot = await response.json();
  updateSnapshotFields(snapshot);
  return snapshot;
}

function activateTab(pageName) {
  if (!pageName) {
    return;
  }
  document.querySelectorAll("[data-v2-tab]").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.v2Tab === pageName);
  });
  document.querySelectorAll("[data-v2-page]").forEach((page) => {
    page.classList.toggle("active", page.dataset.v2Page === pageName);
  });
  window.localStorage.setItem("rin.consoleV2.activeTab", pageName);
}

function appendMessage(message) {
  if (!message || !message.content) {
    return;
  }
  const stream = document.getElementById("v2-message-stream");
  if (!stream) {
    return;
  }
  stream.querySelector(".v2-empty")?.remove();
  const row = document.createElement("article");
  row.className = `v2-message ${message.role}`;
  const role = document.createElement("strong");
  role.textContent = message.role;
  const body = document.createElement("p");
  body.textContent = message.content;
  row.append(role, body);
  stream.appendChild(row);
  stream.scrollTop = stream.scrollHeight;
}

function setChatStatus(message, kind = "muted") {
  const status = document.getElementById("v2-chat-status");
  if (status) {
    status.textContent = message;
    status.dataset.kind = kind;
  }
}

function setSubmitting(form, submitting) {
  const button = form.querySelector("button[type='submit']");
  const input = form.querySelector("textarea");
  if (button) {
    button.disabled = submitting;
    button.textContent = submitting ? "Sending..." : "Send";
  }
  if (input) {
    input.disabled = submitting;
  }
}

async function submitChat(form) {
  const shell = document.querySelector(".rin-v2-shell");
  if (!shell || !shell.dataset.chatUrl) {
    return;
  }
  const data = new FormData(form);
  const payload = {
    content: String(data.get("content") || ""),
    conversationId: String(data.get("conversationId") || "") || null,
  };
  if (!payload.content.trim()) {
    return;
  }
  setSubmitting(form, true);
  setChatStatus("Sending...", "pending");
  const response = await fetch(shell.dataset.chatUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const result = await response.json();
  if (!response.ok || !result.ok) {
    throw new Error(result.errorCode || result.detail || "Chat request failed");
  }
  const conversationInput = form.querySelector("[name='conversationId']");
  if (conversationInput) {
    conversationInput.value = result.conversationId || "";
  }
  const textInput = document.getElementById("v2-chat-input");
  if (textInput) {
    textInput.value = "";
  }
  appendMessage(result.ownerMessage);
  appendMessage(result.rinMessage);
  updateSnapshotFields(result.dashboard ? { dashboard: result.dashboard } : {});
  await refreshSnapshot();
  setChatStatus(`Reply stored with turn ${result.turnId}`, "ok");
}

document.addEventListener("DOMContentLoaded", () => {
  const snapshot = loadInitialSnapshot();
  updateSnapshotFields(snapshot);
  const storedTab = window.localStorage.getItem("rin.consoleV2.activeTab");
  const firstTab = document.querySelector("[data-v2-tab]")?.dataset.v2Tab || "dashboard";
  activateTab(storedTab || firstTab);

  document.querySelectorAll("[data-v2-tab]").forEach((tab) => {
    tab.addEventListener("click", () => activateTab(tab.dataset.v2Tab));
  });
  document.querySelectorAll("[data-v2-refresh]").forEach((button) => {
    button.addEventListener("click", () => {
      void refreshSnapshot().catch((error) => {
        console.error("Console V2 refresh failed", error);
      });
    });
  });

  const form = document.getElementById("v2-chat-form");
  if (form) {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      void submitChat(form).catch((error) => {
        setChatStatus(`Error: ${error.message}`, "error");
        console.error("Console V2 chat submit failed", error);
      }).finally(() => setSubmitting(form, false));
    });
  }
});
