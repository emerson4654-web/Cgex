const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

const LOG_API_KEY = process.env.LOG_API_KEY || "";

app.use(express.json());

// ===============================
// ARMAZENAMENTO DOS LOGS
// ===============================

const logs = [];

// ===============================
// ARQUIVOS DO SITE
// ===============================

app.use(express.static(__dirname));

// ===============================
// API - RECEBER LOG DO BOT
// ===============================

app.post("/api/logs", (req, res) => {
  const apiKey = req.headers["x-api-key"];

  if (!LOG_API_KEY) {
    return res.status(500).json({
      success: false,
      error: "LOG_API_KEY não configurada no servidor."
    });
  }

  if (apiKey !== LOG_API_KEY) {
    return res.status(401).json({
      success: false,
      error: "Não autorizado."
    });
  }

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

  // Limita a quantidade de logs na memória
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
// API - PEGAR LOGS
// ===============================

app.get("/api/logs", (req, res) => {
  res.json({
    success: true,
    logs
  });
});

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
