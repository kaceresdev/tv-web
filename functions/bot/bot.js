const express = require("express");
const bodyParser = require("body-parser");
const fetch = require("node-fetch");
const axios = require("axios");
const functions = require("firebase-functions");
const config = require("./variables");

// Configura el servidor
const app = express();
const port = 8444;

const isLocal = config.isLocal;

// Configuración del bot de Telegram
const TOKEN = config.botToken;
const telegramApiUrl = config.telegramApiUrl + TOKEN;
const webhookUrl = isLocal ? config.localWebhookUrl : config.webhookUrl;
const CHAT_ID = config.telegramChatID;

const previousMessages = new Set();

app.use(bodyParser.json());

// ** ENDPOINTS **

/**
 * Endpoint que recibe un pedido para que lo pinte el bot
 */
app.post("/telegram-bot", async (req, res) => {
  console.log(`🟡 Pedido ${req.body.code} recibido`);
  initialBtns(req.body.name, req.body.code, req.body.mobile);

  res.status(200).send("Bot request received");
});

/**
 * Endpoint que recibe créditos restantes escasos para que lo pinte el bot
 */
app.post("/bot-warning-credits", async (req, res) => {
  console.log(`🟡 Créditos restantes...`);
  botSendMessage(`⚠️ Créditos restantes: *${req.body.numCredits}* ⚠️`);

  res.status(200).send(req.body.numCredits);
});

/**
 * Webhook de telegram que recibe las instrucciones del bot
 */
app.post("/webhook", async (req, res) => {
  res.sendStatus(200); // Contestamos a telegram inmediatamente para que no haga reenvios del mensaje

  if (req.body.message?.text.startsWith("/start")) {
    const messageId = req.body.message.message_id;

    if (previousMessages.has(messageId)) {
      console.log("Mensaje duplicado detectado");
      return res.sendStatus(200); // Ignorar mensajes duplicados
    }
    previousMessages.add(messageId);

    botSendMessage("✅ ¡Listo para empezar a gestionar tus pedidos!");
  } else if (req.body.message?.text.startsWith("/credits")) {
    const messageId = req.body.message.message_id;

    if (previousMessages.has(messageId)) {
      console.log("Mensaje duplicado detectado");
      return res.sendStatus(200); // Ignorar mensajes duplicados
    }
    previousMessages.add(messageId);

    try {
      botSendMessage("💬 Recuperando créditos...");
      const url = isLocal ? config.localUrlServer : config.urlServer;
      const response = await axios.post(url + `/getCredits`);
      console.log(`✅ Créditos obtenidos: \n`, response.data.message);
      botSendMessage(`🧾 Créditos: \n${response.data.message}`);
    } catch (error) {
      console.log(`❌ Créditos NO recuperados. `, error);
      botSendMessage(`❌ Error al obtener los créditos ❌ `);
    }
  } else if (req.body.callback_query) {
    const callback_query = req.body.callback_query;
    const messageId = callback_query.message.message_id;
    const [action, name, code, mobile] = callback_query.data.split("_");

    if (previousMessages.has(callback_query.data)) {
      console.log("Acción duplicada detectada");
      return res.sendStatus(200); // Ignorar acciones duplicadas
    }

    if (action == "accept") {
      optionsBtns(name, code, mobile, messageId);
    } else if (action == "reject") {
      console.log(`❌ Pedido ${code} rechazado`);
      botEditMessage(`📝 Pedido *${code}*, a nombre de *${name}* y con numero de teléfono *${mobile}* recibido`, messageId);
      botSendMessage(`❌ Pedido *${code}* rechazado`);
    } else if (action == "back") {
      initialBtns(name, code, mobile, true, messageId);
    } else {
      previousMessages.add(callback_query.data);

      botEditMessage(`📝 Pedido *${code}*, a nombre de *${name}* y con numero de teléfono *${mobile}* recibido`, messageId);
      botSendMessage(`💬 Procesando el pedido *${code}* de *${action}*...`);

      try {
        console.log(`🟡 Pedido ${code} de ${action} en curso...`);
        const url = isLocal ? config.localUrlServer : config.urlServer;
        const response = await axios.post(url + `/getCodes`, { client_name: name, action });
        console.log(`✅ Pedido ${code} procesado. `, response.data.message);
        previousMessages.delete(callback_query.data);
        botSendMessage(`✅ *${code}* \n${response.data.message}`);
      } catch (error) {
        console.log(`❌ Pedido ${code} NO procesado. `, error);
        botSendMessage(`❌ Error al obtener los códigos del pedido *${code}* ❌ `);
      }
    }
  }
});

// ** FUNCTIONS **

const initialBtns = async (name, code, mobile, editar = false, messageId = null) => {
  const initialOpts = {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "✅ Aceptar", callback_data: `accept_${name}_${code}_${mobile}` },
          { text: "❌ Rechazar", callback_data: `reject_${name}_${code}_${mobile}` },
        ],
      ],
    },
  };

  if (editar && messageId) {
    botEditMessage(`📝 Pedido *${code}*, a nombre de *${name}* y con numero de teléfono *${mobile}* recibido`, messageId, initialOpts.reply_markup);
  } else {
    botSendMessage(`📝 Pedido *${code}*, a nombre de *${name}* y con numero de teléfono *${mobile}* recibido`, initialOpts.reply_markup);
  }
};

const optionsBtns = async (name, code, mobile, messageId) => {
  const periodOpts = {
    reply_markup: {
      inline_keyboard: [
        [{ text: "12h", callback_data: `12h_${name}_${code}_${mobile}` }],
        [{ text: "24h", callback_data: `24h_${name}_${code}_${mobile}` }],
        [{ text: "3 meses", callback_data: `3m_${name}_${code}_${mobile}` }],
        [{ text: "6 meses", callback_data: `6m_${name}_${code}_${mobile}` }],
        [{ text: "12 meses", callback_data: `12m_${name}_${code}_${mobile}` }],
        [{ text: "Atrás", callback_data: `back_${name}_${code}_${mobile}` }],
      ],
    },
  };

  botEditMessage(`📝 Pedido *${code}*, a nombre de *${name}* y con numero de teléfono *${mobile}* recibido`, messageId, periodOpts.reply_markup);
};

const botSendMessage = async (text, reply_markup = { inline_keyboard: [] }) => {
  try {
    const response = await fetch(`${telegramApiUrl}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: escapeMarkdownV2(text),
        reply_markup: reply_markup,
        parse_mode: "MarkdownV2",
      }),
    });
  } catch (err) {
    console.log("ERROR send message telegram: ", err);
  }
};

const botEditMessage = async (text, messageId, reply_markup = { inline_keyboard: [] }) => {
  try {
    await fetch(`${telegramApiUrl}/editMessageText`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        message_id: messageId,
        reply_markup: reply_markup,
        text: escapeMarkdownV2(text),
        parse_mode: "MarkdownV2",
      }),
    });
  } catch (err) {
    console.log("ERROR edit message telegram: ", err);
  }
};

function escapeMarkdownV2(text) {
  return text.replace(/([_\[\]()~`>#+\-=|{}.!])/g, "\\$1");
}

// ** Arranque del servidor y del webhook **

const setWebhook = async () => {
  const response = await fetch(`${telegramApiUrl}/setWebhook?url=${webhookUrl}`);
  const data = await response.json();
  console.log("Webhook set:", data);
};

if (isLocal) {
  // Init server and configure webhook
  app.listen(port, () => {
    console.log(`Server listening at port ${port}`);
    setWebhook();
  });
} else {
  //  Configure webhook
  setWebhook();
}

exports.app = functions.runWith({ timeoutSeconds: 400 }).https.onRequest(app);
