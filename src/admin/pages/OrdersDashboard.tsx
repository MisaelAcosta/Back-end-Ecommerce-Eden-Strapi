import { useEffect, useMemo, useRef, useState } from 'react';
import { useFetchClient } from '@strapi/admin/strapi-admin';
import { Book, BookOpen, Copy } from 'lucide-react';

type Customer = {
  name?: string | null;
  rut?: string | null;
  phone?: string | null;
  region?: string | null;
  comuna?: string | null;
  calle?: string | null;
  numero?: string | null;
  depto?: string | null;
  nota?: string | null;
  account?: {
    email?: string | null;
    username?: string | null;
    [key: string]: unknown;
  } | null;
};

type OrderItem = {
  id?: number;
  orderItemName?: string | null;
  qty?: number | null;
  unitPrice?: number | null;
  lineTotal?: number | null;
  skuSnapshot?: string | null;
  variantNameSnapshot?: string | null;
  productNameSnapshot?: string | null;
  imageUrlSnapshot?: string | null;
  order_imprime?: OrderImprime | null;
};

type OrderImprime = {
  id?: number;
  orderImprimeNumber?: string | null;
  fileName?: string | null;
  material?: string | null;
  color?: string | null;
  quality?: string | null;
  scalePercent?: number | null;
  widthCm?: number | null;
  heightCm?: number | null;
  depthCm?: number | null;
  weightGrams?: number | null;
  postProcess?: string | null;
  postProcessLabel?: string | null;
  total?: number | null;
  status?: string | null;
};

type Order = {
  id?: number;
  documentId?: string;
  orderName?: string | null;
  orderNumber?: string | null;
  commerceOrder?: string | null;
  statusOrder?: string | null;
  subtotal?: number | null;
  shippingCost?: number | null;
  total?: number | null;
  paidAt?: string | null;
  createdAt?: string | null;
  fulfillmentStatus?: 'PENDING_SHIPPING' | 'DELIVERED' | 'COMPLETED' | null;
  trackingNumber?: string | null;
  deliveredAt?: string | null;
  completedAt?: string | null;
  customer?: Customer;
  items?: OrderItem[];
  imprimes?: OrderImprime[];
};

type DashboardResponse = {
  data: Order[];
  meta?: {
    pagination?: {
      total: number;
    };
  };
};

type Priority = 'low' | 'medium' | 'high';
type OrdersView = 'pendingShipping' | 'pendingDelivery' | 'delivered';
type FulfillmentStatus = NonNullable<Order['fulfillmentStatus']>;

const PRIORITY_META: Record<Priority, { label: string; color: string; text: string }> = {
  low: { label: 'Baja', color: '#C0FF01', text: '#C0FF01' },
  medium: { label: 'Media', color: '#FFD91A', text: '#FFD91A' },
  high: { label: 'Alta', color: '#FF321F', text: '#FF321F' },
};

// Cantidad minima de filas visibles en ENTREGADOS.
// Si hay menos pedidos, se rellenan con filas vacias solo visuales.
const MIN_DELIVERED_ROWS = 8;

const moneyFormatter = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
});

const formatMoney = (value?: number | null) => moneyFormatter.format(Number(value || 0));

const formatShortDate = (value?: string | null) => {
  if (!value) return '--';

  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value));
};

const formatFullDate = (value?: string | null) => {
  if (!value) return 'Sin fecha';

  return new Intl.DateTimeFormat('es-CL', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
};

const getOrderId = (order: Order) => order.documentId || order.id;

const getOrderLabel = (order: Order) => order.orderNumber || order.commerceOrder || order.orderName || 'Sin numero';

const getItemName = (item: OrderItem) =>
  item.productNameSnapshot || item.variantNameSnapshot || item.orderItemName || 'Producto sin nombre';

const getAddress = (customer?: Customer) =>
  [
    customer?.calle,
    customer?.numero,
    customer?.depto ? `Depto ${customer.depto}` : null,
    customer?.comuna,
    customer?.region,
  ]
    .filter(Boolean)
    .join(', ');

const getOrderQuantity = (order: Order) => {
  const productQty = (order.items || []).reduce((total, item) => total + Number(item.qty || 1), 0);
  const imprimeQty = (order.imprimes || []).length;

  return productQty + imprimeQty;
};

const getOrderKind = (order: Order) => ((order.imprimes || []).length > 0 ? 'Imprime' : 'Producto');

const getTrackingNumber = (order: Order) => order.trackingNumber || 'Sin seguimiento';

const getFulfillmentStatus = (order: Order): FulfillmentStatus => order.fulfillmentStatus || 'PENDING_SHIPPING';

const getPriority = (order: Order): Priority => {
  const referenceDate = order.createdAt || order.paidAt;

  if (!referenceDate) {
    return 'low';
  }

  const ageMs = Date.now() - new Date(referenceDate).getTime();
  const ageDays = Math.max(Math.floor(ageMs / 86400000), 0);

  if (ageDays <= 3) {
    return 'low';
  }

  if (ageDays <= 5) {
    return 'medium';
  }

  return 'high';
};

const getPrimaryProductLines = (order?: Order) => {
  if (!order) return [];

  const productLines = (order.items || []).map((item) => ({
    name: getItemName(item),
    qty: Number(item.qty || 1),
  }));

  const imprimeLines = (order.imprimes || []).map((imprime) => ({
    name: imprime.fileName || imprime.orderImprimeNumber || 'Pedido imprime',
    qty: 1,
  }));

  return [...productLines, ...imprimeLines];
};

export default function OrdersDashboard() {
  const { get, post } = useFetchClient();
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedId, setSelectedId] = useState<string | number | undefined>();
  const [activeView, setActiveView] = useState<OrdersView>('pendingShipping');
  const [priorityFilter, setPriorityFilter] = useState<'all' | Priority>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingTracking, setIsSavingTracking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trackingValue, setTrackingValue] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadOrders() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await get<DashboardResponse>('/order-dashboard/orders', {
          signal: controller.signal,
          params: {
            page: 1,
            pageSize: 100,
          },
        });

        const nextOrders = response.data.data || [];
        setOrders(nextOrders);
        setSelectedId((current) => current || getOrderId(nextOrders[0]));
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : 'No se pudieron cargar los pedidos.');
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    loadOrders();

    return () => controller.abort();
  }, [get]);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  const showToast = (message: string) => {
    setToastMessage(message);

    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }

    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 1800);
  };

  const filteredOrders = useMemo(
    () =>
      orders.filter(
        (order) => getFulfillmentStatus(order) === 'PENDING_SHIPPING' && (priorityFilter === 'all' || getPriority(order) === priorityFilter)
      ),
    [orders, priorityFilter]
  );

  const visibleOrders = useMemo(() => {
    if (activeView === 'delivered') {
      // Vista ENTREGADOS: muestra pedidos que ya recibieron numero de seguimiento o fueron completados.
      return orders.filter((order) => ['DELIVERED', 'COMPLETED'].includes(getFulfillmentStatus(order)));
    }

    if (activeView === 'pendingDelivery') {
      // Vista futura PTE. ENTREGA. Se deja vacia hasta definir su flujo real.
      return [];
    }

    return filteredOrders;
  }, [activeView, filteredOrders, orders]);

  const selectedOrder = useMemo(
    () => visibleOrders.find((order) => getOrderId(order) === selectedId) || visibleOrders[0],
    [selectedId, visibleOrders]
  );

  useEffect(() => {
    setTrackingValue(selectedOrder?.trackingNumber || '');
  }, [selectedOrder]);

  const counts = useMemo(
    () => {
      const activeOrders = orders.filter((order) => getFulfillmentStatus(order) !== 'COMPLETED');

      return {
        total: activeOrders.length,
        low: activeOrders.filter((order) => getPriority(order) === 'low').length,
        medium: activeOrders.filter((order) => getPriority(order) === 'medium').length,
        high: activeOrders.filter((order) => getPriority(order) === 'high').length,
      };
    },
    [orders]
  );

  const updateOrderInState = (updatedOrder: Order) => {
    setOrders((currentOrders) =>
      currentOrders.map((order) => (getOrderId(order) === getOrderId(updatedOrder) ? updatedOrder : order))
    );
    setSelectedId(getOrderId(updatedOrder));
  };

  const completeSelectedOrderShipping = async () => {
    if (!selectedOrder) return;

    const trackingNumber = trackingValue.trim();

    if (!trackingNumber) {
      setError('Debes ingresar un numero de seguimiento antes de completar el pedido.');
      return;
    }

    setIsSavingTracking(true);
    setError(null);

    try {
      const response = await post<{ data: Order }>(`/order-dashboard/orders/${getOrderId(selectedOrder)}/complete-shipping`, {
        trackingNumber,
      });

      updateOrderInState(response.data.data);
      setActiveView('delivered');
      showToast('Pedido completado correctamente');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el numero de seguimiento.');
    } finally {
      setIsSavingTracking(false);
    }
  };

  const markOrderCompleted = async (order: Order, completed: boolean) => {
    setError(null);

    try {
      const response = await post<{ data: Order }>(`/order-dashboard/orders/${getOrderId(order)}/completed`, {
        completed,
      });

      updateOrderInState(response.data.data);
      showToast(completed ? 'Pedido marcado como completado' : 'Pedido desmarcado como completado');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar el estado completado.');
    }
  };

  return (
    <main style={styles.page}>
      {/* Aviso flotante para copiar, guardar seguimiento y marcar completado. Cambia su posicion/color en styles.copyToast. */}
      {toastMessage ? <div style={styles.copyToast}>{toastMessage}</div> : null}

      {/* Layout principal: columna izquierda de ventas + panel derecho de detalle. Se controla en styles.shell. */}
      <section style={styles.shell}>
        {/* Bloque izquierdo completo de ventas. Fondo, alto y bordes en styles.salesPanel. */}
        <section style={styles.salesPanel}>
          {/* Encabezado superior: titulo, descripcion, total de activos y resumen por prioridad. */}
          <header style={styles.salesHeader}>
            <div>
              <h1 style={styles.title}>VENTAS</h1>
              <p style={styles.description}>Revisa todos tus pedidos, completalos y por entregar</p>
            </div>

            {/* Resumen derecho: total de pedidos activos + contadores rojo/amarillo/verde. */}
            <div style={styles.summaryWrap}>
              <div style={styles.totalSummary}>
                <strong style={styles.totalSummaryValue}>{counts.total}</strong>
                <span>ACTIVOS</span>
              </div>
              <div style={styles.prioritySummary}>
                <PriorityCount count={counts.high} color={PRIORITY_META.high.color} />
                <PriorityCount count={counts.medium} color={PRIORITY_META.medium.color} />
                <PriorityCount count={counts.low} color={PRIORITY_META.low.color} />
              </div>
            </div>
          </header>

          {/* Barra horizontal bajo el titulo. Aqui viven las pestanas y el filtro de prioridad. */}
          <div style={styles.navRow}>
            {/* Pestanas visuales. activeView define cual vista se muestra abajo. */}
            <nav style={styles.tabs}>
              <button
                type="button"
                onClick={() => setActiveView('pendingShipping')}
                style={{ ...styles.tab, ...(activeView === 'pendingShipping' ? styles.tabActive : {}) }}
              >
                PTE. ENVIO
              </button>
              <button
                type="button"
                onClick={() => setActiveView('pendingDelivery')}
                style={{ ...styles.tab, ...(activeView === 'pendingDelivery' ? styles.tabActive : {}) }}
              >
                PTE. ENTREGA
              </button>
              <button
                type="button"
                onClick={() => setActiveView('delivered')}
                style={{ ...styles.tab, ...(activeView === 'delivered' ? styles.tabActive : {}) }}
              >
                ENTREGADOS
              </button>
            </nav>

            {/* Filtro de prioridad. El select esta invisible para conservar el diseno tipo texto + flecha. */}
            <label style={styles.priorityFilter}>
              PRIORIDAD
              <select
                value={priorityFilter}
                onChange={(event) => setPriorityFilter(event.target.value as 'all' | Priority)}
                style={styles.prioritySelect}
              >
                <option value="all">Todas</option>
                <option value="high">Alta</option>
                <option value="medium">Media</option>
                <option value="low">Baja</option>
              </select>
              <span aria-hidden="true">-&gt;</span>
            </label>
          </div>

          {error ? <div style={styles.error}>{error}</div> : null}
          {isLoading ? <div style={styles.empty}>Cargando pedidos...</div> : null}
          {!isLoading && activeView !== 'delivered' && visibleOrders.length === 0 ? <div style={styles.empty}>No hay pedidos en esta vista.</div> : null}

          {activeView === 'delivered' ? (
            <DeliveredOrdersTable
              orders={visibleOrders}
              selectedOrder={selectedOrder}
              onSelect={setSelectedId}
              onToggleCompleted={markOrderCompleted}
            />
          ) : (
            // Grilla de tarjetas de pedidos. Columnas, espacios y margen interno en styles.orderGrid.
            <div style={styles.orderGrid}>
              {visibleOrders.map((order) => {
                const id = getOrderId(order);
                const priority = getPriority(order);
                const meta = PRIORITY_META[priority];
                const isSelected = id === getOrderId(selectedOrder || {});

                return (
                  <button
                    key={String(id)}
                    type="button"
                    onClick={() => setSelectedId(id)}
                    style={{ ...styles.orderCard, ...(isSelected ? styles.orderCardActive : {}) }}
                  >
                    {/* Barra de color de prioridad. Su posicion exacta se mueve en styles.priorityBar. */}
                    <span style={{ ...styles.priorityBar, background: meta.color }} />

                    {/* Contenido principal de la tarjeta: numero, cliente, fecha, total y cantidad. */}
                    <div style={styles.orderContent}>
                      <span style={styles.orderId}>{getOrderLabel(order)}</span>
                      <span style={styles.customerName}>{order.customer?.name || 'Cliente sin nombre'}</span>
                      <span style={{ ...styles.orderDate, color: meta.text }}>{formatShortDate(order.createdAt || order.paidAt)}</span>
                      <div style={styles.orderBottom}>
                        <span>{formatMoney(order.total)}</span>
                        <span>Cantidad: {getOrderQuantity(order)}</span>
                      </div>
                    </div>

                    {/* Columna lateral vertical: muestra PRODUCTO o IMPRIME segun el tipo de pedido. */}
                    <div style={styles.orderSide}>
                      <span style={styles.orderKind}>{getOrderKind(order)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Panel derecho de detalle. Ancho del panel en styles.shell, apariencia en styles.detailPanel. */}
        <aside style={styles.detailPanel}>
          {selectedOrder ? (
            <>
              {/* Seccion CLIENTE: estos campos son los unicos con boton para copiar. */}
              <section style={styles.detailBlock}>
                <div style={styles.detailTitleRow}>
                  <h2 style={styles.detailTitle}>CLIENTE</h2>
                  <span style={styles.paidBadge}>PAID</span>
                </div>
                <div style={styles.detailGrid}>
                  <DetailField label="Nombre" value={selectedOrder.customer?.name || 'Sin nombre'} copyable onCopied={showToast} />
                  <DetailField label="Rut" value={selectedOrder.customer?.rut || 'Sin RUT'} copyable onCopied={showToast} />
                  <DetailField label="Email" value={selectedOrder.customer?.account?.email || 'Sin correo'} copyable onCopied={showToast} />
                  <DetailField label="Telefono" value={selectedOrder.customer?.phone || 'Sin telefono'} copyable onCopied={showToast} />
                  <DetailField label="Direccion" value={getAddress(selectedOrder.customer) || 'Sin direccion'} wide copyable onCopied={showToast} />
                  <DetailField label="Nota" value={selectedOrder.customer?.nota || ''} wide tall copyable onCopied={showToast} />
                </div>
              </section>

              <Divider />

              {/* Seccion PEDIDO: resumen monetario y fecha de pago. No lleva copiar. */}
              <section style={styles.detailBlock}>
                <h2 style={styles.detailTitle}>PEDIDO</h2>
                <div style={styles.detailGrid}>
                  <DetailField label="Total" value={formatMoney(selectedOrder.total)} />
                  <DetailField label="Subtotal" value={formatMoney(selectedOrder.subtotal)} />
                  <DetailField label="Envio" value={formatMoney(selectedOrder.shippingCost)} />
                  <DetailField label="Fecha" value={formatFullDate(selectedOrder.paidAt)} />
                </div>
              </section>

              <Divider />

              {/* Seccion PRODUCTO: lista todos los productos/imprimes del pedido seleccionado. */}
              <section style={styles.detailBlock}>
                <h2 style={styles.detailTitle}>PRODUCTO</h2>
                <div style={styles.productBox}>
                  {getPrimaryProductLines(selectedOrder).map((line) => (
                    <div key={line.name} style={styles.productLine}>
                      <span>{line.name}</span>
                      <strong>{line.qty}</strong>
                    </div>
                  ))}
                  {getPrimaryProductLines(selectedOrder).length === 0 ? <span style={styles.muted}>Sin productos.</span> : null}
                </div>
              </section>

              <Divider />

              {/* Seccion de seguimiento. Por ahora es solo visual; no guarda datos todavia. */}
              <section style={styles.detailBlock}>
                <h2 style={styles.detailTitle}>NUMERO DE SEGUIMIENTO</h2>
                <input
                  style={styles.trackingInput}
                  value={trackingValue}
                  onChange={(event) => setTrackingValue(event.target.value)}
                  placeholder="Ingresa el numero de seguimiento"
                />
                <button type="button" onClick={completeSelectedOrderShipping} disabled={isSavingTracking} style={styles.completeButton}>
                  {isSavingTracking ? 'GUARDANDO' : 'COMPLETAR'}
                </button>
              </section>
            </>
          ) : (
            <div style={styles.empty}>Selecciona un pedido.</div>
          )}
        </aside>
      </section>
    </main>
  );
}

function DeliveredOrdersTable({
  orders,
  selectedOrder,
  onSelect,
  onToggleCompleted,
}: {
  orders: Order[];
  selectedOrder?: Order;
  onSelect: (id: string | number | undefined) => void;
  onToggleCompleted: (order: Order, completed: boolean) => void;
}) {
  const rowSlots = Array.from({ length: Math.max(orders.length, MIN_DELIVERED_ROWS) }, (_, index) => orders[index]);

  return (
    // Tabla visual de ENTREGADOS. Cambia columnas, alturas y colores en los styles delivered*.
    <div style={styles.deliveredWrap}>
      {/* Cabecera de la tabla entregados. Mantiene el mismo orden que el diseno de Figma. */}
      <div style={styles.deliveredHeader}>
        <span />
        <span>Numero</span>
        <span>Nombre</span>
        <span>Fecha</span>
        <span>Total</span>
        <span>Tipo</span>
        <span>Seguimiento</span>
        <span>Completado</span>
        <span />
      </div>

      {/* Filas de pedidos entregados. El pedido seleccionado alimenta el panel derecho. */}
      <div style={styles.deliveredBody}>
        {rowSlots.map((order, index) => {
          if (!order) {
            return (
              // Fila vacia de reserva. Mantiene la estructura lista para futuros pedidos.
              <div key={`empty-delivered-${index}`} style={{ ...styles.deliveredRow, ...styles.deliveredRowEmpty }}>
                <span />
                <span />
                <span />
                <span />
                <span />
                <span />
                <span />
                <span />
                <span />
              </div>
            );
          }

          const id = getOrderId(order);
          const isSelected = id === getOrderId(selectedOrder || {});

          return (
            <button
              key={String(id)}
              type="button"
              onClick={() => onSelect(id)}
              style={{ ...styles.deliveredRow, ...(isSelected ? styles.deliveredRowActive : {}) }}
            >
              <span style={styles.deliveredIndex}>{String(index + 1).padStart(2, '0')}</span>
              <span style={styles.deliveredNumber}>{getOrderLabel(order)}</span>
              <span>{order.customer?.name || 'Cliente sin nombre'}</span>
              <span>{formatShortDate(order.paidAt || order.createdAt)}</span>
              <span>{formatMoney(order.total)}</span>
              <span>{getOrderKind(order)}</span>
              <span>{getTrackingNumber(order)}</span>
              <label style={styles.completedLabel} onClick={(event) => event.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={getFulfillmentStatus(order) === 'COMPLETED'}
                  onChange={(event) => onToggleCompleted(order, event.target.checked)}
                  style={styles.completedCheckbox}
                />
                <span>Completado</span>
              </label>
              <span style={styles.deliveredIconCell}>
                {/* Icono abierto = fila seleccionada. Icono cerrado = fila disponible sin seleccionar. */}
                {isSelected ? <BookOpen size={18} strokeWidth={1.9} /> : <Book size={18} strokeWidth={1.9} />}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PriorityCount({ count, color }: { count: number; color: string }) {
  return (
    // Cada bloque muestra el conteo por prioridad: alta, media y baja.
    <div style={{ ...styles.priorityCount, background: color }}>
      {String(count).padStart(2, '0')}
    </div>
  );
}

function DetailField({
  label,
  value,
  wide = false,
  tall = false,
  copyable = false,
  onCopied,
}: {
  label: string;
  value: string;
  wide?: boolean;
  tall?: boolean;
  copyable?: boolean;
  onCopied?: (label: string) => void;
}) {
  const copyValue = async () => {
    const text = value || '-';

    // Copia moderna del navegador. Si falla o no existe, abajo usamos el respaldo clasico.
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      // Respaldo para navegadores/paneles donde clipboard API no esta disponible.
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }

    onCopied?.(`${label} copiado correctamente`);
  };

  return (
    // Caja individual del panel derecho. wide ocupa dos columnas; tall aumenta la altura.
    <div style={{ ...styles.detailField, ...(wide ? styles.detailFieldWide : {}), ...(tall ? styles.detailFieldTall : {}) }}>
      <span style={styles.detailLabelRow}>
        <span style={styles.detailLabel}>{label}</span>
        {copyable ? (
          <button type="button" onClick={copyValue} style={styles.copyButton} title={`Copiar ${label}`} aria-label={`Copiar ${label}`}>
            <Copy size={13} strokeWidth={1.8} />
          </button>
        ) : null}
      </span>
      <strong style={styles.detailValue}>{value || '-'}</strong>
    </div>
  );
}

function Divider() {
  return <hr style={styles.divider} />;
}

const styles = {
  // Fondo general de la pagina de ventas dentro del admin de Strapi.
  page: {
    minHeight: '100%',
    background: '#000000',
    color: '#ffffff',
    padding: '14px',
  },

  // Notificacion verde que aparece arriba a la derecha al copiar datos del cliente.
  copyToast: {
    position: 'fixed' as const,
    top: '22px',
    right: '22px',
    zIndex: 9999,
    background: '#C0FF01',
    color: '#121212',
    borderRadius: '10px',
    boxShadow: '0 12px 30px rgba(0, 0, 0, 0.3)',
    fontSize: '13px',
    fontWeight: 700,
    padding: '10px 14px',
  },

  // Estructura general de dos columnas.
  // Cambia el "428px" si quieres hacer mas ancho o mas angosto el panel derecho.
  // Cambia "gap" si quieres separar mas o menos ventas y detalle.
  shell: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) 428px',
    gap: '38px',
    maxWidth: '1750px',
    margin: '0 auto',
    paddingTop: '36px',
  },

  // Panel izquierdo completo donde viven titulo, tabs y tarjetas de pedidos.
  // border dibuja el marco externo fino que rodea todo el bloque de ventas.
  // Cambia el color #2b2b2b si quieres que la linea sea mas clara u oscura.
  salesPanel: {
    height: '850px',
    background: '#000000',
    border: '1px solid #2b2b2b',
    borderRadius: '0px',
    boxSizing: 'border-box' as const,
    padding: 0,
    overflow: 'hidden',
  },

  // Encabezado de ventas: controla el espacio superior y la separacion entre titulo y contadores.
  salesHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '24px',
    alignItems: 'flex-start',
    padding: '36px 58px 24px',
  },

  // Titulo principal "VENTAS".
  title: {
    margin: 0,
    fontSize: '29px',
    fontWeight: 300,
    lineHeight: 1,
  },

  // Texto pequeno debajo de VENTAS.
  description: {
    margin: '14px 0 0',
    color: '#a8a8a8',
    fontSize: '12px',
    fontWeight: 300,
    textTransform: 'uppercase' as const,
  },

  // Contenedor del resumen derecho: total de activos + prioridades apiladas.
  summaryWrap: {
    display: 'flex',
    gap: '10px',
    alignItems: 'center',
  },

  // Columna de prioridades. Actualmente se apilan: alta, media y baja.
  prioritySummary: {
    display: 'grid',
    gap: '2px',
  },

  // Cajita individual de cada prioridad. El color se inyecta desde PRIORITY_META.
  priorityCount: {
    display: 'grid',
    placeItems: 'center',
    width: '38px',
    height: '15px',
    color: '#111111',
    fontSize: '11px',
    fontWeight: 700,
  },

  // Bloque del numero total de pedidos activos.
  totalSummary: {
    display: 'grid',
    justifyItems: 'end',
    alignContent: 'center',
    minWidth: '44px',
    color: '#6f6f6f',
    fontSize: '11px',
    lineHeight: 1,
    textTransform: 'uppercase' as const,
  },

  // Numero grande dentro del resumen de activos.
  totalSummaryValue: {
    color: '#ffffff',
    fontSize: '17px',
    fontWeight: 700,
    lineHeight: 1,
    marginBottom: '4px',
  },

  // Fila horizontal de navegacion: tabs a la izquierda y filtro de prioridad a la derecha.
  // borderTop y borderBottom son las lineas horizontales que separan header, tabs y tarjetas.
  navRow: {
    display: 'flex',
    alignItems: 'stretch',
    justifyContent: 'space-between',
    borderTop: '1px solid #2b2b2b',
    borderBottom: '1px solid #2b2b2b',
    minHeight: '74px',
  },

  // Contenedor de las tres pestanas. Modifica 176px para agrandarlas o achicarlas.
  // Si quieres que las pestanas ocupen mas espacio horizontal, cambia repeat(3, 176px).
  tabs: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 176px)',
    background: 'transparent',
    borderRadius: 0,
    padding: 0,
  },

  // Estilo base para cada pestana.
  // borderRight dibuja las lineas verticales entre PTE. ENVIO, PTE. ENTREGA y ENTREGADOS.
  tab: {
    height: '74px',
    border: 0,
    borderRight: '1px solid #242424',
    borderRadius: 0,
    background: 'transparent',
    color: '#ffffff',
    cursor: 'default',
    fontSize: '16px',
    fontWeight: 400,
  },

  // Pestana activa. Por ahora representa la vista PTE. ENVIO.
  tabActive: {
    background: '#d9d9d9',
    color: '#1f1f1f',
  },

  // Texto "PRIORIDAD ->" y zona clickeable del filtro.
  priorityFilter: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '0 58px 0 28px',
    color: '#ffffff',
    fontSize: '12px',
    fontWeight: 700,
  },

  // Select real del filtro. Esta invisible para mantener el look del Figma.
  prioritySelect: {
    width: '22px',
    opacity: 0,
    cursor: 'pointer',
  },

  // Contenedor de la tabla ENTREGADOS.
  // El padding controla la distancia entre la tabla y los bordes del bloque de ventas.
  deliveredWrap: {
    padding: '28px 16px 0',
  },

  // Cabecera de columnas de ENTREGADOS.
  // gridTemplateColumns controla el ancho de cada columna en este orden:
  // indice, numero, nombre, fecha, total, tipo, seguimiento, completado, icono.
  deliveredHeader: {
    display: 'grid',
    gridTemplateColumns: '46px minmax(150px, 1.4fr) minmax(110px, 1fr) 86px 92px 92px 120px 126px 72px',
    alignItems: 'center',
    minHeight: '38px',
    color: '#5f5f5f',
    fontSize: '14px',
    textAlign: 'center' as const,
  },

  // Cuerpo donde viven las filas de entregados.
  deliveredBody: {
    display: 'grid',
    marginTop: '16px',
  },

  // Fila individual de la tabla ENTREGADOS.
  // Usa el mismo gridTemplateColumns que la cabecera para que todo quede alineado.
  deliveredRow: {
    display: 'grid',
    gridTemplateColumns: '46px minmax(150px, 1.4fr) minmax(110px, 1fr) 86px 92px 92px 120px 126px 72px',
    alignItems: 'center',
    minHeight: '48px',
    border: 0,
    borderBottom: '1px solid #555555',
    background: '#202020',
    color: '#ffffff',
    cursor: 'pointer',
    fontSize: '14px',
    padding: 0,
    textAlign: 'center' as const,
  },

  // Fila seleccionada. El icono queda abierto y esta fila alimenta el panel derecho.
  deliveredRowActive: {
    background: '#232323',
  },

  // Fila vacia de reserva para pedidos futuros.
  // Cambia background/minHeight/borderBottom si quieres que se vean mas o menos marcadas.
  deliveredRowEmpty: {
    cursor: 'default',
    pointerEvents: 'none' as const,
  },

  // Numero correlativo de la fila: 01, 02, 03...
  deliveredIndex: {
    color: '#ffffff',
  },

  // Numero de pedido en verde Eden dentro de la tabla.
  deliveredNumber: {
    color: '#C0FF01',
  },

  // Label/casilla para marcar un pedido entregado como completado.
  // Cambia gap/fontSize si quieres hacerlo mas compacto o mas grande.
  completedLabel: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '7px',
    color: '#ffffff',
    cursor: 'pointer',
    fontSize: '12px',
  },

  // Checkbox nativo para evitar agregar otra libreria visual.
  completedCheckbox: {
    width: '14px',
    height: '14px',
    accentColor: '#C0FF01',
    cursor: 'pointer',
  },

  // Celda del boton/icono final. Cambia background o borderRadius para modificar la capsula.
  deliveredIconCell: {
    display: 'inline-grid',
    placeItems: 'center',
    justifySelf: 'center',
    width: '46px',
    height: '26px',
    borderRadius: '7px',
    background: '#383838',
    color: '#ffffff',
  },

  // Grilla de tarjetas. Cambia columnas/gap/padding para mover las tarjetas dentro del panel.
  orderGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(220px, 300px))',
    alignItems: 'start',
    gap: '18px 28px',
    padding: '28px 58px 0',
  },

  // Tarjeta individual de pedido.
  // gridTemplateColumns separa contenido principal y columna vertical PRODUCTO/IMPRIME.
  orderCard: {
    position: 'relative' as const,
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) 56px',
    minHeight: '116px',
    padding: 0,
    overflow: 'hidden',
    background: '#242424',
    color: '#ffffff',
    border: '1px solid transparent',
    borderRadius: '15px',
    textAlign: 'left' as const,
    cursor: 'pointer',
  },

  // Borde blanco cuando la tarjeta esta seleccionada.
  orderCardActive: {
    borderColor: '#ffffff',
  },

  // Padding interno del contenido textual de la tarjeta.
  orderContent: {
    padding: '16px 15px',
  },

  // Numero de orden dentro de la tarjeta.
  orderId: {
    display: 'block',
    fontSize: '12px',
    fontWeight: 400,
    marginBottom: '7px',
  },

  // Nombre del cliente dentro de la tarjeta.
  customerName: {
    display: 'block',
    fontSize: '13px',
    marginBottom: '7px',
  },

  // Fecha de la tarjeta. El color cambia segun la prioridad.
  orderDate: {
    display: 'block',
    fontSize: '13px',
    fontWeight: 400,
    marginBottom: '7px',
  },

  // Fila inferior de la tarjeta: total a la izquierda, cantidad a la derecha.
  orderBottom: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '12px',
    fontSize: '12px',
    color: '#ffffff',
  },

  // Columna lateral donde va el texto vertical PRODUCTO/IMPRIME.
  orderSide: {
    display: 'grid',
    gridTemplateRows: '1fr',
    borderLeft: '1px solid #ffffff',
    minWidth: '56px',
  },

  // Rayita de color de prioridad dentro de la tarjeta.
  // Mueve top/right si quieres cambiar su ubicacion exacta.
  priorityBar: {
    position: 'absolute' as const,
    top: '18px',
    right: '72px',
    width: '40px',
    height: '8px',
    borderRadius: '999px',
  },

  // Texto vertical de la columna lateral.
  orderKind: {
    alignSelf: 'center',
    justifySelf: 'center',
    transform: 'rotate(-90deg)',
    color: '#ffffff',
    fontSize: '11px',
    fontWeight: 600,
    marginRight: '66px',
    textTransform: 'uppercase' as const,
    whiteSpace: 'nowrap' as const,
    width: '60px',
    textAlign: 'center' as const,
  },

  // Panel derecho completo con el detalle del pedido seleccionado.
  detailPanel: {
    minHeight: 'calc(100vh - 28px)',
    background: '#171717',
    borderRadius: '0px',
    padding: '26px 16px',
  },

  // Bloque interno de cada seccion del panel derecho: CLIENTE, PEDIDO, PRODUCTO, SEGUIMIENTO.
  detailBlock: {
    display: 'block',
  },

  // Fila superior de CLIENTE: titulo a la izquierda y badge PAID a la derecha.
  detailTitleRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
  },

  // Titulos del panel derecho.
  detailTitle: {
    margin: '0 0 14px',
    fontSize: '17px',
    fontWeight: 400,
    lineHeight: 1,
  },

  // Badge verde PAID.
  paidBadge: {
    background: '#4f9f2d',
    color: '#ffffff',
    borderRadius: '8px',
    padding: '1px 12px',
    marginBottom: '10px',
    fontSize: '12px',
    fontWeight: 400,
  },

  // Grilla de campos del panel derecho. Dos columnas por defecto.
  detailGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '8px',
  },

  // Caja base de cada campo del detalle.
  detailField: {
    minHeight: '48px',
    background: '#0B0B0B',
    borderRadius: '8px',
    padding: '10px',
    overflow: 'hidden',
  },

  // Variante para campos anchos como Direccion y Nota.
  detailFieldWide: {
    gridColumn: '1 / -1',
  },

  // Variante para campos que necesitan mas alto.
  detailFieldTall: {
    minHeight: '62px',
  },

  // Label pequeno dentro de cada campo: Nombre, Rut, Email, etc.
  detailLabel: {
    display: 'block',
    color: '#5f5f5f',
    fontSize: '11px',
    textTransform: 'uppercase' as const,
  },

  // Fila del label + boton copiar dentro de campos copyable.
  detailLabelRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
    marginBottom: '6px',
  },

  // Boton con icono Copy. Solo aparece en campos del cliente.
  copyButton: {
    display: 'inline-grid',
    placeItems: 'center',
    width: '24px',
    height: '24px',
    border: '1px solid #3f3f3f',
    borderRadius: '6px',
    background: 'transparent',
    color: '#8f8f8f',
    cursor: 'pointer',
    padding: 0,
  },

  // Valor principal dentro de cada caja del detalle.
  detailValue: {
    display: 'block',
    color: '#ffffff',
    fontSize: '12px',
    fontWeight: 300,
    lineHeight: 1.25,
    wordBreak: 'break-word' as const,
  },

  // Linea divisoria entre secciones del panel derecho.
  divider: {
    border: 0,
    borderTop: '1px solid #595959',
    margin: '22px 0',
  },

  // Caja que contiene la lista de productos/imprimes.
  productBox: {
    background: '#0B0B0B',
    borderRadius: '8px',
    padding: '13px',
    minHeight: '84px',
  },

  // Fila individual de producto: nombre a la izquierda, cantidad a la derecha.
  productLine: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) auto',
    gap: '14px',
    padding: '7px 0',
    borderBottom: '1px solid #343434',
    color: '#ffffff',
    fontSize: '12px',
    fontWeight: 300,
  },

  // Input visual del numero de seguimiento. Todavia no guarda en backend.
  trackingInput: {
    width: '100%',
    height: '38px',
    border: 0,
    borderRadius: '8px',
    background: '#0B0B0B',
    color: '#ffffff',
    padding: '0 11px',
    fontSize: '11px',
    outline: 'none',
    boxSizing: 'border-box' as const,
  },

  // Boton COMPLETAR de la seccion seguimiento. Por ahora solo visual.
  completeButton: {
    display: 'block',
    margin: '12px auto 0',
    height: '32px',
    padding: '0 16px',
    border: '1px solid #ffffff',
    borderRadius: '9px',
    background: 'transparent',
    color: '#ffffff',
    fontSize: '10px',
  },

  // Estado vacio/cargando dentro del panel de ventas.
  empty: {
    background: '#242424',
    borderRadius: '15px',
    color: '#a8a8a8',
    margin: '28px 58px 0',
    padding: '18px',
  },

  // Caja de error si falla la carga de pedidos.
  error: {
    background: '#3b1614',
    border: '1px solid #8f2f2a',
    borderRadius: '12px',
    color: '#ffd2cf',
    margin: '28px 58px 16px',
    padding: '14px',
  },

  // Texto secundario generico.
  muted: {
    color: '#a8a8a8',
    fontSize: '12px',
  },
};
