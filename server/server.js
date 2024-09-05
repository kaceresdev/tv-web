const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const nodemailer = require("nodemailer");
const functions = require("firebase-functions");

const app = express();
const port = 8443;

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
        Nombre: ${name_client}
        Whatsapp: ${mobile_client}
        Code: ${code}
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

app.listen(port, () => {
  console.log(`Server listening at port ${port}`);
});

exports.app = functions.https.onRequest(app);
