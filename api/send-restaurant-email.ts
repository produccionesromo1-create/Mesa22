import { sendEmail } from "./_lib/sendEmail";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method Not Allowed" });
  }

  try {
    const { email, subject, html, text, orderId, restaurantName } = req.body || {};

    if (
      typeof email !== "string" ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    ) {
      return res.status(400).json({
        success: false,
        error: "No valid recipient email provided",
      });
    }

    const recipient = email.trim();

    console.log(
      `[Vercel Email] Sending restaurant notification for Order #${orderId || "N/A"} to ${recipient} (${restaurantName || "Restaurante"})`
    );

    const info = await sendEmail({
      to: recipient,
      subject: subject || "Nuevo pedido a domicilio - Mesa 22",
      html,
      text,
      senderName: "Mesa 22 Restaurantes",
    });

    console.log(`[Vercel Email] Sent successfully: ${info.messageId}`);

    return res.status(200).json({
      success: true,
      method: "smtp",
      recipient,
      messageId: info.messageId,
    });
  } catch (error: any) {
    console.error("[Vercel Restaurant Email Error]", error);

    return res.status(500).json({
      success: false,
      error: error?.message || "Error al enviar el correo",
    });
  }
}
