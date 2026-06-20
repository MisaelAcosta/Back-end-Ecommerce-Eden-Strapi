import { ShoppingCart } from '@strapi/icons';
import type { StrapiApp } from '@strapi/strapi/admin';
import './styles.css';

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

const installLoginPersistenceFallback = () => {
  const windowWithFallback = window as Window & {
    __edenLoginPersistenceFallbackInstalled?: boolean;
  };

  if (windowWithFallback.__edenLoginPersistenceFallbackInstalled) {
    return;
  }

  windowWithFallback.__edenLoginPersistenceFallbackInstalled = true;
  const originalFetch = window.fetch.bind(window);

  const normalizeToken = (storedToken: string | null) => {
    if (!storedToken) {
      return null;
    }

    try {
      const parsedToken = JSON.parse(storedToken);

      return typeof parsedToken === 'string' ? parsedToken : storedToken;
    } catch {
      return storedToken;
    }
  };

  const getCookieToken = () => {
    const tokenCookie = document.cookie
      .split(';')
      .map((cookie) => cookie.trim())
      .find((cookie) => cookie.startsWith('jwtToken='));

    return tokenCookie ? decodeURIComponent(tokenCookie.split('=').slice(1).join('=')) : null;
  };

  const persistAdminToken = (token: string) => {
    const normalizedToken = normalizeToken(token);

    if (!normalizedToken) {
      return;
    }

    window.localStorage.setItem('jwtToken', JSON.stringify(normalizedToken));
    window.localStorage.setItem('isLoggedIn', 'true');
    window.sessionStorage.setItem('jwtToken', JSON.stringify(normalizedToken));
    document.cookie = `jwtToken=${encodeURIComponent(normalizedToken)}; Path=/`;
  };

  const hydratePersistedToken = () => {
    const existingToken =
      normalizeToken(window.localStorage.getItem('jwtToken')) ||
      normalizeToken(window.sessionStorage.getItem('jwtToken')) ||
      getCookieToken();

    if (!existingToken) {
      return;
    }

    persistAdminToken(existingToken);

    if (window.location.pathname.endsWith('/auth/login')) {
      window.setTimeout(() => {
        window.location.assign('/admin/');
      }, 100);
    }
  };

  hydratePersistedToken();

  /*
   * Fallback para deploy:
   * Strapi normalmente guarda el token del login en cookie o localStorage.
   * En Seenode el login responde 200 con token, pero el admin vuelve al login
   * porque ese token no queda persistido. Este interceptor solo actua sobre
   * /admin/login y /admin/renew-token y replica el guardado esperado por Strapi.
   */
  window.fetch = async (input, init) => {
    const response = await originalFetch(input, init);
    const requestUrl = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

    const isAuthPersistenceRequest = requestUrl.includes('/admin/login') || requestUrl.includes('/admin/renew-token');

    if (!isAuthPersistenceRequest || !response.ok) {
      return response;
    }

    try {
      const body = await response.clone().json();
      const token = body?.data?.token;

      if (typeof token !== 'string' || token.length === 0) {
        return response;
      }

      persistAdminToken(token);

      if (window.location.pathname.endsWith('/auth/login')) {
        window.setTimeout(() => {
          window.location.assign('/admin/');
        }, 250);
      }
    } catch {
      // Si el body no es JSON o cambia el contrato de Strapi, dejamos que el flujo original continue.
    }

    return response;
  };
};

export default {
  config: {
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
        'HomePage.header.title': 'Hola {name}',
        'HomePage.header.subtitle': 'Bienvenido a tu panel de administracion',
      },
      es: {
        'HomePage.header.title': 'Hola {name}',
        'HomePage.header.subtitle': 'Bienvenido a tu panel de administracion',
      },
    },
  },
  register(app: StrapiApp) {
    app.addMenuLink({
      to: 'plugins/order-dashboard',
      icon: ShoppingCart,
      intlLabel: {
        id: 'order-dashboard.plugin.name',
        defaultMessage: 'Pedidos',
      },
      permissions: [],
      Component: () => import('./pages/OrdersDashboard'),
      position: 3,
    });

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
    installLoginPersistenceFallback();
  },
};
