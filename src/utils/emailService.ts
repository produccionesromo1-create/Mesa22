import { collection, getDocs, doc, getDoc, Firestore } from 'firebase/firestore';
import { Order, Driver, Restaurant } from '../types';

// In-memory set to prevent duplicate emails for the same order status transition
const sentOrderEmailIds = new Set<string>();

/**
 * Sends email notifications to all eligible delivery drivers when an order is available for pickup/delivery.
 */
export async function sendDriverNewOrderEmail(order: Order, db: Firestore): Promise<{
  success: boolean;
  recipients: string[];
  message: string;
}> {
  if (!order || !order.id) {
    return { success: false, recipients: [], message: 'Orden inválida' };
  }

  // Prevent sending duplicate emails for the same order id + status transition
  const emailKey = `${order.id}_${order.status}_${order.driverId || 'unassigned'}`;
  if (sentOrderEmailIds.has(emailKey)) {
    console.log(`[EmailService] Email notification already sent for key ${emailKey}`);
    return { success: true, recipients: [], message: 'Notificación por correo ya enviada previamente.' };
  }

  try {
    // 1. Determine target city from order or restaurant
    let targetCity = (order.city || '').trim();

    if (!targetCity && order.restaurantId) {
      try {
        const restRef = doc(db, 'restaurants', order.restaurantId);
        const restSnap = await getDoc(restRef);
        if (restSnap.exists()) {
          const restData = restSnap.data();
          targetCity = (restData.city || restData.workingZone || restData.deliveryZone || '').trim();
        }
      } catch (err) {
        console.warn('[EmailService] Error fetching restaurant city for driver email filtering:', err);
      }
    }

    // Helper to normalize strings for comparison (remove accents, trim, lowercase)
    const normalize = (str?: string) => 
      (str || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

    const targetCityNorm = normalize(targetCity);

    // 2. Fetch drivers from Firestore
    const driversRef = collection(db, 'drivers');
    const driverSnap = await getDocs(driversRef);
    const driversList: Driver[] = [];

    driverSnap.forEach((docSnap) => {
      driversList.push({ id: docSnap.id, ...docSnap.data() } as Driver);
    });

    if (driversList.length === 0) {
      console.warn('[EmailService] No registered drivers found in database.');
      return { success: false, recipients: [], message: 'No hay repartidores registrados en el sistema.' };
    }

    // 3. Filter drivers STRICTLY matching the same city as the restaurant
    const eligibleDrivers = driversList.filter((driver) => {
      // Must not be suspended
      if (driver.status === 'SUSPENDED') return false;
      if (!driver.email || !driver.email.includes('@')) return false;

      // If restaurant has no city defined, drivers without city or with 'todas' match
      if (!targetCityNorm) {
        return true;
      }

      const driverCityNorm = normalize(driver.city);
      const driverZoneNorm = normalize(driver.workingZone);

      // Check if driver belongs to the same city as the restaurant
      const isCityMatch = 
        driverCityNorm === targetCityNorm ||
        driverCityNorm === 'todas' ||
        driverCityNorm === 'todas las ciudades' ||
        (driverCityNorm.length > 0 && targetCityNorm.includes(driverCityNorm)) ||
        (targetCityNorm.length > 0 && driverCityNorm.includes(targetCityNorm)) ||
        (driverZoneNorm.length > 0 && driverZoneNorm.includes(targetCityNorm));

      return isCityMatch;
    });

    // STRICT: No fallback to all drivers if no match in same city!
    if (eligibleDrivers.length === 0) {
      console.warn(`[EmailService] No drivers found matching restaurant city "${targetCity}". No driver emails will be sent.`);
      return { 
        success: false, 
        recipients: [], 
        message: `No hay repartidores registrados en la ciudad "${targetCity || 'del restaurante'}".` 
      };
    }

    const recipientEmails = Array.from(new Set(eligibleDrivers.map(d => d.email.trim())));

    // 3. Format email text and HTML
    const orderShortId = order.id.slice(0, 5).toUpperCase();
    const restName = order.restaurantName || 'Restaurante Mesa 22';
    const cityText = order.city ? ` (${order.city})` : '';
    const address = (order as any).deliveryAddress || order.notes || 'Consultar domicilio en la app';
    const driverPay = order.driverPaymentRate ?? 10;
    const total = order.total ?? 0;

    const subject = `🚴 ¡Nuevo Pedido Disponible para Entrega en ${restName}${cityText}! (#${orderShortId})`;

    const itemsSummaryHtml = order.items && order.items.length > 0
      ? order.items.map(it => {
          const prodName = it.name || (it as any).product?.name || 'Producto';
          const variant = it.selectedVariant || (it as any).variant;
          return `<li style="margin-bottom: 6px;"><strong>${it.quantity}x</strong> ${prodName} ${variant ? `<em>(${variant})</em>` : ''}</li>`;
        }).join('')
      : '<li>Detalles del pedido en la app</li>';

    const appOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://mesa22.app';

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; color: #0f172a; }
          .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05); }
          .header { background: linear-gradient(135deg, #ea580c, #c2410c); padding: 28px 24px; text-align: center; color: #ffffff; }
          .header h1 { margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; }
          .header p { margin: 6px 0 0 0; opacity: 0.9; font-size: 14px; font-weight: 500; }
          .body-content { padding: 32px 28px; }
          .pill-badge { display: inline-block; background-color: #ffedd5; color: #c2410c; padding: 6px 16px; border-radius: 9999px; font-weight: 800; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 16px; }
          .info-card { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin: 20px 0; border-left: 5px solid #ea580c; }
          .info-row { display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 14px; }
          .info-label { color: #64748b; font-weight: 600; }
          .info-value { font-weight: 700; color: #0f172a; text-align: right; }
          .pay-box { background: linear-gradient(135deg, #f0fdf4, #dcfce7); border: 1px solid #bbf7d0; padding: 18px; border-radius: 12px; text-align: center; margin: 24px 0; }
          .pay-label { font-size: 12px; color: #166534; font-weight: 800; text-transform: uppercase; letter-spacing: 0.8px; }
          .pay-amount { font-size: 28px; font-weight: 900; color: #15803d; margin-top: 4px; }
          .action-btn { display: block; width: 100%; text-align: center; background-color: #ea580c; color: #ffffff !important; font-weight: 800; text-decoration: none; padding: 16px 24px; border-radius: 12px; font-size: 16px; box-sizing: border-box; transition: background-color 0.2s; }
          .footer { padding: 20px; text-align: center; font-size: 12px; color: #94a3b8; background-color: #f8fafc; border-top: 1px solid #f1f5f9; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Mesa 22 Repartos</h1>
            <p>Notificación de Nuevos Pedidos Disponibles</p>
          </div>
          <div class="body-content">
            <span class="pill-badge">🏍️ ¡Nuevo Pedido Disponible!</span>
            <h2 style="margin: 0 0 12px 0; font-size: 20px; color: #0f172a;">¡Hola Repartidor!</h2>
            <p style="font-size: 15px; color: #334155; line-height: 1.6; margin: 0 0 20px 0;">
              Hay un nuevo pedido listo para ser recogido y entregado a domicilio en tu zona.
            </p>
            
            <div class="info-card">
              <div class="info-row"><span class="info-label">Restaurante:</span> <span class="info-value">${restName}</span></div>
              <div class="info-row"><span class="info-label">Número de Pedido:</span> <span class="info-value">#${orderShortId}</span></div>
              <div class="info-row"><span class="info-label">Ciudad / Zona:</span> <span class="info-value">${order.city || 'Zona Local'}</span></div>
              <div class="info-row"><span class="info-label">Dirección de Entrega:</span> <span class="info-value">${address}</span></div>
              <div class="info-row"><span class="info-label">Monto del Pedido:</span> <span class="info-value">$${total.toFixed(2)} MXN</span></div>
            </div>

            <div class="pay-box">
              <div class="pay-label">Ganancia estimada para el Repartidor</div>
              <div class="pay-amount">$${driverPay.toFixed(2)} MXN</div>
            </div>

            <h3 style="font-size: 15px; color: #334155; margin-bottom: 10px;">Artículos a Entregar:</h3>
            <ul style="font-size: 14px; color: #475569; padding-left: 20px; margin-top: 0;">
              ${itemsSummaryHtml}
            </ul>

            <div style="margin-top: 32px;">
              <a href="${appOrigin}" class="action-btn">
                👉 Abrir Panel de Repartidor y Aceptar Pedido
              </a>
            </div>
          </div>
          <div class="footer">
            Recibes este correo porque estás registrado como Repartidor Activo en la plataforma Mesa 22.<br>
            © ${new Date().getFullYear()} Mesa 22. Todos los derechos reservados.
          </div>
        </div>
      </body>
      </html>
    `;

    const textContent = `¡Hola Repartidor! Nuevo pedido disponible #${orderShortId} en ${restName}. Dirección: ${address}. Ganancia: $${driverPay} MXN. Ingresa a la app en ${appOrigin} para tomar el pedido.`;

    // 4. Send email request to backend API
    const response = await fetch('/api/send-driver-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        emails: recipientEmails,
        subject,
        html: htmlContent,
        text: textContent,
        orderId: order.id
      })
    });

    const result = await response.json();

    if (result.success) {
      sentOrderEmailIds.add(emailKey);
      console.log(`[EmailService] Notification successfully sent to ${recipientEmails.length} drivers:`, recipientEmails);
      return {
        success: true,
        recipients: recipientEmails,
        message: `📧 Notificación por correo enviada con éxito a ${recipientEmails.length} repartidor(es).`
      };
    } else {
      console.error('[EmailService] Backend error:', result);
      return {
        success: false,
        recipients: recipientEmails,
        message: result.error || 'Error en la entrega del correo'
      };
    }

  } catch (err: any) {
    console.error('[EmailService Exception]', err);
    return {
      success: false,
      recipients: [],
      message: err.message || 'Error al procesar el correo de repartidores'
    };
  }
}

/**
 * Sends an email notification to the restaurant owner ONLY when a new home delivery order (DELIVERY) is placed.
 */
export async function sendRestaurantNewOrderEmail(order: Order, db: Firestore): Promise<{
  success: boolean;
  recipient?: string;
  message: string;
}> {
  if (!order || !order.id) {
    return { success: false, message: 'Orden inválida' };
  }

  // STRICT REQUIREMENT: Only send email for home delivery orders (DELIVERY). Do NOT send for PICKUP, DINE_IN, EAT_IN, etc.
  if (order.deliveryType !== 'DELIVERY') {
    console.log(`[EmailService] Skipping restaurant email: order #${order.id} deliveryType is "${order.deliveryType}" (only DELIVERY receives emails).`);
    return { success: true, message: 'Solo los pedidos a domicilio (DELIVERY) generan notificaciones por correo al restaurante.' };
  }

  // Prevent sending duplicate emails for the same order
  const emailKey = `rest_${order.id}`;
  if (sentOrderEmailIds.has(emailKey)) {
    console.log(`[EmailService] Restaurant email notification already sent for key ${emailKey}`);
    return { success: true, message: 'Notificación de nuevo pedido ya enviada previamente al restaurante.' };
  }

  try {
    // 1. Fetch restaurant details from Firestore
    let restEmail = '';
    let restName = order.restaurantName || 'Restaurante';

    if (order.restaurantId) {
      try {
        const restRef = doc(db, 'restaurants', order.restaurantId);
        const restSnap = await getDoc(restRef);
        if (restSnap.exists()) {
          const restData = restSnap.data();
          restEmail = restData.email || restData.ownerEmail || '';
          if (restData.name) restName = restData.name;
        }
      } catch (err) {
        console.warn('[EmailService] Error fetching restaurant doc:', err);
      }
    }

    // Fallback if restaurant email is attached to order
    if (!restEmail && (order as any).restaurantEmail) {
      restEmail = (order as any).restaurantEmail;
    }

    if (!restEmail || !restEmail.includes('@')) {
      console.warn(`[EmailService] No valid email found for restaurant ${order.restaurantId}`);
      return { success: false, message: `El restaurante ${restName} no tiene un correo electrónico registrado válido.` };
    }

    // 2. Format email text and HTML
    const orderShortId = order.id.slice(0, 5).toUpperCase();
    const custName = order.customerName || 'Cliente';
    const custPhone = order.customerPhone || 'No proporcionado';
    const address = (order as any).deliveryAddress || order.notes || 'Consultar domicilio en la app';
    const total = order.total ?? 0;

    const subject = `🛍️ ¡Nuevo Pedido a Domicilio Recibido! (#${orderShortId}) - ${restName}`;

    const itemsSummaryHtml = order.items && order.items.length > 0
      ? order.items.map(it => {
          const prodName = it.name || (it as any).product?.name || 'Producto';
          const variant = it.selectedVariant || (it as any).variant;
          const notes = it.notes ? `<div style="font-size: 12px; color: #64748b; margin-top: 2px;">Nota: ${it.notes}</div>` : '';
          const itemTotal = (it.price * it.quantity).toFixed(2);
          return `
            <li style="margin-bottom: 10px; border-bottom: 1px dashed #e2e8f0; padding-bottom: 8px;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="color: #0f172a; font-size: 14px;"><strong>${it.quantity}x</strong> ${prodName} ${variant ? `<em>(${variant})</em>` : ''}</span>
                <span style="font-weight: 700; color: #0f172a; font-size: 14px;">$${itemTotal} MXN</span>
              </div>
              ${notes}
            </li>
          `;
        }).join('')
      : '<li>Detalles de artículos en el panel de control</li>';

    const appOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://mesa22.app';

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; color: #0f172a; }
          .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05); }
          .header { background: linear-gradient(135deg, #2563eb, #1d4ed8); padding: 28px 24px; text-align: center; color: #ffffff; }
          .header h1 { margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; }
          .header p { margin: 6px 0 0 0; opacity: 0.9; font-size: 14px; font-weight: 500; }
          .body-content { padding: 32px 28px; }
          .pill-badge { display: inline-block; background-color: #dbeafe; color: #1e40af; padding: 6px 16px; border-radius: 9999px; font-weight: 800; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 16px; }
          .info-card { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin: 20px 0; border-left: 5px solid #2563eb; }
          .info-row { display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 14px; }
          .info-label { color: #64748b; font-weight: 600; }
          .info-value { font-weight: 700; color: #0f172a; text-align: right; }
          .action-btn { display: block; width: 100%; text-align: center; background-color: #2563eb; color: #ffffff !important; font-weight: 800; text-decoration: none; padding: 16px 24px; border-radius: 12px; font-size: 16px; box-sizing: border-box; }
          .footer { padding: 20px; text-align: center; font-size: 12px; color: #94a3b8; background-color: #f8fafc; border-top: 1px solid #f1f5f9; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Mesa 22 Restaurantes</h1>
            <p>Notificación de Nuevo Pedido a Domicilio</p>
          </div>
          <div class="body-content">
            <span class="pill-badge">🛵 Nuevo Pedido a Domicilio</span>
            <h2 style="margin: 0 0 12px 0; font-size: 20px; color: #0f172a;">¡Hola, ${restName}!</h2>
            <p style="font-size: 15px; color: #334155; line-height: 1.6; margin: 0 0 20px 0;">
              Has recibido un nuevo pedido a domicilio a través de Mesa 22.
            </p>
            
            <div class="info-card">
              <div class="info-row"><span class="info-label">Número de Pedido:</span> <span class="info-value">#${orderShortId}</span></div>
              <div class="info-row"><span class="info-label">Cliente:</span> <span class="info-value">${custName}</span></div>
              <div class="info-row"><span class="info-label">Teléfono:</span> <span class="info-value">${custPhone}</span></div>
              <div class="info-row"><span class="info-label">Dirección de Entrega:</span> <span class="info-value">${address}</span></div>
              <div class="info-row"><span class="info-label">Método de Pago:</span> <span class="info-value">${order.paymentMethod === 'CASH_ON_DELIVERY' ? 'Efectivo contra entrega' : 'Pago en línea / tarjeta'}</span></div>
            </div>

            <h3 style="font-size: 16px; color: #0f172a; margin-bottom: 12px;">Detalle de los Productos:</h3>
            <ul style="font-size: 14px; color: #334155; padding-left: 0; list-style: none; margin-top: 0;">
              ${itemsSummaryHtml}
            </ul>

            <div style="background-color: #f1f5f9; padding: 16px; border-radius: 12px; margin-top: 20px;">
              <div style="display: flex; justify-content: space-between; font-weight: 800; font-size: 18px; color: #0f172a;">
                <span>Total a cobrar:</span>
                <span>$${total.toFixed(2)} MXN</span>
              </div>
            </div>

            ${order.notes ? `
              <div style="margin-top: 20px; padding: 14px; background-color: #fefce8; border: 1px solid #fef08a; border-radius: 10px; font-size: 14px; color: #854d0e;">
                <strong>Instrucciones del cliente:</strong> ${order.notes}
              </div>
            ` : ''}

            <div style="margin-top: 32px;">
              <a href="${appOrigin}" class="action-btn">
                👉 Abrir Panel del Restaurante y Gestionar Pedido
              </a>
            </div>
          </div>
          <div class="footer">
            Recibes este correo porque eres el propietario registrado de <strong>${restName}</strong> en Mesa 22.<br>
            © ${new Date().getFullYear()} Mesa 22. Todos los derechos reservados.
          </div>
        </div>
      </body>
      </html>
    `;

    const textContent = `¡Hola ${restName}! Has recibido un nuevo pedido a domicilio #${orderShortId} de ${custName}. Dirección: ${address}. Teléfono: ${custPhone}. Total: $${total} MXN. Accede a tu panel en ${appOrigin} para procesarlo.`;

    // 3. Send email request to backend API
    const response = await fetch('/api/send-restaurant-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: restEmail.trim(),
        subject,
        html: htmlContent,
        text: textContent,
        orderId: order.id,
        restaurantName: restName
      })
    });

    const result = await response.json();

    if (result.success) {
      sentOrderEmailIds.add(emailKey);
      console.log(`[EmailService] Restaurant notification successfully sent to ${restEmail} for order #${order.id}`);
      return {
        success: true,
        recipient: restEmail,
        message: `📧 Notificación de nuevo pedido enviada al restaurante (${restEmail}).`
      };
    } else {
      console.error('[EmailService] Backend error sending restaurant email:', result);
      return {
        success: false,
        recipient: restEmail,
        message: result.error || 'Error en el envío del correo al restaurante.'
      };
    }

  } catch (err: any) {
    console.error('[EmailService Exception - Restaurant Email]', err);
    return {
      success: false,
      message: err.message || 'Error al procesar el correo del restaurante'
    };
  }
}
