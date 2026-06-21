import type { StrapiApp } from '@strapi/strapi/admin';

/*
 * Admin limpio temporal para diagnosticar el loop de login en deploy.
 *
 * La referencia estable no carga un src/admin/app.tsx real, por eso dejamos
 * esta configuracion minima. Si el login vuelve a funcionar en Seenode, el
 * problema esta confirmado dentro del admin custom y reactivamos las piezas
 * una por una: tema, favicon, menu Pedidos, widget Ventas.
 */
export default {
  config: {},
  register(_app: StrapiApp) {},
  bootstrap(_app: StrapiApp) {},
};
