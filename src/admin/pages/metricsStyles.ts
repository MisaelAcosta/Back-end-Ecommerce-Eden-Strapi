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

  goalAddButton: {
    display: 'inline-grid',
    placeItems: 'center',
    width: '26px',
    height: '26px',
    border: 0,
    background: 'transparent',
    color: '#ffffff',
    fontSize: '18px',
    cursor: 'pointer',
  } satisfies CSSProperties,

  goalEditor: {
    display: 'grid',
    gap: '10px',
    alignContent: 'start',
  } satisfies CSSProperties,

  goalEditorRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 0.7fr',
    gap: '8px',
  } satisfies CSSProperties,

  goalEditorLabel: {
    display: 'grid',
    gap: '5px',
    color: '#8d8d8d',
    fontSize: '11px',
  } satisfies CSSProperties,

  goalEditorInput: {
    width: '100%',
    height: '31px',
    border: '1px solid #303030',
    background: '#0b0b0b',
    color: '#ffffff',
    padding: '0 9px',
    boxSizing: 'border-box',
    fontSize: '12px',
    outline: 'none',
  } satisfies CSSProperties,

  goalSaveButton: {
    justifySelf: 'end',
    minWidth: '112px',
    height: '32px',
    border: 0,
    background: '#C0FF01',
    color: '#111111',
    padding: '0 12px',
    fontSize: '12px',
    cursor: 'pointer',
  } satisfies CSSProperties,

  clientsBlock: {
    ...blockBase,
    gridColumn: '2',
    gridRow: '1 / 3',
    padding: '22px',
    overflow: 'hidden',
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

  comparisonTopLine: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    height: '7px',
    marginTop: '52px',
  } satisfies CSSProperties,

  comparisonTopCurrent: {
    background: '#C0FF01',
  } satisfies CSSProperties,

  comparisonTopPrevious: {
    background: '#0b3a1e',
  } satisfies CSSProperties,

  comparisonMetricsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '32px',
    marginTop: '10px',
    color: '#a8a8a8',
    fontSize: '13px',
  } satisfies CSSProperties,

  comparisonRevenueBar: {
    display: 'flex',
    width: '100%',
    minHeight: '76px',
    marginTop: '58px',
    background: '#0b3a1e',
    overflow: 'hidden',
  } satisfies CSSProperties,

  comparisonRevenueCurrent: {
    position: 'relative',
    display: 'grid',
    alignItems: 'end',
    justifyItems: 'end',
    minWidth: '0%',
    background: '#C0FF01',
    color: '#111111',
    padding: '0 12px 12px',
    boxSizing: 'border-box',
    textTransform: 'capitalize',
    transition: 'width 180ms ease',
  } satisfies CSSProperties,

  comparisonRevenuePrevious: {
    display: 'grid',
    alignItems: 'end',
    justifyItems: 'end',
    minWidth: '0%',
    background: '#0b3a1e',
    color: '#cfcfcf',
    padding: '0 12px 12px',
    boxSizing: 'border-box',
    textTransform: 'capitalize',
    transition: 'width 180ms ease',
  } satisfies CSSProperties,

  blockHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '16px',
  } satisfies CSSProperties,

  chartFrame: {
    position: 'relative',
    minHeight: '280px',
    marginTop: '8px',
  } satisfies CSSProperties,

  clientRows: {
    display: 'grid',
    gap: '1px',
    marginTop: '22px',
  } satisfies CSSProperties,

  clientRow: {
    display: 'grid',
    gridTemplateColumns: '34px minmax(0, 1fr) 42px 72px 82px',
    alignItems: 'center',
    minHeight: '42px',
    padding: '0 8px',
    background: '#171717',
    color: '#bcbcbc',
    fontSize: '12px',
    gap: '8px',
  } satisfies CSSProperties,

  activeClientRow: {
    background: '#C0FF01',
    color: '#111111',
  } satisfies CSSProperties,

  clientEmail: {
    display: 'block',
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  } satisfies CSSProperties,

  clientInfoButton: {
    border: 0,
    background: 'transparent',
    color: '#6f6f6f',
    padding: 0,
    textAlign: 'left',
    fontSize: '11px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  } satisfies CSSProperties,

  clientInfoButtonActive: {
    color: '#111111',
  } satisfies CSSProperties,

  clientSummary: {
    marginTop: '16px',
    borderTop: '1px solid #2e2e2e',
    paddingTop: '12px',
  } satisfies CSSProperties,

  clientSummaryHeader: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) auto',
    alignItems: 'center',
    gap: '12px',
    color: '#C0FF01',
    fontSize: '12px',
  } satisfies CSSProperties,

  clientSummaryEmail: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  } satisfies CSSProperties,

  clientSummaryBody: {
    display: 'grid',
    gap: '8px',
    maxHeight: '150px',
    marginTop: '10px',
    overflowY: 'auto',
    paddingRight: '4px',
  } satisfies CSSProperties,

  clientOrderCard: {
    background: '#101010',
    border: '1px solid #272727',
    padding: '9px',
  } satisfies CSSProperties,

  clientOrderHeader: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) 72px auto',
    gap: '10px',
    color: '#ffffff',
    fontSize: '11px',
  } satisfies CSSProperties,

  clientProductList: {
    display: 'grid',
    gap: '5px',
    marginTop: '8px',
  } satisfies CSSProperties,

  clientProductLine: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) 34px 70px',
    gap: '8px',
    color: '#9b9b9b',
    fontSize: '11px',
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
    gap: '10px',
    minHeight: '210px',
    marginTop: '30px',
    padding: '0 6px',
  } satisfies CSSProperties,

  dateBar: {
    width: '4px',
    background: '#ffffff',
  } satisfies CSSProperties,
};
