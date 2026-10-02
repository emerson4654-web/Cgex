const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

const LOG_API_KEY = process.env.LOG_API_KEY || "";

app.use(express.json({ limit: "10mb" }));

// ===============================
// ARMAZENAMENTO
// ===============================

const logs = [];
const transcripts = [];

// ===============================
// ARQUIVOS DO SITE
// ===============================

app.use(express.static(__dirname));

// ===============================
// FUNÇÃO DE AUTORIZAÇÃO
// ===============================

function verificarApiKey(req, res) {
  const apiKey = req.headers["x-api-key"];

  if (!LOG_API_KEY) {
    res.status(500).json({
      success: false,
      error: "LOG_API_KEY não configurada no servidor."
    });

    return false;
  }

  if (apiKey !== LOG_API_KEY) {
    res.status(401).json({
      success: false,
      error: "Não autorizado."
    });

    return false;
  }

  return true;
}

// ===============================
// RECEBER LOG
// ===============================

app.post("/api/logs", (req, res) => {
  if (!verificarApiKey(req, res)) return;

  const {
    type,
    title,
    description,
    user,
    userId,
    ticket,
    ticketId,
    subject,
    attendant,
    attendantId,
    date
  } = req.body;

  const log = {
    id: Date.now().toString(),
    type: type || "Sistema",
    title: title || "Log",
    description: description || "",
    user: user || "",
    userId: userId || "",
    ticket: ticket || "",
    ticketId: ticketId || "",
    subject: subject || "",
    attendant: attendant || "",
    attendantId: attendantId || "",
    date: date || new Date().toISOString()
  };

  logs.unshift(log);

  if (logs.length > 500) {
    logs.length = 500;
  }

  console.log("Novo log recebido:", log);

  return res.status(201).json({
    success: true,
    log
  });
});

// ===============================
// RECEBER TRANSCRIPT
// ===============================

app.post("/api/logs/transcripts", (req, res) => {
  if (!verificarApiKey(req, res)) return;

  const body = req.body || {};

  const transcript = {
    id: Date.now().toString(),
    ...body,
    date: body.date || new Date().toISOString()
  };

  transcripts.unshift(transcript);

  if (transcripts.length > 200) {
    transcripts.length = 200;
  }

  console.log("Novo transcript recebido:", {
    id: transcript.id,
    ticket: transcript.ticket || transcript.ticketId || "",
    user: transcript.user || "",
    date: transcript.date
  });

  return res.status(201).json({
    success: true,
    transcript,
    url: `/transcripts/${transcript.id}`
  });
});

// ===============================
// PEGAR LOGS
// ===============================

app.get("/api/logs", (req, res) => {
  res.json({
    success: true,
    logs
  });
});

// ===============================
// PEGAR TRANSCRIPTS
// ===============================

app.get("/api/logs/transcripts", (req, res) => {
  res.json({
    success: true,
    transcripts
  });
});

// ===============================
// PEGAR UM TRANSCRIPT
// ===============================

app.get("/api/logs/transcripts/:id", (req, res) => {
  const transcript = transcripts.find(
    item => String(item.id) === String(req.params.id)
  );

  if (!transcript) {
    return res.status(404).json({
      success: false,
      error: "Transcript não encontrado."
    });
  }

  res.json({
    success: true,
    transcript
  });
});

// ===============================
// PÁGINA DO TRANSCRIPT
// ===============================

app.get("/transcripts/:id", (req, res) => {
  const transcript = transcripts.find(
    item => String(item.id) === String(req.params.id)
  );

  if (!transcript) {
    return res.status(404).send(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Transcript não encontrado</title>

        <style>
          body {
            margin: 0;
            background: #0b0f0d;
            color: white;
            font-family: Arial, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
          }

          .box {
            background: #121a16;
            border: 1px solid #26352e;
            border-radius: 14px;
            padding: 30px;
            width: 90%;
            max-width: 600px;
            text-align: center;
          }

          h1 {
            color: #00ff96;
          }
        </style>
      </head>

      <body>
        <div class="box">
          <h1>Transcript não encontrado</h1>
          <p>Esse transcript não existe ou foi perdido após uma reinicialização do servidor.</p>
        </div>
      </body>
      </html>
    `);
  }

  const mensagens = Array.isArray(transcript.messages)
    ? transcript.messages
    : [];

  const mensagensHTML = mensagens.map(msg => {
    const autor = escapeHTML(
      msg.author ||
      msg.username ||
      msg.user ||
      "Usuário"
    );

    const conteudo = escapeHTML(
      msg.content ||
      msg.message ||
      ""
    );

    const data = escapeHTML(
      msg.date ||
      msg.timestamp ||
      ""
    );

    return `
      <div class="message">
        <div class="message-header">
          <strong>${autor}</strong>
          <span>${data}</span>
        </div>

        <div class="content">
          ${conteudo || "<i>Mensagem sem conteúdo</i>"}
        </div>
      </div>
    `;
  }).join("");

  const ticket = escapeHTML(
    transcript.ticket ||
    transcript.ticketId ||
    "Não informado"
  );

  const usuario = escapeHTML(
    transcript.user ||
    transcript.username ||
    "Não informado"
  );

  const data = escapeHTML(
    transcript.date ||
    "Não informado"
  );

  res.send(`
    <!DOCTYPE html>
    <html lang="pt-BR">

    <head>
      <meta charset="UTF-8">

      <meta
        name="viewport"
        content="width=device-width, initial-scale=1.0"
      >

      <title>Transcript - ${ticket}</title>

      <style>

        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          background: #080d0a;
          color: #eeeeee;
          font-family: Arial, Helvetica, sans-serif;
        }

        header {
          background: #101813;
          border-bottom: 1px solid #1e3329;
          padding: 22px;
        }

        .container {
          width: 94%;
          max-width: 1000px;
          margin: auto;
        }

        .logo {
          color: #00ff96;
          font-size: 25px;
          font-weight: bold;
          margin-bottom: 18px;
        }

        h1 {
          margin: 0;
          font-size: 25px;
        }

        .info {
          margin-top: 20px;
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 12px;
        }

        .info-box {
          background: #111914;
          border: 1px solid #23352b;
          border-radius: 10px;
          padding: 14px;
        }

        .label {
          color: #7f9187;
          font-size: 12px;
          margin-bottom: 6px;
        }

        .value {
          color: white;
          font-weight: bold;
          word-break: break-word;
        }

        main {
          padding: 25px 0 50px;
        }

        .messages {
          background: #0f1511;
          border: 1px solid #203027;
          border-radius: 12px;
          overflow: hidden;
        }

        .message {
          padding: 16px;
          border-bottom: 1px solid #1d2922;
        }

        .message:last-child {
          border-bottom: none;
        }

        .message-header {
          display: flex;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 8px;
        }

        .message-header strong {
          color: #00ff96;
        }

        .message-header span {
          color: #728077;
          font-size: 12px;
        }

        .content {
          color: #dddddd;
          white-space: pre-wrap;
          word-break: break-word;
          line-height: 1.5;
        }

        .empty {
          padding: 30px;
          text-align: center;
          color: #87948c;
        }

        footer {
          text-align: center;
          color: #617067;
          padding: 20px;
        }

      </style>
    </head>

    <body>

      <header>
        <div class="container">

          <div class="logo">
            CGEx
          </div>

          <h1>
            Transcript do Ticket
          </h1>

          <div class="info">

            <div class="info-box">
              <div class="label">Ticket</div>
              <div class="value">${ticket}</div>
            </div>

            <div class="info-box">
              <div class="label">Usuário</div>
              <div class="value">${usuario}</div>
            </div>

            <div class="info-box">
              <div class="label">Data</div>
              <div class="value">${data}</div>
            </div>

          </div>

        </div>
      </header>

      <main>

        <div class="container">

          <div class="messages">

            ${
              mensagensHTML ||
              `<div class="empty">
                Nenhuma mensagem encontrada neste transcript.
              </div>`
            }

          </div>

        </div>

      </main>

      <footer>
        CGEx • Sistema de Tickets
      </footer>

    </body>

    </html>
  `);
});

// ===============================
// ESCAPAR HTML
// ===============================

function escapeHTML(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ===============================
// PÁGINA INICIAL
// ===============================

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// ===============================
// 404
// ===============================

app.use((req, res) => {
  res.status(404).send("Página não encontrada.");
});

// ===============================
// SERVIDOR
// ===============================

app.listen(PORT, "0.0.0.0", () => {
  console.log(`CGEx online na porta ${PORT}`);
});
