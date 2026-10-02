# EB Ticket Bot — Node.js

Bot de tickets com:
- painel `/painel`
- assuntos Revogação, Denúncia, Dúvida e Outros
- cargo de atendente
- primeiro atendente que resgatar fica responsável
- fechamento do ticket
- transcript HTML gerado pelo próprio bot
- link público para abrir o transcript no navegador
- envio do link para o canal de logs
- DM para o dono do ticket com botão de avaliação
- avaliação enviada para o canal configurado
- armazenamento simples dos tickets em `data/tickets.json`

## 1. Requisitos

Node.js 18.18 ou superior. O projeto usa discord.js 14.27.0.

## 2. Instalação

```bash
npm install
```

## 3. Configuração

Copie `.env.example` para `.env` e preencha:

```env
DISCORD_TOKEN=SEU_TOKEN
PUBLIC_URL=https://SEU-BOT.onrender.com
PORT=3000
```

Os IDs já estão preenchidos conforme o sistema atual.

## 4. Permissões do bot

No convite do bot, use as permissões necessárias para:
- Ver canais
- Gerenciar canais
- Enviar mensagens
- Ler histórico de mensagens
- Incorporar links
- Anexar arquivos

Também ative no Developer Portal o **Message Content Intent**.

## 5. Executar

```bash
npm start
```

Depois use `/painel` em um canal onde o bot possa enviar mensagens.

## 6. Hospedagem

No Render, crie um Web Service, coloque o projeto no GitHub e use:

Build Command:
```bash
npm install
```

Start Command:
```bash
npm start
```

A variável `PUBLIC_URL` deve ser a URL pública do serviço, por exemplo:

```text
https://meu-bot.onrender.com
```

Sem uma URL pública, o transcript ainda será criado localmente, mas o link não poderá ser aberto pela internet.

## Segurança

Nunca coloque o token do bot no código ou envie o token para outras pessoas. Use somente `.env`.
