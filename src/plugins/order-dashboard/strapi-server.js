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
      ],
    },
  },
});
