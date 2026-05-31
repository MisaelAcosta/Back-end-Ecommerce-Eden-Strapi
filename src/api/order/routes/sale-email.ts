export default {
  routes: [
    {
      method: "POST",
      path: "/orders/:documentId/send-sale-email",
      handler: "order.sendSaleEmail",
    },
  ],
};
