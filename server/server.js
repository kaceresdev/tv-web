const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const nodemailer = require("nodemailer");
const functions = require("firebase-functions");
const puppeteer = require("puppeteer");
const axios = require("axios");

const app = express();
const port = 8443;

const API_KEY_2CAPTCHA = "159fc4b57ab1078d28790eb9b1db75f0";
const LOGIN_URL = "https://suptv.co/c4usm/login.php";

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
      user: "nodemailertvweb@gmail.com",
      pass: "ammf oqai aqof qpof",
    },
  });

  const mailOptions = {
    from: "nodemailertvweb@gmail.com",
    to: "nodemailertvweb@gmail.com",
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
      res.status(200).send("Email sent successfully");
    }
  });
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Faltan usuario o contraseña" });
  }

  try {
    const data = await loginYExtraerDatos(username, password);
    if (data) {
      res.json({ success: true, data });
    } else {
      res.json({ success: false, data });
    }
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
  for (let i = 0; i < 5; i++) {
    // 10 intentos (50 segundos en total)
    await new Promise((resolve) => setTimeout(resolve, 60000)); // Espera 1 minuto

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
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
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
      return;
    }
  } else {
    console.log("❌ No se detectó CAPTCHA.");
  }

  console.log("🟡 Haciendo login...");
  await page.click('button[type="submit"]');
  await page.waitForNavigation();
  // await new Promise((resolve) => setTimeout(resolve, 30000));

  // console.log("🟡 Haciendo clic en un botón...");
  // await page.click("#botonImportante");
  // await page.waitForTimeout(2000);

  console.log("🟡 Extrayendo datos...");
  const datos = await page.evaluate(() => {
    const preElement = document.querySelector("#top > div.left > pre");
    return preElement ? preElement.innerText : "No se encontró el dato.";
  });

  console.log("✅ Datos extraídos:", datos);
  await browser.close();
  return datos;
}

app.listen(port, () => {
  console.log(`Server listening at port ${port}`);
});

exports.app = functions.https.onRequest(app);
