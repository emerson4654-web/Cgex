const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Servir os arquivos do site
app.use(express.static(__dirname));

// Página inicial
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Tratamento de páginas não encontradas
app.use((req, res) => {
  res.status(404).send("Página não encontrada.");
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`CGEx online na porta ${PORT}`);
});
