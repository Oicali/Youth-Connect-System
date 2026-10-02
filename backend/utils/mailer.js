// backend/utils/mailer.js
const nodemailer = require("nodemailer");

// one reusable connection to the SMTP provider
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: false, // port 587 starts plain, then upgrades to TLS
  requireTLS: true, // refuse to send if the upgrade fails
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// the only function the rest of the app uses to send mail
async function sendEmail({ to, subject, text, html }) {
  await transporter.sendMail({
    from: process.env.MAIL_FROM,
    to,
    subject,
    text, // plain-text fallback
    html,
  });
}

module.exports = { sendEmail };