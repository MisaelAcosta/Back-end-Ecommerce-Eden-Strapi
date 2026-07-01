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
  const { get } = useFetchClient();
  const today = useMemo(() => new Date(), []);
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1);
  const [selectedYear] = useState(today.getFullYear());
  const [metrics, setMetrics] = useState<MetricsResponse['data'] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const selectedMonthName = getMonthName(selectedMonth);
  const monthOptions = Array.from({ length: 12 }, (_, index) => index + 1);
  const current = metrics?.current || getEmptyMetrics();
  const previous = metrics?.previous || getEmptyMetrics();

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
          isLoading={isLoading}
          monthName={selectedMonthName}
          progressPercent={metrics?.goal.progressPercent || 0}
          selectedDay={today.getDate()}
          selectedYear={selectedYear}
        />
        <ClientsBlock clients={current.topClients} isLoading={isLoading} monthName={selectedMonthName} />
        <ProductsBlock isLoading={isLoading} monthName={selectedMonthName} products={current.topProducts} />
        <EvolutionAndComparisonBlock
          comparisonPercent={metrics?.comparison.revenueDiffPercent || 0}
          current={current}
          isLoading={isLoading}
          monthName={selectedMonthName}
          previous={previous}
          previousMonthName={metrics ? getMonthName(metrics.previousPeriod.month) : getMonthName(selectedMonth - 1 || 12)}
        />
        <ImportantDatesBlock dates={current.importantDates} isLoading={isLoading} monthName={selectedMonthName} />
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
  isLoading,
  monthName,
  progressPercent,
  selectedDay,
  selectedYear,
}: {
  current: MonthMetrics;
  goalAmount: number;
  isLoading: boolean;
  monthName: string;
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
        <span style={{ color: '#ffffff', fontSize: '18px' }}>+</span>
      </div>
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
    </div>
  </section>
);

const ClientsBlock = ({ clients, isLoading, monthName }: { clients: ClientMetric[]; isLoading: boolean; monthName: string }) => (
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
        clients.map((client, index) => (
          <div key={client.email} style={{ ...styles.clientRow, ...(index === 0 ? styles.activeClientRow : {}) }}>
            <span>{String(index + 1).padStart(2, '0')}</span>
            <span>{client.email}</span>
            <span>{client.products}</span>
            <span>{formatNumber(client.totalPaid)}</span>
            <span>{client.orders} pedidos</span>
          </div>
        ))
      )}
    </div>
  </section>
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
}) => (
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
        <strong style={{ color: '#C0FF01' }}>{comparisonPercent.toFixed(1)}%</strong> respecto al
        <br />
        mes anterior
      </p>
      <div style={styles.progressTrack}>
        <div style={{ ...styles.progressFill, width: `${Math.min(Math.abs(comparisonPercent), 100)}%` }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', marginTop: '10px', color: '#a8a8a8', fontSize: '13px' }}>
        <MetricList metrics={current} />
        <MetricList metrics={previous} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '92px 1fr', marginTop: '58px', minHeight: '76px', background: '#0b3a1e' }}>
        <div style={{ display: 'grid', placeItems: 'center', background: '#C0FF01', color: '#111111', textTransform: 'capitalize' }}>
          {monthName}
        </div>
        <div style={{ display: 'grid', alignItems: 'end', justifyItems: 'end', padding: '10px', color: '#cfcfcf', textTransform: 'capitalize' }}>
          {previousMonthName}
        </div>
      </div>
    </div>
  </section>
);

const RevenueLineChart = ({ points }: { points: DateMetric[] }) => {
  if (points.length === 0) {
    return <EmptyState text="No hay ventas pagadas para graficar este mes." />;
  }

  const maxRevenue = Math.max(...points.map((point) => point.revenue), 1);
  const width = 470;
  const height = 250;
  const coordinates = points.map((point, index) => {
    const x = points.length === 1 ? width / 2 : (index / (points.length - 1)) * width;
    const y = height - 28 - (point.revenue / maxRevenue) * 170;

    return { x, y, point };
  });
  const linePath = coordinates.map((coordinate, index) => `${index === 0 ? 'M' : 'L'}${coordinate.x} ${coordinate.y}`).join(' ');
  const areaPath = `${linePath} L${coordinates[coordinates.length - 1].x} ${height} L${coordinates[0].x} ${height} Z`;

  return (
    <svg aria-hidden="true" width="100%" height="250" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id="incomeArea" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#C0FF01" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#C0FF01" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#incomeArea)" />
      <path d={linePath} fill="none" stroke="#C0FF01" strokeWidth="2" />
      {coordinates.map(({ point, x, y }) => (
        <circle key={point.date} cx={x} cy={y} r="4" fill="#C0FF01" />
      ))}
    </svg>
  );
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

const ImportantDatesBlock = ({ dates, isLoading, monthName }: { dates: DateMetric[]; isLoading: boolean; monthName: string }) => {
  const maxProducts = Math.max(...dates.map((date) => date.products), 1);

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
          ) : dates.length === 0 ? (
            <div>Sin ventas este mes</div>
          ) : (
            dates.slice(0, 3).map((date) => (
              <div key={date.date}>
                {date.date} ---- <span style={{ color: '#C0FF01' }}>{date.products}</span>
              </div>
            ))
          )}
        </div>
      </div>
      <div style={styles.dateBars}>
        {isLoading || dates.length === 0 ? (
          <EmptyState text={isLoading ? 'Cargando fechas...' : 'No hay fechas importantes aun.'} />
        ) : (
          dates.map((date) => (
            <div key={date.date} style={{ display: 'grid', gap: '6px', justifyItems: 'center' }}>
              <span style={{ color: '#ffffff', fontSize: '12px' }}>{new Date(`${date.date}T00:00:00`).getDate()}</span>
              <span
                style={{
                  ...styles.dateBar,
                  height: Math.max((date.products / maxProducts) * 132, 42),
                  background: '#C0FF01',
                }}
              />
            </div>
          ))
        )}
      </div>
    </section>
  );
};

const EmptyState = ({ text }: { text: string }) => (
  <div style={{ color: '#777777', fontSize: '12px', padding: '14px 0' }}>{text}</div>
);

export default MetricsPage;
