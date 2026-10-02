const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

const LOG_API_KEY = process.env.LOG_API_KEY || "";

app.use(express.json({ limit: "10mb" }));

// ===============================
// ARMAZENAMENTO DOS LOGS
// ===============================

const logs = [];

// ===============================
// ARMAZENAMENTO DOS TRANSCRIPTS
// ===============================

const transcripts = [];

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
// API - RECEBER TRANSCRIPT DO BOT
// ===============================

app.post("/api/logs/transcripts", (req, res) => {
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
    transcript
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
// API - PEGAR TRANSCRIPTS
// ===============================

app.get("/api/logs/transcripts", (req, res) => {
  res.json({
    success: true,
    transcripts
  });
});

// ===============================
// API - PEGAR UM TRANSCRIPT
// ===============================

app.get("/api/logs/transcripts/:id", (req, res) => {
  const transcript = transcripts.find(
    item => item.id === req.params.id
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
