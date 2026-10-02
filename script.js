let logs = [];
const reviews = [];
const transcripts = [];

const logCount = document.getElementById("logCount");
const reviewCount = document.getElementById("reviewCount");

function esc(v) {
  return String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(date) {
  try {
    return new Date(date).toLocaleString("pt-BR");
  } catch {
    return date || "";
  }
}

function render(id, data, empty) {
  const element = document.getElementById(id);

  if (!element) return;

  if (!data.length) {
    element.textContent = empty;
    return;
  }

  element.innerHTML = data.map(log => {
    if (typeof log === "string") {
      return `<div class="entry">${esc(log)}</div>`;
    }

    return `
      <div class="entry">
        <strong>${esc(log.title || "Log")}</strong>

        ${log.description
          ? `<div>${esc(log.description)}</div>`
          : ""
        }

        ${log.user
          ? `<div>👤 Usuário: ${esc(log.user)}</div>`
          : ""
        }

        ${log.subject
          ? `<div>📋 Assunto: ${esc(log.subject)}</div>`
          : ""
        }

        ${log.attendant
          ? `<div>🛡️ Atendente: ${esc(log.attendant)}</div>`
          : ""
        }

        ${log.ticket
          ? `<div>🎫 Ticket: ${esc(log.ticket)}</div>`
          : ""
        }

        <small>
          🕐 ${esc(formatDate(log.date))}
        </small>
      </div>
    `;
  }).join("");
}

async function loadLogs() {
  try {
    const response = await fetch("/api/logs");

    if (!response.ok) {
      throw new Error("Erro ao buscar logs.");
    }

    const data = await response.json();

    logs = Array.isArray(data.logs) ? data.logs : [];

    if (logCount) {
      logCount.textContent = logs.length;
    }

    render(
      "logsList",
      logs,
      "Nenhum log registrado."
    );

  } catch (error) {
    console.error("Erro carregando logs:", error);

    if (logCount) {
      logCount.textContent = "0";
    }

    render(
      "logsList",
      [],
      "Não foi possível carregar os logs."
    );
  }
}

if (reviewCount) {
  reviewCount.textContent = reviews.length;
}

render(
  "reviewsList",
  reviews,
  "Nenhuma avaliação registrada."
);

render(
  "transcriptsList",
  transcripts,
  "Nenhum transcript registrado."
);

// Carregar imediatamente
loadLogs();

// Atualizar automaticamente a cada 5 segundos
setInterval(loadLogs, 5000);
