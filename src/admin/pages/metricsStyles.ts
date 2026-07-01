import type { CSSProperties } from 'react';

const blockBase = {
  background: '#171717',
  border: '1px solid #2a2a2a',
  boxSizing: 'border-box',
} satisfies CSSProperties;

export const metricsStyles = {
  // Fondo general de la pagina Metricas.
  page: {
    minHeight: '100vh',
    background: '#000000',
    color: '#ffffff',
    padding: '24px',
    boxSizing: 'border-box',
  } satisfies CSSProperties,

  // Grilla principal: izquierda operativa, centro clientes, derecha productos/fechas.
  shell: {
    display: 'grid',
    gridTemplateColumns: '540px minmax(360px, 1fr) minmax(360px, 1fr)',
    gridTemplateRows: '220px 220px minmax(360px, 1fr)',
    gap: '16px',
    maxWidth: '1500px',
    margin: '0 auto',
  } satisfies CSSProperties,

  block: blockBase,

  // Bloque superior izquierdo: calendario y filtro Mes/Anio.
  dateFilter: {
    ...blockBase,
    display: 'grid',
    gridTemplateColumns: '1.35fr 0.75fr',
    minHeight: '220px',
  } satisfies CSSProperties,

  dateSide: {
    padding: '22px 28px',
    borderRight: '1px solid #333333',
  } satisfies CSSProperties,

  filterSide: {
    display: 'grid',
    alignContent: 'center',
    justifyItems: 'center',
    gap: '22px',
    padding: '22px',
  } satisfies CSSProperties,

  title: {
    margin: 0,
    color: '#d9d9d9',
    fontSize: '18px',
    fontWeight: 400,
  } satisfies CSSProperties,

  mutedTitle: {
    margin: 0,
    color: '#6f6f6f',
    fontSize: '18px',
    fontWeight: 400,
  } satisfies CSSProperties,

  tinyLabel: {
    color: '#9a9a9a',
    fontSize: '12px',
  } satisfies CSSProperties,

  monthLine: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    marginTop: '20px',
  } satisfies CSSProperties,

  yearPill: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '96px',
    height: '26px',
    background: '#2a2a2a',
    color: '#cfcfcf',
    fontSize: '12px',
  } satisfies CSSProperties,

  calendarGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(6, 1fr)',
    gap: '20px 24px',
    marginTop: '30px',
  } satisfies CSSProperties,

  dayButton: {
    height: '28px',
    border: 0,
    background: 'transparent',
    color: '#ffffff',
    fontSize: '12px',
  } satisfies CSSProperties,

  activeDayButton: {
    background: '#C0FF01',
    color: '#111111',
  } satisfies CSSProperties,

  segmented: {
    display: 'inline-flex',
    background: '#101010',
  } satisfies CSSProperties,

  segment: {
    minWidth: '58px',
    height: '25px',
    border: 0,
    background: '#262626',
    color: '#ffffff',
    fontSize: '12px',
  } satisfies CSSProperties,

  activeSegment: {
    background: '#C0FF01',
    color: '#111111',
  } satisfies CSSProperties,

  applyButton: {
    width: '110px',
    height: '34px',
    border: 0,
    background: '#2b2b2b',
    color: '#ffffff',
    fontSize: '12px',
  } satisfies CSSProperties,

  goalBlock: {
    ...blockBase,
    display: 'grid',
    gridTemplateColumns: '0.78fr 1fr',
    minHeight: '220px',
  } satisfies CSSProperties,

  goalLeft: {
    display: 'grid',
    alignContent: 'space-between',
    padding: '20px',
    background: 'linear-gradient(90deg, rgba(18,64,31,0.9), rgba(23,23,23,0.9))',
  } satisfies CSSProperties,

  goalPercent: {
    color: '#C0FF01',
    fontSize: '42px',
    fontWeight: 700,
    letterSpacing: 0,
    textAlign: 'center',
  } satisfies CSSProperties,

  goalRight: {
    display: 'grid',
    alignContent: 'space-between',
    padding: '20px',
  } satisfies CSSProperties,

  metricValue: {
    color: '#ffffff',
    fontSize: '28px',
    fontWeight: 400,
  } satisfies CSSProperties,

  progressTrack: {
    width: '100%',
    height: '13px',
    border: '1px solid #5a5a5a',
    background: '#111111',
  } satisfies CSSProperties,

  progressFill: {
    height: '100%',
    background: '#C0FF01',
  } satisfies CSSProperties,

  clientsBlock: {
    ...blockBase,
    gridColumn: '2',
    gridRow: '1 / 3',
    padding: '22px',
  } satisfies CSSProperties,

  productsBlock: {
    ...blockBase,
    gridColumn: '3',
    gridRow: '1 / 3',
    display: 'grid',
    gridTemplateRows: 'auto 1fr',
    padding: '22px',
  } satisfies CSSProperties,

  datesBlock: {
    ...blockBase,
    gridColumn: '3',
    gridRow: '3',
    background: '#0b3a1e',
    padding: '22px',
  } satisfies CSSProperties,

  bottomBand: {
    ...blockBase,
    gridColumn: '1 / 3',
    gridRow: '3',
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    minHeight: '360px',
  } satisfies CSSProperties,

  evolutionPanel: {
    padding: '22px',
    borderRight: '1px solid #3a3a3a',
  } satisfies CSSProperties,

  comparativePanel: {
    padding: '22px',
  } satisfies CSSProperties,

  blockHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '16px',
  } satisfies CSSProperties,

  chartFrame: {
    position: 'relative',
    minHeight: '250px',
    marginTop: '18px',
  } satisfies CSSProperties,

  clientRows: {
    display: 'grid',
    gap: '1px',
    marginTop: '22px',
  } satisfies CSSProperties,

  clientRow: {
    display: 'grid',
    gridTemplateColumns: '34px minmax(120px, 1fr) 46px 70px 92px',
    alignItems: 'center',
    minHeight: '42px',
    padding: '0 8px',
    background: '#171717',
    color: '#bcbcbc',
    fontSize: '12px',
  } satisfies CSSProperties,

  activeClientRow: {
    background: '#C0FF01',
    color: '#111111',
  } satisfies CSSProperties,

  productBars: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: '4px',
    minHeight: '260px',
    marginTop: '24px',
  } satisfies CSSProperties,

  productBar: {
    display: 'grid',
    alignItems: 'end',
    width: '64px',
    padding: '0 8px 12px',
    color: '#111111',
    fontSize: '13px',
  } satisfies CSSProperties,

  dateBars: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: '16px',
    minHeight: '170px',
    marginTop: '24px',
    padding: '0 6px',
  } satisfies CSSProperties,

  dateBar: {
    width: '3px',
    background: '#ffffff',
  } satisfies CSSProperties,
};
