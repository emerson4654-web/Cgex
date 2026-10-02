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
  StringSelectMenuBuilder,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  Events
} = require('discord.js');

const CONFIG = {
  token: process.env.DISCORD_TOKEN,
  publicUrl: (process.env.PUBLIC_URL || '').replace(/\/$/, ''),
  port: Number(process.env.PORT || 3000),
  guildId: process.env.GUILD_ID || '',
  ticketCategoryId: process.env.TICKET_CATEGORY_ID || '1548065615376416798',
  evaluationChannelId: process.env.EVALUATION_CHANNEL_ID || '1548065757995204618',
  transcriptLogChannelId: process.env.TRANSCRIPT_LOG_CHANNEL_ID || '1550559084858581062',
  attendantRoleId: process.env.ATTENDANT_ROLE_ID || '1548065201172250735'
};

if (!CONFIG.token) {
  console.error('ERRO: defina DISCORD_TOKEN no arquivo .env');
  process.exit(1);
}
if (!CONFIG.publicUrl) {
  console.warn('AVISO: PUBLIC_URL não definido. Os links dos transcripts usarão a URL do Host header.');
}

const DATA_DIR = path.join(__dirname, '..', 'data');
const TRANSCRIPT_DIR = path.join(__dirname, '..', 'transcripts');
const DB_FILE = path.join(DATA_DIR, 'tickets.json');
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(TRANSCRIPT_DIR, { recursive: true });

let db = {};
try {
  if (fs.existsSync(DB_FILE)) db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
} catch (err) {
  console.error('Não foi possível ler data/tickets.json:', err);
  db = {};
}
function saveDb() {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Channel]
});

const app = express();
app.disable('x-powered-by');
app.get('/health', (_req, res) => res.status(200).send('OK'));
app.use('/transcripts', express.static(TRANSCRIPT_DIR, {
  extensions: ['html'],
  maxAge: '1h'
}));
app.use((_req, res) => res.status(404).send('Página não encontrada.'));
app.listen(CONFIG.port, () => console.log(`Servidor web ativo na porta ${CONFIG.port}`));

function publicTranscriptUrl(filename, req) {
  const base = CONFIG.publicUrl || `${req.protocol}://${req.get('host')}`;
  return `${base}/transcripts/${encodeURIComponent(filename)}`;
}

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function linkify(text) {
  const escaped = esc(text);
  return escaped.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
}

async function fetchAllMessages(channel) {
  const all = [];
  let before;
  while (true) {
    const options = { limit: 100 };
    if (before) options.before = before;
    const batch = await channel.messages.fetch(options);
    if (!batch.size) break;
    all.push(...batch.values());
    before = batch.last().id;
    if (batch.size < 100) break;
  }
  return all.reverse();
}

function messageHtml(message) {
  const content = message.content ? `<div class="content">${linkify(message.content)}</div>` : '';
  const attachments = [...message.attachments.values()].map(a => {
    const isImage = /^image\//.test(a.contentType || '');
    return `<div class="attachment">${isImage ? `<img src="${esc(a.url)}" alt="anexo">` : ''}<a href="${esc(a.url)}" target="_blank" rel="noopener noreferrer">📎 ${esc(a.name || a.url)}</a></div>`;
  }).join('');
  const embeds = message.embeds.map(e => {
    const title = e.title ? `<strong>${esc(e.title)}</strong>` : '';
    const desc = e.description ? `<div>${linkify(e.description)}</div>` : '';
    const url = e.url ? `<a href="${esc(e.url)}" target="_blank">Abrir embed</a>` : '';
    return `<div class="embed">${title}${desc}${url}</div>`;
  }).join('');
  const avatar = message.author.displayAvatarURL({ extension: 'png', size: 64 });
  const created = new Date(message.createdTimestamp).toLocaleString('pt-BR');
  return `<article class="message">
    <img class="avatar" src="${esc(avatar)}" alt="avatar">
    <div class="msg-body">
      <div class="meta"><span class="author">${esc(message.author.globalName || message.author.username)}</span><span class="tag">@${esc(message.author.username)}</span><time>${esc(created)}</time></div>
      ${content}${attachments}${embeds}
    </div>
  </article>`;
}

async function generateTranscript(channel, req) {
  const messages = await fetchAllMessages(channel);
  const filename = `${channel.id}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.html`;
  const filepath = path.join(TRANSCRIPT_DIR, filename);
  const title = `Transcript - ${channel.name}`;
  const rows = messages.map(messageHtml).join('\n');
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<style>
:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;background:#0b0f14;color:#e6edf3;font-family:Arial,Helvetica,sans-serif}.top{position:sticky;top:0;z-index:2;background:#111820;border-bottom:1px solid #26313c;padding:18px 22px}.top h1{margin:0 0 6px;font-size:20px}.top p{margin:0;color:#9da9b5;font-size:13px}.messages{max-width:1000px;margin:0 auto;padding:18px}.message{display:flex;gap:12px;padding:14px 8px;border-bottom:1px solid #1d2730}.avatar{width:40px;height:40px;border-radius:50%;object-fit:cover}.msg-body{min-width:0;flex:1}.meta{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;margin-bottom:5px}.author{font-weight:700}.tag,time{font-size:12px;color:#82909d}.content{white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.45}.content a,.attachment a,.embed a{color:#6cb6ff}.attachment{margin-top:8px}.attachment img{display:block;max-width:min(600px,100%);max-height:500px;border-radius:8px;margin-bottom:5px}.embed{margin-top:8px;padding:10px 12px;border-left:3px solid #5865f2;background:#111820;border-radius:4px}.footer{text-align:center;color:#65717d;font-size:12px;padding:30px}.empty{text-align:center;color:#8995a1;padding:50px}</style></head><body><header class="top"><h1>📄 ${esc(title)}</h1><p>Canal: #${esc(channel.name)} · ${messages.length} mensagem(ns)</p></header><main class="messages">${rows || '<div class="empty">Nenhuma mensagem encontrada.</div>'}</main><div class="footer">Transcript gerado pelo bot de tickets.</div></body></html>`;
  fs.writeFileSync(filepath, html, 'utf8');
  return { filename, url: publicTranscriptUrl(filename, req), count: messages.length };
}

function isAttendant(member) {
  return Boolean(member?.roles?.cache?.has(CONFIG.attendantRoleId));
}

function ticketRecord(channelId) {
  return db[channelId] || null;
}

function safeChannelName(subject, user) {
  const normalized = subject.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 20) || 'ticket';
  return `ticket-${normalized}-${user.username.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) || 'user'}`;
}

function ticketButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('resgatar_ticket').setLabel('🎟️ Resgatar').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('fechar_ticket').setLabel('🔒 Fechar Ticket').setStyle(ButtonStyle.Danger)
  );
}

function ticketPanel() {
  const embed = new EmbedBuilder()
    .setColor(0x00ff7f)
    .setTitle('🎫 Atendimento')
    .setDescription('Selecione abaixo o tipo do seu ticket para abrir um atendimento.');
  const select = new StringSelectMenuBuilder()
    .setCustomId('criar_ticket')
    .setPlaceholder('Selecione o assunto do ticket')
    .addOptions(
      { label: 'Revogação', value: 'Revogação', emoji: '📛', description: 'Solicitações relacionadas a revogação' },
      { label: 'Denúncia', value: 'Denúncia', emoji: '🚨', description: 'Realizar uma denúncia' },
      { label: 'Dúvida', value: 'Dúvida', emoji: '❓', description: 'Tirar uma dúvida' },
      { label: 'Outros', value: 'Outros', emoji: '📋', description: 'Outro assunto' }
    );
  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(select)] };
}

async function registerPanelCommand() {
  const commands = [{ name: 'painel', description: 'Envia o painel de tickets' }];
  if (CONFIG.guildId) {
    const guild = await client.guilds.fetch(CONFIG.guildId);
    await guild.commands.set(commands);
  } else {
    await client.application.commands.set(commands);
  }
}

client.once(Events.ClientReady, async ready => {
  console.log(`Bot conectado como ${ready.user.tag}`);
  try {
    await registerPanelCommand();
    console.log('Comando /painel registrado.');
  } catch (err) {
    console.error('Erro registrando comandos:', err);
  }
});

client.on(Events.InteractionCreate, async interaction => {
  try {
    if (interaction.isChatInputCommand() && interaction.commandName === 'painel') {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.reply({ content: '❌ Você precisa da permissão Gerenciar Servidor.', ephemeral: true });
      }
      await interaction.channel.send(ticketPanel());
      return interaction.reply({ content: '✅ Painel de tickets enviado.', ephemeral: true });
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'criar_ticket') {
      await interaction.deferReply({ ephemeral: true });
      const subject = interaction.values[0];
      const existing = Object.values(db).find(t => t.guildId === interaction.guildId && t.ownerId === interaction.user.id && t.status === 'open');
      if (existing) return interaction.editReply(`❌ Você já possui um ticket aberto: <#${existing.channelId}>`);

      const channel = await interaction.guild.channels.create({
        name: safeChannelName(subject, interaction.user),
        type: ChannelType.GuildText,
        parent: CONFIG.ticketCategoryId || undefined,
        permissionOverwrites: [
          { id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
          { id: CONFIG.attendantRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }
        ]
      });

      db[channel.id] = { channelId: channel.id, guildId: interaction.guildId, ownerId: interaction.user.id, attendantId: null, subject, status: 'open', createdAt: Date.now() };
      saveDb();

      const embed = new EmbedBuilder()
        .setColor(0x00ff7f)
        .setTitle('🎫 Ticket aberto')
        .setDescription(`Olá, <@${interaction.user.id}>!\n\n**Assunto:** ${esc(subject)}\n\nAguarde um atendente assumir o ticket.`);
      await channel.send({ content: `<@${interaction.user.id}> <@&${CONFIG.attendantRoleId}>`, embeds: [embed], components: [ticketButtons()] });
      await interaction.editReply(`✅ Ticket criado: <#${channel.id}>`);
      return;
    }

    if (!interaction.isButton()) return;

    if (interaction.customId === 'resgatar_ticket') {
      if (!isAttendant(interaction.member)) return interaction.reply({ content: '❌ Você não possui o cargo de atendente.', ephemeral: true });
      const ticket = ticketRecord(interaction.channelId);
      if (!ticket || ticket.status !== 'open') return interaction.reply({ content: '❌ Este ticket não está registrado como aberto.', ephemeral: true });
      if (ticket.attendantId) return interaction.reply({ content: `❌ Este ticket já foi resgatado por <@${ticket.attendantId}>.`, ephemeral: true });

      ticket.attendantId = interaction.user.id;
      saveDb();
      const embed = new EmbedBuilder().setColor(0x00ff7f).setTitle('🎟️ Ticket resgatado').setDescription(`🛡️ Atendente: <@${interaction.user.id}>\n\nEste ticket foi assumido por este atendente.`);
      return interaction.reply({ embeds: [embed] });
    }

    if (interaction.customId === 'fechar_ticket') {
      const ticket = ticketRecord(interaction.channelId);
      if (!ticket || ticket.status !== 'open') return interaction.reply({ content: '❌ Este ticket não está registrado.', ephemeral: true });
      if (!ticket.attendantId) return interaction.reply({ content: '❌ Este ticket ainda não foi resgatado.', ephemeral: true });
      if (interaction.user.id !== ticket.attendantId && !interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)) {
        return interaction.reply({ content: '❌ Apenas o atendente responsável ou um administrador pode fechar este ticket.', ephemeral: true });
      }

      await interaction.reply({ content: '📋 Gerando o transcript... aguarde.', ephemeral: true });
      const result = await generateTranscript(interaction.channel, interaction);

      ticket.status = 'closed';
      ticket.transcriptUrl = result.url;
      ticket.closedAt = Date.now();
      saveDb();

      const logChannel = await client.channels.fetch(CONFIG.transcriptLogChannelId).catch(() => null);
      if (logChannel?.isTextBased()) {
        const logEmbed = new EmbedBuilder()
          .setColor(0x00ff7f)
          .setTitle('📄 Transcript do Ticket')
          .addFields(
            { name: '🎫 Assunto', value: ticket.subject || 'Não informado', inline: true },
            { name: '👤 Dono', value: `<@${ticket.ownerId}>`, inline: true },
            { name: '🛡️ Atendente', value: `<@${ticket.attendantId}>`, inline: true },
            { name: '💬 Mensagens', value: String(result.count), inline: true }
          )
          .setDescription(`🔗 **[Abrir Transcript](${result.url})**`)
          .setTimestamp();
        await logChannel.send({ embeds: [logEmbed] });
      }

      const owner = await client.users.fetch(ticket.ownerId).catch(() => null);
      if (owner) {
        const dmEmbed = new EmbedBuilder()
          .setColor(0x00ff7f)
          .setTitle('⭐ Avalie o atendimento')
          .setDescription(`Seu ticket foi encerrado.\n\n🎫 **Assunto:** ${ticket.subject}\n🛡️ **Atendente:** <@${ticket.attendantId}>\n\nGostaríamos de saber como foi o atendimento.`);
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`avaliar_atendimento:${interaction.channelId}`).setLabel('⭐ Avaliar atendimento').setStyle(ButtonStyle.Primary));
        await owner.send({ embeds: [dmEmbed], components: [row] }).catch(() => {});
      }

      await interaction.editReply({ content: `✅ Transcript gerado!\n🔗 [Abrir Transcript](${result.url})` });
      await interaction.channel.send(`📄 **Transcript:** ${result.url}\n🔒 Este ticket será excluído em 5 segundos.`);
      setTimeout(async () => {
        await interaction.channel.delete('Ticket fechado e transcript gerado').catch(() => {});
        delete db[interaction.channelId];
        saveDb();
      }, 5000);
      return;
    }

    if (interaction.customId.startsWith('avaliar_atendimento:')) {
      const channelId = interaction.customId.split(':')[1];
      const ticket = db[channelId];
      const modal = new ModalBuilder().setCustomId(`avaliacao:${channelId}`).setTitle('⭐ Avaliação do Atendimento');
      const attendant = new TextInputBuilder().setCustomId('atendente').setLabel('Nome do atendente').setStyle(TextInputStyle.Short).setRequired(true).setMinLength(2).setMaxLength(100).setPlaceholder(ticket?.attendantId ? `Atendente: ${ticket.attendantId}` : 'Digite o nome');
      const nota = new TextInputBuilder().setCustomId('nota').setLabel('Qual é a nota? (0 a 10)').setStyle(TextInputStyle.Short).setRequired(true).setMinLength(1).setMaxLength(2).setPlaceholder('Ex.: 10');
      const obs = new TextInputBuilder().setCustomId('observacao').setLabel('Observação').setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(1000).setPlaceholder('Opcional');
      modal.addComponents(new ActionRowBuilder().addComponents(attendant), new ActionRowBuilder().addComponents(nota), new ActionRowBuilder().addComponents(obs));
      return interaction.showModal(modal);
    }

    if (interaction.customId.startsWith('avaliacao:')) {
      const channelId = interaction.customId.split(':')[1];
      const ticket = db[channelId];
      const notaRaw = interaction.fields.getTextInputValue('nota').trim();
      const nota = Number(notaRaw);
      if (!Number.isInteger(nota) || nota < 0 || nota > 10) return interaction.reply({ content: '❌ A nota precisa ser um número inteiro de 0 a 10.', ephemeral: true });
      const atendente = interaction.fields.getTextInputValue('atendente').trim();
      const observacao = interaction.fields.getTextInputValue('observacao').trim() || 'Sem observação.';
      const channel = await client.channels.fetch(CONFIG.evaluationChannelId).catch(() => null);
      if (!channel?.isTextBased()) return interaction.reply({ content: '❌ Canal de avaliações não encontrado.', ephemeral: true });
      const embed = new EmbedBuilder().setColor(0x00ff7f).setTitle('📋「AVALIAÇÃO」📋').setDescription(`-----------------------------------------\n「🗣️ 」 **Avaliador:** <@${interaction.user.id}>\n「👤」 **Atendente:** ${esc(atendente)}\n----------------------------------------\n「📄」 • **Nota:** ${nota}/10.\n「📅」 • **Data:** <t:${Math.floor(Date.now()/1000)}:f>\n----------------------------------------\n「📋」 • **Ticket Assunto:** ${esc(ticket?.subject || 'Não informado')}\n----------------------------------------\n「📝」 **Observação:** ${esc(observacao)}\n----------------------------------------`);
      await channel.send({ embeds: [embed] });
      return interaction.reply({ content: '✅ Sua avaliação foi enviada com sucesso!', ephemeral: true });
    }
  } catch (err) {
    console.error('Erro na interação:', err);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: '❌ Ocorreu um erro ao processar esta ação. Veja o console do bot.', ephemeral: true }).catch(() => {});
    } else {
      await interaction.reply({ content: '❌ Ocorreu um erro ao processar esta ação. Veja o console do bot.', ephemeral: true }).catch(() => {});
    }
  }
});

process.on('unhandledRejection', err => console.error('Unhandled rejection:', err));
process.on('uncaughtException', err => console.error('Uncaught exception:', err));

client.login(CONFIG.token);
