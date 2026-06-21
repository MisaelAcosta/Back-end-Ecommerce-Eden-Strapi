import type { CSSProperties } from 'react';

const pageStyles = {
  minHeight: '100vh',
  background: '#000000',
} satisfies CSSProperties;

const MetricsPage = () => {
  return <main style={pageStyles} aria-label="Metricas" />;
};

export default MetricsPage;
