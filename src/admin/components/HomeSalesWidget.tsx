import { useEffect, useMemo, useState } from 'react';
import { useFetchClient } from '@strapi/admin/strapi-admin';

type OrderSummary = {
  fulfillmentStatus?: 'PENDING_SHIPPING' | 'DELIVERED' | 'COMPLETED' | null;
};

type OrdersResponse = {
  data: OrderSummary[];
};

const getStatus = (order: OrderSummary) => order.fulfillmentStatus || 'PENDING_SHIPPING';

export default function HomeSalesWidget() {
  const { get } = useFetchClient();
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    async function loadSalesSummary() {
      try {
        const response = await get<OrdersResponse>('/order-dashboard/orders', {
          signal: controller.signal,
          params: {
            page: 1,
            pageSize: 100,
          },
        });

        setOrders(response.data.data || []);
      } catch {
        if (!controller.signal.aborted) {
          setHasError(true);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    loadSalesSummary();

    return () => controller.abort();
  }, [get]);

  const summary = useMemo(() => {
    const pendingShipping = orders.filter((order) => getStatus(order) === 'PENDING_SHIPPING').length;
    const delivered = orders.filter((order) => getStatus(order) === 'DELIVERED').length;
    const completed = orders.filter((order) => getStatus(order) === 'COMPLETED').length;

    return {
      active: pendingShipping + delivered,
      pendingShipping,
      delivered,
      completed,
    };
  }, [orders]);

  if (isLoading) {
    return <div style={styles.message}>Cargando ventas...</div>;
  }

  if (hasError) {
    return <div style={styles.message}>No se pudo cargar el resumen de ventas.</div>;
  }

  return (
    <div style={styles.widget}>
      {/* Numero principal del widget: pedidos que aun requieren gestion. */}
      <section style={styles.activeSection}>
        <strong style={styles.activeValue}>{summary.active}</strong>
        <div>
          <div style={styles.activeLabel}>PEDIDOS ACTIVOS</div>
          <div style={styles.activeDescription}>Pagados, por enviar o por completar</div>
        </div>
      </section>

      {/* Resumen compacto por etapa del flujo manual de pedidos. */}
      <div style={styles.statsGrid}>
        <SalesStat label="Pte. envio" value={summary.pendingShipping} color="#FFD91A" />
        <SalesStat label="Entregados" value={summary.delivered} color="#C0FF01" />
        <SalesStat label="Completados" value={summary.completed} color="#8f8f8f" />
      </div>
    </div>
  );
}

function SalesStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={styles.stat}>
      <span style={{ ...styles.statIndicator, background: color }} />
      <strong style={styles.statValue}>{value}</strong>
      <span style={styles.statLabel}>{label}</span>
    </div>
  );
}

const styles = {
  widget: {
    display: 'grid',
    gap: '20px',
    paddingTop: '4px',
  },
  activeSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '18px',
    minHeight: '92px',
    borderBottom: '1px solid #333333',
  },
  activeValue: {
    color: '#C0FF01',
    fontSize: '48px',
    fontWeight: 600,
    lineHeight: 1,
  },
  activeLabel: {
    color: '#ffffff',
    fontSize: '14px',
    fontWeight: 600,
  },
  activeDescription: {
    marginTop: '5px',
    color: '#a5a5ba',
    fontSize: '12px',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '10px',
  },
  stat: {
    position: 'relative' as const,
    display: 'grid',
    gap: '3px',
    minHeight: '68px',
    padding: '12px',
    background: '#111111',
    border: '1px solid #333333',
    borderRadius: '6px',
    boxSizing: 'border-box' as const,
  },
  statIndicator: {
    position: 'absolute' as const,
    top: '10px',
    right: '10px',
    width: '8px',
    height: '8px',
    borderRadius: '50%',
  },
  statValue: {
    color: '#ffffff',
    fontSize: '20px',
    lineHeight: 1,
  },
  statLabel: {
    alignSelf: 'end',
    color: '#a5a5ba',
    fontSize: '11px',
  },
  message: {
    display: 'grid',
    placeItems: 'center',
    minHeight: '180px',
    color: '#a5a5ba',
    fontSize: '13px',
  },
};
