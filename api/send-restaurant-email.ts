import nodemailer from "nodemailer";

function getTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error("SMTP no configurado en Vercel. Verifica SMTP_HOST, SMTP_PORT, SMTP_USER y SMTP_PASS.");
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method Not Allowed" });
  }

  try {
    const { email, subject, html, text, orderId, restaurantName } = req.body || {};

    if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return res.status(400).json({ success: false, error: "No valid recipient email provided" });
    }

    const recipient = email.trim();
    console.log(`[Vercel Email] Sending restaurant notification for Order #${orderId || "N/A"} to ${recipient} (${restaurantName || "Restaurante"})`);

    const transporter = getTransporter();
    const from = process.env.SMTP_FROM || process.env.SMTP_USER;
    const info = await transporter.sendMail({
      from: `"Mesa 22 Restaurantes" <${from}>`,
      to: recipient,
      subject: subject || "Nuevo pedido a domicilio - Mesa 22",
      text: text || "",
      html: html || "",
    });

    console.log(`[Vercel Email] Sent successfully: ${info.messageId}`);
    return res.status(200).json({ success: true, method: "smtp", recipient, messageId: info.messageId });
  } catch (error: any) {
    console.error("[Vercel Restaurant Email Error]", error);
    return res.status(500).json({ success: false, error: error?.message || "Error al enviar el correo" });
  }
}
