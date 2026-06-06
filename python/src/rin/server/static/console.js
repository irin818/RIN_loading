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
