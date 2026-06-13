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

let chatSubmitTimer = null;

function setChatStatus(message, kind = "muted") {
  const status = document.getElementById("chat-status");
  if (status) {
    status.textContent = message;
    status.dataset.kind = kind;
  }
}

function startChatTimer() {
  const startedAt = Date.now();
  window.clearInterval(chatSubmitTimer);
  setChatStatus("Sending... 0s", "pending");
  chatSubmitTimer = window.setInterval(() => {
    const elapsed = Math.floor((Date.now() - startedAt) / 1000);
    setChatStatus(`Waiting for API provider... ${elapsed}s`, "pending");
  }, 1000);
}

function stopChatTimer() {
  window.clearInterval(chatSubmitTimer);
  chatSubmitTimer = null;
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
let traceStages = new Map();

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

function closeTraceWindow(stageId, element) {
  openTraceWindows.delete(stageId);
  element.remove();
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
    closeTraceWindow(stageId, element);
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
    model_request: "Structured request prepared for API provider.",
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

function closeTopTraceWindow() {
  let topEntry = null;
  openTraceWindows.forEach((element, stageId) => {
    const zIndex = Number(element.style.zIndex || 0);
    if (!topEntry || zIndex > topEntry.zIndex) {
      topEntry = { stageId, element, zIndex };
    }
  });
  if (topEntry) {
    closeTraceWindow(topEntry.stageId, topEntry.element);
  }
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

function clearChildren(element) {
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
}

function textNode(tagName, text, className = "") {
  const element = document.createElement(tagName);
  if (className) {
    element.className = className;
  }
  element.textContent = text === undefined || text === null ? "n/a" : String(text);
  return element;
}

function boundedPercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round(number)));
}

function createPageHeading() {
  const header = document.createElement("header");
  header.className = "page-heading";
  const title = document.createElement("div");
  title.append(
    textNode("p", "Runtime Dataflow Analyzer", "eyebrow"),
    textNode("h2", "Latest Backend Turn Pipeline"),
  );
  const chips = document.createElement("div");
  chips.className = "inline-chips";
  ["Safe Mode", "prompt hidden", "raw output hidden"].forEach((label) => {
    chips.appendChild(textNode("span", label));
  });
  header.append(title, chips);
  return header;
}

function createTraceToolbar() {
  const toolbar = document.createElement("section");
  toolbar.className = "trace-toolbar";
  toolbar.appendChild(
    textNode("span", "Click any stage to open a free floating inspector."),
  );
  const reset = document.createElement("button");
  reset.type = "button";
  reset.dataset.traceResetWindows = "";
  reset.textContent = "Reset windows";
  const close = document.createElement("button");
  close.type = "button";
  close.dataset.traceCloseWindows = "";
  close.textContent = "Close all windows";
  toolbar.append(reset, close);
  return toolbar;
}

function createSummaryItem(label, value, title = "") {
  const item = document.createElement("div");
  item.appendChild(textNode("span", label));
  const body = textNode("b", value);
  if (title) {
    body.title = title;
  }
  item.appendChild(body);
  return item;
}

function buildTraceSummary(trace) {
  const analysis = trace.analysis || {};
  const summary = document.createElement("section");
  summary.className = "trace-v2-summary";
  summary.append(
    createSummaryItem("Status", trace.status),
    createSummaryItem("Duration", `${trace.totalDurationMs ?? "n/a"} ms`),
    createSummaryItem(
      "Conversation",
      trace.conversationShortId,
      trace.conversationId || "",
    ),
    createSummaryItem("Turn", trace.turnShortId, trace.turnId || ""),
    createSummaryItem("Privacy", trace.privacyMode),
    createSummaryItem("Model", analysis.model),
    createSummaryItem("Final", `${analysis.finalAnswerLength ?? "n/a"} chars`),
  );
  return summary;
}

function buildTraceMetrics(trace) {
  const analysis = trace.analysis || {};
  const metrics = [
    ["Owner input", analysis.ownerInputLength],
    ["Recent selected", analysis.recentMessagesSelected],
    ["Memory injected", analysis.memoryTracesInjected],
    ["Request messages", analysis.requestMessages],
    ["Raw output", analysis.rawOutputLength],
    ["Removed", analysis.removedThinkingCharacters],
    ["Stored sanitized", analysis.storedSanitizedOnly],
  ];
  const section = document.createElement("section");
  section.className = "trace-flow-metrics";
  metrics.forEach(([label, value]) => {
    const item = document.createElement("article");
    item.append(textNode("span", label), textNode("b", value));
    section.appendChild(item);
  });
  return section;
}

function buildTraceStageData(stages) {
  const script = document.createElement("script");
  script.id = "trace-stage-data";
  script.type = "application/json";
  script.textContent = JSON.stringify(stages);
  return script;
}

function buildTraceTimeline(stages) {
  const timeline = document.createElement("nav");
  timeline.className = "trace-timeline compact";
  timeline.setAttribute("aria-label", "Runtime pipeline timeline");
  stages.forEach((stage, index) => {
    const button = document.createElement("button");
    button.className = `trace-stage ${stage.status}`;
    button.type = "button";
    button.dataset.traceStage = stage.name;
    button.dataset.stageId = stage.name;
    button.append(
      textNode("span", index + 1),
      textNode("strong", stage.displayName),
      textNode("em", stage.status),
      textNode("b", stage.summary),
    );
    timeline.appendChild(button);
  });
  return timeline;
}

function buildTraceBar(className, finalPercent, removedPercent = null) {
  const bar = document.createElement("div");
  bar.className = className;
  const final = document.createElement("i");
  final.style.width = `${boundedPercent(finalPercent)}%`;
  bar.appendChild(final);
  if (removedPercent !== null) {
    const removed = document.createElement("em");
    removed.style.width = `${boundedPercent(removedPercent)}%`;
    bar.appendChild(removed);
  }
  return bar;
}

function buildTraceBarBlock(label, bar, detail) {
  const block = document.createElement("div");
  block.className = "trace-bar-block";
  block.append(textNode("span", label), bar, textNode("small", detail));
  return block;
}

function buildDurationBars(items) {
  const section = document.createElement("div");
  section.className = "trace-duration-bars";
  (Array.isArray(items) ? items : []).forEach((item) => {
    const row = document.createElement("div");
    const bar = buildTraceBar("trace-bar mini", item.percent);
    const fill = bar.querySelector("i");
    if (fill && item.status) {
      fill.className = item.status;
    }
    row.append(
      textNode("span", item.name),
      bar,
      textNode("b", `${item.durationMs ?? "n/a"} ms`),
    );
    section.appendChild(row);
  });
  return section;
}

function buildTraceE2E(trace) {
  const analysis = trace.analysis || {};
  const aside = document.createElement("aside");
  aside.className = "trace-e2e";
  aside.appendChild(textNode("h3", "End-to-End Summary"));
  aside.appendChild(
    buildTraceBarBlock(
      "Sanitizer raw → final",
      buildTraceBar(
        "trace-bar",
        analysis.rawToFinalPercent,
        analysis.removedPercent,
      ),
      `${analysis.rawOutputLength ?? "n/a"} raw / `
        + `${analysis.finalAnswerLength ?? "n/a"} final / `
        + `${analysis.removedThinkingCharacters ?? "n/a"} removed`,
    ),
  );
  aside.appendChild(
    buildTraceBarBlock(
      "Context → request",
      buildTraceBar("trace-bar cyan", analysis.contextToRequestPercent),
      `${analysis.contextCharacters ?? "n/a"} context chars / `
        + `${analysis.requestCharacters ?? "n/a"} request chars`,
    ),
  );
  aside.appendChild(buildDurationBars(analysis.durationBars));

  const privacy = document.createElement("section");
  privacy.className = "trace-privacy-box";
  privacy.append(
    textNode("strong", "Safe Mode"),
    textNode("span", "Full prompt hidden"),
    textNode("span", "Raw model output hidden"),
    textNode("span", "Full profile and memory text hidden"),
  );
  aside.appendChild(privacy);

  const note = document.createElement("section");
  note.className = "trace-diagnostic-note";
  note.append(
    textNode("strong", "Memory retrieval"),
    textNode(
      "span",
      `${analysis.memoryRetrievalStatus ?? "n/a"} · `
        + `${analysis.memorySkipReason ?? "n/a"}`,
    ),
  );
  aside.appendChild(note);
  return aside;
}

function buildTraceAnalyzer(stages, trace) {
  const analyzer = document.createElement("section");
  analyzer.className = "trace-analyzer trace-analyzer-compact";
  analyzer.append(buildTraceTimeline(stages), buildTraceE2E(trace));
  return analyzer;
}

function buildSafeTraceJson(trace) {
  const details = document.createElement("details");
  details.className = "safe-json compact-json";
  details.appendChild(textNode("summary", "Safe trace JSON"));
  const pre = document.createElement("pre");
  pre.textContent = JSON.stringify(trace, null, 2);
  details.appendChild(pre);
  return details;
}

function renderLatestRuntimeTrace(trace) {
  const page = document.querySelector("[data-console-page='runtime-trace']");
  if (!page || !trace) {
    return;
  }
  const stages = Array.isArray(trace.stages) ? trace.stages : [];
  traceStages = new Map(stages.map((stage) => [stage.name, stage]));
  closeAllTraceWindows();
  clearChildren(page);
  page.append(
    createPageHeading(),
    createTraceToolbar(),
    buildTraceSummary(trace),
    buildTraceMetrics(trace),
    buildTraceStageData(stages),
    buildTraceAnalyzer(stages, trace),
    buildSafeTraceJson(trace),
  );
}

async function refreshLatestRuntimeTrace() {
  const response = await fetch("/api/diagnostics/runtime-trace/latest", {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    return;
  }
  const payload = await response.json();
  const trace = Array.isArray(payload.traces) ? payload.traces[0] : null;
  if (trace) {
    renderLatestRuntimeTrace(trace);
  }
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
  startChatTimer();
  const response = await fetch("/api/chat-test/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const result = await response.json();
  if (!response.ok || !result.ok) {
    throw new Error(result.errorCode || result.detail || "Chat request failed");
  }
  const conversationInput = formElement.querySelector("[name='conversationId']");
  if (conversationInput) {
    conversationInput.value = result.conversationId || "";
  }
  const input = document.getElementById("chat-input");
  if (input) {
    input.value = "";
  }
  appendChatMessage(result.ownerMessage);
  appendChatMessage(result.rinMessage);
  updateDashboard(result.dashboard || {});
  await refreshLatestRuntimeTrace();
  setChatStatus(`Reply stored with turn ${result.turnId} · ${result.elapsedMs} ms`, "ok");
  scrollMessagesToEnd();
}

function appendChatMessage(message) {
  if (!message || !message.content) {
    return;
  }
  const stream = document.getElementById("message-stream");
  if (!stream) {
    return;
  }
  stream.querySelector(".empty-state")?.remove();
  const row = document.createElement("article");
  row.className = `message-row message-row-${message.role}`;
  const bubble = document.createElement("div");
  bubble.className = `message-bubble ${message.role}`;
  const meta = document.createElement("div");
  meta.className = "message-meta";
  const role = document.createElement("strong");
  role.textContent = message.role;
  const time = document.createElement("time");
  time.textContent = message.createdAt || "";
  const body = document.createElement("p");
  body.textContent = message.content;
  meta.append(role, time);
  bubble.append(meta, body);
  row.appendChild(bubble);
  stream.appendChild(row);
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

  traceStages = loadTraceStages();
  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const stage = target ? target.closest("[data-trace-stage]") : null;
    if (stage) {
      event.preventDefault();
      openTraceStageWindow(stage.dataset.traceStage, traceStages);
      return;
    }
    if (target?.closest("[data-trace-close-windows]")) {
      closeAllTraceWindows();
      return;
    }
    if (target?.closest("[data-trace-reset-windows]")) {
      resetTraceWindows();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || openTraceWindows.size === 0) {
      return;
    }
    if (event.shiftKey) {
      closeAllTraceWindows();
    } else {
      closeTopTraceWindow();
    }
  });

  const formElement = document.getElementById("chat-form");
  const input = document.getElementById("chat-input");

  if (formElement) {
    formElement.addEventListener("submit", (event) => {
      event.preventDefault();
      void submitChatForm(formElement).catch((error) => {
        setChatStatus(`Error: ${error.message}`, "error");
        console.error("RIN console submit failed", error);
      }).finally(() => {
        stopChatTimer();
        setSubmitting(false);
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
