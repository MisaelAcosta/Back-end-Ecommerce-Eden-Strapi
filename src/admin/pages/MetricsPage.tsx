import { useEffect, useMemo, useState } from 'react';
import { useFetchClient } from '@strapi/admin/strapi-admin';
import { metricsStyles as styles } from './metricsStyles';

type ProductMetric = {
  name: string;
  quantity: number;
  revenue: number;
  expenses: number;
};

type ClientMetric = {
  email: string;
  customerName?: string;
  products: number;
  totalPaid: number;
  orders: number;
  orderSummaries?: Array<{
    orderNumber: string;
    date: string;
    total: number;
    products: Array<{
      name: string;
      qty: number;
      total: number;
    }>;
  }>;
};

type DateMetric = {
  date: string;
  products: number;
  revenue: number;
  orders: number;
};

type MonthMetrics = {
  revenue: number;
  expenses: number;
  profit: number;
  orders: number;
  soldProducts: number;
  newClients: number;
  topProducts: ProductMetric[];
  topClients: ClientMetric[];
  importantDates: DateMetric[];
  dailyRevenue: DateMetric[];
};

type MetricsResponse = {
  data: {
    period: {
      year: number;
      month: number;
    };
    previousPeriod: {
      year: number;
      month: number;
    };
    goal: {
      id?: number;
      documentId?: string;
      amount: number;
      progressPercent: number;
    };
    current: MonthMetrics;
    previous: MonthMetrics;
    comparison: {
      revenueDiffPercent: number;
    };
  };
};

type SaveGoalResponse = {
  data: {
    id: number;
    documentId?: string;
    year: number;
    month: number;
    amount: number;
  };
};

const monthNames = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

const moneyFormatter = new Intl.NumberFormat('es-CL', {
  maximumFractionDigits: 0,
});

const formatMoney = (value: number) => `$ ${moneyFormatter.format(Math.round(value || 0))}`;
const formatNumber = (value: number) => moneyFormatter.format(Math.round(value || 0));
const getMonthName = (month: number) => monthNames[Math.max(Math.min(month - 1, 11), 0)];
const parseMoneyInput = (value: string) => {
  const parsed = Number(value.replace(/\./g, '').replace(',', '.').trim());

  return Number.isFinite(parsed) ? Math.round(parsed) : 0;
};
const getEmptyMetrics = (): MonthMetrics => ({
  revenue: 0,
  expenses: 0,
  profit: 0,
  orders: 0,
  soldProducts: 0,
  newClients: 0,
  topProducts: [],
  topClients: [],
  importantDates: [],
  dailyRevenue: [],
});

const MetricsPage = () => {
  const { get, post } = useFetchClient();
  const today = useMemo(() => new Date(), []);
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1);
  const [selectedYear] = useState(today.getFullYear());
  const [metrics, setMetrics] = useState<MetricsResponse['data'] | null>(null);
  const [isGoalEditorOpen, setIsGoalEditorOpen] = useState(false);
  const [goalDraftMonth, setGoalDraftMonth] = useState(selectedMonth);
  const [goalDraftYear, setGoalDraftYear] = useState(selectedYear);
  const [goalDraftAmount, setGoalDraftAmount] = useState('');
  const [isSavingGoal, setIsSavingGoal] = useState(false);
  const [selectedClientEmail, setSelectedClientEmail] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const selectedMonthName = getMonthName(selectedMonth);
  const monthOptions = Array.from({ length: 12 }, (_, index) => index + 1);
  const current = metrics?.current || getEmptyMetrics();
  const previous = metrics?.previous || getEmptyMetrics();

  useEffect(() => {
    setGoalDraftMonth(selectedMonth);
    setGoalDraftYear(selectedYear);
    setGoalDraftAmount(metrics?.goal.amount ? formatNumber(metrics.goal.amount) : '');
  }, [metrics?.goal.amount, selectedMonth, selectedYear]);

  useEffect(() => {
    let isMounted = true;

    const loadMetrics = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await get<MetricsResponse>('/order-dashboard/metrics', {
          params: {
            month: selectedMonth,
            year: selectedYear,
          },
        });

        if (!isMounted) return;

        setMetrics(response.data.data);
      } catch (err) {
        if (!isMounted) return;

        setError(err instanceof Error ? err.message : 'No se pudieron cargar las metricas.');
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadMetrics();

    return () => {
      isMounted = false;
    };
  }, [get, selectedMonth, selectedYear]);

  const saveMonthlyGoal = async () => {
    const amount = parseMoneyInput(goalDraftAmount);

    setIsSavingGoal(true);
    setError(null);

    try {
      const response = await post<SaveGoalResponse>('/order-dashboard/metrics/goals', {
        year: goalDraftYear,
        month: goalDraftMonth,
        amount,
      });
      const savedGoal = response.data.data;

      if (savedGoal.year === selectedYear && savedGoal.month === selectedMonth) {
        setMetrics((currentMetrics) =>
          currentMetrics
            ? {
                ...currentMetrics,
                goal: {
                  ...currentMetrics.goal,
                  id: savedGoal.id,
                  documentId: savedGoal.documentId,
                  amount: savedGoal.amount,
                  progressPercent:
                    savedGoal.amount > 0 ? Math.min((currentMetrics.current.revenue / savedGoal.amount) * 100, 100) : 0,
                },
              }
            : currentMetrics
        );
      }

      setIsGoalEditorOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la meta mensual.');
    } finally {
      setIsSavingGoal(false);
    }
  };

  return (
    <main style={styles.page} aria-label="Metricas">
      {error ? <div style={{ color: '#ff6b5f', margin: '0 auto 14px', maxWidth: '1500px' }}>{error}</div> : null}
      <section style={styles.shell}>
        <DateFilterBlock
          months={monthOptions}
          monthName={selectedMonthName}
          selectedMonth={selectedMonth}
          selectedYear={selectedYear}
          onSelectMonth={setSelectedMonth}
        />
        <MonthlyGoalBlock
          current={current}
          goalAmount={metrics?.goal.amount || 645000}
          goalDraftAmount={goalDraftAmount}
          goalDraftMonth={goalDraftMonth}
          goalDraftYear={goalDraftYear}
          isLoading={isLoading}
          isSavingGoal={isSavingGoal}
          isEditorOpen={isGoalEditorOpen}
          monthName={selectedMonthName}
          onChangeGoalAmount={setGoalDraftAmount}
          onChangeGoalMonth={setGoalDraftMonth}
          onChangeGoalYear={setGoalDraftYear}
          onCloseEditor={() => setIsGoalEditorOpen(false)}
          onOpenEditor={() => setIsGoalEditorOpen(true)}
          onSaveGoal={saveMonthlyGoal}
          progressPercent={metrics?.goal.progressPercent || 0}
          selectedDay={today.getDate()}
          selectedYear={selectedYear}
        />
        <ClientsBlock
          clients={current.topClients}
          isLoading={isLoading}
          monthName={selectedMonthName}
          selectedClientEmail={selectedClientEmail}
          onSelectClient={setSelectedClientEmail}
        />
        <ProductsBlock isLoading={isLoading} monthName={selectedMonthName} products={current.topProducts} />
        <EvolutionAndComparisonBlock
          comparisonPercent={metrics?.comparison.revenueDiffPercent || 0}
          current={current}
          isLoading={isLoading}
          monthName={selectedMonthName}
          previous={previous}
          previousMonthName={metrics ? getMonthName(metrics.previousPeriod.month) : getMonthName(selectedMonth - 1 || 12)}
        />
        <ImportantDatesBlock
          dailyDates={current.dailyRevenue}
          importantDates={current.importantDates}
          isLoading={isLoading}
          monthName={selectedMonthName}
        />
      </section>
    </main>
  );
};

const DateFilterBlock = ({
  months,
  monthName,
  onSelectMonth,
  selectedMonth,
  selectedYear,
}: {
  months: number[];
  monthName: string;
  onSelectMonth: (month: number) => void;
  selectedMonth: number;
  selectedYear: number;
}) => (
  <section style={styles.dateFilter} aria-label="Filtro de fecha">
    <div style={styles.dateSide}>
      <h2 style={styles.title}>Fecha</h2>
      <div style={styles.monthLine}>
        <span style={{ ...styles.tinyLabel, width: '60px' }} />
        <span style={{ color: '#ffffff', fontSize: '12px', textTransform: 'capitalize' }}>{monthName}</span>
        <span style={{ color: '#C0FF01' }}>•</span>
        <span style={styles.yearPill}>{selectedYear}</span>
      </div>
      <div style={styles.calendarGrid}>
        {months.map((month) => {
          const isActive = month === selectedMonth;

          return (
            <button
              key={month}
              onClick={() => onSelectMonth(month)}
              style={{ ...styles.dayButton, ...(isActive ? styles.activeDayButton : {}) }}
              type="button"
            >
              {String(month).padStart(2, '0')}
            </button>
          );
        })}
      </div>
    </div>
    <div style={styles.filterSide}>
      <span style={styles.tinyLabel}>Ver metricas por</span>
      <div style={styles.segmented}>
        <button style={{ ...styles.segment, ...styles.activeSegment }} type="button">
          Mes
        </button>
        <button style={styles.segment} type="button">
          Anio
        </button>
      </div>
      <button style={styles.applyButton} type="button">
        Aplicar
      </button>
    </div>
  </section>
);

const MonthlyGoalBlock = ({
  current,
  goalAmount,
  goalDraftAmount,
  goalDraftMonth,
  goalDraftYear,
  isLoading,
  isSavingGoal,
  isEditorOpen,
  monthName,
  onChangeGoalAmount,
  onChangeGoalMonth,
  onChangeGoalYear,
  onCloseEditor,
  onOpenEditor,
  onSaveGoal,
  progressPercent,
  selectedDay,
  selectedYear,
}: {
  current: MonthMetrics;
  goalAmount: number;
  goalDraftAmount: string;
  goalDraftMonth: number;
  goalDraftYear: number;
  isLoading: boolean;
  isSavingGoal: boolean;
  isEditorOpen: boolean;
  monthName: string;
  onChangeGoalAmount: (value: string) => void;
  onChangeGoalMonth: (value: number) => void;
  onChangeGoalYear: (value: number) => void;
  onCloseEditor: () => void;
  onOpenEditor: () => void;
  onSaveGoal: () => void;
  progressPercent: number;
  selectedDay: number;
  selectedYear: number;
}) => (
  <section style={styles.goalBlock} aria-label="Meta del mes">
    <div style={styles.goalLeft}>
      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#a8a8a8', fontSize: '11px' }}>
        <span>
          {selectedDay} de {monthName}, {selectedYear}
        </span>
        <span>{new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
      <div style={styles.goalPercent}>{isLoading ? '...' : `${progressPercent.toFixed(2)}%`}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#cfcfcf', fontSize: '12px' }}>
        <span>
          <span style={styles.tinyLabel}>Mes</span>
          <br />
          <span style={{ textTransform: 'capitalize' }}>{monthName}</span>
        </span>
        <span>
          <span style={styles.tinyLabel}>Meta del mes</span>
          <br />
          {formatNumber(goalAmount)}
        </span>
      </div>
    </div>
    <div style={styles.goalRight}>
      <div style={styles.blockHeader}>
        <span style={styles.tinyLabel}>Ingreso actual</span>
        <button type="button" onClick={isEditorOpen ? onCloseEditor : onOpenEditor} style={styles.goalAddButton}>
          {isEditorOpen ? 'x' : '+'}
        </button>
      </div>
      {isEditorOpen ? (
        <div style={styles.goalEditor}>
          <div style={styles.goalEditorRow}>
            <label style={styles.goalEditorLabel}>
              Mes
              <select
                onChange={(event) => onChangeGoalMonth(Number(event.target.value))}
                style={styles.goalEditorInput}
                value={goalDraftMonth}
              >
                {monthNames.map((name, index) => (
                  <option key={name} value={index + 1}>
                    {String(index + 1).padStart(2, '0')} - {name}
                  </option>
                ))}
              </select>
            </label>
            <label style={styles.goalEditorLabel}>
              Anio
              <input
                inputMode="numeric"
                onChange={(event) => onChangeGoalYear(Number(event.target.value) || selectedYear)}
                style={styles.goalEditorInput}
                value={goalDraftYear}
              />
            </label>
          </div>
          <label style={styles.goalEditorLabel}>
            Meta del mes
            <input
              inputMode="numeric"
              onChange={(event) => onChangeGoalAmount(event.target.value)}
              placeholder="Ej: 645.000"
              style={styles.goalEditorInput}
              value={goalDraftAmount}
            />
          </label>
          <button type="button" disabled={isSavingGoal} onClick={onSaveGoal} style={styles.goalSaveButton}>
            {isSavingGoal ? 'Guardando' : 'Guardar meta'}
          </button>
        </div>
      ) : (
        <>
          <div>
            <div style={styles.metricValue}>{isLoading ? '$ ...' : formatMoney(current.revenue)}</div>
            <div style={{ ...styles.tinyLabel, margin: '14px 0 5px' }}>
              {formatNumber(current.revenue)} / {formatNumber(goalAmount)}
            </div>
            <div style={styles.progressTrack}>
              <div style={{ ...styles.progressFill, width: `${Math.min(progressPercent, 100)}%` }} />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
            <strong>Productos Vendidos</strong>
            <span>{isLoading ? '...' : current.soldProducts}</span>
          </div>
        </>
      )}
    </div>
  </section>
);

const ClientsBlock = ({
  clients,
  isLoading,
  monthName,
  onSelectClient,
  selectedClientEmail,
}: {
  clients: ClientMetric[];
  isLoading: boolean;
  monthName: string;
  onSelectClient: (email: string | null) => void;
  selectedClientEmail: string | null;
}) => {
  const selectedClient = clients.find((client) => client.email === selectedClientEmail) || null;

  return (
    <section style={styles.clientsBlock} aria-label="Clientes">
      <div style={styles.blockHeader}>
        <h2 style={styles.mutedTitle}>Clientes</h2>
        <span style={{ color: '#ffffff', textTransform: 'capitalize' }}>{monthName}</span>
      </div>
      <p style={{ margin: '24px 0 0', color: '#ffffff', fontSize: '18px', lineHeight: 1.1 }}>
        Top <span style={{ color: '#C0FF01' }}>↗</span>
        <br />
        Clientes
      </p>
      <div style={styles.clientRows}>
        {isLoading ? (
          <EmptyState text="Cargando clientes..." />
        ) : clients.length === 0 ? (
          <EmptyState text="No hay clientes con compras pagadas en este mes." />
        ) : (
          clients.map((client, index) => {
            const isActive = selectedClientEmail ? client.email === selectedClientEmail : index === 0;

            return (
              <div key={client.email} style={{ ...styles.clientRow, ...(isActive ? styles.activeClientRow : {}) }}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <span style={styles.clientEmail} title={client.email}>
                  {client.email}
                </span>
                <span>{client.products}</span>
                <span>{formatNumber(client.totalPaid)}</span>
                <button
                  type="button"
                  onClick={() => onSelectClient(client.email === selectedClientEmail ? null : client.email)}
                  style={{ ...styles.clientInfoButton, ...(isActive ? styles.clientInfoButtonActive : {}) }}
                >
                  {client.orders} pedidos
                </button>
              </div>
            );
          })
        )}
      </div>
      {selectedClient ? <ClientSummary client={selectedClient} /> : null}
    </section>
  );
};

const ClientSummary = ({ client }: { client: ClientMetric }) => (
  <div style={styles.clientSummary}>
    <div style={styles.clientSummaryHeader}>
      <span style={styles.clientSummaryEmail} title={client.email}>
        {client.email}
      </span>
      <strong>{formatMoney(client.totalPaid)}</strong>
    </div>
    <div style={styles.clientSummaryBody}>
      {(client.orderSummaries || []).map((order) => (
        <div key={`${order.orderNumber}-${order.date}`} style={styles.clientOrderCard}>
          <div style={styles.clientOrderHeader}>
            <span>{order.orderNumber}</span>
            <span>{order.date}</span>
            <strong>{formatMoney(order.total)}</strong>
          </div>
          <div style={styles.clientProductList}>
            {order.products.map((product) => (
              <div key={`${order.orderNumber}-${product.name}`} style={styles.clientProductLine}>
                <span>{product.name}</span>
                <span>x{product.qty}</span>
                <span>{formatMoney(product.total)}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  </div>
);

const ProductsBlock = ({ isLoading, monthName, products }: { isLoading: boolean; monthName: string; products: ProductMetric[] }) => {
  const maxQuantity = Math.max(...products.map((product) => product.quantity), 1);
  const barColors = ['#C0FF01', '#9bd800', '#648c00', '#5b5b5b', '#505050'];

  return (
    <section style={styles.productsBlock} aria-label="Productos">
      <div>
        <div style={styles.blockHeader}>
          <h2 style={styles.mutedTitle}>Productos</h2>
          <span style={{ color: '#ffffff', textTransform: 'capitalize' }}>{monthName}</span>
        </div>
        <p style={{ margin: '32px 0 0', color: '#ffffff', fontSize: '18px', lineHeight: 1.1 }}>
          Mas <span style={{ color: '#C0FF01' }}>↗</span>
          <br />
          vendidos
        </p>
      </div>
      <div style={styles.productBars}>
        {isLoading ? (
          <EmptyState text="Cargando productos..." />
        ) : products.length === 0 ? (
          <EmptyState text="No hay productos vendidos en este mes." />
        ) : (
          products.map((product, index) => (
            <div key={product.name} style={{ display: 'grid', gap: '8px', alignItems: 'end' }}>
              <span style={{ color: '#ffffff', fontSize: '20px' }}>{product.quantity}</span>
              <div
                style={{
                  ...styles.productBar,
                  height: `${Math.max((product.quantity / maxQuantity) * 210, 48)}px`,
                  background: barColors[index] || '#505050',
                }}
              >
                {product.name}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
};

const EvolutionAndComparisonBlock = ({
  comparisonPercent,
  current,
  isLoading,
  monthName,
  previous,
  previousMonthName,
}: {
  comparisonPercent: number;
  current: MonthMetrics;
  isLoading: boolean;
  monthName: string;
  previous: MonthMetrics;
  previousMonthName: string;
}) => {
  const hasPreviousRevenue = previous.revenue > 0;
  const comparisonText = hasPreviousRevenue ? `${comparisonPercent.toFixed(1)}%` : 'Sin ventas el mes anterior';

  return (
    <section style={styles.bottomBand} aria-label="Evolucion y comparativa">
      <div style={styles.evolutionPanel}>
        <div style={styles.blockHeader}>
          <h2 style={styles.mutedTitle}>Evolucion de ventas</h2>
          <span style={{ textTransform: 'capitalize' }}>{monthName}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
          <div>
            <div style={{ fontSize: '18px' }}>Ingreso total</div>
            <strong style={{ color: '#C0FF01', fontSize: '20px' }}>{isLoading ? '$ ...' : formatMoney(current.revenue)}</strong>
          </div>
          <div style={{ display: 'flex', gap: '18px', fontSize: '16px' }}>
            <span>Ingreso</span>
            <span style={{ color: '#686868' }}>Perdida</span>
          </div>
        </div>
        <div style={styles.chartFrame}>
          {isLoading ? <EmptyState text="Cargando evolucion..." /> : <RevenueLineChart points={current.dailyRevenue} />}
        </div>
      </div>
      <div style={styles.comparativePanel}>
        <div style={styles.blockHeader}>
          <h2 style={styles.mutedTitle}>Comparativa</h2>
          <span style={{ textTransform: 'capitalize' }}>
            {previousMonthName} x {monthName}
          </span>
        </div>
        <p style={{ margin: '8px 0 28px', fontSize: '18px' }}>
          <strong style={{ color: '#C0FF01' }}>{hasPreviousRevenue ? `↗ ${comparisonText}` : comparisonText}</strong>
          {hasPreviousRevenue ? (
            <>
              {' '}respecto al
              <br />
              mes anterior
            </>
          ) : (
            <>
              <br />
              comparativa no disponible
            </>
          )}
        </p>
        <div style={styles.comparisonTopLine}>
          <span style={styles.comparisonTopCurrent} />
          <span style={styles.comparisonTopPrevious} />
        </div>
        <div style={styles.comparisonMetricsGrid}>
          <MetricList metrics={current} />
          <MetricList metrics={previous} />
        </div>
        <ComparisonRevenueBar
          currentLabel={monthName}
          currentRevenue={current.revenue}
          previousLabel={previousMonthName}
          previousRevenue={previous.revenue}
        />
      </div>
    </section>
  );
};

const RevenueLineChart = ({ points }: { points: DateMetric[] }) => {
  if (points.length === 0) {
    return <EmptyState text="No hay ventas pagadas para graficar este mes." />;
  }

  const maxRevenue = Math.max(...points.map((point) => point.revenue), 1);
  const yMax = Math.max(Math.ceil(maxRevenue / 10000) * 10000, 100000);
  const width = 540;
  const height = 280;
  const padding = {
    top: 12,
    right: 12,
    bottom: 34,
    left: 64,
  };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const coordinates = points.map((point, index) => {
    const x = padding.left + (points.length === 1 ? plotWidth / 2 : (index / (points.length - 1)) * plotWidth);
    const y = padding.top + (1 - point.revenue / yMax) * plotHeight;

    return { x, y, point };
  });
  const linePath = buildSmoothPath(coordinates);
  const areaPath = `${linePath} L${coordinates[coordinates.length - 1].x} ${height - padding.bottom} L${coordinates[0].x} ${height - padding.bottom} Z`;
  const yLabels = Array.from({ length: 10 }, (_, index) => yMax - index * (yMax / 10)).filter((value) => value > 0);
  const salesCoordinates = coordinates.filter(({ point }) => point.revenue > 0);
  const labelCoordinates = [
    coordinates[0],
    ...salesCoordinates,
    coordinates[coordinates.length - 1],
  ].filter((coordinate, index, list) => list.findIndex((item) => item.point.date === coordinate.point.date) === index);

  return (
    <svg aria-hidden="true" width="100%" height="280" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id="incomeArea" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#C0FF01" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#C0FF01" stopOpacity="0" />
        </linearGradient>
      </defs>
      {yLabels.map((value) => {
        const y = padding.top + (1 - value / yMax) * plotHeight;

        return (
          <text key={value} x="0" y={y + 5} fill="#d6d6d6" fontSize="16">
            ${Math.round(value / 1000)}k
          </text>
        );
      })}
      <path d={areaPath} fill="url(#incomeArea)" />
      <path d={linePath} fill="none" stroke="#C0FF01" strokeWidth="2" />
      {salesCoordinates.map(({ point, x, y }) => (
        <g key={point.date}>
          <line x1={x} x2={x} y1={y + 8} y2={height - padding.bottom} stroke="#8b8b8b" strokeDasharray="2 3" />
          <circle cx={x} cy={y} r="5" fill="#C0FF01" />
        </g>
      ))}
      {labelCoordinates.map(({ point, x }) => (
        <text key={`label-${point.date}`} x={x} y={height - 8} fill="#d6d6d6" fontSize="15" textAnchor="middle">
          {String(new Date(`${point.date}T00:00:00`).getDate()).padStart(2, '0')}
        </text>
      ))}
    </svg>
  );
};

const buildSmoothPath = (coordinates: Array<{ x: number; y: number }>) => {
  if (coordinates.length === 1) {
    return `M${coordinates[0].x} ${coordinates[0].y}`;
  }

  return coordinates.reduce((path, point, index, list) => {
    if (index === 0) {
      return `M${point.x} ${point.y}`;
    }

    const previous = list[index - 1];
    const controlX = (previous.x + point.x) / 2;

    return `${path} C${controlX} ${previous.y}, ${controlX} ${point.y}, ${point.x} ${point.y}`;
  }, '');
};

const MetricList = ({ metrics }: { metrics: MonthMetrics }) => (
  <div style={{ display: 'grid', gap: '6px' }}>
    {[
      ['ventas', formatMoney(metrics.revenue)],
      ['Ganancia', formatMoney(metrics.profit)],
      ['Gastos', formatMoney(metrics.expenses)],
      ['Pedidos', String(metrics.orders)],
      ['Clientes Nuevos', String(metrics.newClients)],
    ].map(([label, value]) => (
      <div key={label} style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>{label}</span>
        <span style={{ color: '#ffffff' }}>{value}</span>
      </div>
    ))}
  </div>
);

const ComparisonRevenueBar = ({
  currentLabel,
  currentRevenue,
  previousLabel,
  previousRevenue,
}: {
  currentLabel: string;
  currentRevenue: number;
  previousLabel: string;
  previousRevenue: number;
}) => {
  const totalRevenue = currentRevenue + previousRevenue;
  const currentPercent = totalRevenue > 0 ? (currentRevenue / totalRevenue) * 100 : 50;
  const previousPercent = totalRevenue > 0 ? 100 - currentPercent : 50;

  return (
    <div style={styles.comparisonRevenueBar}>
      <div
        style={{
          ...styles.comparisonRevenueCurrent,
          width: `${currentPercent}%`,
        }}
      >
        <span>{currentLabel}</span>
      </div>
      <div
        style={{
          ...styles.comparisonRevenuePrevious,
          width: `${previousPercent}%`,
        }}
      >
        <span>{previousLabel}</span>
      </div>
    </div>
  );
};

const ImportantDatesBlock = ({
  dailyDates,
  importantDates,
  isLoading,
  monthName,
}: {
  dailyDates: DateMetric[];
  importantDates: DateMetric[];
  isLoading: boolean;
  monthName: string;
}) => {
  const importantDateKeys = new Set(importantDates.slice(0, 3).map((date) => date.date));
  const maxProducts = Math.max(...dailyDates.map((date) => date.products), 1);

  return (
    <section style={styles.datesBlock} aria-label="Fechas importantes">
      <div style={styles.blockHeader}>
        <h2 style={{ ...styles.mutedTitle, color: '#75a986' }}>Fechas</h2>
        <span style={{ textTransform: 'capitalize' }}>{monthName}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '18px' }}>
        <p style={{ margin: 0, color: '#ffffff', fontSize: '18px', lineHeight: 1.1 }}>
          Mejores <span style={{ color: '#C0FF01' }}>↗</span>
          <br />
          Fechas
        </p>
        <div style={{ color: '#8fbf9d', fontSize: '13px', textAlign: 'right' }}>
          {isLoading ? (
            <div>Cargando...</div>
          ) : importantDates.length === 0 ? (
            <div>Sin ventas este mes</div>
          ) : (
            importantDates.slice(0, 3).map((date) => (
              <div key={date.date}>
                {date.date} ---- <span style={{ color: '#C0FF01' }}>{date.products}</span>
              </div>
            ))
          )}
        </div>
      </div>
      <div style={styles.dateBars}>
        {isLoading || dailyDates.length === 0 ? (
          <EmptyState text={isLoading ? 'Cargando fechas...' : 'No hay fechas importantes aun.'} />
        ) : (
          dailyDates.map((date) => {
            const isImportant = importantDateKeys.has(date.date) && date.products > 0;

            return (
            <div key={date.date} style={{ display: 'grid', gap: '6px', justifyItems: 'center' }}>
              {isImportant ? (
                <span style={{ color: '#ffffff', fontSize: '12px' }}>{new Date(`${date.date}T00:00:00`).getDate()}</span>
              ) : null}
              <span
                style={{
                  ...styles.dateBar,
                  height: Math.max((date.products / maxProducts) * 150, date.products > 0 ? 58 : 44),
                  background: isImportant ? '#C0FF01' : '#ffffff',
                }}
              />
            </div>
          );
          })
        )}
      </div>
    </section>
  );
};

const EmptyState = ({ text }: { text: string }) => (
  <div style={{ color: '#777777', fontSize: '12px', padding: '14px 0' }}>{text}</div>
);

export default MetricsPage;
