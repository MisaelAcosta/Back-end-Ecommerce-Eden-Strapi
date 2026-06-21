import type { CSSProperties } from 'react';

const pageStyles = {
  minHeight: '100vh',
  background: '#000000',
} satisfies CSSProperties;

const WarehousePage = () => {
  return <main style={pageStyles} aria-label="Bodega" />;
};

export default WarehousePage;
