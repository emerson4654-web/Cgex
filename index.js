const express = require("express");

const app = express();

app.use(
  express.json({
    limit: "10mb"
  })
);

// ======================================================
// CONFIGURAÇÕES
// ======================================================

const PORT =
  process.env.PORT || 10000;

const LOG_API_KEY =
  process.env.LOG_API_KEY;

// ======================================================
// ARMAZENAMENTO
// ======================================================

const logs = [];
const transcripts = [];

// ======================================================
// MIDDLEWARE
// ======================================================

function verificarApiKey(req, res, next) {

  if (!LOG_API_KEY) {
    return next();
  }

  const chave =
    req.headers["x-api-key"];

  if (
    chave !== LOG_API_KEY
  ) {

    return res.status(401).json({
      error:
        "Não autorizado."
    });

  }

  next();
}

// ======================================================
// ESCAPAR HTML
// ======================================================

function escapeHTML(text) {

  if (
    text === null ||
    text === undefined
  ) {
    return "";
  }

  return String(text)
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    );
}

// ======================================================
// LOGS
// ======================================================

app.post(
  "/api/logs",
  verificarApiKey,
  (req, res) => {

    const dados = {
      id:
        Date.now().toString(),

      ...req.body,

      receivedAt:
        new Date().toISOString()
    };

    logs.unshift(
      dados
    );

    if (
      logs.length > 1000
    ) {
      logs.pop();
    }

    console.log(
      "Novo log recebido:",
      dados.type
    );

    res.json({
      success:
        true,

      id:
        dados.id
    });

  }
);

// ======================================================
// RECEBER TRANSCRIPT
// ======================================================

app.post(
  "/api/logs/transcripts",
  verificarApiKey,
  (req, res) => {

    const dados =
      req.body || {};

    const id =
      Date.now().toString() +
      "-" +
      Math.random()
        .toString(36)
        .substring(2, 8);

    const transcript = {

      id,

      ticket:
        dados.ticket ||
        "Ticket",

      ticketId:
        dados.ticketId ||
        "",

      user:
        dados.user ||
        "Usuário",

      userId:
        dados.userId ||
        "",

      avatar:
        dados.avatar ||
        null,

      attendant:
        dados.attendant ||
        "Não assumido",

      attendantId:
        dados.attendantId ||
        "",

      openedAt:
        dados.openedAt ||
        "Não informado",

      closedAt:
        dados.closedAt ||
        "Não informado",

      closedBy:
        dados.closedBy ||
        "Não informado",

      type:
        dados.type ||
        "Ticket",

      messages:
        Array.isArray(
          dados.messages
        )
          ? dados.messages
          : [],

      date:
        dados.date ||
        new Date().toISOString()

    };

    transcripts.unshift(
      transcript
    );

    if (
      transcripts.length > 500
    ) {
      transcripts.pop();
    }

    console.log(
      "Transcript recebido:",
      transcript.ticket
    );

    res.json({

      success:
        true,

      id,

      url:
        `/transcripts/${id}`

    });

  }
);

// ======================================================
// LISTAR LOGS
// ======================================================

app.get(
  "/api/logs",
  (req, res) => {

    res.json(
      logs
    );

  }
);

// ======================================================
// LISTAR TRANSCRIPTS
// ======================================================

app.get(
  "/api/logs/transcripts",
  (req, res) => {

    res.json(
      transcripts
    );

  }
);

// ======================================================
// TRANSCRIPT POR ID
// ======================================================

app.get(
  "/api/logs/transcripts/:id",
  (req, res) => {

    const transcript =
      transcripts.find(
        item =>
          item.id ===
          req.params.id
      );

    if (!transcript) {

      return res.status(404).json({
        error:
          "Transcript não encontrado."
      });

    }

    res.json(
      transcript
    );

  }
);

// ======================================================
// PÁGINA DO TRANSCRIPT
// ======================================================

app.get(
  "/transcripts/:id",
  (req, res) => {

    const transcript =
      transcripts.find(
        item =>
          item.id ===
          req.params.id
      );

    if (!transcript) {

      return res.status(404).send(`

<!DOCTYPE html>

<html lang="pt-BR">

<head>

<meta charset="UTF-8">

<meta
  name="viewport"
  content="width=device-width, initial-scale=1.0"
>

<title>Transcript não encontrado | CGEx</title>

<style>

* {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  padding: 0;
  width: 100%;
  min-height: 100%;
}

body {

  background:
    radial-gradient(
      circle at top,
      #451016 0%,
      #21090d 35%,
      #080808 75%
    );

  color: #ffffff;

  font-family:
    Arial,
    Helvetica,
    sans-serif;

  display: flex;

  align-items: center;

  justify-content: center;

  min-height: 100vh;

}

.error {

  text-align: center;

  padding: 40px;

}

.error h1 {

  color: #d4af37;

  font-size: 32px;

}

.error p {

  color: #ffffffaa;

}

</style>

</head>

<body>

<div class="error">

<h1>Transcript não encontrado</h1>

<p>
O transcript pode ter expirado ou não existe.
</p>

</div>

</body>

</html>

      `);
    }

    // ==================================================
    // AVATAR
    // ==================================================

    let avatar =
      transcript.avatar;

    if (
      !avatar &&
      transcript.userId
    ) {

      avatar =
        `https://cdn.discordapp.com/avatars/${transcript.userId}/`;
    }

    if (!avatar) {

      avatar =
        "https://cdn.discordapp.com/embed/avatars/0.png";
    }

    // ==================================================
    // MENSAGENS
    // ==================================================

    const mensagensHTML =
      transcript.messages
        .map(
          (mensagem, index) => {

            const autor =
              escapeHTML(
                mensagem.author ||
                "Usuário"
              );

            const conteudo =
              escapeHTML(
                mensagem.content ||
                ""
              );

            const data =
              escapeHTML(
                mensagem.date ||
                ""
              );

            const autorId =
              mensagem.authorId ||
              "";

            let fotoMensagem =
              "https://cdn.discordapp.com/embed/avatars/0.png";

            if (autorId) {

              fotoMensagem =
                `https://cdn.discordapp.com/avatars/${autorId}/`;
            }

            return `

<div
  class="message"
  style="animation-delay:${index * 0.04}s"
>

  <img
    class="message-avatar"
    src="${fotoMensagem}"
    onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'"
  >

  <div class="message-content">

    <div class="message-top">

      <span class="message-author">
        ${autor}
      </span>

      <span class="message-date">
        ${data}
      </span>

    </div>

    <div class="message-text">
      ${
        conteudo ||
        "<span class='empty'>Mensagem sem texto</span>"
      }
    </div>

  </div>

</div>

            `;

          }
        )
        .join("");

    // ==================================================
    // HTML
    // ==================================================

    res.send(`

<!DOCTYPE html>

<html
  lang="pt-BR"
>

<head>

<meta charset="UTF-8">

<meta
  name="viewport"
  content="width=device-width, initial-scale=1.0"
>

<title>
Transcript | ${escapeHTML(
      transcript.ticket
    )}
</title>

<style>

/* =====================================================
   RESET
===================================================== */

* {

  box-sizing:
    border-box;

}

html,
body {

  margin:
    0;

  padding:
    0;

  width:
    100%;

  min-height:
    100%;

}

/* =====================================================
   BODY
===================================================== */

body {

  background:

    radial-gradient(
      circle at 50% -10%,
      #66151f 0%,
      #3b0d13 22%,
      #180609 48%,
      #070707 80%
    );

  color:
    #ffffff;

  font-family:
    Arial,
    Helvetica,
    sans-serif;

  overflow-x:
    hidden;

}

/* =====================================================
   FUNDO
===================================================== */

body::before {

  content:
    "";

  position:
    fixed;

  inset:
    0;

  pointer-events:
    none;

  background:

    linear-gradient(
      135deg,
      transparent 0%,
      rgba(212,175,55,0.035) 50%,
      transparent 100%
    );

}

/* =====================================================
   TELA DE ENTRADA
===================================================== */

#intro {

  position:
    fixed;

  inset:
    0;

  z-index:
    9999;

  display:
    flex;

  align-items:
    center;

  justify-content:
    center;

  flex-direction:
    column;

  background:

    radial-gradient(
      circle,
      #4b1018 0%,
      #21090d 45%,
      #050505 100%
    );

  transition:
    opacity 0.9s ease,
    visibility 0.9s ease;

}

/* brilho */

#intro::before {

  content:
    "";

  position:
    absolute;

  width:
    320px;

  height:
    320px;

  border-radius:
    50%;

  background:
    rgba(212,175,55,0.12);

  filter:
    blur(70px);

  animation:
    pulse 2.2s infinite;

}

/* =====================================================
   LOGO
===================================================== */

.intro-logo {

  position:
    relative;

  z-index:
    2;

  width:
    110px;

  height:
    110px;

  border:
    2px solid #d4af37;

  border-radius:
    50%;

  display:
    flex;

  align-items:
    center;

  justify-content:
    center;

  color:
    #d4af37;

  font-size:
    30px;

  font-weight:
    900;

  letter-spacing:
    2px;

  box-shadow:

    0 0 20px
      rgba(212,175,55,0.25),

    inset 0 0 20px
      rgba(212,175,55,0.08);

  animation:
    logoIn 1s ease forwards;

}

/* =====================================================
   TEXTO INTRO
===================================================== */

.intro-title {

  position:
    relative;

  z-index:
    2;

  margin-top:
    25px;

  color:
    #ffffff;

  font-size:
    28px;

  font-weight:
    800;

  letter-spacing:
    4px;

  opacity:
    0;

  animation:
    textIn 1s ease 0.35s forwards;

}

.intro-subtitle {

  position:
    relative;

  z-index:
    2;

  margin-top:
    10px;

  color:
    #d4af37;

  font-size:
    13px;

  letter-spacing:
    3px;

  text-transform:
    uppercase;

  opacity:
    0;

  animation:
    textIn 1s ease 0.55s forwards;

}

/* =====================================================
   LINHA
===================================================== */

.intro-line {

  position:
    relative;

  z-index:
    2;

  margin-top:
    30px;

  width:
    180px;

  height:
    2px;

  background:
    #3d1016;

  overflow:
    hidden;

}

.intro-line::after {

  content:
    "";

  display:
    block;

  width:
    60px;

  height:
    100%;

  background:
    #d4af37;

  animation:
    loadingLine 1.8s infinite;

}

/* =====================================================
   ANIMAÇÕES
===================================================== */

@keyframes logoIn {

  0% {

    opacity:
      0;

    transform:
      scale(0.5)
      rotate(-30deg);

  }

  100% {

    opacity:
      1;

    transform:
      scale(1)
      rotate(0deg);

  }

}

@keyframes textIn {

  0% {

    opacity:
      0;

    transform:
      translateY(15px);

  }

  100% {

    opacity:
      1;

    transform:
      translateY(0);

  }

}

@keyframes loadingLine {

  0% {

    transform:
      translateX(-80px);

  }

  100% {

    transform:
      translateX(200px);

  }

}

@keyframes pulse {

  0%,
  100% {

    transform:
      scale(0.9);

    opacity:
      0.5;

  }

  50% {

    transform:
      scale(1.15);

    opacity:
      0.9;

  }

}

/* =====================================================
   CONTEÚDO
===================================================== */

#site {

  opacity:
    0;

  transform:
    translateY(15px);

  transition:
    opacity 0.8s ease,
    transform 0.8s ease;

}

#site.visible {

  opacity:
    1;

  transform:
    translateY(0);

}

/* =====================================================
   HEADER
===================================================== */

.header {

  width:
    100%;

  padding:
    25px 20px;

  border-bottom:
    1px solid
    rgba(212,175,55,0.25);

  background:
    rgba(8,8,8,0.8);

  backdrop-filter:
    blur(15px);

  position:
    sticky;

  top:
    0;

  z-index:
    10;

}

.header-inner {

  max-width:
    1100px;

  margin:
    auto;

  display:
    flex;

  align-items:
    center;

  gap:
    18px;

}

/* =====================================================
   FOTO USUÁRIO
===================================================== */

.user-avatar {

  width:
    76px;

  height:
    76px;

  border-radius:
    50%;

  object-fit:
    cover;

  border:
    2px solid #d4af37;

  box-shadow:
    0 0 25px
    rgba(212,175,55,0.22);

  animation:
    avatarIn 0.8s ease;

}

@keyframes avatarIn {

  from {

    opacity:
      0;

    transform:
      scale(0.6);

  }

  to {

    opacity:
      1;

    transform:
      scale(1);

  }

}

/* =====================================================
   TITULO
===================================================== */

.header-title {

  flex:
    1;

}

.header-title h1 {

  margin:
    0;

  color:
    #ffffff;

  font-size:
    24px;

}

.header-title p {

  margin:
    5px 0 0;

  color:
    #d4af37;

  font-size:
    13px;

}

/* =====================================================
   PRINCIPAL
===================================================== */

.container {

  width:
    calc(100% - 30px);

  max-width:
    1100px;

  margin:
    35px auto 80px;

}

/* =====================================================
   CARD
===================================================== */

.card {

  background:

    linear-gradient(
      145deg,
      rgba(53,12,17,0.92),
      rgba(12,12,12,0.96)
    );

  border:
    1px solid
    rgba(212,175,55,0.2);

  border-radius:
    18px;

  padding:
    25px;

  box-shadow:
    0 20px 70px
    rgba(0,0,0,0.45);

  animation:
    cardIn 0.7s ease;

}

@keyframes cardIn {

  from {

    opacity:
      0;

    transform:
      translateY(30px);

  }

  to {

    opacity:
      1;

    transform:
      translateY(0);

  }

}

/* =====================================================
   INFORMAÇÕES
===================================================== */

.ticket-title {

  color:
    #d4af37;

  font-size:
    25px;

  font-weight:
    800;

  margin:
    0 0 20px;

}

.info-grid {

  display:
    grid;

  grid-template-columns:
    repeat(2, 1fr);

  gap:
    12px;

  margin-bottom:
    30px;

}

.info {

  padding:
    15px;

  background:
    rgba(0,0,0,0.28);

  border-left:
    3px solid #6b1721;

  border-radius:
    8px;

}

.info-label {

  color:
    #d4af37;

  font-size:
    11px;

  text-transform:
    uppercase;

  letter-spacing:
    1px;

}

.info-value {

  margin-top:
    5px;

  color:
    #ffffff;

  font-size:
    14px;

  word-break:
    break-word;

}

/* =====================================================
   SEPARADOR
===================================================== */

.section-title {

  display:
    flex;

  align-items:
    center;

  gap:
    12px;

  color:
    #ffffff;

  font-size:
    18px;

  margin:
    25px 0;

}

.section-title::after {

  content:
    "";

  flex:
    1;

  height:
    1px;

  background:
    linear-gradient(
      90deg,
      #d4af37,
      transparent
    );

}

/* =====================================================
   MENSAGEM
===================================================== */

.message {

  display:
    flex;

  gap:
    13px;

  padding:
    15px;

  margin-bottom:
    10px;

  background:
    rgba(0,0,0,0.3);

  border:
    1px solid
    rgba(255,255,255,0.04);

  border-radius:
    12px;

  opacity:
    0;

  animation:
    messageIn 0.5s ease forwards;

}

@keyframes messageIn {

  from {

    opacity:
      0;

    transform:
      translateX(-12px);

  }

  to {

    opacity:
      1;

    transform:
      translateX(0);

  }

}

.message-avatar {

  width:
    42px;

  height:
    42px;

  min-width:
    42px;

  border-radius:
    50%;

  object-fit:
    cover;

  border:
    1px solid
    rgba(212,175,55,0.5);

}

.message-content {

  min-width:
    0;

  flex:
    1;

}

.message-top {

  display:
    flex;

  align-items:
    center;

  gap:
    10px;

  flex-wrap:
    wrap;

  margin-bottom:
    5px;

}

.message-author {

  color:
    #ffffff;

  font-weight:
    700;

}

.message-date {

  color:
    #d4af37aa;

  font-size:
    11px;

}

.message-text {

  color:
    #eeeeee;

  white-space:
    pre-wrap;

  word-break:
    break-word;

  line-height:
    1.5;

}

.empty {

  color:
    #ffffff55;

  font-style:
    italic;

}

/* =====================================================
   FOOTER
===================================================== */

.footer {

  text-align:
    center;

  margin-top:
    30px;

  color:
    #ffffff55;

  font-size:
    12px;

}

.footer span {

  color:
    #d4af37;

}

/* =====================================================
   MOBILE
===================================================== */

@media (
  max-width: 650px
) {

  .intro-title {

    font-size:
      21px;

    letter-spacing:
      2px;

  }

  .header-inner {

    align-items:
      flex-start;

  }

  .user-avatar {

    width:
      58px;

    height:
      58px;

  }

  .header-title h1 {

    font-size:
      18px;

  }

  .container {

    width:
      calc(100% - 20px);

    margin-top:
      20px;

  }

  .card {

    padding:
      17px;

    border-radius:
      14px;

  }

  .info-grid {

    grid-template-columns:
      1fr;

  }

  .message {

    padding:
      12px;

  }

}

/* =====================================================
   SCROLLBAR
===================================================== */

::-webkit-scrollbar {

  width:
    8px;

}

::-webkit-scrollbar-track {

  background:
    #080808;

}

::-webkit-scrollbar-thumb {

  background:
    #57131c;

  border-radius:
    10px;

}

::-webkit-scrollbar-thumb:hover {

  background:
    #d4af37;

}

</style>

</head>

<body>

<!-- =================================================
     TELA DE ENTRADA
================================================= -->

<div id="intro">

  <div class="intro-logo">
    CG
  </div>

  <div class="intro-title">
    CORREGEDORIA-GERAL
  </div>

  <div class="intro-subtitle">
    Exército Brasileiro
  </div>

  <div class="intro-line"></div>

</div>

<!-- =================================================
     SITE
================================================= -->

<div id="site">

  <header class="header">

    <div class="header-inner">

      <img
        class="user-avatar"
        src="${avatar}"
        onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'"
        alt="Foto do usuário"
      >

      <div class="header-title">

        <h1>
          Transcript do Ticket
        </h1>

        <p>
          ${escapeHTML(
            transcript.user
          )}
        </p>

      </div>

    </div>

  </header>

  <main class="container">

    <div class="card">

      <h2 class="ticket-title">

        ${escapeHTML(
          transcript.ticket
        )}

      </h2>

      <div class="info-grid">

        <div class="info">

          <div class="info-label">
            Usuário
          </div>

          <div class="info-value">
            ${escapeHTML(
              transcript.user
            )}
          </div>

        </div>

        <div class="info">

          <div class="info-label">
            Tipo
          </div>

          <div class="info-value">
            ${escapeHTML(
              transcript.type
            )}
          </div>

        </div>

        <div class="info">

          <div class="info-label">
            Atendente
          </div>

          <div class="info-value">
            ${escapeHTML(
              transcript.attendant
            )}
          </div>

        </div>

        <div class="info">

          <div class="info-label">
            Fechado por
          </div>

          <div class="info-value">
            ${escapeHTML(
              transcript.closedBy
            )}
          </div>

        </div>

        <div class="info">

          <div class="info-label">
            Aberto em
          </div>

          <div class="info-value">
            ${escapeHTML(
              transcript.openedAt
            )}
          </div>

        </div>

        <div class="info">

          <div class="info-label">
            Fechado em
          </div>

          <div class="info-value">
            ${escapeHTML(
              transcript.closedAt
            )}
          </div>

        </div>

      </div>

      <div class="section-title">
        Mensagens
      </div>

      <div class="messages">

        ${
          mensagensHTML ||
          `
          <div class="message">
            <div class="message-content">
              <div class="message-text">
                Nenhuma mensagem encontrada.
              </div>
            </div>
          </div>
          `
        }

      </div>

      <div class="footer">

        Transcript gerado pela
        <span>CGEx</span>

      </div>

    </div>

  </main>

</div>

<script>

/* =====================================================
   ANIMAÇÃO DE ENTRADA
===================================================== */

window.addEventListener(
  "load",
  function() {

    setTimeout(
      function() {

        const intro =
          document.getElementById(
            "intro"
          );

        const site =
          document.getElementById(
            "site"
          );

        intro.style.opacity =
          "0";

        intro.style.visibility =
          "hidden";

        site.classList.add(
          "visible"
        );

        setTimeout(
          function() {

            intro.remove();

          },
          900
        );

      },
      2200
    );

  }
);

</script>

</body>

</html>

    `);

  }
);

// ======================================================
// 404
// ======================================================

app.use(
  (req, res) => {

    res.status(404).send(
      "Página não encontrada."
    );

  }
);

// ======================================================
// INICIAR
// ======================================================

app.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log(
      `CGEx online na porta ${PORT}`
    );

  }
);
