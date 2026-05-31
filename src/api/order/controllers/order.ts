/**
 * order controller
 */

import { factories } from '@strapi/strapi'

type OrderItem = {
  qty?: number | null;
  lineTotal?: number | null;
  unitPrice?: number | null;
  orderItemName?: string | null;
  variantNameSnapshot?: string | null;
  productNameSnapshot?: string | null;
};

type OrderRecord = {
  documentId?: string;
  orderNumber?: string | null;
  commerceOrder?: string | null;
  statusOrder?: string | null;
  paidAt?: string | null;
  saleEmailSentAt?: string | null;
  total?: number | null;
  subtotal?: number | null;
  shippingCost?: number | null;
  customerName?: string | null;
  phone?: string | null;
  region?: string | null;
  comuna?: string | null;
  calle?: string | null;
  numero?: string | null;
  depto?: string | null;
  nota?: string | null;
  order_items?: OrderItem[];
};

function formatClp(value: number | null | undefined) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function getItemName(item: OrderItem) {
  return (
    item.variantNameSnapshot ||
    item.productNameSnapshot ||
    item.orderItemName ||
    "Articulo"
  );
}

function buildSaleEmail(order: OrderRecord) {
  const orderId = order.orderNumber || order.commerceOrder || order.documentId || "Sin ID";
  const paidAt = order.paidAt
    ? new Date(order.paidAt).toLocaleString("es-CL")
    : new Date().toLocaleString("es-CL");
  const address = [
    order.calle,
    order.numero,
    order.depto ? `Depto ${order.depto}` : null,
    order.comuna,
    order.region,
  ]
    .filter(Boolean)
    .join(", ");

  const itemLines = (order.order_items || []).map((item) => {
    const qty = Number(item.qty || 1);
    const lineTotal = Number(item.lineTotal || Number(item.unitPrice || 0) * qty);
    return `- ${getItemName(item)} x${qty}: ${formatClp(lineTotal)}`;
  });

  const text = [
    "Nueva venta confirmada en Eden.",
    "",
    `Pedido: ${orderId}`,
    `Fecha pago: ${paidAt}`,
    `Cliente: ${order.customerName || "Sin nombre"}`,
    `Telefono: ${order.phone || "Sin telefono"}`,
    `Direccion: ${address || "Sin direccion"}`,
    "",
    "Articulos:",
    itemLines.length ? itemLines.join("\n") : "- Sin articulos registrados",
    "",
    `Subtotal: ${formatClp(order.subtotal)}`,
    `Envio: ${formatClp(order.shippingCost)}`,
    `Total pagado: ${formatClp(order.total)}`,
    order.nota ? `Nota: ${order.nota}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const htmlItems = itemLines.length
    ? itemLines.map((line) => `<li>${line.replace(/^- /, "")}</li>`).join("")
    : "<li>Sin articulos registrados</li>";

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111">
      <h2>Nueva venta confirmada en Eden</h2>
      <p><strong>Pedido:</strong> ${orderId}</p>
      <p><strong>Fecha pago:</strong> ${paidAt}</p>
      <p><strong>Cliente:</strong> ${order.customerName || "Sin nombre"}</p>
      <p><strong>Telefono:</strong> ${order.phone || "Sin telefono"}</p>
      <p><strong>Direccion:</strong> ${address || "Sin direccion"}</p>
      <h3>Articulos</h3>
      <ul>${htmlItems}</ul>
      <p><strong>Subtotal:</strong> ${formatClp(order.subtotal)}</p>
      <p><strong>Envio:</strong> ${formatClp(order.shippingCost)}</p>
      <p><strong>Total pagado:</strong> ${formatClp(order.total)}</p>
      ${order.nota ? `<p><strong>Nota:</strong> ${order.nota}</p>` : ""}
    </div>
  `;

  return { subject: `Nueva venta Eden - ${orderId}`, text, html };
}

export default factories.createCoreController('api::order.order', ({ strapi }) => ({
  async sendSaleEmail(ctx) {
    const documentId = String(ctx.params?.documentId || "");

    if (!documentId) {
      return ctx.badRequest("Falta documentId");
    }

    const order = await strapi.db.query("api::order.order").findOne({
      where: { documentId },
      populate: {
        order_items: true,
      },
    }) as OrderRecord | null;

    if (!order) {
      return ctx.notFound("Orden no encontrada");
    }

    if (order.statusOrder !== "PAID") {
      return ctx.badRequest("La orden aun no esta pagada");
    }

    if (order.saleEmailSentAt) {
      ctx.body = { ok: true, skipped: true, reason: "Correo ya enviado" };
      return;
    }

    const to =
      strapi.config.get<string>("server.saleNotificationEmail") ||
      process.env.SALE_NOTIFICATION_EMAIL ||
      "eden.estudio1@gmail.com";
    const email = buildSaleEmail(order);

    await strapi.plugin("email").service("email").send({
      to,
      subject: email.subject,
      text: email.text,
      html: email.html,
    });

    const sentAt = new Date().toISOString();

    await strapi.db.query("api::order.order").update({
      where: { documentId },
      data: { saleEmailSentAt: sentAt },
    });

    ctx.body = { ok: true, sentAt };
  },
}));
