import nodemailer from "nodemailer";

function getTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error(
      "SMTP no configurado en Vercel. Verifica SMTP_HOST, SMTP_PORT, SMTP_USER y SMTP_PASS."
    );
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

export async function sendEmail(params: {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  senderName?: string;
}) {
  const transporter = getTransporter();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;

  if (!from) {
    throw new Error("SMTP_FROM o SMTP_USER no está configurado en Vercel.");
  }

  const info = await transporter.sendMail({
    from: `"${params.senderName || "Mesa 22"}" <${from}>`,
    to: Array.isArray(params.to) ? params.to.join(", ") : params.to,
    subject: params.subject,
    text: params.text || "",
    html: params.html || "",
  });

  return info;
}
