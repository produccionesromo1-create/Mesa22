import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import nodemailer from "nodemailer";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "10mb" }));

  // API endpoint: Send notification emails to drivers
  app.post("/api/send-driver-email", async (req, res) => {
    try {
      const { emails, subject, html, text, orderId } = req.body;

      if (!emails || !Array.isArray(emails) || emails.length === 0) {
        return res.status(400).json({ success: false, error: "No recipient emails provided" });
      }

      console.log(`[Server Email] Sending notification for Order #${orderId} to: ${emails.join(", ")}`);

      const smtpHost = process.env.SMTP_HOST;
      const smtpPort = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 587;
      const smtpUser = process.env.SMTP_USER;
      const smtpPass = process.env.SMTP_PASS;
      const smtpFrom = process.env.SMTP_FROM || 'notificaciones@mesa22.com';

      if (smtpHost && smtpUser && smtpPass) {
        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port: smtpPort,
          secure: smtpPort === 465,
          auth: {
            user: smtpUser,
            pass: smtpPass,
          },
        });

        const info = await transporter.sendMail({
          from: `"Mesa 22 Repartos" <${smtpFrom}>`,
          to: emails.join(", "),
          subject: subject,
          text: text,
          html: html,
        });

        console.log(`[Server Email] Real SMTP email sent successfully (MessageID: ${info.messageId})`);
        return res.json({
          success: true,
          method: "smtp",
          recipients: emails,
          messageId: info.messageId,
        });
      } else {
        // Simulated email fallback when SMTP is not configured
        console.log(`[Server Email] SMTP credentials not set in environment. Simulated email sent to ${emails.length} driver(s):`, emails);
        return res.json({
          success: true,
          method: "simulated",
          recipients: emails,
          note: "Notificación de correo procesada con éxito (Modo simulación / vista previa activa). Configura SMTP_HOST en .env para envio SMTP real.",
        });
      }
    } catch (err: any) {
      console.error("[Server Email Error]", err);
      return res.status(500).json({
        success: false,
        error: err.message || "Error al procesar el correo",
      });
    }
  });

  // API endpoint: Send notification emails to restaurant owners (DELIVERY orders only)
  app.post("/api/send-restaurant-email", async (req, res) => {
    try {
      const { email, subject, html, text, orderId, restaurantName } = req.body;

      if (!email || typeof email !== "string" || !email.includes("@")) {
        return res.status(400).json({ success: false, error: "No valid recipient email provided" });
      }

      console.log(`[Server Email] Sending new DELIVERY order notification for Order #${orderId} to restaurant owner (${restaurantName}): ${email}`);

      const smtpHost = process.env.SMTP_HOST;
      const smtpPort = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 587;
      const smtpUser = process.env.SMTP_USER;
      const smtpPass = process.env.SMTP_PASS;
      const smtpFrom = process.env.SMTP_FROM || 'notificaciones@mesa22.com';

      if (smtpHost && smtpUser && smtpPass) {
        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port: smtpPort,
          secure: smtpPort === 465,
          auth: {
            user: smtpUser,
            pass: smtpPass,
          },
        });

        const info = await transporter.sendMail({
          from: `"Mesa 22 Restaurantes" <${smtpFrom}>`,
          to: email,
          subject: subject,
          text: text,
          html: html,
        });

        console.log(`[Server Email] Real SMTP email sent to restaurant owner (${info.messageId})`);
        return res.json({
          success: true,
          method: "smtp",
          recipient: email,
          messageId: info.messageId,
        });
      } else {
        // Simulated email fallback when SMTP is not configured
        console.log(`[Server Email] SMTP credentials not set. Simulated email sent to restaurant owner: ${email}`);
        return res.json({
          success: true,
          method: "simulated",
          recipient: email,
          note: `Notificación de nuevo pedido enviada con éxito a ${email} (Modo simulación / vista previa activa). Configura SMTP_HOST en .env para envío SMTP real.`,
        });
      }
    } catch (err: any) {
      console.error("[Server Restaurant Email Error]", err);
      return res.status(500).json({
        success: false,
        error: err.message || "Error al procesar el correo al restaurante",
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Mesa 22 Full-Stack Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
