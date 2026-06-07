function scrollMessagesToEnd() {
  const stream = document.getElementById("message-stream");
  if (stream) {
    stream.scrollTop = stream.scrollHeight;
  }
}

function setSubmitting(isSubmitting) {
  const button = document.getElementById("send-button");
  const input = document.getElementById("chat-input");
  if (button) {
    button.disabled = isSubmitting;
    button.textContent = isSubmitting ? "Sending..." : "Send";
  }
  if (input) {
    input.dataset.submitting = String(isSubmitting);
  }
}

function readPath(payload, path) {
  return path.split(".").reduce((value, key) => {
    if (value && Object.prototype.hasOwnProperty.call(value, key)) {
      return value[key];
    }
    return undefined;
  }, payload);
}

function updateDashboard(payload) {
  document.querySelectorAll("[data-dashboard-field]").forEach((element) => {
    const value = readPath(payload, element.dataset.dashboardField);
    if (value !== undefined && value !== null) {
      element.textContent = String(value);
    }
  });

  const memoryRing = document.querySelector(".trace-ring");
  const ringFill = readPath(payload, "memoryContext.ringFillPercent");
  if (memoryRing && typeof ringFill === "number") {
    memoryRing.style.setProperty("--ring-fill", `${ringFill}%`);
  }

  const ownerBar = document.querySelector("[data-dashboard-bar='owner']");
  const rinBar = document.querySelector("[data-dashboard-bar='rin']");
  const ownerPercent = readPath(payload, "activeConversation.ownerMessagePercent");
  const rinPercent = readPath(payload, "activeConversation.rinMessagePercent");
  if (ownerBar && typeof ownerPercent === "number") {
    ownerBar.style.width = `${ownerPercent}%`;
  }
  if (rinBar && typeof rinPercent === "number") {
    rinBar.style.width = `${rinPercent}%`;
  }
}

async function refreshDashboard() {
  const shell = document.querySelector(".control-console-shell");
  if (!shell || !shell.dataset.dashboardUrl) {
    return;
  }

  const response = await fetch(shell.dataset.dashboardUrl, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    return;
  }
  updateDashboard(await response.json());
}

function activateConsolePage(pageName) {
  if (!pageName) {
    return;
  }
  document.querySelectorAll("[data-console-tab]").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.consoleTab === pageName);
  });
  document.querySelectorAll("[data-console-page]").forEach((page) => {
    page.classList.toggle("active", page.dataset.consolePage === pageName);
  });
  window.localStorage.setItem("rin.activeConsoleTab", pageName);
}

function updateClock() {
  const clock = document.getElementById("console-clock");
  if (clock) {
    clock.textContent = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
}

const openTraceWindows = new Map();
let topTraceWindowZ = 1000;
let traceWindowOffset = 0;

function loadTraceStages() {
  const node = document.getElementById("trace-stage-data");
  if (!node || !node.textContent) {
    return new Map();
  }
  try {
    const stages = JSON.parse(node.textContent);
    return new Map(stages.map((stage) => [stage.name, stage]));
  } catch (error) {
    console.error("RIN trace stage data failed to parse", error);
    return new Map();
  }
}

function focusWindow(element) {
  topTraceWindowZ += 1;
  element.style.zIndex = String(topTraceWindowZ);
}

function openTraceStageWindow(stageId, stages) {
  const existing = openTraceWindows.get(stageId);
  if (existing) {
    focusWindow(existing);
    return;
  }

  const stage = stages.get(stageId);
  const layer = document.getElementById("trace-window-layer");
  const template = document.getElementById("trace-stage-window-template");
  if (!stage || !layer || !template) {
    return;
  }

  const element = template.content.firstElementChild.cloneNode(true);
  element.dataset.stageWindow = stageId;
  element.querySelector(".trace-window-title").textContent =
    `${stage.displayName} · ${stage.status} · ${stage.durationMs} ms`;
  element.querySelector(".trace-window-body").appendChild(renderStageDetails(stage));

  const offset = traceWindowOffset % 140;
  traceWindowOffset += 28;
  element.style.left = `${Math.min(window.innerWidth - 360, 260 + offset)}px`;
  element.style.top = `${Math.min(window.innerHeight - 260, 120 + offset)}px`;

  const close = element.querySelector(".trace-window-close");
  close.addEventListener("click", () => {
    openTraceWindows.delete(stageId);
    element.remove();
  });
  element.addEventListener("pointerdown", () => focusWindow(element));
  makeDraggable(element, element.querySelector(".trace-window-titlebar"));

  layer.appendChild(element);
  openTraceWindows.set(stageId, element);
  focusWindow(element);
}

function renderStageDetails(stage) {
  const fragment = document.createDocumentFragment();
  const summary = document.createElement("p");
  summary.className = "trace-window-summary";
  summary.textContent = stage.summary || "n/a";
  fragment.appendChild(summary);

  ["input", "operation", "output", "decision", "privacy"].forEach((sectionName) => {
    fragment.appendChild(renderObjectSection(sectionName, stage[sectionName] || {}));
  });
  if (stage.warnings && stage.warnings.length) {
    fragment.appendChild(renderListSection("warnings", stage.warnings));
  }
  if (stage.errors && stage.errors.length) {
    fragment.appendChild(renderListSection("errors", stage.errors));
  }

  const details = document.createElement("details");
  details.className = "trace-window-json";
  const summaryNode = document.createElement("summary");
  summaryNode.textContent = "Safe JSON";
  const pre = document.createElement("pre");
  pre.textContent = JSON.stringify(stage, null, 2);
  details.append(summaryNode, pre);
  fragment.appendChild(details);
  return fragment;
}

function renderObjectSection(title, data) {
  const section = document.createElement("section");
  section.className = "trace-window-section";
  const heading = document.createElement("h4");
  heading.textContent = title;
  const dl = document.createElement("dl");
  Object.entries(data).forEach(([key, value]) => {
    const row = document.createElement("div");
    const dt = document.createElement("dt");
    const dd = document.createElement("dd");
    dt.textContent = key;
    dd.textContent = formatTraceValue(value);
    row.append(dt, dd);
    dl.appendChild(row);
  });
  section.append(heading, dl);
  return section;
}

function renderListSection(title, values) {
  const section = document.createElement("section");
  section.className = `trace-window-section ${title}`;
  const heading = document.createElement("h4");
  heading.textContent = title;
  const body = document.createElement("p");
  body.textContent = values.join(", ");
  section.append(heading, body);
  return section;
}

function formatTraceValue(value) {
  if (value === null || value === undefined) {
    return "n/a";
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

function makeDraggable(element, handle) {
  if (!handle) {
    return;
  }
  handle.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    focusWindow(element);
    const rect = element.getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;
    handle.setPointerCapture(event.pointerId);

    function move(moveEvent) {
      const maxLeft = Math.max(8, window.innerWidth - element.offsetWidth - 8);
      const maxTop = Math.max(8, window.innerHeight - element.offsetHeight - 8);
      const left = Math.min(Math.max(8, moveEvent.clientX - offsetX), maxLeft);
      const top = Math.min(Math.max(8, moveEvent.clientY - offsetY), maxTop);
      element.style.left = `${left}px`;
      element.style.top = `${top}px`;
    }

    function stop() {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", stop);
      handle.removeEventListener("pointercancel", stop);
    }

    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", stop);
    handle.addEventListener("pointercancel", stop);
  });
}

async function submitChatForm(formElement) {
  const form = new FormData(formElement);
  const payload = {
    content: String(form.get("content") || ""),
    conversationId: String(form.get("conversationId") || "") || null,
  };

  if (!payload.content.trim()) {
    return;
  }

  window.localStorage.setItem("rin.activeConsoleTab", "chat");
  setSubmitting(true);
  const response = await fetch("/ui/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const html = await response.text();
  document.open();
  document.write(html);
  document.close();
}

document.addEventListener("DOMContentLoaded", () => {
  const shell = document.querySelector(".control-console-shell");
  const validTabs = new Set(
    Array.from(document.querySelectorAll("[data-console-tab]")).map(
      (tab) => tab.dataset.consoleTab,
    ),
  );
  const hashTab = window.location.hash.replace(/^#/, "");
  const storedTab = window.localStorage.getItem("rin.activeConsoleTab");
  const serverTab = shell ? shell.dataset.activeTab : "";
  const activeTab = validTabs.has(hashTab)
    ? hashTab
    : validTabs.has(serverTab) && serverTab !== "overview"
      ? serverTab
      : validTabs.has(storedTab)
        ? storedTab
        : validTabs.has(serverTab)
          ? serverTab
          : "overview";
  activateConsolePage(activeTab);
  scrollMessagesToEnd();
  updateClock();
  window.setInterval(updateClock, 30000);
  void refreshDashboard().catch(() => {});

  document.querySelectorAll("[data-console-tab]").forEach((tab) => {
    tab.addEventListener("click", (event) => {
      event.stopPropagation();
      activateConsolePage(tab.dataset.consoleTab);
      if (tab.dataset.consoleTab === "chat") {
        scrollMessagesToEnd();
      }
    });
  });

  document.querySelectorAll("[data-refresh-dashboard]").forEach((button) => {
    button.addEventListener("click", () => {
      void refreshDashboard().catch((error) => {
        console.error("RIN dashboard refresh failed", error);
      });
    });
  });

  const traceStages = loadTraceStages();
  document.querySelectorAll("[data-trace-stage]").forEach((stage) => {
    stage.addEventListener("click", (event) => {
      event.preventDefault();
      openTraceStageWindow(stage.dataset.traceStage, traceStages);
    });
  });

  const formElement = document.getElementById("chat-form");
  const input = document.getElementById("chat-input");

  if (formElement) {
    formElement.addEventListener("submit", (event) => {
      event.preventDefault();
      void submitChatForm(formElement).catch((error) => {
        setSubmitting(false);
        console.error("RIN console submit failed", error);
      });
    });
  }

  if (input && formElement) {
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        formElement.requestSubmit();
      }
    });
  }
});
