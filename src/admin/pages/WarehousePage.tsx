import { type ChangeEvent, useEffect, useMemo, useState } from 'react';
import { useFetchClient } from '@strapi/admin/strapi-admin';
import { ChevronLeft, ChevronRight, Copy, Mail, Save, Search, Send, SquarePen, Upload } from 'lucide-react';

type WarehouseCategory = {
  id: number;
  documentId?: string;
  name: string;
  slug?: string | null;
};

type WarehouseVariant = {
  id: number;
  documentId?: string;
  name: string;
  price: number;
  imageUrl?: string | null;
  bodega?: WarehouseBodegaRow | null;
  stock?: number | null;
  sku?: string | null;
  product?: {
    id?: number;
    documentId?: string;
    name?: string | null;
    imageUrl?: string | null;
  } | null;
  category?: WarehouseCategory | null;
};

type WarehouseBodegaRow = {
  id: number;
  documentId?: string;
  materialGrams: number;
  printTimeHours: number;
  printTimeLabel: string;
  materialCost: number;
  lightCost: number;
  boxCost: number;
  paintCost: number;
  flowCost: number;
  totalCost: number;
  price: number;
  returnAmount: number;
};

type WarehouseResponse = {
  data: {
    categories: WarehouseCategory[];
    variants: WarehouseVariant[];
  };
};

type SaveWarehouseRowResponse = {
  data: WarehouseVariant;
};

type MailboxRecipient = {
  id: number;
  documentId?: string;
  email: string;
  name?: string;
  isSubscribed: boolean;
};

type MailboxRecipientsResponse = {
  data: MailboxRecipient[];
};

type MailboxSendResponse = {
  data: {
    scheduled: boolean;
    scheduledAt?: string;
    total: number;
  };
};

type EditableVariantFields = {
  materialGrams: string;
  printTime: string;
  materialCost: string;
  lightCost: string;
  boxCost: string;
  paintCost: string;
};

type EditableCellProps = {
  color?: string;
  isEditing: boolean;
  onChange: (value: string) => void;
  value: string;
};

const numberFormatter = new Intl.NumberFormat('es-CL', {
  maximumFractionDigits: 0,
});

const formatPrice = (value?: number | null) => numberFormatter.format(Number(value || 0));

const VARIANTS_PER_PAGE = 10;
const FILAMENT_PRICE_PER_KG = 12000;
const RESIN_PRICE_PER_LITER = 19000;
const BAMBU_A1_AVERAGE_WATTS = 150;
const ENEL_SANTIAGO_CLP_PER_KWH = 220;
const MAILBOX_VISIBLE_DAYS = 7;
const FLOW_FEE_RATE = 0.0319;

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

const weekdayNames = ['Dom.', 'Lun.', 'Mar.', 'Mier.', 'Juev.', 'Vier.', 'Sab.'];

const emptyEditableFields: EditableVariantFields = {
  materialGrams: '',
  printTime: '',
  materialCost: '',
  lightCost: '',
  boxCost: '',
  paintCost: '',
};

const toInputValue = (value?: number | null) => (value ? String(value) : '');

const toEditableFields = (bodega?: WarehouseBodegaRow | null): EditableVariantFields => ({
  materialGrams: toInputValue(bodega?.materialGrams),
  printTime: bodega?.printTimeLabel || toInputValue(bodega?.printTimeHours),
  materialCost: toInputValue(bodega?.materialCost),
  lightCost: toInputValue(bodega?.lightCost),
  boxCost: toInputValue(bodega?.boxCost),
  paintCost: toInputValue(bodega?.paintCost),
});

const parseTableNumber = (value: string) => {
  const normalizedValue = value.replace(/\./g, '').replace(',', '.').trim();
  const numberValue = Number(normalizedValue);

  return Number.isFinite(numberValue) ? numberValue : 0;
};

const getVariantCosts = (draft: EditableVariantFields, price: number) => {
  const materialCost = Math.round(parseTableNumber(draft.materialCost));
  const lightCost = Math.round(parseTableNumber(draft.lightCost));
  const boxCost = Math.round(parseTableNumber(draft.boxCost));
  const paintCost = Math.round(parseTableNumber(draft.paintCost));
  const flowCost = Math.round(Number(price || 0) * FLOW_FEE_RATE);
  const totalCost = materialCost + lightCost + boxCost + paintCost + flowCost;

  return {
    materialCost,
    lightCost,
    boxCost,
    paintCost,
    flowCost,
    totalCost,
    returnAmount: Math.round(Number(price || 0)) - totalCost,
  };
};

const getVariantUniqueKey = (variant: WarehouseVariant) =>
  variant.documentId || variant.sku || `${variant.product?.documentId || variant.product?.id || 'product'}-${variant.name}`;

const dedupeVariants = (items: WarehouseVariant[]) => {
  const variantsByKey = new Map<string, WarehouseVariant>();

  items.forEach((variant) => {
    variantsByKey.set(getVariantUniqueKey(variant), variant);
  });

  return Array.from(variantsByKey.values());
};

const toDateInputValue = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const toMailboxTimeValue = (date: Date) =>
  `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

const buildScheduledDate = (dateValue: string, timeValue: string) => new Date(`${dateValue}T${timeValue || '00:00'}:00`);

const getSafeMonthDate = (dateValue: string, nextYear: number, nextMonth: number) => {
  const currentDate = new Date(`${dateValue}T00:00:00`);
  const maxDay = new Date(nextYear, nextMonth + 1, 0).getDate();
  const nextDate = new Date(nextYear, nextMonth, Math.min(currentDate.getDate(), maxDay));

  return toDateInputValue(nextDate);
};

const WarehousePage = () => {
  const { get, post } = useFetchClient();
  const [categories, setCategories] = useState<WarehouseCategory[]>([]);
  const [variants, setVariants] = useState<WarehouseVariant[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [editingVariantKey, setEditingVariantKey] = useState<string | null>(null);
  const [variantDrafts, setVariantDrafts] = useState<Record<string, EditableVariantFields>>({});
  const [savingVariantKey, setSavingVariantKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadWarehouse = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await get<WarehouseResponse>('/order-dashboard/warehouse');
        const nextCategories = response.data.data.categories || [];
        const nextVariants = response.data.data.variants || [];

        if (!isMounted) return;

        setCategories(nextCategories);
        setVariants(nextVariants);
        setVariantDrafts(
          nextVariants.reduce<Record<string, EditableVariantFields>>((drafts, variant) => {
            drafts[getVariantUniqueKey(variant)] = toEditableFields(variant.bodega);

            return drafts;
          }, {})
        );
        setActiveCategoryId((currentCategoryId) => currentCategoryId ?? nextCategories[0]?.id ?? null);
      } catch (err) {
        if (!isMounted) return;

        setError(err instanceof Error ? err.message : 'No se pudo cargar bodega.');
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadWarehouse();

    return () => {
      isMounted = false;
    };
  }, [get]);

  const activeVariants = useMemo(() => {
    if (!activeCategoryId) {
      return [];
    }

    return dedupeVariants(variants.filter((variant) => variant.category?.id === activeCategoryId));
  }, [activeCategoryId, variants]);

  useEffect(() => {
    setCurrentPage(1);
    setEditingVariantKey(null);
  }, [activeCategoryId]);

  const pageCount = Math.max(Math.ceil(activeVariants.length / VARIANTS_PER_PAGE), 1);
  const visibleVariants = activeVariants.slice((currentPage - 1) * VARIANTS_PER_PAGE, currentPage * VARIANTS_PER_PAGE);
  const canGoBack = currentPage > 1;
  const canGoNext = currentPage < pageCount;

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, pageCount));
  }, [pageCount]);

  const getVariantDraft = (variant: WarehouseVariant) => {
    const variantKey = getVariantUniqueKey(variant);

    return variantDrafts[variantKey] || emptyEditableFields;
  };

  const updateVariantDraft = (variant: WarehouseVariant, field: keyof EditableVariantFields, value: string) => {
    const variantKey = getVariantUniqueKey(variant);

    setVariantDrafts((currentDrafts) => ({
      ...currentDrafts,
      [variantKey]: {
        ...(currentDrafts[variantKey] || emptyEditableFields),
        [field]: value,
      },
    }));
  };

  const saveVariantDraft = async (variant: WarehouseVariant) => {
    const variantKey = getVariantUniqueKey(variant);
    const draft = getVariantDraft(variant);
    const costs = getVariantCosts(draft, variant.price);

    setSavingVariantKey(variantKey);
    setError(null);

    try {
      const response = await post<SaveWarehouseRowResponse>(
        `/order-dashboard/warehouse/${encodeURIComponent(variant.documentId || String(variant.id))}`,
        {
          materialGrams: parseTableNumber(draft.materialGrams),
          printTimeHours: parsePrintHours(draft.printTime),
          printTimeLabel: draft.printTime,
          materialCost: costs.materialCost,
          lightCost: costs.lightCost,
          boxCost: costs.boxCost,
          paintCost: costs.paintCost,
          price: Math.round(Number(variant.price || 0)),
        }
      );
      const savedVariant = response.data.data;

      setVariants((currentVariants) =>
        currentVariants.map((currentVariant) =>
          getVariantUniqueKey(currentVariant) === variantKey ? savedVariant : currentVariant
        )
      );
      setVariantDrafts((currentDrafts) => ({
        ...currentDrafts,
        [variantKey]: toEditableFields(savedVariant.bodega),
      }));
      setEditingVariantKey(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la fila de bodega.');
    } finally {
      setSavingVariantKey(null);
    }
  };

  const toggleVariantEdit = (variant: WarehouseVariant) => {
    const variantKey = getVariantUniqueKey(variant);

    if (editingVariantKey === variantKey) {
      void saveVariantDraft(variant);
      return;
    }

    setVariantDrafts((currentDrafts) => ({
      ...currentDrafts,
      [variantKey]: currentDrafts[variantKey] || emptyEditableFields,
    }));
    setEditingVariantKey(variantKey);
  };

  return (
    <main style={pageStyles} aria-label="Bodega">
      {/* Layout general de BODEGA: columna izquierda con herramientas + bloque derecho con datos.
          Para mover anchos, espacios o centrado principal revisa layoutStyles. */}
      <section style={layoutStyles}>
        {/* Columna izquierda: aqui viven Calculadora y Buzon.
            El gap vertical entre bloques esta en este aside. */}
        <aside style={{ display: 'grid', gap: '14px', alignContent: 'start' }}>
          <CalculatorBlock />
          <MailboxBlock />
        </aside>

        {/* Bloque grande derecho: listado de categorias y tabla de variantes.
            Fondo/borde base salen de blockStyles; alto y padding se ajustan aqui. */}
        <section style={{ ...blockStyles, minHeight: '790px', padding: '34px 44px' }} aria-label="Inventario de bodega">
          {/* Tabs de categorias: se cargan desde Strapi category.
              Cambia alto, color activo o ancho minimo dentro del style del button. */}
          <div style={{ display: 'flex', gap: 0, marginBottom: '28px', flexWrap: 'wrap' }}>
            {categories.map((category) => {
              const isActive = category.id === activeCategoryId;

              return (
                <button
                  key={category.documentId || category.id}
                  onClick={() => setActiveCategoryId(category.id)}
                  style={{
                    minWidth: '86px',
                    height: '42px',
                    border: 0,
                    background: isActive ? '#C0FF01' : '#303030',
                    color: isActive ? '#000000' : '#ffffff',
                    fontSize: '16px',
                    cursor: 'pointer',
                  }}
                  type="button"
                >
                  {category.name}
                </button>
              );
            })}
          </div>

          {isLoading ? (
            <p style={{ color: '#b5b5b5', fontSize: '13px' }}>Cargando bodega...</p>
          ) : error ? (
            <p style={{ color: '#ff4d4f', fontSize: '13px' }}>{error}</p>
          ) : (
            <>
              {/* Tabla principal de datos: mantiene el orden visual del diseno.
                  La primera columna usa ProductNameCell para mostrar foto + nombre sin romper la grilla. */}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ color: '#9c9c9c', textAlign: 'left' }}>
                    {['Nombre', 'G. Mat.', 'T. Imp.', 'C. Mat.', 'C. luz', 'G. Caja', 'Pintura', 'Flow T.', 'Total', 'Precio', 'Retorno', ''].map(
                      (heading) => (
                        <th key={heading} style={{ fontWeight: 400, padding: '0 12px 18px' }}>
                          {heading}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {activeVariants.length === 0 ? (
                    <tr>
                      <td colSpan={12} style={{ border: '1px solid #3f3f3f', color: '#777777', padding: '24px 12px' }}>
                        No hay variantes en esta categoria.
                      </td>
                    </tr>
                  ) : (
                    visibleVariants.map((variant) => {
                      const variantKey = getVariantUniqueKey(variant);
                      const isEditing = editingVariantKey === variantKey;
                      const draft = getVariantDraft(variant);
                      const costs = getVariantCosts(draft, variant.price);
                      const isSaving = savingVariantKey === variantKey;

                      return (
                        <tr key={variantKey}>
                          {/* Columna NOMBRE: foto de variante/producto + nombre.
                              El tamano del thumbnail se controla en productThumbStyles. */}
                          <td style={cellStyles}>
                            <ProductNameCell imageUrl={variant.imageUrl || variant.product?.imageUrl} name={variant.name} />
                          </td>
                          {/* Celdas editables: al tocar el icono pencil cambian de texto a input.
                              Estos valores por ahora quedan en estado local de la pagina. */}
                          <EditableCell
                            color="#ff7a00"
                            isEditing={isEditing}
                            onChange={(value) => updateVariantDraft(variant, 'materialGrams', value)}
                            value={draft.materialGrams}
                          />
                          <EditableCell
                            color="#00a3ff"
                            isEditing={isEditing}
                            onChange={(value) => updateVariantDraft(variant, 'printTime', value)}
                            value={draft.printTime}
                          />
                          <EditableCell
                            isEditing={isEditing}
                            onChange={(value) => updateVariantDraft(variant, 'materialCost', value)}
                            value={draft.materialCost}
                          />
                          <EditableCell
                            isEditing={isEditing}
                            onChange={(value) => updateVariantDraft(variant, 'lightCost', value)}
                            value={draft.lightCost}
                          />
                          <EditableCell
                            isEditing={isEditing}
                            onChange={(value) => updateVariantDraft(variant, 'boxCost', value)}
                            value={draft.boxCost}
                          />
                          <EditableCell
                            isEditing={isEditing}
                            onChange={(value) => updateVariantDraft(variant, 'paintCost', value)}
                            value={draft.paintCost}
                          />
                          <td style={cellStyles}>{formatPrice(costs.flowCost)}</td>
                          {/* Total: suma solo columnas CLP, incluido Flow T.; no gramos ni horas. */}
                          <td style={cellStyles}>{costs.totalCost ? formatPrice(costs.totalCost) : '--'}</td>
                          <td style={cellStyles}>{formatPrice(variant.price)}</td>
                          {/* Retorno: precio menos total de gastos. Este dato tambien se guarda en Bodega. */}
                          <td style={{ ...cellStyles, color: '#C0FF01' }}>
                            {costs.totalCost ? formatPrice(costs.returnAmount) : '--'}
                          </td>
                          {/* Boton de accion por fila: SquarePen edita, Save cierra la edicion. */}
                          <td style={cellStyles}>
                            <button
                              aria-label={isEditing ? 'Guardar datos de variante' : 'Editar datos de variante'}
                              disabled={isSaving}
                              onClick={() => toggleVariantEdit(variant)}
                              style={{
                                ...iconButtonStyles,
                                cursor: isSaving ? 'wait' : 'pointer',
                                opacity: isSaving ? 0.55 : 1,
                              }}
                              type="button"
                            >
                              {isEditing ? <Save size={16} /> : <SquarePen size={16} />}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>

              {activeVariants.length > VARIANTS_PER_PAGE && (
                /* Paginacion visual de la tabla. La cantidad por pagina se cambia en VARIANTS_PER_PAGE. */
                <div style={paginationStyles} aria-label="Paginacion de variantes">
                  <span style={{ color: '#8d8d8d', fontSize: '12px' }}>
                    {visibleVariants.length} de {activeVariants.length} variantes
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      disabled={!canGoBack}
                      onClick={() => setCurrentPage((page) => Math.max(page - 1, 1))}
                      style={getPaginationButtonStyles(!canGoBack)}
                      type="button"
                    >
                      Anterior
                    </button>
                    <span style={{ color: '#ffffff', fontSize: '12px', minWidth: '54px', textAlign: 'center' }}>
                      {currentPage} / {pageCount}
                    </span>
                    <button
                      disabled={!canGoNext}
                      onClick={() => setCurrentPage((page) => Math.min(page + 1, pageCount))}
                      style={getPaginationButtonStyles(!canGoNext)}
                      type="button"
                    >
                      Siguiente
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </section>
    </main>
  );
};

const EditableCell = ({ color = '#ffffff', isEditing, onChange, value }: EditableCellProps) => {
  if (isEditing) {
    return (
      // Modo edicion de cada celda editable de la tabla.
      // El ancho, fondo y borde del input se cambian en tableInputStyles.
      <td style={cellStyles}>
        <input
          onChange={(event) => onChange(event.target.value)}
          style={{ ...tableInputStyles, color }}
          value={value}
        />
      </td>
    );
  }

  return <td style={{ ...cellStyles, color }}>{value || '--'}</td>;
};

const ProductNameCell = ({ imageUrl, name }: { imageUrl?: string | null; name: string }) => (
  // Celda compacta para foto + nombre. Mantiene la imagen fija para no descuadrar filas.
  <div style={productNameCellStyles}>
    <span style={productThumbStyles}>
      {imageUrl ? <img alt="" src={imageUrl} style={productThumbImageStyles} /> : null}
    </span>
    <span>{name}</span>
  </div>
);

const CalculatorBlock = () => {
  const [selectedMaterial, setSelectedMaterial] = useState<'filament' | 'resin'>('filament');
  const [grams, setGrams] = useState('');
  const [time, setTime] = useState('');
  const [copiedResult, setCopiedResult] = useState<'print' | 'electric' | 'total' | null>(null);

  const materialPrice = selectedMaterial === 'filament' ? FILAMENT_PRICE_PER_KG : RESIN_PRICE_PER_LITER;
  const gramsValue = Number(grams.replace(',', '.')) || 0;
  const printHours = parsePrintHours(time);
  const printCost = Math.round((gramsValue / 1000) * materialPrice);
  const electricCost = Math.round(printHours * (BAMBU_A1_AVERAGE_WATTS / 1000) * ENEL_SANTIAGO_CLP_PER_KWH);
  const total = printCost + electricCost;

  const copyCalculatorValue = async (key: 'print' | 'electric' | 'total', value: number) => {
    await navigator.clipboard.writeText(String(value));
    setCopiedResult(key);
    window.setTimeout(() => setCopiedResult(null), 1400);
  };

  return (
    // Bloque CALCULADORA completo.
    // Usa blockStyles como base; el alto/padding propios estan en este section.
    <section style={{ ...blockStyles, minHeight: '320px', padding: '18px' }} aria-label="Calculadora">
      <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 500 }}>Calculadora</h2>
      {/* Grilla interna de la calculadora: izquierda inputs, derecha materiales + resultado. */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.35fr', gap: '22px', marginTop: '18px' }}>
        <div>
          {/* Chips informativos fijos: base de 1kg y maquina usada para el calculo. */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '18px' }}>
            <button style={{ ...inputStyles, width: '64px', cursor: 'default' }} type="button">
              1 kg
            </button>
            <button style={{ ...inputStyles, width: '104px', cursor: 'default' }} type="button">
              Bambu lab A1
            </button>
          </div>
          <p style={{ color: '#9c9c9c', fontSize: '11px', lineHeight: 1.45, margin: '0 0 34px' }}>
            Selecciona el material y luego ingresa el peso de la pieza en gramos y el tiempo de impresion en horas.
          </p>
          {/* Inputs de calculo: Gramos y Tiempo.
              Tiempo acepta formatos como 8, 8.5, 8:30 o 8h 30m. */}
          <div style={{ display: 'grid', gap: '14px' }}>
            <input
              inputMode="decimal"
              onChange={(event) => setGrams(event.target.value)}
              style={inputStyles}
              placeholder="Gramos"
              value={grams}
            />
            <input
              onChange={(event) => setTime(event.target.value)}
              style={inputStyles}
              placeholder="Tiempo"
              value={time}
            />
          </div>
        </div>
        <div>
          {/* Tarjetas de material. La imagen de resina cambia a botella_gris cuando no esta activa. */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '32px' }}>
            <MaterialCard
              image="/carrete.png"
              isActive={selectedMaterial === 'filament'}
              label="Filamento"
              name="Pla"
              onClick={() => setSelectedMaterial('filament')}
              price={FILAMENT_PRICE_PER_KG}
            />
            <MaterialCard
              image={selectedMaterial === 'resin' ? '/botella.png' : '/botella_gris.png'}
              isActive={selectedMaterial === 'resin'}
              label="Resina"
              name="Normal"
              onClick={() => setSelectedMaterial('resin')}
              price={RESIN_PRICE_PER_LITER}
            />
          </div>
          {/* Resultado calculado: costo de material, costo electrico y total copiable. */}
          <div style={{ display: 'grid', gap: '18px', color: '#cfcfcf', fontSize: '11px' }}>
            <div>Resultado</div>
            <ResultRow
              copied={copiedResult === 'print'}
              label="Cost. Impr."
              numericValue={printCost}
              onCopy={() => copyCalculatorValue('print', printCost)}
              value={formatPrice(printCost)}
            />
            <ResultRow
              copied={copiedResult === 'electric'}
              label="Cost. Elec."
              numericValue={electricCost}
              onCopy={() => copyCalculatorValue('electric', electricCost)}
              value={formatPrice(electricCost)}
            />
            <div style={calculatorTotalStyles}>
              <span>Total</span>
              <span>{formatPrice(total)}</span>
              {/* Boton copiar total: muestra texto Copiado debajo del total cuando se usa. */}
              <button
                aria-label="Copiar total"
                disabled={total <= 0}
                onClick={() => copyCalculatorValue('total', total)}
                style={{
                  ...calculatorCopyButtonStyles,
                  cursor: total > 0 ? 'pointer' : 'not-allowed',
                  opacity: total > 0 ? 1 : 0.35,
                }}
                type="button"
              >
                <Copy size={14} />
              </button>
              {copiedResult === 'total' && <span style={copiedTotalStyles}>Copiado</span>}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

const ResultRow = ({
  copied,
  label,
  numericValue,
  onCopy,
  value,
}: {
  copied: boolean;
  label: string;
  numericValue: number;
  onCopy: () => void;
  value: string;
}) => (
  // Fila simple de resultado dentro de la calculadora.
  // La linea divisoria se controla con borderBottom aqui.
  <div style={calculatorResultRowStyles}>
    <span>{label}</span>
    <span>{value}</span>
    <button
      aria-label={`Copiar ${label}`}
      disabled={numericValue <= 0}
      onClick={onCopy}
      style={{
        ...calculatorCopyButtonStyles,
        cursor: numericValue > 0 ? 'pointer' : 'not-allowed',
        opacity: numericValue > 0 ? 1 : 0.35,
      }}
      type="button"
    >
      <Copy size={14} />
    </button>
    {copied && <span style={copiedResultRowStyles}>Copiado</span>}
  </div>
);

const MaterialCard = ({
  image,
  isActive,
  label,
  name,
  onClick,
  price,
}: {
  image: string;
  isActive: boolean;
  label: string;
  name: string;
  onClick: () => void;
  price: number;
}) => (
  // Tarjeta visual de material: borde verde cuando esta seleccionada.
  // Imagen, puntos superiores y precio se ordenan con materialCardStyles.
  <button
    onClick={onClick}
    style={{
      ...materialCardStyles,
      borderColor: isActive ? '#C0FF01' : '#4a4a4a',
    }}
    type="button"
  >
    <span style={{ fontSize: '11px', color: '#ffffff' }}>{label}</span>
    {/* Tres puntos superiores de la tarjeta. El primer punto usa el verde de marca. */}
    <span style={materialDotsStyles}>
      {[0, 1, 2].map((dot) => (
        <span
          key={dot}
          style={{
            ...materialDotStyles,
            background: dot === 0 ? '#C0FF01' : '#d9d9d9',
          }}
        />
      ))}
    </span>
    <img alt="" src={image} style={materialImageStyles} />
    <span style={{ color: '#ffffff' }}>{name}</span>
    <span style={{ color: '#C0FF01' }}>{formatPrice(price)}</span>
  </button>
);

const parsePrintHours = (value: string) => {
  // Convierte el tiempo del laminador a horas decimales para calcular electricidad.
  // Acepta numero directo, horas con h/m y formato reloj.
  const normalizedValue = value.trim().toLowerCase().replace(',', '.');

  if (!normalizedValue) return 0;

  const hoursAndMinutes = normalizedValue.match(/^(\d+(?:\.\d+)?)\s*h(?:oras?)?\s*(\d+)?\s*m?/);

  if (hoursAndMinutes) {
    return Number(hoursAndMinutes[1]) + Number(hoursAndMinutes[2] || 0) / 60;
  }

  const clockTime = normalizedValue.match(/^(\d+):(\d{1,2})$/);

  if (clockTime) {
    return Number(clockTime[1]) + Number(clockTime[2]) / 60;
  }

  return Number(normalizedValue) || 0;
};

const MailboxBlock = () => {
  const { get, post } = useFetchClient();
  const now = useMemo(() => new Date(), []);
  const [recipients, setRecipients] = useState<MailboxRecipient[]>([]);
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<number[]>([]);
  const [activeList, setActiveList] = useState<'subscribed' | 'clients'>('clients');
  const [searchValue, setSearchValue] = useState('');
  const [selectedDate, setSelectedDate] = useState(toDateInputValue(now));
  const [visibleStartDate, setVisibleStartDate] = useState(toDateInputValue(now));
  const [selectedTime, setSelectedTime] = useState(toMailboxTimeValue(now));
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
  const [subject, setSubject] = useState('Promocion Eden');
  const [htmlContent, setHtmlContent] = useState('');
  const [fileName, setFileName] = useState('');
  const [selectionMode, setSelectionMode] = useState('Seleccionados');
  const [isLoadingRecipients, setIsLoadingRecipients] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [mailboxMessage, setMailboxMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadRecipients = async () => {
      setIsLoadingRecipients(true);

      try {
        const response = await get<MailboxRecipientsResponse>('/order-dashboard/mailbox/recipients');

        if (isMounted) {
          setRecipients(response.data.data || []);
        }
      } catch (err) {
        if (isMounted) {
          setMailboxMessage(err instanceof Error ? err.message : 'No se pudieron cargar los clientes.');
        }
      } finally {
        if (isMounted) {
          setIsLoadingRecipients(false);
        }
      }
    };

    loadRecipients();

    return () => {
      isMounted = false;
    };
  }, [get]);

  const subscribedRecipients = useMemo(() => recipients.filter((recipient) => recipient.isSubscribed), [recipients]);
  const visibleRecipients = useMemo(() => {
    const source = activeList === 'subscribed' ? subscribedRecipients : recipients;
    const query = searchValue.trim().toLowerCase();

    if (!query) return source;

    return source.filter((recipient) =>
      [recipient.email, recipient.name].some((value) => String(value || '').toLowerCase().includes(query))
    );
  }, [activeList, recipients, searchValue, subscribedRecipients]);
  const selectedSet = useMemo(() => new Set(selectedRecipientIds), [selectedRecipientIds]);
  const allVisibleSelected =
    visibleRecipients.length > 0 && visibleRecipients.every((recipient) => selectedSet.has(recipient.id));
  const scheduledDate = buildScheduledDate(selectedDate, selectedTime);
  const calendarStart = useMemo(() => {
    const start = new Date(`${visibleStartDate}T00:00:00`);
    start.setHours(0, 0, 0, 0);

    return start;
  }, [visibleStartDate]);
  const calendarDays = useMemo(
    () =>
      Array.from({ length: MAILBOX_VISIBLE_DAYS }, (_, index) => {
        const date = new Date(calendarStart);
        date.setDate(calendarStart.getDate() + index);

        return date;
      }),
    [calendarStart]
  );

  const toggleRecipient = (recipientId: number) => {
    setSelectionMode('Seleccionados');
    setSelectedRecipientIds((currentIds) =>
      currentIds.includes(recipientId)
        ? currentIds.filter((currentId) => currentId !== recipientId)
        : [...currentIds, recipientId]
    );
  };

  const changeSelectedYear = (yearDelta: number) => {
    const date = new Date(`${selectedDate}T00:00:00`);
    const nextDate = getSafeMonthDate(selectedDate, date.getFullYear() + yearDelta, date.getMonth());

    setSelectedDate(nextDate);
    setVisibleStartDate(nextDate);
  };

  const selectMonth = (monthIndex: number) => {
    const nextDate = getSafeMonthDate(selectedDate, new Date(`${selectedDate}T00:00:00`).getFullYear(), monthIndex);

    setSelectedDate(nextDate);
    setVisibleStartDate(nextDate);
    setIsMonthPickerOpen(false);
  };

  const selectDay = (dateValue: string) => {
    setSelectedDate(dateValue);
  };

  const shiftVisibleDays = (dayDelta: number) => {
    setVisibleStartDate((currentDate) => {
      const date = new Date(`${currentDate}T00:00:00`);
      date.setDate(date.getDate() + dayDelta);

      return toDateInputValue(date);
    });
  };

  const selectGroup = (group: 'all' | 'visible' | 'subscribed' | 'clients') => {
    const groupRecipients =
      group === 'all' ? recipients : group === 'visible' ? visibleRecipients : group === 'subscribed' ? subscribedRecipients : recipients;
    const nextSelectionMode =
      group === 'all'
        ? 'Todos'
        : group === 'visible'
          ? 'Seleccionar todos'
          : group === 'subscribed'
            ? 'Suscritos'
            : 'Clientes';

    setSelectionMode(nextSelectionMode);
    setSelectedRecipientIds((currentIds) =>
      Array.from(new Set([...currentIds, ...groupRecipients.map((recipient) => recipient.id)]))
    );
  };

  const toggleVisibleSelection = () => {
    if (allVisibleSelected) {
      const visibleIds = new Set(visibleRecipients.map((recipient) => recipient.id));
      setSelectionMode('Seleccionados');
      setSelectedRecipientIds((currentIds) => currentIds.filter((id) => !visibleIds.has(id)));
      return;
    }

    selectGroup('visible');
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) return;

    setFileName(file.name);
    setHtmlContent(await file.text());
    setMailboxMessage(null);
  };

  const sendCampaign = async () => {
    setIsSending(true);
    setMailboxMessage(null);

    try {
      const response = await post<MailboxSendResponse>('/order-dashboard/mailbox/send', {
        subject,
        html: htmlContent,
        recipientIds: selectedRecipientIds,
        scheduledAt: scheduledDate.toISOString(),
        scheduledDateValue: selectedDate,
        scheduledTime: selectedTime,
        audienceTab: activeList,
        selectionMode,
        fileName,
      });
      const result = response.data.data;

      setMailboxMessage(
        result.scheduled
          ? `Programado para ${scheduledDate.toLocaleString('es-CL')} (${result.total} correos).`
          : `Correo enviado a ${result.total} cliente(s).`
      );
    } catch (err) {
      setMailboxMessage(err instanceof Error ? err.message : 'No se pudo enviar el correo.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <section style={{ ...blockStyles, minHeight: '430px', padding: '18px' }} aria-label="Buzon">
      <div style={mailboxHeaderStyles}>
        <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 500 }}>Buzon</h2>
        <span style={mailboxMonthStyles}>{monthNames[scheduledDate.getMonth()]}</span>
      </div>

      <div style={mailboxScheduleStyles}>
        <span style={mailboxScheduleLabelStyles}>
          Dia {!isMonthPickerOpen && <span style={{ color: '#C0FF01' }}>•</span>}
        </span>
        <button onClick={() => setIsMonthPickerOpen((isOpen) => !isOpen)} style={mailboxMonthButtonStyles} type="button">
          Mes {isMonthPickerOpen && <span style={{ color: '#C0FF01' }}>•</span>}
        </button>
        <div style={mailboxYearControlStyles}>
          <button onClick={() => changeSelectedYear(-1)} style={mailboxArrowButtonStyles} type="button">
            <ChevronLeft size={14} />
          </button>
          <span>{scheduledDate.getFullYear()}</span>
          <button onClick={() => changeSelectedYear(1)} style={mailboxArrowButtonStyles} type="button">
            <ChevronRight size={14} />
          </button>
        </div>
        <label style={mailboxTimeLabelStyles}>
          Hora
          <input onChange={(event) => setSelectedTime(event.target.value)} style={mailboxTimeInputStyles} type="time" value={selectedTime} />
        </label>
      </div>

      {isMonthPickerOpen && (
        <div style={mailboxMonthsRowStyles}>
          {monthNames.map((monthName, monthIndex) => {
            const isActive = monthIndex === scheduledDate.getMonth();

            return (
              <button
                key={monthName}
                onClick={() => selectMonth(monthIndex)}
                style={{
                  ...mailboxMonthChipStyles,
                  borderColor: isActive ? '#C0FF01' : '#4d4d4d',
                  color: isActive ? '#ffffff' : '#cfcfcf',
                }}
                type="button"
              >
                {monthName.slice(0, 3)}
              </button>
            );
          })}
        </div>
      )}

      <div style={mailboxDaysRowStyles}>
        <button onClick={() => shiftVisibleDays(-MAILBOX_VISIBLE_DAYS)} style={mailboxDayNavButtonStyles} type="button">
          <ChevronLeft size={20} />
        </button>
        {calendarDays.map((date) => {
          const dateValue = toDateInputValue(date);
          const isActive = dateValue === selectedDate;

          return (
            <button
              key={dateValue}
              onClick={() => selectDay(dateValue)}
              style={{
                ...mailboxDayButtonStyles,
                borderColor: isActive ? '#C0FF01' : '#4d4d4d',
              }}
              type="button"
            >
              <span style={{ color: isActive ? '#C0FF01' : '#d7d7d7', fontSize: '13px', lineHeight: 1 }}>•</span>
              <span style={{ fontSize: '10px', color: '#a5a5a5' }}>{weekdayNames[date.getDay()]}</span>
              <span>{String(date.getDate()).padStart(2, '0')}</span>
            </button>
          );
        })}
        <button onClick={() => shiftVisibleDays(MAILBOX_VISIBLE_DAYS)} style={mailboxDayNavButtonStyles} type="button">
          <ChevronRight size={20} />
        </button>
      </div>

      <div style={mailboxTableStyles}>
        <div style={mailboxTabsStyles}>
          <button onClick={() => setActiveList('subscribed')} style={getMailboxTabStyles(activeList === 'subscribed')} type="button">
            Suscritos {activeList === 'subscribed' && <span style={{ color: '#C0FF01' }}>•</span>}
          </button>
          <button onClick={() => setActiveList('clients')} style={getMailboxTabStyles(activeList === 'clients')} type="button">
            Clientes {activeList === 'clients' && <span style={{ color: '#C0FF01' }}>•</span>}
          </button>
          <label style={mailboxSearchStyles}>
            <Search size={13} />
            <input
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder="Buscar"
              style={mailboxSearchInputStyles}
              value={searchValue}
            />
          </label>
          <button onClick={() => selectGroup('all')} style={mailboxAllButtonStyles} type="button">
            Todos <span style={mailboxSquareStyles} />
          </button>
        </div>

        <div style={mailboxSummaryStyles}>
          <button onClick={toggleVisibleSelection} style={mailboxSelectAllStyles} type="button">
            Seleccionar todos <span style={mailboxTinyCheckStyles}>{allVisibleSelected ? '■' : '□'}</span>
          </button>
          <span>Total {visibleRecipients.length}</span>
        </div>

        <div style={mailboxRowsStyles}>
          {isLoadingRecipients ? (
            <p style={mailboxEmptyStyles}>Cargando clientes...</p>
          ) : visibleRecipients.length === 0 ? (
            <p style={mailboxEmptyStyles}>No hay clientes para mostrar.</p>
          ) : (
            visibleRecipients.map((recipient, index) => (
              <label key={recipient.id} style={mailboxRecipientRowStyles}>
                <span style={mailboxRecipientIndexStyles}>{String(index + 1).padStart(2, '0')}</span>
                <span style={mailboxRecipientEmailStyles} title={recipient.email}>
                  {recipient.email}
                </span>
                <input
                  checked={selectedSet.has(recipient.id)}
                  onChange={() => toggleRecipient(recipient.id)}
                  style={mailboxCheckboxStyles}
                  type="checkbox"
                />
              </label>
            ))
          )}
        </div>
      </div>

      <input accept=".html,.htm,text/html" id="mailbox-html-file" onChange={handleFileChange} style={{ display: 'none' }} type="file" />
      <div style={mailboxFooterStyles}>
        <label htmlFor="mailbox-html-file" style={mailboxFileButtonStyles}>
          <Upload size={14} />
          <span>
            Seleccionar archivo
            <small style={mailboxFileNameStyles}>{fileName || 'archivo.html'}</small>
          </span>
        </label>
        <input onChange={(event) => setSubject(event.target.value)} placeholder="Asunto" style={mailboxSubjectStyles} value={subject} />
        <button
          disabled={isSending || selectedRecipientIds.length === 0 || !htmlContent}
          onClick={sendCampaign}
          style={{
            ...mailboxSendButtonStyles,
            cursor: isSending || selectedRecipientIds.length === 0 || !htmlContent ? 'not-allowed' : 'pointer',
            opacity: isSending || selectedRecipientIds.length === 0 || !htmlContent ? 0.45 : 1,
          }}
          type="button"
        >
          {isSending ? <Mail size={14} /> : <Send size={14} />}
          Enviar
        </button>
      </div>
      {mailboxMessage && <p style={mailboxMessageStyles}>{mailboxMessage}</p>}
    </section>
  );
};

const mailboxHeaderStyles = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  color: '#d8d8d8',
} as const;

const mailboxMonthStyles = {
  fontSize: '18px',
  color: '#eeeeee',
} as const;

const mailboxScheduleStyles = {
  display: 'grid',
  gridTemplateColumns: '70px 50px 126px 96px',
  alignItems: 'center',
  gap: '8px',
  marginTop: '22px',
  color: '#eeeeee',
  fontSize: '12px',
} as const;

const mailboxScheduleLabelStyles = {
  paddingLeft: '14px',
} as const;

const mailboxMonthButtonStyles = {
  height: '28px',
  border: 0,
  background: 'transparent',
  color: '#eeeeee',
  fontSize: '12px',
  textAlign: 'left',
  cursor: 'pointer',
} as const;

const mailboxYearControlStyles = {
  display: 'grid',
  gridTemplateColumns: '24px 1fr 24px',
  alignItems: 'center',
  justifyItems: 'center',
  height: '28px',
  width: '126px',
  background: '#4a4a4a',
  color: '#ededed',
} as const;

const mailboxArrowButtonStyles = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '24px',
  height: '28px',
  border: 0,
  background: 'transparent',
  color: '#cfcfcf',
  cursor: 'pointer',
} as const;

const mailboxTimeLabelStyles = {
  display: 'grid',
  gridTemplateColumns: 'auto 1fr',
  alignItems: 'center',
  gap: '8px',
  justifySelf: 'start',
} as const;

const mailboxTimeInputStyles = {
  width: '64px',
  height: '28px',
  border: '1px solid #3b3b3b',
  background: '#202020',
  color: '#ffffff',
  fontSize: '11px',
  padding: '0 4px',
  boxSizing: 'border-box',
} as const;

const mailboxMonthsRowStyles = {
  display: 'grid',
  gridTemplateColumns: 'repeat(6, 1fr)',
  gap: '8px',
  marginTop: '12px',
} as const;

const mailboxMonthChipStyles = {
  height: '34px',
  border: '1px solid #4d4d4d',
  borderRadius: '6px',
  background: '#303030',
  color: '#cfcfcf',
  fontSize: '11px',
  textTransform: 'capitalize',
  cursor: 'pointer',
} as const;

const mailboxDaysRowStyles = {
  display: 'grid',
  gridTemplateColumns: `22px repeat(${MAILBOX_VISIBLE_DAYS}, minmax(0, 1fr)) 22px`,
  alignItems: 'center',
  gap: '8px',
  marginTop: '16px',
} as const;

const mailboxDayNavButtonStyles = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '22px',
  height: '78px',
  border: 0,
  background: 'transparent',
  color: '#d8d8d8',
  fontSize: '18px',
  cursor: 'pointer',
} as const;

const mailboxDayButtonStyles = {
  display: 'grid',
  justifyItems: 'center',
  alignContent: 'center',
  gap: '6px',
  height: '78px',
  border: '1px solid #4d4d4d',
  borderRadius: '8px',
  background: '#4a4a4a',
  color: '#ffffff',
  fontSize: '12px',
  cursor: 'pointer',
} as const;

const mailboxTableStyles = {
  marginTop: '26px',
  border: '1px solid #3b3b3b',
  minHeight: '200px',
  background: '#151515',
} as const;

const mailboxTabsStyles = {
  display: 'grid',
  gridTemplateColumns: '96px 84px minmax(0, 1fr) 82px',
  alignItems: 'center',
  gap: '4px',
  minHeight: '38px',
  borderBottom: '1px solid #3b3b3b',
  padding: '0 10px',
} as const;

const getMailboxTabStyles = (isActive: boolean) =>
  ({
    border: 0,
    background: 'transparent',
    color: isActive ? '#ffffff' : '#c8c8c8',
    fontSize: '12px',
    textAlign: 'left',
    cursor: 'pointer',
  }) as const;

const mailboxSearchStyles = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  color: '#8e8e8e',
} as const;

const mailboxSearchInputStyles = {
  width: '100%',
  height: '28px',
  border: 0,
  background: 'transparent',
  color: '#ffffff',
  fontSize: '12px',
  outline: 'none',
} as const;

const mailboxAllButtonStyles = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: '8px',
  border: 0,
  background: 'transparent',
  color: '#dedede',
  fontSize: '12px',
  cursor: 'pointer',
} as const;

const mailboxSquareStyles = {
  width: '12px',
  height: '12px',
  border: '1px solid #86b600',
  background: '#2e3f00',
} as const;

const mailboxSummaryStyles = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '16px',
  padding: '10px 16px 4px',
  color: '#cfcfcf',
  fontSize: '11px',
} as const;

const mailboxSelectAllStyles = {
  border: 0,
  background: 'transparent',
  color: '#d8d8d8',
  fontSize: '11px',
  cursor: 'pointer',
} as const;

const mailboxTinyCheckStyles = {
  marginLeft: '6px',
  color: '#d8d8d8',
} as const;

const mailboxRowsStyles = {
  display: 'grid',
  alignContent: 'start',
  maxHeight: '128px',
  overflowY: 'auto',
  padding: '2px 12px 12px',
} as const;

const mailboxRecipientRowStyles = {
  display: 'grid',
  gridTemplateColumns: '24px minmax(0, 1fr) 22px',
  alignItems: 'center',
  minHeight: '20px',
  color: '#8d8d8d',
  fontSize: '11px',
  cursor: 'pointer',
} as const;

const mailboxRecipientIndexStyles = {
  color: '#666666',
} as const;

const mailboxRecipientEmailStyles = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
} as const;

const mailboxCheckboxStyles = {
  width: '12px',
  height: '12px',
  justifySelf: 'end',
  accentColor: '#C0FF01',
} as const;

const mailboxEmptyStyles = {
  color: '#777777',
  fontSize: '11px',
  margin: '16px 0 0',
} as const;

const mailboxFooterStyles = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) 138px 96px',
  alignItems: 'center',
  gap: '12px',
  marginTop: '22px',
} as const;

const mailboxFileButtonStyles = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '10px',
  color: '#ffffff',
  fontSize: '12px',
  cursor: 'pointer',
} as const;

const mailboxFileNameStyles = {
  display: 'block',
  marginTop: '3px',
  color: '#747474',
  fontSize: '11px',
  maxWidth: '190px',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
} as const;

const mailboxSubjectStyles = {
  width: '100%',
  height: '30px',
  border: '1px solid #202020',
  background: '#101010',
  color: '#ffffff',
  padding: '0 10px',
  boxSizing: 'border-box',
  fontSize: '11px',
  outline: 'none',
} as const;

const mailboxSendButtonStyles = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  height: '30px',
  border: 0,
  background: '#202020',
  color: '#ffffff',
  fontSize: '12px',
} as const;

const mailboxMessageStyles = {
  margin: '12px 0 0',
  color: '#C0FF01',
  fontSize: '11px',
} as const;

const pageStyles = {
  // Fondo general de la pagina Bodega.
  // Cambia padding si quieres separar mas o menos todo el contenido del borde de Strapi.
  minHeight: '100vh',
  background: '#000000',
  color: '#ffffff',
  padding: '24px',
  boxSizing: 'border-box',
} as const;

const layoutStyles = {
  // Grilla principal: columna izquierda fija + panel derecho flexible.
  // Para agrandar la calculadora/buzon cambia el primer valor de gridTemplateColumns.
  // Para separar mas ambos bloques cambia gap.
  display: 'grid',
  gridTemplateColumns: '550px minmax(0, 1fr)',
  gap: '30px',
  alignItems: 'stretch',
  maxWidth: '1800px',
  margin: '0 auto',
} as const;

const blockStyles = {
  // Estilo base compartido por Calculadora, Buzon y panel de datos.
  // Este es el color de tarjeta principal de bodega.
  background: '#171717',
  border: '1px solid #2a2a2a',
  boxSizing: 'border-box',
} as const;

const inputStyles = {
  // Input/chip base de la calculadora.
  // Lo usan los campos Gramos/Tiempo y los chips 1kg/Bambu lab A1.
  width: '100%',
  height: '30px',
  border: '1px solid #202020',
  background: '#202020',
  color: '#ffffff',
  padding: '0 12px',
  boxSizing: 'border-box',
  fontSize: '11px',
} as const;

const materialCardStyles = {
  // Tarjeta Filamento/Resina.
  // minHeight controla el alto, padding el aire interno y border el contorno.
  position: 'relative',
  display: 'grid',
  gridTemplateColumns: '1fr auto',
  alignItems: 'start',
  minHeight: '112px',
  border: '1px solid #4a4a4a',
  background: '#171717',
  color: '#ffffff',
  padding: '8px',
  cursor: 'pointer',
  textAlign: 'left',
} as const;

const materialDotsStyles = {
  // Contenedor de los tres puntos superiores de cada tarjeta de material.
  display: 'flex',
  gap: '4px',
} as const;

const materialDotStyles = {
  // Punto individual de la tarjeta de material.
  // Cambia width/height si quieres puntos mas grandes o mas chicos.
  width: '6px',
  height: '6px',
  borderRadius: '999px',
} as const;

const materialImageStyles = {
  // Imagen central de la tarjeta de material.
  // width/height controlan el tamano del carrete y la botella.
  gridColumn: '1 / 3',
  justifySelf: 'center',
  width: '62px',
  height: '62px',
  objectFit: 'contain',
  margin: '6px 0',
  filter: 'drop-shadow(0 8px 8px rgba(0, 0, 0, 0.45))',
} as const;

const calculatorTotalStyles = {
  // Caja negra del total en la calculadora.
  // gridTemplateColumns deja texto, precio e icono copiar en una sola fila.
  position: 'relative',
  display: 'grid',
  gridTemplateColumns: '1fr auto auto',
  alignItems: 'center',
  gap: '10px',
  background: '#080808',
  padding: '10px',
} as const;

const calculatorResultRowStyles = {
  position: 'relative',
  display: 'grid',
  gridTemplateColumns: '1fr auto auto',
  alignItems: 'center',
  gap: '10px',
  borderBottom: '1px solid #4a4a4a',
  paddingBottom: '8px',
} as const;

const calculatorCopyButtonStyles = {
  // Icono Copy del total. Cambia color o tamano del boton aqui.
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '24px',
  height: '24px',
  border: 0,
  background: 'transparent',
  color: '#8d8d8d',
} as const;

const copiedTotalStyles = {
  // Texto temporal "Copiado" que aparece debajo del total.
  // right/bottom ajustan su posicion exacta.
  position: 'absolute',
  right: 0,
  bottom: '-20px',
  color: '#C0FF01',
  fontSize: '11px',
} as const;

const copiedResultRowStyles = {
  position: 'absolute',
  right: 0,
  bottom: '-16px',
  color: '#C0FF01',
  fontSize: '10px',
} as const;

const productNameCellStyles = {
  // Layout interno de la celda Nombre: thumbnail fijo + texto.
  // El primer valor de gridTemplateColumns es el ancho reservado para la foto.
  display: 'grid',
  gridTemplateColumns: '34px minmax(120px, 1fr)',
  alignItems: 'center',
  gap: '10px',
} as const;

const productThumbStyles = {
  // Marco del thumbnail del producto/variante dentro de la tabla.
  // Mantiene todas las filas con imagen del mismo tamano.
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '34px',
  height: '34px',
  background: '#101010',
  border: '1px solid #2f2f2f',
  overflow: 'hidden',
} as const;

const productThumbImageStyles = {
  // Imagen real dentro del thumbnail.
  // objectFit cover llena el cuadro; usa contain si prefieres ver la imagen completa.
  width: '100%',
  height: '100%',
  objectFit: 'cover',
} as const;

const cellStyles = {
  // Celda base de la tabla de variantes.
  // padding controla alto de filas; border controla las lineas de la tabla.
  border: '1px solid #3f3f3f',
  padding: '18px 12px',
  color: '#ffffff',
  whiteSpace: 'nowrap',
} as const;

const tableInputStyles = {
  // Input que aparece dentro de una celda cuando una fila esta en modo edicion.
  // width limita el tamano para que la tabla no crezca demasiado.
  width: '72px',
  border: '1px solid #333333',
  background: '#0b0b0b',
  padding: '6px 8px',
  boxSizing: 'border-box',
  fontSize: '12px',
  outline: 'none',
} as const;

const iconButtonStyles = {
  // Boton final de cada fila: pencil/save.
  // Cambia background/border si quieres una capsula mas marcada.
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '28px',
  height: '28px',
  border: '1px solid #4a4a4a',
  background: '#202020',
  color: '#ffffff',
  cursor: 'pointer',
} as const;

const paginationStyles = {
  // Fila inferior de paginacion.
  // justifyContent separa contador a la izquierda y botones a la derecha.
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '16px',
  marginTop: '18px',
} as const;

const getPaginationButtonStyles = (isDisabled: boolean) =>
  ({
    // Botones Anterior/Siguiente.
    // Cuando isDisabled es true se apagan visualmente.
    height: '32px',
    minWidth: '88px',
    border: '1px solid #3f3f3f',
    background: isDisabled ? '#1f1f1f' : '#C0FF01',
    color: isDisabled ? '#686868' : '#000000',
    cursor: isDisabled ? 'not-allowed' : 'pointer',
    fontSize: '12px',
  }) as const;

export default WarehousePage;
