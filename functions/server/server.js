const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const nodemailer = require("nodemailer");
const functions = require("firebase-functions");
const axios = require("axios");
const puppeteer = require("puppeteer");
const puppeteerCore = require("puppeteer-core");
const chrome = require("chrome-aws-lambda");
const config = require("./variables");

const app = express();
const port = 8443;

const isLocal = config.isLocal;

const API_KEY_2CAPTCHA = config.apiKey2Captcha;
const LOGIN_URL = config.loginUrl;
const USERNAME_WEB = config.usernameWeb;
const PASSWORD_WEB = config.passwordWeb;

app.use(bodyParser.json());
app.use(cors());

// ** ENDPOINTS **

/**
 * Endpoint enviar email de pedido
 */
app.post("/send-email", (req, res) => {
  const { name, name_client, mobile_client, code, tivimate, vpn } = req.body;

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: config.nodemailerUser,
      pass: config.nodemailerPass,
    },
  });

  const mailOptions = {
    from: config.nodemailerEmail,
    to: config.nodemailerEmail,
    subject: `[${name}] - ${code}`,
    text: `
      Datos de cliente:
        Code: ${code}
        Nombre: ${name_client}
        Whatsapp: ${mobile_client}
        Tivimate: ${tivimate ? "Si" : "No"}
        VPN: ${vpn ? "Si" : "No"}
    `,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.log(error);
      res.status(500).send("Error sending email");
    } else {
      console.log("Email sent:", info.response);
      res.status(200).send("Email sent successfully");
    }
  });
});

/**
 * Endpoint para avisar al bot de telegram que existe un pedido
 */
app.post("/bot", async (req, res) => {
  const { name_client, mobile_client, code } = req.body;

  const url = isLocal ? config.localUrlServerTelegramBot : config.urlServerTelegramBot;
  const response = await axios.post(url + `/telegram-bot`, {
    name: name_client,
    mobile: mobile_client,
    code,
  });

  res.status(200).send(response.data);
});

/**
 * Endpoint para obtener los créditos
 */
app.post("/getCredits", async (req, res) => {
  try {
    const data = await getCredits(USERNAME_WEB, PASSWORD_WEB);
    res.json(data);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Endpoint para obtener los códigos
 */
app.post("/getCodes", async (req, res) => {
  const { client_name, action } = req.body;
  let period = "";

  switch (action) {
    case "3m":
      period = "3mois";
      break;
    case "6m":
      period = "6mois";
      break;
    case "12m":
      period = "12mois";
      break;

    default:
      period = action;
      break;
  }

  try {
    const data = await getCodes(USERNAME_WEB, PASSWORD_WEB, client_name, period);
    res.json(data);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ** FUNCTIONS **

/**
 * Función que resuelve un captcha
 * @param {*} siteKey clave del captcha a resolver
 * @param {*} pageUrl url de dónde se encuentra el captcha
 * @returns
 */
async function resolverCaptcha(siteKey, pageUrl) {
  console.log("🟡 Enviando CAPTCHA a 2Captcha...");

  // Enviar el CAPTCHA a 2Captcha
  const response = await axios.get(
    `http://2captcha.com/in.php?key=${API_KEY_2CAPTCHA}&method=userrecaptcha&googlekey=${siteKey}&pageurl=${pageUrl}&json=1`
  );

  if (response.data.status !== 1) {
    console.error("❌ Error al enviar CAPTCHA:", response.data);
    return null;
  }

  const captchaId = response.data.request;
  console.log("🟡 CAPTCHA enviado, esperando resolución...");

  // Esperar y hacer múltiples intentos para obtener la solución
  for (let i = 0; i < 10; i++) {
    await new Promise((resolve) => setTimeout(resolve, 30000));

    try {
      const result = await axios.get(`http://2captcha.com/res.php?key=${API_KEY_2CAPTCHA}&action=get&id=${captchaId}&json=1`);
      if (result.data.status === 1) {
        console.log("✅ CAPTCHA resuelto:", result.data.request);
        return result.data.request;
      }
    } catch (error) {
      console.error("❌ Error al evaluar el CAPTCHA: ", error);
      return null;
    }
    console.log(`🔄 Intento ${i + 1}: CAPTCHA aún no está listo...`);
  }

  console.error("❌ No se pudo resolver el CAPTCHA en el tiempo esperado.");
  return null;
}

/**
 * Función que realiza login en la URL de login
 * @param {*} username usuario del login
 * @param {*} password contraseña del login
 * return {page, browser}
 */
async function login(username, password) {
  let browser;
  if (isLocal) {
    browser = await puppeteer.launch({
      headless: false, // Muestra el navegador
      args: [
        "--disable-features=site-per-process", // Reduce el aislamiento de procesos
        "--no-sandbox",
        "--disable-setuid-sandbox", // Desactiva restricciones de seguridad (útil en servidores)
        "--disable-dev-shm-usage", // Evita usar `/dev/shm` (útil en contenedores Docker)
        "--disable-gpu", // Desactiva la GPU (en algunos sistemas acelera el rendimiento)
        "--window-size=1920,1080", // Establece un tamaño de ventana grande
      ],
    });
  } else {
    browser = await puppeteerCore.launch({
      headless: chrome.headless,
      args: [...chrome.args, "--no-sandbox", "--disable-setuid-sandbox"],
      executablePath: (await chrome.executablePath) || "/usr/bin/google-chrome-stable",
    });
  }
  const pages = await browser.pages();
  await Promise.all(pages.map((page) => page.close()));
  const page = await browser.newPage();
  await page.setRequestInterception(true);
  page.on("request", (request) => {
    if (["image", "stylesheet", "font"].includes(request.resourceType())) {
      request.abort(); // ❌ Bloquear carga innecesaria
    } else {
      request.continue();
    }
  });
  await page.goto(LOGIN_URL);

  console.log("🟡 Ingresando usuario y contraseña...");
  await page.type('input[name="username"]', username);
  await page.type('input[name="password"]', password);

  console.log("🟡 Detectando CAPTCHA...");
  const siteKey = await page.evaluate(() => {
    const captchaElement = document.querySelector(".g-recaptcha");
    return captchaElement ? captchaElement.getAttribute("data-sitekey") : null;
  });

  if (siteKey) {
    console.log("🔹 SiteKey encontrada:", siteKey);
    const captchaToken = await resolverCaptcha(siteKey, LOGIN_URL);
    if (captchaToken) {
      await page.evaluate((token) => {
        document.querySelector("#g-recaptcha-response").innerText = token;
      }, captchaToken);
    } else {
      console.error("❌ No se pudo resolver el CAPTCHA.");
      await browser.close();
      return { success: false, message: "No se pudo resolver el CAPTCHA" };
    }
  } else {
    console.log("❌ No se detectó CAPTCHA.");
    await browser.close();
    return { success: false, message: "No se detectó CAPTCHA" };
  }

  console.log("🟡 Haciendo login...");
  await page.click('button[type="submit"]');
  await new Promise((resolve) => setTimeout(resolve, 5000));

  return { page, browser };
}

/**
 * Función que recupera los créditos restantes
 * @param {*} username usuario de la url de login
 * @param {*} password contraseña de la url de login
 * @returns {succes, message}
 */
async function getCredits(username, password) {
  const { page, browser } = await login(username, password);

  console.log("🟡 Extrayendo créditos...");
  const credits = await page.evaluate(() => {
    const preElement = document.querySelector("#top > div.left > pre");
    return preElement ? preElement.innerText : null;
  });

  await browser.close();

  if (credits) {
    console.log("✅ Créditos extraídos: \n", credits);
    return { success: true, message: credits };
  } else {
    console.error("❌ No se pudieron extraer los créditos.");
    return { success: false, message: "No se pudieron extraer los créditos" };
  }
}

/**
 * Función que recupera los códigos de la lista
 * @param {*} username usuario de la url de login
 * @param {*} password contraseña de la url de login
 */
async function getCodes(username, password, client_name, period) {
  const { page, browser } = await login(username, password);

  if (!(page?.constructor?.name === "Page") || !(browser?.constructor?.name === "Browser")) {
    return { success: false, message: "❌ No se pudo realizar login" };
  }

  console.log("🟡 Navegando...");
  await page.click("#sidebar > li:nth-child(2) > a");
  await new Promise((resolve) => setTimeout(resolve, 2000));

  console.log("🟡 Introduciendo datos de la lista...");
  await page.type("#main > div.full_w > form > table > tbody > tr:nth-child(1) > td:nth-child(2) > input", client_name);
  await page.select("#main > div.full_w > form > table > tbody > tr:nth-child(4) > td.small > span > select", period);

  await new Promise((resolve) => setTimeout(resolve, 2000));

  console.log("🟡 Añadiendo lista...");
  await page.click('input[type="submit"]');

  await new Promise((resolve) => setTimeout(resolve, 2000));

  console.log("🟡 Extrayendo datos...");
  const url = page.url();
  const hash = new URL(url).hash;
  const hashValue = hash.replace("#z", "");

  const codes = await page.evaluate((hash) => {
    const selector = `#zcon${hash} > p`;
    const contentElement = document.querySelector(selector);
    return contentElement ? contentElement.innerText : null;
  }, hashValue);

  console.log("🟡 Extrayendo créditos...");
  const credits = await page.evaluate(() => {
    const preElement = document.querySelector("#top > div.left > pre");
    return preElement ? preElement.innerText : null;
  });

  await browser.close();

  const numCredits = credits.match(/CREDIT LEFT\s*:\s*(\d+)/)[1];

  if (parseInt(numCredits) < 24) {
    try {
      const url = isLocal ? config.localUrlServerTelegramBot : config.urlServerTelegramBot;
      await axios.post(url + `/bot-warning-credits`, {
        numCredits,
      });
      console.log("✅ Créditos restantes enviados");
    } catch (error) {
      console.error("❌ Error al enviar créditos restantes.");
    }
  }

  if (codes) {
    console.log("✅ Datos extraídos: \n", codes);
    return { success: true, message: codes };
  } else {
    console.error("❌ No se pudieron extraer los datos.");
    return { success: false, message: "No se pudieron extraer los datos" };
  }
}

// ** Arranque del servidor **

if (isLocal) {
  app.listen(port, () => {
    console.log(`Server listening at port ${port}`);
  });
}

exports.app = functions.runWith({ memory: "512MB", timeoutSeconds: 400 }).https.onRequest(app);
