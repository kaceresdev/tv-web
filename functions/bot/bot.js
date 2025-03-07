const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");
const express = require("express");
const functions = require("firebase-functions");
const bodyParser = require("body-parser");
const cors = require("cors");
const config = require("./variables");

const app = express();
const port = 8444;

const TOKEN = config.botToken;
const CHAT_ID = config.telegramChatID;
const bot = new TelegramBot(TOKEN, { polling: true });

app.use(bodyParser.json());
app.use(cors());

app.post("/telegram-bot", (req, res) => {
  console.log("REQ: ", req.body);

  const nombre = "javi";

  const opciones = {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "Aceptar", callback_data: `aceptar_${nombre}` },
          { text: "Rechazar", callback_data: `rechazar_${nombre}` },
        ],
      ],
    },
  };

  bot.sendMessage(CHAT_ID, `¿Aceptar o rechazar el nombre?`, opciones);
  res.status(200).send("Bot message sent");
});

// bot.onText(/\/start/, (msg) => {
//   bot.sendMessage(msg.chat.id, "Envíame un nombre para procesarlo.");
// });

// Recibir el nombre y enviar botones
// bot.on("message", (msg) => {
//   const chatId = msg.chat.id;
//   const nombre = msg.text;

//   console.log(chatId);

//   if (nombre.startsWith("/")) return; // Ignorar comandos

//   const opciones = {
//     reply_markup: {
//       inline_keyboard: [
//         [
//           { text: "Aceptar", callback_data: `aceptar_${nombre}` },
//           { text: "Rechazar", callback_data: `rechazar_${nombre}` },
//         ],
//       ],
//     },
//   };

//   bot.sendMessage(chatId, `¿Aceptar o rechazar el nombre: ${nombre}?`, opciones);
// });

// Manejo de botones
bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const [accion, nombre] = query.data.split("_");

  if (accion === "aceptar") {
    const URL = `https://tudominio.com/api/procesar?nombre=${encodeURIComponent(nombre)}`;

    try {
      await axios.get(URL);
      bot.sendMessage(chatId, `✅ Nombre "${nombre}" aceptado y enviado a la URL.`);
    } catch (error) {
      bot.sendMessage(chatId, `❌ Error al enviar el nombre "${nombre}".`);
    }
  } else {
    bot.sendMessage(chatId, `❌ Nombre "${nombre}" rechazado.`);
  }
});

app.listen(port, () => {
  console.log(`Server listening at port ${port}`);
});

exports.app = functions.runWith({ memory: "512MB", timeoutSeconds: 300 }).https.onRequest(app);
