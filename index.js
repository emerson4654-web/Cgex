require('dotenv').config();

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const express = require('express');

const {
  Client,
  GatewayIntentBits,
  Partials,
  ChannelType,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  Events
} = require('discord.js');


// ==================================================
// CONFIGURAÇÕES
// ==================================================

const CONFIG = {
  token: process.env.DISCORD_TOKEN,

  publicUrl: (process.env.PUBLIC_URL || '').replace(/\/$/, ''),

  port: Number(process.env.PORT || 3000),

  guildId: process.env.GUILD_ID || '',

  ticketCategoryId:
    process.env.TICKET_CATEGORY_ID ||
    '1548065615376416798',

  evaluationChannelId:
    process.env.EVALUATION_CHANNEL_ID ||
    '1548065757995204618',

  transcriptLogChannelId:
    process.env.TRANSCRIPT_LOG_CHANNEL_ID ||
    '1550559084858581062',

  attendantRoleId:
    process.env.ATTENDANT_ROLE_ID ||
    '1548065201172250735'
};


// ==================================================
// VERIFICAÇÃO
// ==================================================

if (!CONFIG.token) {
  console.error(
    'ERRO: defina DISCORD_TOKEN nas Environment Variables.'
  );

  process.exit(1);
}

if (!CONFIG.publicUrl) {
  console.warn(
    'AVISO: PUBLIC_URL não definido.'
  );
}


// ==================================================
// PASTAS
// ==================================================

const DATA_DIR = path.join(__dirname, 'data');

const TRANSCRIPT_DIR = path.join(
  __dirname,
  'transcripts'
);

const DB_FILE = path.join(
  DATA_DIR,
  'tickets.json'
);

fs.mkdirSync(DATA_DIR, {
  recursive: true
});

fs.mkdirSync(TRANSCRIPT_DIR, {
  recursive: true
});


// ==================================================
// BANCO DE DADOS
// ==================================================

let db = {};

try {
  if (fs.existsSync(DB_FILE)) {
    db = JSON.parse(
      fs.readFileSync(
        DB_FILE,
        'utf8'
      )
    );
  }
} catch (error) {

  console.error(
    'Erro ao carregar tickets.json:',
    error
  );

  db = {};
}


function saveDb() {

  fs.writeFileSync(
    DB_FILE,
    JSON.stringify(
      db,
      null,
      2
    )
  );
}


// ==================================================
// CLIENT DISCORD
// ==================================================

const client = new Client({

  intents: [

    GatewayIntentBits.Guilds,

    GatewayIntentBits.GuildMessages,

    GatewayIntentBits.MessageContent,

    GatewayIntentBits.DirectMessages

  ],

  partials: [
    Partials.Channel
  ]

});


// ==================================================
// SERVIDOR WEB
// ==================================================

const app = express();

app.disable(
  'x-powered-by'
);


app.get(
  '/health',
  (_req, res) => {

    res.status(200).send(
      'OK'
    );

  }
);


app.use(
  '/transcripts',
  express.static(
    TRANSCRIPT_DIR,
    {
      extensions: ['html'],
      maxAge: '1h'
    }
  )
);


app.use(
  (_req, res) => {

    res
      .status(404)
      .send(
        'Página não encontrada.'
      );

  }
);


app.listen(
  CONFIG.port,
  '0.0.0.0',
  () => {

    console.log(
      `Servidor web ativo na porta ${CONFIG.port}`
    );

  }
);


// ==================================================
// URL DO TRANSCRIPT
// ==================================================

function publicTranscriptUrl(
  filename,
  req
) {

  const base =
    CONFIG.publicUrl ||
    `${req.protocol}://${req.get('host')}`;

  return `${base}/transcripts/${encodeURIComponent(filename)}`;
}


// ==================================================
// ESCAPE HTML
// ==================================================

function esc(value) {

  return String(value ?? '')

    .replaceAll(
      '&',
      '&amp;'
    )

    .replaceAll(
      '<',
      '&lt;'
    )

    .replaceAll(
      '>',
      '&gt;'
    )

    .replaceAll(
      '"',
      '&quot;'
    )

    .replaceAll(
      "'",
      '&#039;'
    );
}


// ==================================================
// LINKS
// ==================================================

function linkify(text) {

  const escaped = esc(text);

  return escaped.replace(
    /(https?:\/\/[^\s<]+)/g,

    '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
  );
}


// ==================================================
// BUSCAR TODAS AS MENSAGENS
// ==================================================

async function fetchAllMessages(
  channel
) {

  const all = [];

  let before;

  while (true) {

    const options = {
      limit: 100
    };

    if (before) {
      options.before = before;
    }

    const batch =
      await channel.messages.fetch(
        options
      );

    if (!batch.size) {
      break;
    }

    all.push(
      ...batch.values()
    );

    before =
      batch.last().id;

    if (batch.size < 100) {
      break;
    }
  }

  return all.reverse();
}


// ==================================================
// MENSAGEM DO TRANSCRIPT
// ==================================================

function messageHtml(
  message
) {

  const content =
    message.content
      ? `<div class="content">${linkify(message.content)}</div>`
      : '';


  const attachments =
    [...message.attachments.values()]
      .map(
        attachment => {

          const isImage =
            /^image\//.test(
              attachment.contentType || ''
            );

          return `
          <div class="attachment">

            ${
              isImage
                ? `<img src="${esc(
                    attachment.url
                  )}" alt="anexo">`
                : ''
            }

            <a
              href="${esc(attachment.url)}"
              target="_blank"
              rel="noopener noreferrer"
            >
              📎 ${esc(
                attachment.name ||
                attachment.url
              )}
            </a>

          </div>
          `;
        }
      )
      .join('');


  const embeds =
    message.embeds
      .map(
        embed => {

          const title =
            embed.title
              ? `<strong>${esc(
                  embed.title
                )}</strong>`
              : '';

          const desc =
            embed.description
              ? `<div>${linkify(
                  embed.description
                )}</div>`
              : '';

          const url =
            embed.url
              ? `<a href="${esc(
                  embed.url
                )}" target="_blank">
                  Abrir embed
                </a>`
              : '';

          return `
          <div class="embed">

            ${title}

            ${desc}

            ${url}

          </div>
          `;
        }
      )
      .join('');


  const avatar =
    message.author.displayAvatarURL({
      extension: 'png',
      size: 64
    });


  const created =
    new Date(
      message.createdTimestamp
    ).toLocaleString(
      'pt-BR'
    );


  return `

  <article class="message">

    <img
      class="avatar"
      src="${esc(avatar)}"
      alt="avatar"
    >

    <div class="msg-body">

      <div class="meta">

        <span class="author">
          ${esc(
            message.author.globalName ||
            message.author.username
          )}
        </span>

        <span class="tag">
          @${esc(
            message.author.username
          )}
        </span>

        <time>
          ${esc(created)}
        </time>

      </div>

      ${content}

      ${attachments}

      ${embeds}

    </div>

  </article>

  `;
}


// ==================================================
// GERAR TRANSCRIPT
// ==================================================

async function generateTranscript(
  channel,
  req
) {

  const messages =
    await fetchAllMessages(
      channel
    );


  const filename =
    `${channel.id}-${Date.now()}-${crypto
      .randomBytes(4)
      .toString('hex')}.html`;


  const filepath =
    path.join(
      TRANSCRIPT_DIR,
      filename
    );


  const title =
    `Transcript - ${channel.name}`;


  const rows =
    messages
      .map(messageHtml)
      .join('\n');


  const html = `

<!doctype html>

<html lang="pt-BR">

<head>

<meta charset="utf-8">

<meta
  name="viewport"
  content="width=device-width,initial-scale=1"
>

<title>
  ${esc(title)}
</title>

<style>

:root {
  color-scheme: dark;
}

* {
  box-sizing: border-box;
}

body {

  margin: 0;

  background: #0b0f14;

  color: #e6edf3;

  font-family:
    Arial,
    Helvetica,
    sans-serif;
}

.top {

  position: sticky;

  top: 0;

  z-index: 2;

  background: #111820;

  border-bottom:
    1px solid #26313c;

  padding: 18px 22px;
}

.top h1 {

  margin:
    0 0 6px;

  font-size: 20px;
}

.top p {

  margin: 0;

  color: #9da9b5;

  font-size: 13px;
}

.messages {

  max-width: 1000px;

  margin: 0 auto;

  padding: 18px;
}

.message {

  display: flex;

  gap: 12px;

  padding: 14px 8px;

  border-bottom:
    1px solid #1d2730;
}

.avatar {

  width: 40px;

  height: 40px;

  border-radius: 50%;

  object-fit: cover;
}

.msg-body {

  min-width: 0;

  flex: 1;
}

.meta {

  display: flex;

  align-items: baseline;

  gap: 8px;

  flex-wrap: wrap;

  margin-bottom: 5px;
}

.author {

  font-weight: 700;
}

.tag,
time {

  font-size: 12px;

  color: #82909d;
}

.content {

  white-space: pre-wrap;

  overflow-wrap: anywhere;

  line-height: 1.45;
}

.content a,
.attachment a,
.embed a {

  color: #6cb6ff;
}

.attachment {

  margin-top: 8px;
}

.attachment img {

  display: block;

  max-width:
    min(600px, 100%);

  max-height: 500px;

  border-radius: 8px;

  margin-bottom: 5px;
}

.embed {

  margin-top: 8px;

  padding: 10px 12px;

  border-left:
    3px solid #5865f2;

  background: #111820;

  border-radius: 4px;
}

.footer {

  text-align: center;

  color: #65717d;

  font-size: 12px;

  padding: 30px;
}

.empty {

  text-align: center;

  color: #8995a1;

  padding: 50px;
}

</style>

</head>

<body>

<header class="top">

<h1>
  📄 ${esc(title)}
</h1>

<p>
  Canal: #${esc(channel.name)}
  · ${messages.length} mensagem(ns)
</p>

</header>

<main class="messages">

${rows ||
  '<div class="empty">Nenhuma mensagem encontrada.</div>'}

</main>

<div class="footer">

Transcript gerado pelo bot de tickets.

</div>

</body>

</html>

`;


  fs.writeFileSync(
    filepath,
    html,
    'utf8'
  );


  return {

    filename,

    url:
      publicTranscriptUrl(
        filename,
        req
      ),

    count:
      messages.length
  };
}


// ==================================================
// VERIFICAR ATENDENTE
// ==================================================

function isAttendant(
  member
) {

  return Boolean(
    member?.roles?.cache?.has(
      CONFIG.attendantRoleId
    )
  );
}


// ==================================================
// PEGAR TICKET
// ==================================================

function ticketRecord(
  channelId
) {

  return db[channelId] || null;
}


// ==================================================
// NOME DO TICKET
// ==================================================

function safeChannelName(
  subject,
  user
) {

  const normalized =
    subject
      .toLowerCase()
      .normalize('NFD')
      .replace(
        /[\u0300-\u036f]/g,
        ''
      )
      .replace(
        /[^a-z0-9]+/g,
        '-'
      )
      .replace(
        /^-|-$/g,
        ''
      )
      .slice(
        0,
        20
      ) ||
    'ticket';


  const username =
    user.username
      .toLowerCase()
      .replace(
        /[^a-z0-9]/g,
        ''
      )
      .slice(
        0,
        8
      ) ||
    'user';


  return `ticket-${normalized}-${username}`;
}


// ==================================================
// PAINEL PRINCIPAL
// ==================================================

function ticketPanel() {

  const texto = `

<:corregedoriacgex:1548227255388344340>  **CGEx — Corregedoria-Geral do Exército** <:corregedoriacgex:1548227255388344340>

Escolha uma das opções abaixo para abrir seu ticket.

O atendimento funciona das 00:00 às 07:00.

Preencha as informações solicitadas corretamente.

Explique sua situação com clareza e objetividade.

Anexe documentos ou provas, se necessário.

Aguarde a análise da equipe responsável.


• 🔄 **Revogações**

Solicite a revogação de uma decisão ou procedimento.

Informe qual decisão deseja revogar.

Explique detalhadamente o motivo da solicitação.

Apresente os fatos relacionados ao pedido.

Anexe documentos ou provas, se houver.

Aguarde a avaliação da Corregedoria-Geral do Exército.


• 📋 **Solicitar Processo**

Utilize esta opção para solicitar a abertura de um processo, Juntamente com o STM.

`;


  const row =
    new ActionRowBuilder()
      .addComponents(

        new ButtonBuilder()
          .setCustomId(
            'abrir_revogacoes'
          )
          .setLabel(
            '🔄 Revogações'
          )
          .setStyle(
            ButtonStyle.Primary
          ),

        new ButtonBuilder()
          .setCustomId(
            'abrir_processo'
          )
          .setLabel(
            '📋 Solicitar Processo'
          )
          .setStyle(
            ButtonStyle.Success
          )

      );


  return {

    content: texto,

    components: [
      row
    ]

  };
}


// ==================================================
// FORMULÁRIO
// ==================================================

function ticketModal(
  tipo
) {

  const modal =
    new ModalBuilder()

      .setCustomId(
        `ticket_form:${tipo}`
      )

      .setTitle(
        tipo === 'Revogações'
          ? '🔄 Revogações'
          : '📋 Solicitar Processo'
      );


  const nick =
    new TextInputBuilder()

      .setCustomId(
        'nick'
      )

      .setLabel(
        '👤 Nick do Roblox'
      )

      .setStyle(
        TextInputStyle.Short
      )

      .setRequired(
        true
      )

      .setMinLength(
        1
      )

      .setMaxLength(
        100
      )

      .setPlaceholder(
        'Digite seu Nick do Roblox'
      );


  const ocorrido =
    new TextInputBuilder()

      .setCustomId(
        'ocorrido'
      )

      .setLabel(
        '📝 O que aconteceu?'
      )

      .setStyle(
        TextInputStyle.Paragraph
      )

      .setRequired(
        true
      )

      .setMinLength(
        10
      )

      .setMaxLength(
        1000
      )

      .setPlaceholder(
        'Explique detalhadamente sua situação.'
      );


  modal.addComponents(

    new ActionRowBuilder()
      .addComponents(
        nick
      ),

    new ActionRowBuilder()
      .addComponents(
        ocorrido
      )

  );


  return modal;
}


// ==================================================
// BOTÕES DO TICKET
// ==================================================

function ticketButtons() {

  return new ActionRowBuilder()
    .addComponents(

      new ButtonBuilder()

        .setCustomId(
          'resgatar_ticket'
        )

        .setLabel(
          '🎟️ Resgatar'
        )

        .setStyle(
          ButtonStyle.Success
        ),


      new ButtonBuilder()

        .setCustomId(
          'fechar_ticket'
        )

        .setLabel(
          '🔒 Fechar Ticket'
        )

        .setStyle(
          ButtonStyle.Danger
        )

    );
}


// ==================================================
// COMANDO /PAINEL
// ==================================================

async function registerPanelCommand() {

  const commands = [

    {
      name: 'painel',

      description:
        'Envia o painel de tickets'
    }

  ];


  if (CONFIG.guildId) {

    const guild =
      await client.guilds.fetch(
        CONFIG.guildId
      );

    await guild.commands.set(
      commands
    );

  } else {

    await client.application.commands.set(
      commands
    );

  }
}


// ==================================================
// BOT ONLINE
// ==================================================

client.once(
  Events.ClientReady,
  async ready => {

    console.log(
      `Bot conectado como ${ready.user.tag}`
    );


    try {

      await registerPanelCommand();

      console.log(
        'Comando /painel registrado.'
      );

    } catch (error) {

      console.error(
        'Erro registrando comandos:',
        error
      );

    }

  }
);


// ==================================================
// INTERAÇÕES
// ==================================================

client.on(
  Events.InteractionCreate,
  async interaction => {

    try {


      // ==========================================
      // /PAINEL
      // ==========================================

      if (
        interaction.isChatInputCommand() &&
        interaction.commandName === 'painel'
      ) {

        if (
          !interaction.memberPermissions?.has(
            PermissionFlagsBits.ManageGuild
          )
        ) {

          return interaction.reply({

            content:
              '❌ Você precisa da permissão **Gerenciar Servidor**.',

            ephemeral: true

          });

        }


        await interaction.channel.send(
          ticketPanel()
        );


        return interaction.reply({

          content:
            '✅ Painel de tickets enviado.',

          ephemeral: true

        });

      }


      // ==========================================
      // BOTÃO REVOGAÇÕES
      // ==========================================

      if (
        interaction.isButton() &&
        interaction.customId ===
          'abrir_revogacoes'
      ) {

        return interaction.showModal(
          ticketModal(
            'Revogações'
          )
        );

      }


      // ==========================================
      // BOTÃO PROCESSO
      // ==========================================

      if (
        interaction.isButton() &&
        interaction.customId ===
          'abrir_processo'
      ) {

        return interaction.showModal(
          ticketModal(
            'Solicitar Processo'
          )
        );

      }


      // ==========================================
      // FORMULÁRIO DO TICKET
      // ==========================================

      if (
        interaction.isModalSubmit() &&
        interaction.customId.startsWith(
          'ticket_form:'
        )
      ) {

        await interaction.deferReply({
          ephemeral: true
        });


        const tipo =
          interaction.customId.split(':')[1];


        const nick =
          interaction.fields
            .getTextInputValue(
              'nick'
            )
            .trim();


        const ocorrido =
          interaction.fields
            .getTextInputValue(
              'ocorrido'
            )
            .trim();


        const existing =
          Object.values(db).find(
            ticket =>
              ticket.guildId ===
                interaction.guildId &&

              ticket.ownerId ===
                interaction.user.id &&

              ticket.status ===
                'open'
          );


        if (existing) {

          return interaction.editReply({

            content:
              `❌ Você já possui um ticket aberto: <#${existing.channelId}>`

          });

        }


        // ========================================
        // CRIAR CANAL
        // ========================================

        const channel =
          await interaction.guild.channels.create({

            name:
              safeChannelName(
                tipo,
                interaction.user
              ),

            type:
              ChannelType.GuildText,

            parent:
              CONFIG.ticketCategoryId ||
              undefined,


            permissionOverwrites: [

              {

                id:
                  interaction.guild.roles
                    .everyone.id,

                deny: [

                  PermissionFlagsBits.ViewChannel

                ]

              },


              {

                id:
                  interaction.user.id,

                allow: [

                  PermissionFlagsBits.ViewChannel,

                  PermissionFlagsBits.SendMessages,

                  PermissionFlagsBits.ReadMessageHistory,

                  PermissionFlagsBits.AttachFiles

                ]

              },


              {

                id:
                  CONFIG.attendantRoleId,

                allow: [

                  PermissionFlagsBits.ViewChannel,

                  PermissionFlagsBits.SendMessages,

                  PermissionFlagsBits.ReadMessageHistory,

                  PermissionFlagsBits.AttachFiles

                ]

              }

            ]

          });


        // ========================================
        // SALVAR TICKET
        // ========================================

        db[channel.id] = {

          channelId:
            channel.id,

          guildId:
            interaction.guildId,

          ownerId:
            interaction.user.id,

          attendantId:
            null,

          subject:
            tipo,

          nick:
            nick,

          ocorrido:
            ocorrido,

          status:
            'open',

          createdAt:
            Date.now(),

          closedAt:
            null,

          transcriptUrl:
            null,

          evaluationSubmitted:
            false

        };


        saveDb();


        // ========================================
        // EMBED DO TICKET
        // ========================================

        const embed =
          new EmbedBuilder()

            .setColor(
              0x00ff7f
            )

            .setTitle(
              '🎫 Ticket aberto'
            )

            .setDescription(

              `Olá, <@${interaction.user.id}>!

**📋 Assunto:**
${tipo}

**👤 Nick do Roblox:**
${esc(nick)}

**📝 O que aconteceu?**
${esc(ocorrido)}

---

Aguarde um atendente assumir o ticket.

📎 Você pode enviar fotos, documentos e outras comprovações diretamente neste ticket.`

            );


        await channel.send({

          content:
            `<@${interaction.user.id}> <@&${CONFIG.attendantRoleId}>`,

          embeds: [
            embed
          ],

          components: [
            ticketButtons()
          ]

        });


        return interaction.editReply({

          content:
            `✅ Ticket criado com sucesso: <#${channel.id}>`

        });

      }


      // ==========================================
      // RESGATAR
      // ==========================================

      if (
        interaction.isButton() &&
        interaction.customId ===
          'resgatar_ticket'
      ) {

        if (
          !isAttendant(
            interaction.member
          )
        ) {

          return interaction.reply({

            content:
              '❌ Você não possui o cargo de atendente.',

            ephemeral: true

          });

        }


        const ticket =
          ticketRecord(
            interaction.channelId
          );


        if (
          !ticket ||
          ticket.status !== 'open'
        ) {

          return interaction.reply({

            content:
              '❌ Este ticket não está registrado como aberto.',

            ephemeral: true

          });

        }


        if (
          ticket.attendantId
        ) {

          return interaction.reply({

            content:
              `❌ Este ticket já foi resgatado por <@${ticket.attendantId}>.`,

            ephemeral: true

          });

        }


        ticket.attendantId =
          interaction.user.id;


        saveDb();


        const embed =
          new EmbedBuilder()

            .setColor(
              0x00ff7f
            )

            .setTitle(
              '🎟️ Ticket resgatado'
            )

            .setDescription(

              `🛡️ **Atendente:** <@${interaction.user.id}>

Este ticket foi assumido por este atendente.

🔒 Nenhum outro atendente poderá resgatar este ticket.`

            );


        return interaction.reply({

          embeds: [
            embed
          ]

        });

      }


      // ==========================================
      // FECHAR TICKET
      // ==========================================

      if (
        interaction.isButton() &&
        interaction.customId ===
          'fechar_ticket'
      ) {

        const ticket =
          ticketRecord(
            interaction.channelId
          );


        if (
          !ticket ||
          ticket.status !== 'open'
        ) {

          return interaction.reply({

            content:
              '❌ Este ticket não está registrado como aberto.',

            ephemeral: true

          });

        }


        if (
          !ticket.attendantId
        ) {

          return interaction.reply({

            content:
              '❌ Este ticket ainda não foi resgatado por nenhum atendente.',

            ephemeral: true

          });

        }


        if (

          interaction.user.id !==
            ticket.attendantId &&

          !interaction.memberPermissions?.has(
            PermissionFlagsBits.ManageChannels
          )

        ) {

          return interaction.reply({

            content:
              '❌ Apenas o atendente responsável ou um administrador pode fechar este ticket.',

            ephemeral: true

          });

        }


        await interaction.reply({

          content:
            '📋 Gerando o transcript... aguarde.',

          ephemeral: true

        });


        // ========================================
        // TRANSCRIPT
        // ========================================

        const result =
          await generateTranscript(
            interaction.channel,
            interaction
          );


        ticket.status =
          'closed';


        ticket.transcriptUrl =
          result.url;


        ticket.closedAt =
          Date.now();


        saveDb();


        // ========================================
        // CANAL DE LOG
        // ========================================

        const logChannel =
          await client.channels.fetch(
            CONFIG.transcriptLogChannelId
          ).catch(
            () => null
          );


        if (
          logChannel?.isTextBased()
        ) {

          const logEmbed =
            new EmbedBuilder()

              .setColor(
                0x00ff7f
              )

              .setTitle(
                '📄 Transcript do Ticket'
              )

              .addFields(

                {

                  name:
                    '🎫 Assunto',

                  value:
                    ticket.subject ||
                    'Não informado',

                  inline:
                    true

                },


                {

                  name:
                    '👤 Dono',

                  value:
                    `<@${ticket.ownerId}>`,

                  inline:
                    true

                },


                {

                  name:
                    '🛡️ Atendente',

                  value:
                    `<@${ticket.attendantId}>`,

                  inline:
                    true

                },


                {

                  name:
                    '💬 Mensagens',

                  value:
                    String(
                      result.count
                    ),

                  inline:
                    true

                }

              )

              .setDescription(
                `🔗 Transcript gerado com sucesso.`
              )

              .setTimestamp();


          const transcriptButton =
            new ActionRowBuilder()
              .addComponents(

                new ButtonBuilder()

                  .setLabel(
                    '📄 Acessar Transcript'
                  )

                  .setStyle(
                    ButtonStyle.Link
                  )

                  .setURL(
                    result.url
                  )

              );


          await logChannel.send({

            embeds: [
              logEmbed
            ],

            components: [
              transcriptButton
            ]

          });

        }


        // ========================================
        // DM PARA O DONO
        // ========================================

        const owner =
          await client.users.fetch(
            ticket.ownerId
          ).catch(
            () => null
          );


        if (owner) {

          const dmEmbed =
            new EmbedBuilder()

              .setColor(
                0x00ff7f
              )

              .setTitle(
                '⭐ Avalie o atendimento'
              )

              .setDescription(

                `Seu ticket foi encerrado.

🎫 **Assunto:** ${ticket.subject}

👤 **Nick do Roblox:** ${esc(ticket.nick)}

🛡️ **Atendente:** <@${ticket.attendantId}>

Gostaríamos de saber como foi o atendimento.

Clique no botão abaixo para avaliar.`

              );


          const evaluationRow =
            new ActionRowBuilder()
              .addComponents(

                new ButtonBuilder()

                  .setCustomId(
                    `avaliar_atendimento:${ticket.channelId}`
                  )

                  .setLabel(
                    '⭐ Avaliar atendimento'
                  )

                  .setStyle(
                    ButtonStyle.Primary
                  )

              );


          await owner.send({

            embeds: [
              dmEmbed
            ],

            components: [
              evaluationRow
            ]

          }).catch(
            () => {}
          );

        }


        // ========================================
        // AVISO ANTES DE APAGAR
        // ========================================

        await interaction.editReply({

          content:
            `✅ Transcript gerado com sucesso!\n\n📄 [Abrir Transcript](${result.url})`

        });


        await interaction.channel.send({

          content:
            `📄 **Transcript:** ${result.url}

🔒 Este ticket será excluído em **5 segundos**.`

        });


        // ========================================
        // APAGAR CANAL
        // ========================================

        setTimeout(
          async () => {

            await interaction.channel
              .delete(
                'Ticket fechado e transcript gerado'
              )
              .catch(
                () => {}
              );

            // IMPORTANTE:
            // NÃO apagar o registro do DB.
            //
            // A avaliação ainda precisa dos dados
            // do ticket depois que o canal for apagado.

            saveDb();

          },
          5000
        );


        return;

      }


      // ==========================================
      // BOTÃO DE AVALIAÇÃO
      // ==========================================

      if (

        interaction.isButton() &&

        interaction.customId.startsWith(
          'avaliar_atendimento:'
        )

      ) {

        const channelId =
          interaction.customId
            .split(':')[1];


        const ticket =
          db[channelId];


        if (!ticket) {

          return interaction.reply({

            content:
              '❌ Os dados deste ticket não foram encontrados.',

            ephemeral: true

          });

        }


        if (
          ticket.ownerId !==
          interaction.user.id
        ) {

          return interaction.reply({

            content:
              '❌ Apenas o dono do ticket pode fazer esta avaliação.',

            ephemeral: true

          });

        }


        if (
          ticket.evaluationSubmitted
        ) {

          return interaction.reply({

            content:
              '❌ Você já enviou uma avaliação para este ticket.',

            ephemeral: true

          });

        }


        // ========================================
        // MODAL
        // ========================================

        const modal =
          new ModalBuilder()

            .setCustomId(
              `avaliacao:${channelId}`
            )

            .setTitle(
              '⭐ Avaliação do Atendimento'
            );


        const nota =
          new TextInputBuilder()

            .setCustomId(
              'nota'
            )

            .setLabel(
              '⭐ Nota (0–10)'
            )

            .setStyle(
              TextInputStyle.Short
            )

            .setRequired(
              true
            )

            .setMinLength(
              1
            )

            .setMaxLength(
              2
            )

            .setPlaceholder(
              'Digite uma nota de 0 a 10'
            );


        const observacao =
          new TextInputBuilder()

            .setCustomId(
              'observacao'
            )

            .setLabel(
              '📝 Observação'
            )

            .setStyle(
              TextInputStyle.Paragraph
            )

            .setRequired(
              false
            )

            .setMaxLength(
              1000
            )

            .setPlaceholder(
              'Opcional'
            );


        modal.addComponents(

          new ActionRowBuilder()
            .addComponents(
              nota
            ),

          new ActionRowBuilder()
            .addComponents(
              observacao
            )

        );


        return interaction.showModal(
          modal
        );

      }


      // ==========================================
      // ENVIO DA AVALIAÇÃO
      // ==========================================

      if (

        interaction.isModalSubmit() &&

        interaction.customId.startsWith(
          'avaliacao:'
        )

      ) {

        const channelId =
          interaction.customId
            .split(':')[1];


        const ticket =
          db[channelId];


        if (!ticket) {

          return interaction.reply({

            content:
              '❌ Os dados deste ticket não foram encontrados.',

            ephemeral: true

          });

        }


        if (
          ticket.ownerId !==
          interaction.user.id
        ) {

          return interaction.reply({

            content:
              '❌ Você não pode avaliar este ticket.',

            ephemeral: true

          });

        }


        if (
          ticket.evaluationSubmitted
        ) {

          return interaction.reply({

            content:
              '❌ Esta avaliação já foi enviada.',

            ephemeral: true

          });

        }


        // ========================================
        // NOTA
        // ========================================

        const notaRaw =
          interaction.fields
            .getTextInputValue(
              'nota'
            )
            .trim();


        const nota =
          Number(
            notaRaw
          );


        if (

          !Number.isInteger(nota) ||

          nota < 0 ||

          nota > 10

        ) {

          return interaction.reply({

            content:
              '❌ A nota precisa ser um número inteiro entre 0 e 10.',

            ephemeral: true

          });

        }


        // ========================================
        // OBSERVAÇÃO
        // ========================================

        const observacao =
          interaction.fields
            .getTextInputValue(
              'observacao'
            )
            .trim() ||
          'Sem observação.';


        // ========================================
        // CANAL DE AVALIAÇÃO
        // ========================================

        const channel =
          await client.channels.fetch(
            CONFIG.evaluationChannelId
          ).catch(
            () => null
          );


        if (
          !channel?.isTextBased()
        ) {

          return interaction.reply({

            content:
              '❌ Canal de avaliações não encontrado.',

            ephemeral: true

          });

        }


        // ========================================
        // EMBED
        // ========================================

        const embed =
          new EmbedBuilder()

            .setColor(
              0x00ff7f
            )

            .setTitle(
              '📋「AVALIAÇÃO」📋'
            )

            .setDescription(

              `-----------------------------------------

「🗣️ 」 **Avaliador:** <@${interaction.user.id}>

「👤」 **Atendente:** <@${ticket.attendantId}>

----------------------------------------

「📄」 • **Nota:** ${nota}/10.

「📅」 • **Data:** <t:${Math.floor(Date.now() / 1000)}:f>

----------------------------------------

「📋」 • **Ticket Assunto:** ${esc(ticket.subject)}

----------------------------------------

「📝」 • **Observação:** ${esc(observacao)}

----------------------------------------`

            );


        await channel.send({

          embeds: [
            embed
          ]

        });


        // ========================================
        // MARCAR COMO AVALIADO
        // ========================================

        ticket.evaluationSubmitted =
          true;


        ticket.evaluation = {

          evaluatorId:
            interaction.user.id,

          attendantId:
            ticket.attendantId,

          nota:
            nota,

          observacao:
            observacao,

          submittedAt:
            Date.now()

        };


        saveDb();


        return interaction.reply({

          content:
            '✅ Sua avaliação foi enviada com sucesso!',

          ephemeral: true

        });

      }

    } catch (error) {

      console.error(
        'Erro na interação:',
        error
      );


      if (
        interaction.replied ||
        interaction.deferred
      ) {

        await interaction
          .followUp({

            content:
              '❌ Ocorreu um erro ao processar esta ação. Verifique o console do bot.',

            ephemeral: true

          })
          .catch(
            () => {}
          );

      } else {

        await interaction
          .reply({

            content:
              '❌ Ocorreu um erro ao processar esta ação. Verifique o console do bot.',

            ephemeral: true

          })
          .catch(
            () => {}
          );

      }

    }

  }
);


// ==================================================
// ERROS
// ==================================================

process.on(
  'unhandledRejection',
  error => {

    console.error(
      'Unhandled rejection:',
      error
    );

  }
);


process.on(
  'uncaughtException',
  error => {

    console.error(
      'Uncaught exception:',
      error
    );

  }
);


// ==================================================
// LOGIN
// ==================================================

client.login(
  CONFIG.token
);
