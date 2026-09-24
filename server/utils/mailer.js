// Sends email with Nodemailer.
// If SMTP settings are in .env they are used; otherwise a free Ethereal test inbox is
// created automatically and a preview link is returned (handy for demos).
const nodemailer = require('nodemailer');

let transporterPromise;

function getTransporter() {
  if (!transporterPromise) {
    transporterPromise = process.env.SMTP_HOST
      ? Promise.resolve(nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT || 587),
          secure: Number(process.env.SMTP_PORT) === 465,
          auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
        }))
      : nodemailer.createTestAccount().then((account) =>
          nodemailer.createTransport({ host: 'smtp.ethereal.email', port: 587, auth: { user: account.user, pass: account.pass } })
        );
    // If creating the transport fails, try again next time instead of caching the failure.
    transporterPromise.catch(() => { transporterPromise = null; });
  }
  return transporterPromise;
}

async function sendMail({ from, replyTo, to, subject, text, attachments }) {
  const transporter = await getTransporter();
  const info = await transporter.sendMail({
    from: process.env.SMTP_FROM || from,
    replyTo,
    to,
    subject,
    text,
    attachments,
  });
  return { previewUrl: nodemailer.getTestMessageUrl(info) || null };
}

module.exports = { sendMail };
