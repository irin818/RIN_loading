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
  element.style.left = `${Math.max(16, Math.min(window.innerWidth - 120, 220 + offset))}px`;
  element.style.top = `${Math.max(16, Math.min(window.innerHeight - 52, 96 + offset))}px`;

  const close = element.querySelector(".trace-window-close");
  close.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
  });
  close.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
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
  const purpose = document.createElement("p");
  purpose.className = "trace-window-purpose";
  purpose.textContent = stagePurpose(stage.name);
  fragment.appendChild(purpose);

  const summary = document.createElement("p");
  summary.className = "trace-window-summary";
  summary.textContent = stage.summary || "n/a";
  fragment.appendChild(summary);

  fragment.appendChild(renderPrimaryFields(stage));
  renderStageSpecificSections(stage).forEach((section) => fragment.appendChild(section));
  fragment.appendChild(
    renderObjectSection("Diagnostics", {
      status: stage.status,
      skipReason: readTracePath(stage, "decision.skipReason", "n/a"),
      rejectionReason: readTracePath(stage, "decision.rejectionReason", "n/a"),
      errors: stage.errors && stage.errors.length ? stage.errors.join(", ") : "n/a",
      warnings:
        stage.warnings && stage.warnings.length ? stage.warnings.join(", ") : "n/a",
    }),
  );
  fragment.appendChild(renderObjectSection("Privacy", stage.privacy || {}));
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
  details.appendChild(summaryNode);
  details.addEventListener(
    "toggle",
    () => {
      if (details.open && !details.querySelector("pre")) {
        const pre = document.createElement("pre");
        pre.textContent = JSON.stringify(stage, null, 2);
        details.appendChild(pre);
      }
    },
    { once: true },
  );
  fragment.appendChild(details);
  return fragment;
}

function stagePurpose(stageName) {
  return {
    input_received: "Owner message entered the runtime.",
    owner_message_persisted: "Owner message was stored before model execution.",
    profile_loading: "Slow-variable profile context loaded.",
    recent_history_selection: "Short-term conversation context selected.",
    memory_v2_retrieval: "Long-term memory retrieval status.",
    context_assembly: "Runtime context assembled for model request.",
    model_request: "Structured request prepared for local model.",
    raw_model_response: "Raw model output received from provider.",
    sanitization_final_answer: "Raw model output cleaned before display/storage.",
    rin_reply_persisted: "Final answer saved to conversation history.",
    memory_update: "Conversation turn contributed to Memory V2.",
    response_returned: "Final response returned to UI.",
  }[stageName] || "Runtime trace stage.";
}

function renderPrimaryFields(stage) {
  const section = document.createElement("section");
  section.className = "trace-window-primary";
  curatedPrimaryFields(stage).forEach(([label, value]) => {
    const item = document.createElement("div");
    const key = document.createElement("span");
    const body = document.createElement("b");
    key.textContent = label;
    body.textContent = formatTraceValue(value);
    item.append(key, body);
    section.appendChild(item);
  });
  return section;
}

function curatedPrimaryFields(stage) {
  const name = stage.name;
  if (name === "input_received") {
    return [
      ["preview", readTracePath(stage, "output.inputPreview")],
      ["length", readTracePath(stage, "output.inputLength")],
      ["hash", readTracePath(stage, "output.inputHash")],
      ["conversation", readTracePath(stage, "input.conversationShortId")],
      ["timestamp", readTracePath(stage, "input.timestamp")],
      ["normalized", readTracePath(stage, "operation.normalizationApplied")],
    ];
  }
  if (name === "owner_message_persisted") {
    return [
      ["message", readTracePath(stage, "output.messageShortId")],
      ["conversation", readTracePath(stage, "input.conversationId")],
      ["role", readTracePath(stage, "output.role")],
      ["length", readTracePath(stage, "output.storedContentLength")],
      ["hash", readTracePath(stage, "output.storedContentHash")],
      ["written", readTracePath(stage, "output.databaseWriteSuccess")],
    ];
  }
  if (name === "profile_loading") {
    return [
      ["RIN profile", readTracePath(stage, "output.rinProfilePresent")],
      ["Owner profile", readTracePath(stage, "output.ownerProfilePresent")],
      ["files", readTracePath(stage, "output.profileFilesLoaded", []).length],
      ["status", readTracePath(stage, "output.profileValidationStatus")],
      ["in context", readTracePath(stage, "decision.profileContextInjected")],
      ["context chars", readTracePath(stage, "output.profileCharacterCountAvailable")],
    ];
  }
  if (name === "recent_history_selection") {
    return [
      ["policy", readTracePath(stage, "input.selectionPolicy")],
      ["available", readTracePath(stage, "input.availablePriorMessages")],
      ["selected", readTracePath(stage, "output.selectedPriorMessages")],
      ["owner", readTracePath(stage, "output.selectedOwnerCount")],
      ["RIN", readTracePath(stage, "output.selectedRinCount")],
      ["excluded", readTracePath(stage, "output.excludedMessagesCount")],
    ];
  }
  if (name === "memory_v2_retrieval") {
    return [
      ["enabled", readTracePath(stage, "operation.retrievalEnabled")],
      ["status", stage.status],
      ["available traces", readTracePath(stage, "input.availableMemoryV2TraceCount")],
      ["candidates", readTracePath(stage, "operation.candidateCount")],
      ["selected", readTracePath(stage, "output.selectedTraceCount")],
      ["injected", readTracePath(stage, "output.injectedIntoContext")],
    ];
  }
  if (name === "context_assembly") {
    return [
      ["builder", readTracePath(stage, "operation.contextBuilderVersion")],
      ["request messages", readTracePath(stage, "output.finalRequestMessageCount")],
      ["context chars", readTracePath(stage, "output.finalContextCharacterCount")],
      ["recent", readTracePath(stage, "output.recentHistoryIncludedCount")],
      ["memory", readTracePath(stage, "output.memoryTracesIncludedCount")],
      ["dropped", readTracePath(stage, "output.droppedCount")],
    ];
  }
  if (name === "model_request") {
    return [
      ["adapter", readTracePath(stage, "operation.adapter")],
      ["model", readTracePath(stage, "operation.model")],
      ["timeout", readTracePath(stage, "operation.timeoutMs")],
      ["think false", readTracePath(stage, "operation.thinkFalse")],
      ["messages", readTracePath(stage, "output.requestMessageCount")],
      ["chars", readTracePath(stage, "output.requestCharacterCount")],
    ];
  }
  if (name === "raw_model_response") {
    return [
      ["duration", readTracePath(stage, "operation.durationMs")],
      ["returned", readTracePath(stage, "output.providerReturned")],
      ["length", readTracePath(stage, "output.rawContentLength")],
      ["hash", readTracePath(stage, "output.rawContentHash")],
      ["thinking tag", readTracePath(stage, "output.thinkingTagDetected")],
      ["error", readTracePath(stage, "output.errorCode")],
    ];
  }
  if (name === "sanitization_final_answer") {
    return [
      ["applied", readTracePath(stage, "operation.sanitizerApplied")],
      ["tag removed", readTracePath(stage, "operation.thinkingTagRemoved")],
      ["raw length", readTracePath(stage, "output.rawLength")],
      ["final length", readTracePath(stage, "output.finalLength")],
      ["removed", readTracePath(stage, "output.removedCharacterCount")],
      ["rejected", readTracePath(stage, "decision.rejected")],
    ];
  }
  if (name === "rin_reply_persisted") {
    return [
      ["message", readTracePath(stage, "output.messageShortId")],
      ["role", readTracePath(stage, "output.role")],
      ["length", readTracePath(stage, "output.storedContentLength")],
      ["hash", readTracePath(stage, "output.storedContentHash")],
      ["sanitized", readTracePath(stage, "output.storedSanitizedAnswer")],
      ["raw thinking", readTracePath(stage, "output.storedRawThinking")],
    ];
  }
  if (name === "memory_update") {
    return [
      ["attempted", readTracePath(stage, "operation.memoryV2UpdateAttempted")],
      ["signals", readTracePath(stage, "output.signalsCreatedCount")],
      ["traces created", readTracePath(stage, "output.tracesCreatedCount")],
      ["traces updated", readTracePath(stage, "output.tracesUpdatedCount")],
      ["source", readTracePath(stage, "input.sourceMessageId")],
      ["full text stored", readTracePath(stage, "output.fullTextStoredInTrace")],
    ];
  }
  if (name === "response_returned") {
    return [
      ["status", readTracePath(stage, "output.uiApiStatus")],
      ["duration", readTracePath(stage, "output.totalDurationMs")],
      ["final length", readTracePath(stage, "output.finalAnswerLength")],
      ["conversation", readTracePath(stage, "output.conversationId")],
      ["message", readTracePath(stage, "output.messageShortId")],
      ["error", readTracePath(stage, "output.errorCode")],
    ];
  }
  return [["status", stage.status], ["summary", stage.summary]];
}

function renderStageSpecificSections(stage) {
  const sections = [];
  if (stage.name === "recent_history_selection") {
    sections.push(
      renderTableSection("Selected messages", readTracePath(stage, "output.selectedMessages", []), [
        "messageShortId",
        "role",
        "timestamp",
        "length",
        "preview",
        "reason",
      ]),
    );
  }
  if (stage.name === "context_assembly") {
    sections.push(
      renderTableSection("Components", readTracePath(stage, "output.componentTable", []), [
        "component",
        "included",
        "characterCount",
        "sourceId",
        "privacyStatus",
      ]),
    );
  }
  if (stage.name === "model_request") {
    sections.push(
      renderTableSection("Request outline", readTracePath(stage, "output.requestOutline", []), [
        "index",
        "role",
        "characterCount",
        "sourceComponent",
        "preview",
      ]),
    );
    sections.push(renderObjectSection("Model options", stage.operation || {}));
  }
  if (stage.name === "sanitization_final_answer") {
    sections.push(renderSanitizerVisual(stage));
    sections.push(
      renderObjectSection("Rules", {
        rulesApplied: readTracePath(stage, "operation.rulesApplied", []),
        finalPreview: readTracePath(stage, "output.finalAnswerPreview"),
        storedSanitizedOnly: readTracePath(stage, "output.storedSanitizedOnly"),
      }),
    );
  }
  if (stage.name === "memory_v2_retrieval") {
    sections.push(
      renderObjectSection("Integration gap", {
        skipReason: readTracePath(stage, "decision.skipReason"),
        explanation: readTracePath(stage, "decision.explanation"),
        topTraceIds: readTracePath(stage, "output.topSelectedTraceIds", []),
      }),
    );
  }
  return sections;
}

function renderTableSection(title, rows, columns) {
  const section = document.createElement("section");
  section.className = "trace-window-section trace-window-table";
  const heading = document.createElement("h4");
  heading.textContent = title;
  const table = document.createElement("table");
  const head = document.createElement("thead");
  const headRow = document.createElement("tr");
  columns.forEach((column) => {
    const th = document.createElement("th");
    th.textContent = column;
    headRow.appendChild(th);
  });
  head.appendChild(headRow);
  const body = document.createElement("tbody");
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const tr = document.createElement("tr");
    columns.forEach((column) => {
      const td = document.createElement("td");
      td.textContent = formatTraceValue(row[column]);
      tr.appendChild(td);
    });
    body.appendChild(tr);
  });
  table.append(head, body);
  section.append(heading, table);
  return section;
}

function renderSanitizerVisual(stage) {
  const raw = Number(readTracePath(stage, "output.rawLength", 0)) || 0;
  const final = Number(readTracePath(stage, "output.finalLength", 0)) || 0;
  const removed = Number(readTracePath(stage, "output.removedCharacterCount", 0)) || 0;
  const finalPercent = raw > 0 ? Math.max(0, Math.min(100, Math.round((final / raw) * 100))) : 0;
  const removedPercent = raw > 0
    ? Math.max(0, Math.min(100, Math.round((removed / raw) * 100)))
    : 0;
  const section = document.createElement("section");
  section.className = "trace-window-visual";
  section.innerHTML = `
    <h4>Raw → Final</h4>
    <div class="trace-bar"><i style="width: ${finalPercent}%"></i><em style="width: ${removedPercent}%"></em></div>
    <small>${raw} raw / ${final} final / ${removed} removed</small>
  `;
  return section;
}

function readTracePath(object, path, fallback = "n/a") {
  const value = path.split(".").reduce((current, key) => {
    if (current && Object.prototype.hasOwnProperty.call(current, key)) {
      return current[key];
    }
    return undefined;
  }, object);
  return value === undefined || value === null ? fallback : value;
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
    if (event.target.closest("button")) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    focusWindow(element);
    const rect = element.getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;
    if (handle.setPointerCapture) {
      handle.setPointerCapture(event.pointerId);
    }

    function move(moveEvent) {
      const maxLeft = Math.max(80 - element.offsetWidth, window.innerWidth - 80);
      const maxTop = Math.max(8, window.innerHeight - 34);
      const left = Math.min(Math.max(80 - element.offsetWidth, moveEvent.clientX - offsetX), maxLeft);
      const top = Math.min(Math.max(8, moveEvent.clientY - offsetY), maxTop);
      element.style.left = `${left}px`;
      element.style.top = `${top}px`;
    }

    function stop() {
      if (handle.hasPointerCapture && handle.hasPointerCapture(event.pointerId)) {
        handle.releasePointerCapture(event.pointerId);
      }
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    }

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
  });
}

function closeAllTraceWindows() {
  openTraceWindows.forEach((element) => element.remove());
  openTraceWindows.clear();
  traceWindowOffset = 0;
}

function resetTraceWindows() {
  let index = 0;
  openTraceWindows.forEach((element) => {
    element.style.left = `${220 + index * 28}px`;
    element.style.top = `${96 + index * 28}px`;
    focusWindow(element);
    index += 1;
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
  document.querySelectorAll("[data-trace-close-windows]").forEach((button) => {
    button.addEventListener("click", closeAllTraceWindows);
  });
  document.querySelectorAll("[data-trace-reset-windows]").forEach((button) => {
    button.addEventListener("click", resetTraceWindows);
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
