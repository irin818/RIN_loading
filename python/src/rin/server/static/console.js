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
  document.querySelectorAll("[data-console-tab]").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.consoleTab === pageName);
  });
  document.querySelectorAll("[data-console-page]").forEach((page) => {
    page.classList.toggle("active", page.dataset.consolePage === pageName);
  });
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

async function submitChatForm(formElement) {
  const form = new FormData(formElement);
  const payload = {
    content: String(form.get("content") || ""),
    conversationId: String(form.get("conversationId") || "") || null,
  };

  if (!payload.content.trim()) {
    return;
  }

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
  scrollMessagesToEnd();
  updateClock();
  window.setInterval(updateClock, 30000);
  void refreshDashboard().catch(() => {});

  document.querySelectorAll("[data-console-tab]").forEach((tab) => {
    tab.addEventListener("click", () => {
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
