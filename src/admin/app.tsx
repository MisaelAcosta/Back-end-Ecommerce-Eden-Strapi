import type { StrapiApp } from '@strapi/strapi/admin';
import type { ElementType } from 'react';
import {
  Box,
  ChartColumnIncreasing,
  Feather,
  Image,
  PanelsTopLeft,
  ShoppingBag,
  ShoppingCart,
} from 'lucide-react';
import './styles.css';

type AdminMenuLink = {
  to: string;
  icon: ElementType;
  intlLabel: {
    id: string;
    defaultMessage: string;
  };
  position?: number;
};

type StrapiAppWithRouter = StrapiApp & {
  router?: {
    menu: AdminMenuLink[];
  };
};

const blackTheme = {
  colors: {
    neutral0: '#171717',
    neutral100: '#000000',
    neutral150: '#262626',
    neutral200: '#333333',
    neutral300: '#666687',
    neutral400: '#a5a5ba',
    neutral500: '#c0c0cf',
    neutral600: '#a5a5ba',
    neutral700: '#eaeaef',
    neutral800: '#ffffff',
    neutral900: '#ffffff',
    neutral1000: '#ffffff',
    primary100: '#1f2b00',
    primary200: '#425700',
    primary500: '#C0FF01',
    primary600: '#C0FF01',
    primary700: '#C0FF01',
    buttonPrimary500: '#C0FF01',
    buttonPrimary600: '#C0FF01',
    alternative100: '#1f2b00',
    alternative200: '#425700',
    alternative500: '#C0FF01',
    alternative600: '#C0FF01',
    alternative700: '#C0FF01',
  },
  shadows: {
    focus: 'inset 2px 0px 0px #C0FF01, inset 0px 2px 0px #C0FF01, inset -2px 0px 0px #C0FF01, inset 0px -2px 0px #C0FF01',
    focusShadow: '0px 0px 6px rgba(192, 255, 1, 0.75)',
  },
};

export default {
  config: {
    // Logo principal del login. Usa el archivo public/icono.png.
    auth: {
      logo: '/icono.png',
    },
    // Logo superior del menu lateral.
    menu: {
      logo: '/icono.png',
    },
    // Icono de Eden mostrado exclusivamente en la pestana del navegador.
    head: {
      favicon: '/icono.png',
    },
    theme: {
      light: blackTheme,
      dark: blackTheme,
    },
    // Traducciones personalizadas del encabezado principal del Home.
    translations: {
      en: {
        'Auth.form.button.login': 'Ingresar',
        'Auth.form.email.label': 'Correo',
        'Auth.form.email.placeholder': 'ej. hola@eden.com',
        'Auth.form.password.label': 'Contrasena',
        'Auth.form.rememberMe.label': 'Recordarme',
        'Auth.form.welcome.subtitle': 'Ingresa a tu cuenta de Eden Admin',
        'Auth.form.welcome.title': 'Bienvenido a Eden Admin',
        'Auth.link.forgot-password': 'Olvidaste tu contrasena?',
        'HomePage.header.title': 'Hola {name}',
        'HomePage.header.subtitle': 'Bienvenido a tu panel de administracion',
      },
      es: {
        'Auth.form.button.login': 'Ingresar',
        'Auth.form.email.label': 'Correo',
        'Auth.form.email.placeholder': 'ej. hola@eden.com',
        'Auth.form.password.label': 'Contrasena',
        'Auth.form.rememberMe.label': 'Recordarme',
        'Auth.form.welcome.subtitle': 'Ingresa a tu cuenta de Eden Admin',
        'Auth.form.welcome.title': 'Bienvenido a Eden Admin',
        'Auth.link.forgot-password': 'Olvidaste tu contrasena?',
        'HomePage.header.title': 'Hola {name}',
        'HomePage.header.subtitle': 'Bienvenido a tu panel de administracion',
      },
    },
  },
  register(app: StrapiApp) {
    app.addMenuLink({
      to: 'plugins/warehouse',
      icon: Box,
      intlLabel: {
        id: 'warehouse.plugin.name',
        defaultMessage: 'Bodega',
      },
      permissions: [],
      Component: () => import('./pages/WarehousePage'),
      position: 2.5,
    });

    app.addMenuLink({
      to: 'plugins/metrics',
      icon: ChartColumnIncreasing,
      intlLabel: {
        id: 'metrics.plugin.name',
        defaultMessage: 'Metricas',
      },
      permissions: [],
      Component: () => import('./pages/MetricsPage'),
      position: 6,
    });

    app.addMenuLink({
      to: 'plugins/order-dashboard',
      icon: ShoppingCart,
      intlLabel: {
        id: 'order-dashboard.plugin.name',
        defaultMessage: 'Pedidos',
      },
      permissions: [],
      Component: () => import('./pages/OrdersDashboard'),
      position: 8,
    });

    /*
     * AJUSTES VISUALES DEL MENU LATERAL
     * Strapi arma primero los links nativos/plugins y luego ejecuta este app.tsx.
     * Aqui reemplazamos iconos disponibles por Lucide y ocultamos Deploy localmente
     * sin eliminar el plugin ni sus rutas internas.
     */
    const router = (app as StrapiAppWithRouter).router;
    const menu = router?.menu;

    if (Array.isArray(menu)) {
      for (let index = menu.length - 1; index >= 0; index -= 1) {
        const item = menu[index];
        const label = item.intlLabel.defaultMessage.toLowerCase();

        if (item.to === 'plugins/strapi-cloud' || label === 'deploy') {
          menu.splice(index, 1);
        }
      }

      const lucideMenuIcons: Record<string, ElementType> = {
        'content-manager': Feather,
        'plugins/upload': Image,
        'plugins/content-type-builder': PanelsTopLeft,
        'plugins/marketplace': ShoppingBag,
      };

      menu.forEach((item) => {
        const nextIcon = lucideMenuIcons[item.to];

        if (nextIcon) {
          item.icon = nextIcon;
        }
      });
    }

    // Widget resumido de ventas mostrado en la pagina Home del admin.
    app.widgets.register({
      id: 'sales-summary',
      icon: ShoppingCart,
      title: {
        id: 'order-dashboard.home.sales.title',
        defaultMessage: 'Ventas',
      },
      link: {
        label: {
          id: 'order-dashboard.home.sales.link',
          defaultMessage: 'Ver pedidos',
        },
        href: '/plugins/order-dashboard',
      },
      component: async () => {
        const { default: HomeSalesWidget } = await import('./components/HomeSalesWidget');

        return HomeSalesWidget;
      },
    });

    /*
     * Orden y visibilidad de los widgets del Home.
     * Aqui se eliminan Profile y Last edited entries.
     * Ventas queda primero y Project statistics queda segundo.
     */
    app.widgets.register((widgets) => {
      const visibleWidgets = widgets.filter(
        (widget) => widget.id !== 'profile-info' && widget.id !== 'last-edited-entries'
      );
      const salesWidget = visibleWidgets.find((widget) => widget.id === 'sales-summary');
      const projectStatisticsWidget = visibleWidgets.find((widget) => widget.id === 'key-statistics');
      const remainingWidgets = visibleWidgets.filter(
        (widget) => widget.id !== 'sales-summary' && widget.id !== 'key-statistics'
      );

      return [
        ...(salesWidget ? [salesWidget] : []),
        ...(projectStatisticsWidget ? [projectStatisticsWidget] : []),
        ...remainingWidgets,
      ];
    });
  },
  bootstrap(_app: StrapiApp) {
    // Nombre mostrado junto al favicon en la pestana del navegador.
    document.title = 'Eden Admin';
  },
};
