// Sends email. Three options, picked from .env:
//   1. BREVO_API_KEY set  → Brevo's HTTPS email API (works on hosts that block SMTP, e.g. Railway)
//   2. SMTP_HOST set      → your own SMTP server
//   3. nothing set        → a free Ethereal test inbox; a preview link is returned (handy for demos)
const nodemailer = require('nodemailer');

// Give up quickly instead of hanging when a host blocks outgoing SMTP.
const TIMEOUTS = { connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 20000 };

let transporterPromise;

function getTransporter() {
  if (!transporterPromise) {
    transporterPromise = process.env.SMTP_HOST
      ? Promise.resolve(nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT || 587),
          secure: Number(process.env.SMTP_PORT) === 465,
          auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
          ...TIMEOUTS,
        }))
      : nodemailer.createTestAccount().then((account) =>
          nodemailer.createTransport({ host: 'smtp.ethereal.email', port: 587, auth: { user: account.user, pass: account.pass }, ...TIMEOUTS })
        );
    // If creating the transport fails, try again next time instead of caching the failure.
    transporterPromise.catch(() => { transporterPromise = null; });
  }
  return transporterPromise;
}

// Brevo (https://www.brevo.com) — free plan, 300 emails/day. SMTP_FROM must be a sender verified in Brevo.
async function sendWithBrevo({ from, replyTo, to, subject, text, attachments }) {
  const sender = process.env.SMTP_FROM || from;
  const email = sender.match(/<(.+)>/)?.[1] || sender;
  const name = sender.match(/^"?([^"<]+)"?\s*</)?.[1]?.trim();

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': process.env.BREVO_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sender: { email, name },
      replyTo: replyTo ? { email: replyTo } : undefined,
      to: [{ email: to }],
      subject,
      textContent: text,
      attachment: attachments.map((a) => ({ name: a.filename, content: a.content.toString('base64') })),
    }),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`Brevo: ${res.status} ${await res.text()}`);
  return { previewUrl: null };
}

async function sendMail(message) {
  if (process.env.BREVO_API_KEY) return sendWithBrevo(message);

  const transporter = await getTransporter();
  const info = await transporter.sendMail({ ...message, from: process.env.SMTP_FROM || message.from });
  return { previewUrl: nodemailer.getTestMessageUrl(info) || null };
}

module.exports = { sendMail };
