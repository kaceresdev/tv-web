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

const API_KEY_2CAPTCHA = config.apiKey2Captcha;
const LOGIN_URL = config.loginUrl;
const isLocal = config.isLocal;

app.use(bodyParser.json());
app.use(cors());

app.post("/send-email", (req, res) => {
  const name = req.body.name;
  const name_client = req.body.name_client;
  const mobile_client = req.body.mobile_client;
  const code = req.body.code;

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
    `,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.log(error);
      res.status(500).send("Error sending email");
    } else {
      console.log("Email sent:", info.response);
      // const response = await axios.get(`https://localhost:8444/telegram-bot`);
      // console.log("Bot called: ", response);
      res.status(200).send("Email sent successfully");
    }
  });
});

app.post("/test", async (req, res) => {
  const { name } = req.body;
  const response = await axios.post(`https://us-central1-tvweb-6cf69.cloudfunctions.net/bot-app/telegram-bot`, { name: name });
  console.log(response.data);

  res.status(200).send(response.data);
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Faltan usuario o contraseña" });
  }

  try {
    const data = await loginYExtraerDatos(username, password);
    res.json(data);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

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
    // 10 intentos (50 segundos en total)
    await new Promise((resolve) => setTimeout(resolve, 30000)); // Espera 1 minuto

    const result = await axios.get(`http://2captcha.com/res.php?key=${API_KEY_2CAPTCHA}&action=get&id=${captchaId}&json=1`);

    if (result.data.status === 1) {
      console.log("✅ CAPTCHA resuelto:", result.data.request);
      return result.data.request;
    }

    console.log(`🔄 Intento ${i + 1}: CAPTCHA aún no está listo...`);
  }

  console.error("❌ No se pudo resolver el CAPTCHA en el tiempo esperado.");
  return null;
}

async function loginYExtraerDatos(username, password) {
  let browser;
  if (isLocal) {
    browser = await puppeteer.launch({
      headless: true,
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
  // await page.waitForNavigation();
  await new Promise((resolve) => setTimeout(resolve, 10000));

  // console.log("🟡 Haciendo clic en un botón...");
  // await page.click("#botonImportante");
  // await page.waitForTimeout(2000);

  console.log("🟡 Extrayendo datos...");
  const datos = await page.evaluate(() => {
    const preElement = document.querySelector("#top > div.left > pre");
    return preElement ? preElement.innerText : null;
  });

  console.log("✅ Datos extraídos:", datos);
  await browser.close();
  return { success: datos ? true : false, message: datos };
}

app.listen(port, () => {
  console.log(`Server listening at port ${port}`);
});

exports.app = functions.runWith({ memory: "512MB", timeoutSeconds: 300 }).https.onRequest(app);
