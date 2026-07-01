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

const buildBodegaData = ({ payload, variant }) => {
  const product = variant.product || {};
  const category = product.category || null;
  const price = toInteger(payload.price ?? variant.price);
  const materialCost = toInteger(payload.materialCost);
  const lightCost = toInteger(payload.lightCost);
  const boxCost = toInteger(payload.boxCost);
  const paintCost = toInteger(payload.paintCost);
  const totalCost = materialCost + lightCost + boxCost + paintCost;
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

const getOrderDate = (order) => new Date(order.paidAt || order.createdAt || order.updatedAt || 0);

const formatDateKey = (date) => date.toISOString().slice(0, 10);

const getItemName = (item) =>
  item.variantNameSnapshot || item.productNameSnapshot || item.variant?.variantName || item.orderItemName || 'Producto sin nombre';

const getItemVariantDocumentId = (item) => item.variant?.documentId || null;

const buildMonthMetrics = (orders, bodegaRows) => {
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
  const dailyRevenue = Array.from(datesByKey.values()).sort((a, b) => a.date.localeCompare(b.date));

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
        const current = buildMonthMetrics(currentOrders, bodegaRows);
        const previous = buildMonthMetrics(uniquePreviousOrders, bodegaRows);
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
              amount: 645000,
              progressPercent: 645000 > 0 ? Math.min((current.revenue / 645000) * 100, 100) : 0,
            },
            current,
            previous,
            comparison: {
              revenueDiffPercent,
            },
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
          path: '/metrics',
          handler: 'metrics.findSummary',
          config: {
            policies: ['admin::isAuthenticatedAdmin'],
          },
        },
      ],
    },
  },
});
