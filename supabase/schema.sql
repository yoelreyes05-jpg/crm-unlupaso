-- ============================================================
-- UNLUPASO CRM - Schema Supabase
-- Prefijo: ul_  (totalmente separado de crm-automotriz)
-- ============================================================

-- =====================
-- EXTENSIONES
-- =====================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================
-- TIPOS ENUM
-- =====================
DO $$ BEGIN
  CREATE TYPE ul_metodo_pago AS ENUM ('EFECTIVO', 'TARJETA', 'TRANSFERENCIA');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE ul_ncf_tipo AS ENUM ('B01', 'B02', 'B14', 'B15');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE ul_categoria AS ENUM ('HELADOS', 'CHURROS', 'BIZCOCHOS', 'CAFE', 'BEBIDAS', 'POSTRES', 'SNACKS', 'OTROS');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =====================
-- TABLA: ul_config
-- Configuración general del negocio
-- =====================
CREATE TABLE IF NOT EXISTS ul_config (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clave         TEXT UNIQUE NOT NULL,
  valor         TEXT,
  descripcion   TEXT,
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- TABLA: ul_productos
-- =====================
CREATE TABLE IF NOT EXISTS ul_productos (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre        TEXT NOT NULL,
  descripcion   TEXT,
  precio        NUMERIC(10,2) NOT NULL CHECK (precio >= 0),
  costo         NUMERIC(10,2) DEFAULT 0 CHECK (costo >= 0),
  categoria     ul_categoria NOT NULL DEFAULT 'OTROS',
  stock         INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  stock_minimo  INTEGER NOT NULL DEFAULT 5,
  imagen        TEXT,
  activo        BOOLEAN NOT NULL DEFAULT TRUE,
  codigo        TEXT UNIQUE,
  itbis         NUMERIC(5,2) DEFAULT 0,   -- % de ITBIS (0, 16, 18)
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ul_productos_categoria ON ul_productos(categoria);
CREATE INDEX IF NOT EXISTS idx_ul_productos_activo    ON ul_productos(activo);

-- =====================
-- TABLA: ul_secuencias_ncf
-- Manejo de secuencias NCF por tipo
-- =====================
CREATE TABLE IF NOT EXISTS ul_secuencias_ncf (
  tipo          ul_ncf_tipo PRIMARY KEY,
  prefijo       TEXT NOT NULL,
  siguiente     INTEGER NOT NULL DEFAULT 1,
  maximo        INTEGER NOT NULL DEFAULT 99999999,
  activo        BOOLEAN NOT NULL DEFAULT TRUE
);

INSERT INTO ul_secuencias_ncf (tipo, prefijo, siguiente) VALUES
  ('B01', 'B01', 1),
  ('B02', 'B02', 1),
  ('B14', 'B14', 1),
  ('B15', 'B15', 1)
ON CONFLICT (tipo) DO NOTHING;

-- =====================
-- TABLA: ul_ventas
-- =====================
CREATE TABLE IF NOT EXISTS ul_ventas (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  numero            TEXT UNIQUE,                        -- auto-generado por trigger
  total             NUMERIC(10,2) NOT NULL CHECK (total >= 0),
  subtotal          NUMERIC(10,2) DEFAULT 0,
  itbis_total       NUMERIC(10,2) DEFAULT 0,
  descuento         NUMERIC(10,2) DEFAULT 0,
  metodo_pago       ul_metodo_pago NOT NULL DEFAULT 'EFECTIVO',
  ncf               TEXT,
  ncf_tipo          ul_ncf_tipo DEFAULT 'B02',
  cliente_nombre    TEXT,
  cliente_rnc       TEXT,
  notas             TEXT,
  cajero            TEXT,
  anulada           BOOLEAN NOT NULL DEFAULT FALSE,
  motivo_anulacion  TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ul_ventas_created_at    ON ul_ventas(created_at);
CREATE INDEX IF NOT EXISTS idx_ul_ventas_metodo_pago   ON ul_ventas(metodo_pago);
CREATE INDEX IF NOT EXISTS idx_ul_ventas_ncf_tipo      ON ul_ventas(ncf_tipo);
CREATE INDEX IF NOT EXISTS idx_ul_ventas_anulada       ON ul_ventas(anulada);

-- =====================
-- TABLA: ul_detalle_ventas
-- =====================
CREATE TABLE IF NOT EXISTS ul_detalle_ventas (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  venta_id          UUID NOT NULL REFERENCES ul_ventas(id) ON DELETE CASCADE,
  producto_id       UUID REFERENCES ul_productos(id) ON DELETE SET NULL,
  nombre_producto   TEXT NOT NULL,
  categoria         TEXT,
  qty               INTEGER NOT NULL CHECK (qty > 0),
  precio_unitario   NUMERIC(10,2) NOT NULL CHECK (precio_unitario >= 0),
  costo_unitario    NUMERIC(10,2) DEFAULT 0,
  itbis             NUMERIC(10,2) DEFAULT 0,
  descuento         NUMERIC(10,2) DEFAULT 0,
  subtotal          NUMERIC(10,2) NOT NULL CHECK (subtotal >= 0)
);

CREATE INDEX IF NOT EXISTS idx_ul_detalle_venta_id      ON ul_detalle_ventas(venta_id);
CREATE INDEX IF NOT EXISTS idx_ul_detalle_producto_id   ON ul_detalle_ventas(producto_id);

-- =====================
-- TABLA: ul_cuadre
-- Cierre de caja diario
-- =====================
CREATE TABLE IF NOT EXISTS ul_cuadre (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fecha                   DATE NOT NULL,
  usuario                 TEXT,
  ventas_efectivo         NUMERIC(10,2) NOT NULL DEFAULT 0,
  ventas_tarjeta          NUMERIC(10,2) NOT NULL DEFAULT 0,
  ventas_transferencia    NUMERIC(10,2) NOT NULL DEFAULT 0,
  ventas_total            NUMERIC(10,2) NOT NULL DEFAULT 0,
  transacciones_count     INTEGER NOT NULL DEFAULT 0,
  efectivo_inicial        NUMERIC(10,2) DEFAULT 0,
  efectivo_contado        NUMERIC(10,2) DEFAULT 0,
  diferencia              NUMERIC(10,2) DEFAULT 0,
  notas                   TEXT,
  cerrado                 BOOLEAN NOT NULL DEFAULT FALSE,
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ul_cuadre_fecha ON ul_cuadre(fecha);

-- =====================
-- TABLA: ul_movimientos_inventario
-- Log de cambios en stock
-- =====================
CREATE TABLE IF NOT EXISTS ul_movimientos_inventario (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  producto_id   UUID NOT NULL REFERENCES ul_productos(id) ON DELETE CASCADE,
  tipo          TEXT NOT NULL,  -- 'VENTA', 'AJUSTE', 'ENTRADA', 'ANULACION'
  cantidad      INTEGER NOT NULL,
  stock_antes   INTEGER,
  stock_despues INTEGER,
  referencia_id UUID,           -- venta_id u otro
  notas         TEXT,
  usuario       TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ul_mov_producto_id ON ul_movimientos_inventario(producto_id);
CREATE INDEX IF NOT EXISTS idx_ul_mov_created_at  ON ul_movimientos_inventario(created_at);

-- ============================================================
-- FUNCIONES Y TRIGGERS
-- ============================================================

-- Trigger: updated_at automático
CREATE OR REPLACE FUNCTION ul_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ul_productos_updated_at ON ul_productos;
CREATE TRIGGER trg_ul_productos_updated_at
  BEFORE UPDATE ON ul_productos
  FOR EACH ROW EXECUTE FUNCTION ul_set_updated_at();

-- Trigger: generar número de venta (UL-YYYYMMDD-NNNN)
CREATE OR REPLACE FUNCTION ul_generar_numero_venta()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_fecha TEXT;
  v_count INTEGER;
BEGIN
  v_fecha := TO_CHAR(NEW.created_at, 'YYYYMMDD');
  SELECT COUNT(*) + 1 INTO v_count
    FROM ul_ventas
   WHERE DATE(created_at) = DATE(NEW.created_at)
     AND id <> NEW.id;
  NEW.numero := 'UL-' || v_fecha || '-' || LPAD(v_count::TEXT, 4, '0');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ul_generar_numero ON ul_ventas;
CREATE TRIGGER trg_ul_generar_numero
  BEFORE INSERT ON ul_ventas
  FOR EACH ROW EXECUTE FUNCTION ul_generar_numero_venta();

-- Trigger: generar NCF automáticamente
CREATE OR REPLACE FUNCTION ul_generar_ncf()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_seq   ul_secuencias_ncf%ROWTYPE;
  v_ncf   TEXT;
BEGIN
  -- Solo genera si no viene ya con NCF
  IF NEW.ncf IS NOT NULL AND NEW.ncf <> '' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_seq FROM ul_secuencias_ncf
   WHERE tipo = NEW.ncf_tipo AND activo = TRUE
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  v_ncf := v_seq.prefijo || LPAD(v_seq.siguiente::TEXT, 8, '0');
  NEW.ncf := v_ncf;

  UPDATE ul_secuencias_ncf
     SET siguiente = siguiente + 1
   WHERE tipo = NEW.ncf_tipo;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ul_generar_ncf ON ul_ventas;
CREATE TRIGGER trg_ul_generar_ncf
  BEFORE INSERT ON ul_ventas
  FOR EACH ROW EXECUTE FUNCTION ul_generar_ncf();

-- Trigger: descontar inventario al crear detalle_venta
CREATE OR REPLACE FUNCTION ul_descontar_inventario()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_stock_antes INTEGER;
BEGIN
  IF NEW.producto_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT stock INTO v_stock_antes FROM ul_productos WHERE id = NEW.producto_id;

  UPDATE ul_productos
     SET stock = GREATEST(0, stock - NEW.qty)
   WHERE id = NEW.producto_id;

  INSERT INTO ul_movimientos_inventario
    (producto_id, tipo, cantidad, stock_antes, stock_despues, referencia_id)
  VALUES
    (NEW.producto_id, 'VENTA', -NEW.qty, v_stock_antes,
     GREATEST(0, v_stock_antes - NEW.qty), NEW.venta_id);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ul_descontar_inventario ON ul_detalle_ventas;
CREATE TRIGGER trg_ul_descontar_inventario
  AFTER INSERT ON ul_detalle_ventas
  FOR EACH ROW EXECUTE FUNCTION ul_descontar_inventario();

-- Trigger: devolver stock al anular venta
CREATE OR REPLACE FUNCTION ul_devolver_inventario_anulacion()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_detalle RECORD;
  v_stock_antes INTEGER;
BEGIN
  -- Solo actúa cuando cambia anulada de FALSE a TRUE
  IF OLD.anulada = FALSE AND NEW.anulada = TRUE THEN
    FOR v_detalle IN
      SELECT * FROM ul_detalle_ventas WHERE venta_id = NEW.id
    LOOP
      IF v_detalle.producto_id IS NOT NULL THEN
        SELECT stock INTO v_stock_antes FROM ul_productos WHERE id = v_detalle.producto_id;

        UPDATE ul_productos
           SET stock = stock + v_detalle.qty
         WHERE id = v_detalle.producto_id;

        INSERT INTO ul_movimientos_inventario
          (producto_id, tipo, cantidad, stock_antes, stock_despues, referencia_id, notas)
        VALUES
          (v_detalle.producto_id, 'ANULACION', v_detalle.qty, v_stock_antes,
           v_stock_antes + v_detalle.qty, NEW.id, 'Anulación: ' || COALESCE(NEW.motivo_anulacion, ''));
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ul_devolver_inventario ON ul_ventas;
CREATE TRIGGER trg_ul_devolver_inventario
  AFTER UPDATE ON ul_ventas
  FOR EACH ROW EXECUTE FUNCTION ul_devolver_inventario_anulacion();

-- ============================================================
-- VISTAS
-- ============================================================

-- Vista: resumen de ventas por día
CREATE OR REPLACE VIEW ul_ventas_diarias AS
SELECT
  DATE(created_at)                                          AS fecha,
  COUNT(*)                                                  AS total_transacciones,
  SUM(CASE WHEN NOT anulada THEN 1 ELSE 0 END)             AS ventas_validas,
  SUM(CASE WHEN NOT anulada THEN total ELSE 0 END)          AS monto_total,
  SUM(CASE WHEN NOT anulada AND metodo_pago = 'EFECTIVO' THEN total ELSE 0 END)      AS efectivo,
  SUM(CASE WHEN NOT anulada AND metodo_pago = 'TARJETA' THEN total ELSE 0 END)       AS tarjeta,
  SUM(CASE WHEN NOT anulada AND metodo_pago = 'TRANSFERENCIA' THEN total ELSE 0 END) AS transferencia
FROM ul_ventas
GROUP BY DATE(created_at)
ORDER BY fecha DESC;

-- Vista: productos con stock bajo
CREATE OR REPLACE VIEW ul_stock_bajo AS
SELECT id, nombre, categoria, stock, stock_minimo, precio
FROM ul_productos
WHERE activo = TRUE AND stock <= stock_minimo
ORDER BY stock ASC;

-- Vista: top productos más vendidos
CREATE OR REPLACE VIEW ul_top_productos AS
SELECT
  p.id,
  p.nombre,
  p.categoria,
  p.precio,
  SUM(d.qty)       AS unidades_vendidas,
  SUM(d.subtotal)  AS ingresos_total
FROM ul_detalle_ventas d
JOIN ul_productos p ON p.id = d.producto_id
JOIN ul_ventas v ON v.id = d.venta_id
WHERE NOT v.anulada
GROUP BY p.id, p.nombre, p.categoria, p.precio
ORDER BY unidades_vendidas DESC;

-- Vista: cuadre automático (útil para la API cuadre/auto)
CREATE OR REPLACE VIEW ul_cuadre_auto AS
SELECT
  DATE(created_at) AS fecha,
  SUM(CASE WHEN NOT anulada AND metodo_pago = 'EFECTIVO'      THEN total ELSE 0 END) AS ventas_efectivo,
  SUM(CASE WHEN NOT anulada AND metodo_pago = 'TARJETA'       THEN total ELSE 0 END) AS ventas_tarjeta,
  SUM(CASE WHEN NOT anulada AND metodo_pago = 'TRANSFERENCIA' THEN total ELSE 0 END) AS ventas_transferencia,
  SUM(CASE WHEN NOT anulada THEN total ELSE 0 END)                                   AS ventas_total,
  COUNT(CASE WHEN NOT anulada THEN 1 END)                                            AS transacciones_count
FROM ul_ventas
GROUP BY DATE(created_at);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Habilitar RLS
ALTER TABLE ul_productos            ENABLE ROW LEVEL SECURITY;
ALTER TABLE ul_ventas               ENABLE ROW LEVEL SECURITY;
ALTER TABLE ul_detalle_ventas       ENABLE ROW LEVEL SECURITY;
ALTER TABLE ul_cuadre               ENABLE ROW LEVEL SECURITY;
ALTER TABLE ul_movimientos_inventario ENABLE ROW LEVEL SECURITY;
ALTER TABLE ul_config               ENABLE ROW LEVEL SECURITY;
ALTER TABLE ul_secuencias_ncf       ENABLE ROW LEVEL SECURITY;

-- Políticas: anon puede leer productos activos
CREATE POLICY "ul_productos_select_anon"
  ON ul_productos FOR SELECT
  TO anon
  USING (activo = TRUE);

-- Políticas: authenticated puede todo
CREATE POLICY "ul_productos_all_auth"
  ON ul_productos FOR ALL
  TO authenticated
  USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "ul_ventas_all_auth"
  ON ul_ventas FOR ALL
  TO authenticated
  USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "ul_detalle_all_auth"
  ON ul_detalle_ventas FOR ALL
  TO authenticated
  USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "ul_cuadre_all_auth"
  ON ul_cuadre FOR ALL
  TO authenticated
  USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "ul_mov_all_auth"
  ON ul_movimientos_inventario FOR ALL
  TO authenticated
  USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "ul_config_all_auth"
  ON ul_config FOR ALL
  TO authenticated
  USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "ul_secuencias_all_auth"
  ON ul_secuencias_ncf FOR ALL
  TO authenticated
  USING (TRUE) WITH CHECK (TRUE);

-- Service role bypasses RLS (para API routes con service key)
-- No necesita políticas adicionales; service role ignora RLS por defecto.

-- ============================================================
-- DATOS INICIALES (SEED)
-- ============================================================

-- Configuración del negocio
INSERT INTO ul_config (clave, valor, descripcion) VALUES
  ('nombre',      'UNLUPASO',              'Nombre del negocio'),
  ('slogan',      'Un lugar para soñar',   'Slogan'),
  ('telefono',    '829-644-7991',          'Teléfono principal'),
  ('rnc',         '',                      'RNC de la empresa'),
  ('direccion',   '',                      'Dirección física'),
  ('moneda',      'DOP',                   'Moneda (ISO 4217)'),
  ('itbis_pct',   '18',                    'Porcentaje ITBIS por defecto'),
  ('ncf_default', 'B02',                   'Tipo NCF por defecto'),
  ('logo_url',    '',                      'URL del logo')
ON CONFLICT (clave) DO NOTHING;

-- Productos de ejemplo
INSERT INTO ul_productos (nombre, descripcion, precio, costo, categoria, stock, stock_minimo, activo) VALUES
  -- Helados
  ('Helado Vainilla',      'Copa de helado de vainilla',           120.00,  60.00, 'HELADOS',   50, 10, TRUE),
  ('Helado Chocolate',     'Copa de helado de chocolate',          120.00,  60.00, 'HELADOS',   50, 10, TRUE),
  ('Helado Fresa',         'Copa de helado de fresa',              120.00,  60.00, 'HELADOS',   50, 10, TRUE),
  ('Sundae',               'Helado con topping y crema batida',    175.00,  80.00, 'HELADOS',   30,  5, TRUE),
  ('Milkshake',            'Batido cremoso de helado',             250.00, 100.00, 'HELADOS',   20,  5, TRUE),
  -- Churros
  ('Churros x3',           '3 churros con azúcar',                 150.00,  50.00, 'CHURROS',   40, 10, TRUE),
  ('Churros x6',           '6 churros con azúcar y chocolate',     250.00,  90.00, 'CHURROS',   40, 10, TRUE),
  ('Churros Rellenos',     'Churros rellenos de dulce de leche',   200.00,  80.00, 'CHURROS',   30,  5, TRUE),
  -- Bizcochos
  ('Bizcocho de Chocolate','Porción de bizcocho húmedo',           180.00,  70.00, 'BIZCOCHOS', 20,  5, TRUE),
  ('Bizcocho de Vainilla', 'Porción de bizcocho esponjoso',        180.00,  70.00, 'BIZCOCHOS', 20,  5, TRUE),
  ('Cheesecake',           'Porción de cheesecake NY',             220.00,  90.00, 'BIZCOCHOS', 15,  3, TRUE),
  -- Café
  ('Espresso',             'Espresso doble',                        80.00,  20.00, 'CAFE',     100, 20, TRUE),
  ('Cappuccino',           'Cappuccino con espuma de leche',       130.00,  40.00, 'CAFE',     100, 20, TRUE),
  ('Latte',                'Café latte cremoso',                   150.00,  45.00, 'CAFE',     100, 20, TRUE),
  ('Americano',            'Café americano grande',                 90.00,  25.00, 'CAFE',     100, 20, TRUE),
  ('Mocha',                'Café con chocolate',                   160.00,  55.00, 'CAFE',      80, 15, TRUE),
  -- Bebidas
  ('Agua Mineral',         'Botella de agua 500ml',                 50.00,  20.00, 'BEBIDAS',  200, 30, TRUE),
  ('Jugo Natural',         'Jugo de fruta natural 16oz',           120.00,  40.00, 'BEBIDAS',   60, 10, TRUE),
  ('Limonada',             'Limonada fresca con menta',            130.00,  35.00, 'BEBIDAS',   60, 10, TRUE),
  ('Refresco',             'Refresco en lata 355ml',                70.00,  30.00, 'BEBIDAS',  150, 30, TRUE),
  -- Postres
  ('Flan',                 'Flan casero con caramelo',             150.00,  50.00, 'POSTRES',   25,  5, TRUE),
  ('Brownie',              'Brownie de chocolate con nueces',       160.00,  55.00, 'POSTRES',   30,  5, TRUE),
  ('Tiramisú',             'Porción de tiramisú italiano',         220.00,  85.00, 'POSTRES',   15,  3, TRUE),
  -- Snacks
  ('Palomitas',            'Palomitas de maíz dulces',              80.00,  20.00, 'SNACKS',    50, 10, TRUE),
  ('Nachos con Queso',     'Nachos con salsa de queso',            150.00,  50.00, 'SNACKS',    40, 10, TRUE)
ON CONFLICT DO NOTHING;
