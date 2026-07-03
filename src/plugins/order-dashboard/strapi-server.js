'use strict';

const compactOrder = (order) => ({
  id: order.id,
  documentId: order.documentId,
  orderName: order.orderName,
  orderNumber: order.orderNumber,
  commerceOrder: order.commerceOrder,
  statusOrder: order.statusOrder,
  subtotal: order.subtotal,
  shippingCost: order.shippingCost,
  total: order.total,
  paidAt: order.paidAt,
  createdAt: order.createdAt,
  updatedAt: order.updatedAt,
  fulfillmentStatus: order.fulfillmentStatus || 'PENDING_SHIPPING',
  trackingNumber: order.trackingNumber,
  deliveredAt: order.deliveredAt,
  completedAt: order.completedAt,
  paymentProvider: order.paymentProvider,
  customer: {
    name: order.customerName,
    rut: [order.rutBody, order.rutDv].filter(Boolean).join('-'),
    phone: order.phone,
    region: order.region,
    comuna: order.comuna,
    calle: order.calle,
    numero: order.numero,
    depto: order.depto,
    nota: order.nota,
    account: order.customer,
  },
  items: order.order_items || [],
  imprimes: order.order_imprimes || [],
});

const compactWarehouseCategory = (category) => ({
  id: category.id,
  documentId: category.documentId,
  name: category.categoryName || 'Sin nombre',
  slug: category.slug,
});

const compactMediaUrl = (media) => {
  if (!media) {
    return null;
  }

  const file = Array.isArray(media) ? media[0] : media;

  return file?.formats?.thumbnail?.url || file?.url || null;
};

const toInteger = (value) => {
  const numberValue = Number(value);

  return Number.isFinite(numberValue) ? Math.round(numberValue) : 0;
};

const toDecimal = (value) => {
  const numberValue = Number(value);

  return Number.isFinite(numberValue) ? numberValue : 0;
};

const FLOW_FEE_RATE = 0.0319;

const getFlowCost = (price) => toInteger(Number(price || 0) * FLOW_FEE_RATE);

const compactBodega = (bodega) =>
  bodega
    ? {
        id: bodega.id,
        documentId: bodega.documentId,
        materialGrams: Number(bodega.materialGrams || 0),
        printTimeHours: Number(bodega.printTimeHours || 0),
        printTimeLabel: bodega.printTimeLabel || '',
        materialCost: Number(bodega.materialCost || 0),
        lightCost: Number(bodega.lightCost || 0),
        boxCost: Number(bodega.boxCost || 0),
        paintCost: Number(bodega.paintCost || 0),
        flowCost: Number(bodega.flowCost || 0),
        totalCost: Number(bodega.totalCost || 0),
        price: Number(bodega.price || 0),
        returnAmount: Number(bodega.returnAmount || 0),
      }
    : null;

const compactWarehouseVariant = (variant, bodega = null) => {
  const product = variant.product || {};
  const category = product.category || null;

  return {
    id: variant.id,
    documentId: variant.documentId,
    name: variant.variantName || product.productName || 'Sin nombre',
    price: Number(variant.price || 0),
    stock: variant.stock,
    sku: variant.sku,
    imageUrl: compactMediaUrl(variant.image) || compactMediaUrl(product.images),
    bodega: compactBodega(bodega),
    product: {
      id: product.id,
      documentId: product.documentId,
      name: product.productName,
      imageUrl: compactMediaUrl(product.images),
    },
    category: category
      ? {
          id: category.id,
          documentId: category.documentId,
          name: category.categoryName || 'Sin nombre',
          slug: category.slug,
        }
      : null,
  };
};

const compactMailboxClient = (user) => ({
  id: user.id,
  documentId: user.documentId,
  email: user.email,
  name: user.nombre || user.username || '',
  isSubscribed: Boolean(user.notifyEmail),
});

const buildBodegaData = ({ payload, variant }) => {
  const product = variant.product || {};
  const category = product.category || null;
  const price = toInteger(payload.price ?? variant.price);
  const materialCost = toInteger(payload.materialCost);
  const lightCost = toInteger(payload.lightCost);
  const boxCost = toInteger(payload.boxCost);
  const paintCost = toInteger(payload.paintCost);
  const flowCost = getFlowCost(price);
  const totalCost = materialCost + lightCost + boxCost + paintCost + flowCost;
  const imageUrl = compactMediaUrl(variant.image) || compactMediaUrl(product.images);

  return {
    bodegaName: variant.variantName || product.productName || 'Sin nombre',
    variantDocumentId: variant.documentId,
    productDocumentId: product.documentId,
    categoryDocumentId: category?.documentId,
    variantNameSnapshot: variant.variantName || 'Sin nombre',
    productNameSnapshot: product.productName || '',
    categoryNameSnapshot: category?.categoryName || '',
    imageUrlSnapshot: imageUrl,
    materialGrams: toDecimal(payload.materialGrams),
    printTimeHours: toDecimal(payload.printTimeHours),
    printTimeLabel: String(payload.printTimeLabel || ''),
    materialCost,
    lightCost,
    boxCost,
    paintCost,
    flowCost,
    totalCost,
    price,
    returnAmount: price - totalCost,
    variant: variant.id,
    product: product.id,
    category: category?.id,
  };
};

const getMonthBounds = (year, month) => {
  const safeYear = Number(year) || new Date().getFullYear();
  const safeMonth = Math.min(Math.max(Number(month) || new Date().getMonth() + 1, 1), 12);
  const start = new Date(Date.UTC(safeYear, safeMonth - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(safeYear, safeMonth, 1, 0, 0, 0, 0));

  return { start, end, year: safeYear, month: safeMonth };
};

const getPreviousMonth = (year, month) => {
  if (month === 1) {
    return { year: year - 1, month: 12 };
  }

  return { year, month: month - 1 };
};

const DEFAULT_MONTHLY_GOAL = 645000;

const findMonthlyGoal = async (year, month) =>
  strapi.db.query('api::monthly-goal.monthly-goal').findOne({
    where: {
      year,
      month,
    },
  });

const getOrderDate = (order) => new Date(order.paidAt || order.createdAt || order.updatedAt || 0);

const getOrderLabel = (order) => order.orderNumber || order.commerceOrder || order.orderName || 'Sin numero';

const formatDateKey = (date) => date.toISOString().slice(0, 10);

const getItemName = (item) =>
  item.variantNameSnapshot || item.productNameSnapshot || item.variant?.variantName || item.orderItemName || 'Producto sin nombre';

const getItemVariantDocumentId = (item) => item.variant?.documentId || null;

const buildMonthMetrics = (orders, bodegaRows, period = null) => {
  const bodegaByVariantDocumentId = new Map(bodegaRows.map((bodega) => [bodega.variantDocumentId, bodega]));
  const productsByName = new Map();
  const clientsByEmail = new Map();
  const datesByKey = new Map();
  let revenue = 0;
  let expenses = 0;
  let soldProducts = 0;

  for (const order of orders) {
    const orderTotal = Number(order.total || 0);
    const orderDate = getOrderDate(order);
    const dateKey = formatDateKey(orderDate);
    const customerEmail = order.customer?.email || order.customerName || 'Cliente sin correo';
    const currentClient = clientsByEmail.get(customerEmail) || {
      email: customerEmail,
      customerName: order.customerName || order.customer?.username || '',
      products: 0,
      totalPaid: 0,
      orders: 0,
      orderSummaries: [],
    };
    const currentDate = datesByKey.get(dateKey) || {
      date: dateKey,
      products: 0,
      revenue: 0,
      orders: 0,
    };

    revenue += orderTotal;
    currentClient.totalPaid += orderTotal;
    currentClient.orders += 1;
    currentClient.orderSummaries.push({
      orderNumber: getOrderLabel(order),
      date: formatDateKey(orderDate),
      total: orderTotal,
      products: [],
    });
    currentDate.revenue += orderTotal;
    currentDate.orders += 1;

    for (const item of order.order_items || []) {
      const qty = Number(item.qty || 0);
      const name = getItemName(item);
      const lineTotal = Number(item.lineTotal || item.unitPrice * qty || 0);
      const variantDocumentId = getItemVariantDocumentId(item);
      const bodega = variantDocumentId ? bodegaByVariantDocumentId.get(variantDocumentId) : null;
      const unitCost = Number(bodega?.totalCost || 0);
      const currentProduct = productsByName.get(name) || {
        name,
        quantity: 0,
        revenue: 0,
        expenses: 0,
      };

      soldProducts += qty;
      expenses += unitCost * qty;
      currentClient.products += qty;
      currentClient.orderSummaries[currentClient.orderSummaries.length - 1].products.push({
        name,
        qty,
        total: lineTotal,
      });
      currentDate.products += qty;
      currentProduct.quantity += qty;
      currentProduct.revenue += lineTotal;
      currentProduct.expenses += unitCost * qty;
      productsByName.set(name, currentProduct);
    }

    clientsByEmail.set(customerEmail, currentClient);
    datesByKey.set(dateKey, currentDate);
  }

  const topProducts = Array.from(productsByName.values())
    .sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue)
    .slice(0, 5);
  const topClients = Array.from(clientsByEmail.values())
    .sort((a, b) => b.totalPaid - a.totalPaid || b.products - a.products)
    .slice(0, 7);
  const importantDates = Array.from(datesByKey.values())
    .sort((a, b) => b.products - a.products || b.revenue - a.revenue)
    .slice(0, 5);
  const dailyRevenue = period
    ? Array.from({ length: new Date(Date.UTC(period.year, period.month, 0)).getUTCDate() }, (_, index) => {
        const date = new Date(Date.UTC(period.year, period.month - 1, index + 1));
        const key = formatDateKey(date);

        return (
          datesByKey.get(key) || {
            date: key,
            products: 0,
            revenue: 0,
            orders: 0,
          }
        );
      })
    : Array.from(datesByKey.values()).sort((a, b) => a.date.localeCompare(b.date));

  return {
    revenue,
    expenses,
    profit: revenue - expenses,
    orders: orders.length,
    soldProducts,
    newClients: clientsByEmail.size,
    topProducts,
    topClients,
    importantDates,
    dailyRevenue,
  };
};

const getOrderTimestamp = (order) => new Date(order.updatedAt || order.paidAt || order.createdAt || 0).getTime();

const pickCurrentOrderVersion = (current, next) => {
  if (!current) {
    return next;
  }

  if (next.publishedAt && !current.publishedAt) {
    return next;
  }

  if (!next.publishedAt && current.publishedAt) {
    return current;
  }

  return getOrderTimestamp(next) > getOrderTimestamp(current) ? next : current;
};

const uniqueOrdersByDocumentId = (orders) => {
  const ordersByDocumentId = new Map();

  for (const order of orders) {
    const key = order.documentId || String(order.id);
    ordersByDocumentId.set(key, pickCurrentOrderVersion(ordersByDocumentId.get(key), order));
  }

  return Array.from(ordersByDocumentId.values()).sort((a, b) => {
    const paidAtDiff = new Date(b.paidAt || 0).getTime() - new Date(a.paidAt || 0).getTime();

    if (paidAtDiff !== 0) {
      return paidAtDiff;
    }

    return getOrderTimestamp(b) - getOrderTimestamp(a);
  });
};

const findOrderVersions = async (id) =>
  strapi.db.query('api::order.order').findMany({
    where: {
      $or: [{ documentId: String(id) }, { id: Number(id) || -1 }],
    },
    limit: 20,
    populate: {
      customer: true,
      order_items: {
        populate: {
          variant: true,
          order_imprime: true,
        },
      },
      order_imprimes: true,
    },
  });

const updateOrderVersions = async (id, data) => {
  const versions = await findOrderVersions(id);

  if (versions.length === 0) {
    return null;
  }

  await Promise.all(
    versions.map((order) =>
      strapi.db.query('api::order.order').update({
        where: { id: order.id },
        data,
      })
    )
  );

  const updatedVersions = await findOrderVersions(id);
  const currentOrder = uniqueOrdersByDocumentId(updatedVersions)[0];

  return currentOrder ? compactOrder(currentOrder) : null;
};

const sendMailboxCampaign = async ({ html, recipients, subject }) => {
  for (const recipient of recipients) {
    await strapi.plugin('email').service('email').send({
      to: recipient.email,
      subject,
      html,
    });
  }
};

const getCampaignDateParts = ({ scheduledAt, scheduledDateValue, scheduledTime }) => {
  if (scheduledDateValue) {
    const [year, month, day] = String(scheduledDateValue).split('-').map((value) => Number(value));

    return {
      scheduledDay: day || scheduledAt.getDate(),
      scheduledMonth: month || scheduledAt.getMonth() + 1,
      scheduledYear: year || scheduledAt.getFullYear(),
      scheduledTime: scheduledTime || `${String(scheduledAt.getHours()).padStart(2, '0')}:${String(scheduledAt.getMinutes()).padStart(2, '0')}`,
    };
  }

  return {
    scheduledDay: scheduledAt.getDate(),
    scheduledMonth: scheduledAt.getMonth() + 1,
    scheduledYear: scheduledAt.getFullYear(),
    scheduledTime: scheduledTime || `${String(scheduledAt.getHours()).padStart(2, '0')}:${String(scheduledAt.getMinutes()).padStart(2, '0')}`,
  };
};

const createMailboxCampaignHistory = async ({
  audienceTab,
  fileName,
  recipientIds,
  recipients,
  scheduledAt,
  scheduledDateValue,
  scheduledTime,
  selectionMode,
  status,
  subject,
}) => {
  const dateParts = getCampaignDateParts({ scheduledAt, scheduledDateValue, scheduledTime });

  return strapi.db.query('api::mailbox-campaign.mailbox-campaign').create({
    data: {
      campaignName: subject,
      subject,
      scheduledAt,
      ...dateParts,
      audienceTab,
      selectionMode,
      recipientCount: recipients.length,
      recipientIds,
      recipientEmails: recipients.map((recipient) => recipient.email),
      fileName,
      status,
      sentAt: status === 'sent' ? new Date() : null,
    },
  });
};

module.exports = () => ({
  controllers: {
    orders: {
      async findPaid(ctx) {
        const page = Math.max(Number(ctx.query?.page || 1), 1);
        const pageSize = Math.min(Math.max(Number(ctx.query?.pageSize || 25), 1), 100);
        const where = { statusOrder: 'PAID' };

        const orders = await strapi.db.query('api::order.order').findMany({
          where,
          limit: 500,
          orderBy: [{ paidAt: 'desc' }, { createdAt: 'desc' }],
          populate: {
            customer: true,
            order_items: {
              populate: {
                variant: true,
                order_imprime: true,
              },
            },
            order_imprimes: true,
          },
        });
        const uniqueOrders = uniqueOrdersByDocumentId(orders);
        const total = uniqueOrders.length;
        const start = (page - 1) * pageSize;
        const paginatedOrders = uniqueOrders.slice(start, start + pageSize);

        ctx.body = {
          data: paginatedOrders.map(compactOrder),
          meta: {
            pagination: {
              page,
              pageSize,
              pageCount: Math.ceil(total / pageSize),
              total,
            },
          },
        };
      },
      async completeShipping(ctx) {
        const id = ctx.params?.id;
        const trackingNumber = String(ctx.request.body?.trackingNumber || '').trim();

        if (!trackingNumber) {
          return ctx.badRequest('Debes ingresar un numero de seguimiento.');
        }

        const updatedOrder = await updateOrderVersions(id, {
          trackingNumber,
          fulfillmentStatus: 'DELIVERED',
          deliveredAt: new Date(),
        });

        if (!updatedOrder) {
          return ctx.notFound('No se encontro el pedido.');
        }

        ctx.body = { data: updatedOrder };
      },
      async markCompleted(ctx) {
        const id = ctx.params?.id;
        const completed = Boolean(ctx.request.body?.completed);

        const updatedOrder = await updateOrderVersions(id, {
          fulfillmentStatus: completed ? 'COMPLETED' : 'DELIVERED',
          completedAt: completed ? new Date() : null,
        });

        if (!updatedOrder) {
          return ctx.notFound('No se encontro el pedido.');
        }

        ctx.body = { data: updatedOrder };
      },
    },
    warehouse: {
      async findInventory(ctx) {
        const categories = await strapi.db.query('api::category.category').findMany({
          limit: 200,
          orderBy: [{ categoryName: 'asc' }],
        });

        const variants = await strapi.db.query('api::variant.variant').findMany({
          limit: 500,
          orderBy: [{ variantName: 'asc' }],
          populate: {
            image: true,
            product: {
              populate: {
                category: true,
                images: true,
              },
            },
          },
        });
        const bodegaRows = await strapi.db.query('api::bodega.bodega').findMany({
          limit: 1000,
        });
        const bodegaByVariantDocumentId = new Map(
          bodegaRows.map((bodega) => [bodega.variantDocumentId, bodega])
        );

        ctx.body = {
          data: {
            categories: categories.map(compactWarehouseCategory),
            variants: variants.map((variant) =>
              compactWarehouseVariant(variant, bodegaByVariantDocumentId.get(variant.documentId))
            ),
          },
        };
      },
      async saveInventoryRow(ctx) {
        const variantDocumentId = String(ctx.params?.variantDocumentId || '').trim();

        if (!variantDocumentId) {
          return ctx.badRequest('No se encontro la variante.');
        }

        const variant = await strapi.db.query('api::variant.variant').findOne({
          where: { documentId: variantDocumentId },
          populate: {
            image: true,
            product: {
              populate: {
                category: true,
                images: true,
              },
            },
          },
        });

        if (!variant) {
          return ctx.notFound('No se encontro la variante.');
        }

        const data = buildBodegaData({
          payload: ctx.request.body || {},
          variant,
        });
        const existingBodega = await strapi.db.query('api::bodega.bodega').findOne({
          where: { variantDocumentId },
        });
        const savedBodega = existingBodega
          ? await strapi.db.query('api::bodega.bodega').update({
              where: { id: existingBodega.id },
              data,
            })
          : await strapi.db.query('api::bodega.bodega').create({
              data,
            });

        ctx.body = {
          data: compactWarehouseVariant(variant, savedBodega),
        };
      },
    },
    mailbox: {
      async findRecipients(ctx) {
        const users = await strapi.db.query('plugin::users-permissions.user').findMany({
          where: {
            blocked: { $ne: true },
          },
          limit: 1000,
          orderBy: [{ createdAt: 'desc' }],
        });

        ctx.body = {
          data: users.filter((user) => user.email).map(compactMailboxClient),
        };
      },
      async sendCampaign(ctx) {
        const body = ctx.request.body || {};
        const html = String(body.html || '').trim();
        const subject = String(body.subject || 'Promocion Eden').trim();
        const scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : null;
        const scheduledDateValue = String(body.scheduledDateValue || '').trim();
        const scheduledTime = String(body.scheduledTime || '').trim();
        const audienceTab = ['clients', 'subscribed'].includes(body.audienceTab) ? body.audienceTab : 'clients';
        const selectionMode = String(body.selectionMode || 'Seleccionados').trim();
        const fileName = String(body.fileName || '').trim();
        const recipientIds = Array.isArray(body.recipientIds)
          ? body.recipientIds.map((id) => Number(id)).filter(Boolean)
          : [];

        if (!html) {
          return ctx.badRequest('Debes seleccionar un archivo HTML para enviar.');
        }

        if (recipientIds.length === 0) {
          return ctx.badRequest('Debes seleccionar al menos un cliente.');
        }

        if (!scheduledAt || Number.isNaN(scheduledAt.getTime())) {
          return ctx.badRequest('Debes seleccionar una fecha y hora valida.');
        }

        const users = await strapi.db.query('plugin::users-permissions.user').findMany({
          where: {
            id: { $in: recipientIds },
            blocked: { $ne: true },
          },
          limit: 1000,
        });
        const recipients = users.filter((user) => user.email);

        if (recipients.length === 0) {
          return ctx.badRequest('No hay correos validos para enviar.');
        }

        if (scheduledAt && scheduledAt.getTime() > Date.now()) {
          const delay = Math.min(scheduledAt.getTime() - Date.now(), 2147483647);
          const campaignHistory = await createMailboxCampaignHistory({
            audienceTab,
            fileName,
            recipientIds,
            recipients,
            scheduledAt,
            scheduledDateValue,
            scheduledTime,
            selectionMode,
            status: 'scheduled',
            subject,
          });

          setTimeout(() => {
            sendMailboxCampaign({ html, recipients, subject })
              .then(() =>
                strapi.db.query('api::mailbox-campaign.mailbox-campaign').update({
                  where: { id: campaignHistory.id },
                  data: {
                    status: 'sent',
                    sentAt: new Date(),
                  },
                })
              )
              .catch((error) => {
                strapi.log.error('No se pudo enviar campana programada desde buzon.', error);
                return strapi.db.query('api::mailbox-campaign.mailbox-campaign').update({
                  where: { id: campaignHistory.id },
                  data: {
                    status: 'failed',
                    errorMessage: error instanceof Error ? error.message : String(error),
                  },
                });
              });
          }, delay);

          ctx.body = {
            data: {
              id: campaignHistory.id,
              documentId: campaignHistory.documentId,
              scheduled: true,
              scheduledAt: scheduledAt.toISOString(),
              total: recipients.length,
            },
          };
          return;
        }

        await sendMailboxCampaign({ html, recipients, subject });
        const campaignHistory = await createMailboxCampaignHistory({
          audienceTab,
          fileName,
          recipientIds,
          recipients,
          scheduledAt,
          scheduledDateValue,
          scheduledTime,
          selectionMode,
          status: 'sent',
          subject,
        });

        ctx.body = {
          data: {
            id: campaignHistory.id,
            documentId: campaignHistory.documentId,
            scheduled: false,
            total: recipients.length,
          },
        };
      },
    },
    metrics: {
      async findSummary(ctx) {
        const requestedMonth = getMonthBounds(ctx.query?.year, ctx.query?.month);
        const previousMonth = getPreviousMonth(requestedMonth.year, requestedMonth.month);
        const previousBounds = getMonthBounds(previousMonth.year, previousMonth.month);
        const orders = await strapi.db.query('api::order.order').findMany({
          where: {
            statusOrder: 'PAID',
            paidAt: {
              $gte: requestedMonth.start.toISOString().slice(0, 10),
              $lt: requestedMonth.end.toISOString().slice(0, 10),
            },
          },
          limit: 1000,
          orderBy: [{ paidAt: 'asc' }, { createdAt: 'asc' }],
          populate: {
            customer: true,
            order_items: {
              populate: {
                variant: true,
              },
            },
          },
        });
        const previousOrders = await strapi.db.query('api::order.order').findMany({
          where: {
            statusOrder: 'PAID',
            paidAt: {
              $gte: previousBounds.start.toISOString().slice(0, 10),
              $lt: previousBounds.end.toISOString().slice(0, 10),
            },
          },
          limit: 1000,
          populate: {
            customer: true,
            order_items: {
              populate: {
                variant: true,
              },
            },
          },
        });
        const bodegaRows = await strapi.db.query('api::bodega.bodega').findMany({
          limit: 1000,
        });
        const currentOrders = uniqueOrdersByDocumentId(orders);
        const uniquePreviousOrders = uniqueOrdersByDocumentId(previousOrders);
        const current = buildMonthMetrics(currentOrders, bodegaRows, requestedMonth);
        const previous = buildMonthMetrics(uniquePreviousOrders, bodegaRows, previousBounds);
        const monthlyGoal = await findMonthlyGoal(requestedMonth.year, requestedMonth.month);
        const goalAmount = Number(monthlyGoal?.amount || DEFAULT_MONTHLY_GOAL);
        const revenueDiffPercent =
          previous.revenue > 0 ? ((current.revenue - previous.revenue) / previous.revenue) * 100 : 0;

        ctx.body = {
          data: {
            period: {
              year: requestedMonth.year,
              month: requestedMonth.month,
            },
            previousPeriod: {
              year: previousBounds.year,
              month: previousBounds.month,
            },
            goal: {
              id: monthlyGoal?.id,
              documentId: monthlyGoal?.documentId,
              amount: goalAmount,
              progressPercent: goalAmount > 0 ? Math.min((current.revenue / goalAmount) * 100, 100) : 0,
            },
            current,
            previous,
            comparison: {
              revenueDiffPercent,
            },
          },
        };
      },
      async saveGoal(ctx) {
        const year = Number(ctx.request.body?.year);
        const month = Number(ctx.request.body?.month);
        const amount = toInteger(ctx.request.body?.amount);

        if (!year || !month || month < 1 || month > 12) {
          return ctx.badRequest('Debes ingresar un mes y anio validos.');
        }

        if (amount <= 0) {
          return ctx.badRequest('La meta debe ser mayor a cero.');
        }

        const data = {
          goalName: `Meta ${String(month).padStart(2, '0')}-${year}`,
          year,
          month,
          amount,
        };
        const existingGoal = await findMonthlyGoal(year, month);
        const savedGoal = existingGoal
          ? await strapi.db.query('api::monthly-goal.monthly-goal').update({
              where: { id: existingGoal.id },
              data,
            })
          : await strapi.db.query('api::monthly-goal.monthly-goal').create({
              data,
            });

        ctx.body = {
          data: {
            id: savedGoal.id,
            documentId: savedGoal.documentId,
            year: savedGoal.year,
            month: savedGoal.month,
            amount: Number(savedGoal.amount || 0),
          },
        };
      },
    },
  },
  routes: {
    admin: {
      type: 'admin',
      routes: [
        {
          method: 'GET',
          path: '/orders',
          handler: 'orders.findPaid',
          config: {
            policies: ['admin::isAuthenticatedAdmin'],
          },
        },
        {
          method: 'POST',
          path: '/orders/:id/complete-shipping',
          handler: 'orders.completeShipping',
          config: {
            policies: ['admin::isAuthenticatedAdmin'],
          },
        },
        {
          method: 'POST',
          path: '/orders/:id/completed',
          handler: 'orders.markCompleted',
          config: {
            policies: ['admin::isAuthenticatedAdmin'],
          },
        },
        {
          method: 'GET',
          path: '/warehouse',
          handler: 'warehouse.findInventory',
          config: {
            policies: ['admin::isAuthenticatedAdmin'],
          },
        },
        {
          method: 'POST',
          path: '/warehouse/:variantDocumentId',
          handler: 'warehouse.saveInventoryRow',
          config: {
            policies: ['admin::isAuthenticatedAdmin'],
          },
        },
        {
          method: 'GET',
          path: '/mailbox/recipients',
          handler: 'mailbox.findRecipients',
          config: {
            policies: ['admin::isAuthenticatedAdmin'],
          },
        },
        {
          method: 'POST',
          path: '/mailbox/send',
          handler: 'mailbox.sendCampaign',
          config: {
            policies: ['admin::isAuthenticatedAdmin'],
          },
        },
        {
          method: 'GET',
          path: '/metrics',
          handler: 'metrics.findSummary',
          config: {
            policies: ['admin::isAuthenticatedAdmin'],
          },
        },
        {
          method: 'POST',
          path: '/metrics/goals',
          handler: 'metrics.saveGoal',
          config: {
            policies: ['admin::isAuthenticatedAdmin'],
          },
        },
      ],
    },
  },
});
