import { sendEmail } from "./_lib/sendEmail";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method Not Allowed" });
  }

  try {
    const { emails, subject, html, text, orderId } = req.body || {};

    if (!Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({
        success: false,
        error: "No recipient emails provided",
      });
    }

    const validEmails = emails
      .filter((email: unknown) => typeof email === "string")
      .map((email: string) => email.trim())
      .filter((email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));

    if (validEmails.length === 0) {
      return res.status(400).json({
        success: false,
        error: "No valid recipient emails provided",
      });
    }

    console.log(
      `[Vercel Email] Sending driver notification for Order #${orderId || "N/A"} to ${validEmails.length} recipient(s)`
    );

    const info = await sendEmail({
      to: validEmails,
      subject: subject || "Nuevo pedido disponible - Mesa 22",
      html,
      text,
      senderName: "Mesa 22 Repartos",
    });

    console.log(`[Vercel Email] Sent successfully: ${info.messageId}`);

    return res.status(200).json({
      success: true,
      method: "smtp",
      recipients: validEmails,
      messageId: info.messageId,
    });
  } catch (error: any) {
    console.error("[Vercel Driver Email Error]", error);

    return res.status(500).json({
      success: false,
      error: error?.message || "Error al enviar el correo",
    });
  }
}
