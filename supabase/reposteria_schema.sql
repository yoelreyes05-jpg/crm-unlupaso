-- ============================================================================
-- ERP REPOSTERÍA — Schema para el proyecto Supabase de UNLUPASO
-- Prefijo: rep_   (totalmente independiente de las tablas ul_ del POS)
--
-- • Ninguna tabla rep_ referencia tablas ul_  → los datos NO se mezclan.
-- • Sin dependencia de auth.users / profiles  → login en pausa.
--   La autoría se guarda como texto en la columna `usuario`.
-- • Ejecutar completo en: Supabase → SQL Editor → Run
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- TIPOS ENUM
-- ============================================================================
DO $$ BEGIN
  CREATE TYPE rep_metodo_pago AS ENUM ('EFECTIVO','TARJETA','TRANSFERENCIA','CHEQUE','DEPOSITO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE rep_ncf_tipo AS ENUM ('B01','B02','B14','B15');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE rep_equipo_estado AS ENUM ('disponible','alquilado','mantenimiento','danado','baja');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE rep_evento_estado AS ENUM ('cotizado','confirmado','en_preparacion','entregado','cerrado','cancelado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE rep_evento_tipo AS ENUM ('cumpleanos','boda','baby_shower','aniversario','corporativo','otro');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE rep_cotizacion_estado AS ENUM ('borrador','enviada','aceptada','rechazada','vencida');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE rep_factura_estado AS ENUM ('pendiente','parcial','pagada','vencida','anulada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- FUNCIÓN AUXILIAR: updated_at
-- ============================================================================
CREATE OR REPLACE FUNCTION rep_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ============================================================================
-- 1. CONFIGURACIÓN
-- ============================================================================
CREATE TABLE IF NOT EXISTS rep_config (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clave        TEXT UNIQUE NOT NULL,
  valor        TEXT,
  descripcion  TEXT,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 2. CLIENTES
-- ============================================================================
CREATE TABLE IF NOT EXISTS rep_clientes (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre      TEXT NOT NULL,
  apellido    TEXT NOT NULL DEFAULT '',
  email       TEXT,
  telefono    TEXT,
  cedula_rnc  TEXT,
  direccion   TEXT,
  tipo        TEXT NOT NULL DEFAULT 'persona' CHECK (tipo IN ('persona','empresa')),
  notas       TEXT,
  activo      BOOLEAN NOT NULL DEFAULT TRUE,
  usuario     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_rep_clientes_updated ON rep_clientes;
CREATE TRIGGER trg_rep_clientes_updated BEFORE UPDATE ON rep_clientes
  FOR EACH ROW EXECUTE FUNCTION rep_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_rep_clientes_nombre ON rep_clientes(nombre);
CREATE INDEX IF NOT EXISTS idx_rep_clientes_activo ON rep_clientes(activo);

-- ============================================================================
-- 3. PROVEEDORES
-- ============================================================================
CREATE TABLE IF NOT EXISTS rep_proveedores (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre      TEXT NOT NULL,
  contacto    TEXT,
  email       TEXT,
  telefono    TEXT,
  rnc         TEXT,
  direccion   TEXT,
  categoria   TEXT,
  notas       TEXT,
  activo      BOOLEAN NOT NULL DEFAULT TRUE,
  usuario     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_rep_proveedores_updated ON rep_proveedores;
CREATE TRIGGER trg_rep_proveedores_updated BEFORE UPDATE ON rep_proveedores
  FOR EACH ROW EXECUTE FUNCTION rep_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_rep_proveedores_activo ON rep_proveedores(activo);

-- ============================================================================
-- 4. INGREDIENTES  (materia prima)
-- ============================================================================
CREATE TABLE IF NOT EXISTS rep_ingredientes (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre                  TEXT NOT NULL,
  descripcion             TEXT,
  categoria               TEXT NOT NULL DEFAULT 'otro'
    CHECK (categoria IN ('harina','lacteo','azucar','grasa','huevo','fruta','saborizante','decoracion','liquido','fruto_seco','otro')),
  unidad                  TEXT NOT NULL DEFAULT 'unidad',   -- kg, lb, lt, oz, unidad
  costo_unitario          NUMERIC(12,2) NOT NULL DEFAULT 0,
  stock_actual            NUMERIC(12,3) NOT NULL DEFAULT 0,
  stock_minimo            NUMERIC(12,3) NOT NULL DEFAULT 0,
  punto_reorden           NUMERIC(12,3) NOT NULL DEFAULT 0,
  ubicacion               TEXT,                              -- "Estante A-2", "Refrigerador 1"
  unidad_compra           TEXT,                              -- "saco 50lb", "galón"
  costo_compra            NUMERIC(12,2) NOT NULL DEFAULT 0,
  proveedor_id            UUID REFERENCES rep_proveedores(id) ON DELETE SET NULL,
  fecha_ultimo_movimiento DATE,
  activo                  BOOLEAN NOT NULL DEFAULT TRUE,
  usuario                 TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_rep_ingredientes_updated ON rep_ingredientes;
CREATE TRIGGER trg_rep_ingredientes_updated BEFORE UPDATE ON rep_ingredientes
  FOR EACH ROW EXECUTE FUNCTION rep_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_rep_ingredientes_categoria ON rep_ingredientes(categoria);
CREATE INDEX IF NOT EXISTS idx_rep_ingredientes_activo    ON rep_ingredientes(activo);

-- ============================================================================
-- 5. PRODUCTOS  (catálogo de repostería)
-- ============================================================================
CREATE TABLE IF NOT EXISTS rep_productos (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre         TEXT NOT NULL,
  descripcion    TEXT,
  categoria      TEXT NOT NULL DEFAULT 'general'
    CHECK (categoria IN ('bizcocho','cupcake','postre','pan','galleta','decoracion','servicio','general')),
  codigo         TEXT UNIQUE,
  precio_venta   NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (precio_venta >= 0),
  costo_estimado NUMERIC(12,2) NOT NULL DEFAULT 0,
  itbis          NUMERIC(5,2)  NOT NULL DEFAULT 0,   -- % (0, 16, 18)
  unidad         TEXT NOT NULL DEFAULT 'unidad',
  imagen_url     TEXT,
  vende_en_pos   BOOLEAN NOT NULL DEFAULT TRUE,
  activo         BOOLEAN NOT NULL DEFAULT TRUE,
  usuario        TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_rep_productos_updated ON rep_productos;
CREATE TRIGGER trg_rep_productos_updated BEFORE UPDATE ON rep_productos
  FOR EACH ROW EXECUTE FUNCTION rep_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_rep_productos_categoria ON rep_productos(categoria);
CREATE INDEX IF NOT EXISTS idx_rep_productos_activo    ON rep_productos(activo);

-- ============================================================================
-- 6. RECETAS
-- ============================================================================
CREATE TABLE IF NOT EXISTS rep_recetas (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  producto_id        UUID REFERENCES rep_productos(id) ON DELETE SET NULL,
  nombre             TEXT NOT NULL,
  descripcion        TEXT,
  rendimiento        NUMERIC(10,3) NOT NULL DEFAULT 1,
  unidad_rendimiento TEXT NOT NULL DEFAULT 'unidad',
  costo_total        NUMERIC(12,2) NOT NULL DEFAULT 0,   -- calculado por trigger
  costo_por_unidad   NUMERIC(12,2) NOT NULL DEFAULT 0,   -- calculado por trigger
  instrucciones      TEXT,
  activo             BOOLEAN NOT NULL DEFAULT TRUE,
  usuario            TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_rep_recetas_updated ON rep_recetas;
CREATE TRIGGER trg_rep_recetas_updated BEFORE UPDATE ON rep_recetas
  FOR EACH ROW EXECUTE FUNCTION rep_set_updated_at();

CREATE TABLE IF NOT EXISTS rep_receta_ingredientes (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  receta_id      UUID NOT NULL REFERENCES rep_recetas(id) ON DELETE CASCADE,
  ingrediente_id UUID NOT NULL REFERENCES rep_ingredientes(id) ON DELETE CASCADE,
  cantidad       NUMERIC(12,3) NOT NULL CHECK (cantidad > 0),
  unidad         TEXT NOT NULL DEFAULT 'unidad',
  costo_linea    NUMERIC(12,2) NOT NULL DEFAULT 0,
  notas          TEXT
);

CREATE INDEX IF NOT EXISTS idx_rep_recing_receta ON rep_receta_ingredientes(receta_id);

-- Trigger 1 (BEFORE): costea la propia línea con el costo actual del ingrediente.
-- Va en BEFORE para modificar NEW directamente y evitar un UPDATE recursivo.
CREATE OR REPLACE FUNCTION rep_costear_linea_receta()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_costo NUMERIC(12,2);
BEGIN
  SELECT COALESCE(costo_unitario, 0) INTO v_costo
    FROM rep_ingredientes WHERE id = NEW.ingrediente_id;

  NEW.costo_linea := ROUND(NEW.cantidad * COALESCE(v_costo, 0), 2);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rep_costear_linea ON rep_receta_ingredientes;
CREATE TRIGGER trg_rep_costear_linea
  BEFORE INSERT OR UPDATE ON rep_receta_ingredientes
  FOR EACH ROW EXECUTE FUNCTION rep_costear_linea_receta();

-- Trigger 2 (AFTER): recalcula el total de la receta. Solo toca rep_recetas.
CREATE OR REPLACE FUNCTION rep_calcular_costo_receta()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_receta UUID;
  v_total  NUMERIC(12,2);
  v_rend   NUMERIC(10,3);
BEGIN
  v_receta := COALESCE(NEW.receta_id, OLD.receta_id);

  SELECT COALESCE(SUM(costo_linea), 0) INTO v_total
    FROM rep_receta_ingredientes WHERE receta_id = v_receta;

  SELECT GREATEST(rendimiento, 0.001) INTO v_rend
    FROM rep_recetas WHERE id = v_receta;

  UPDATE rep_recetas
     SET costo_total      = v_total,
         costo_por_unidad = ROUND(v_total / COALESCE(v_rend, 1), 2)
   WHERE id = v_receta;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_rep_costo_receta ON rep_receta_ingredientes;
CREATE TRIGGER trg_rep_costo_receta
  AFTER INSERT OR UPDATE OR DELETE ON rep_receta_ingredientes
  FOR EACH ROW EXECUTE FUNCTION rep_calcular_costo_receta();

-- ============================================================================
-- 7. LOTES DE PRODUCCIÓN (perecederos) + movimientos
-- ============================================================================
CREATE TABLE IF NOT EXISTS rep_lotes (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  producto_id       UUID REFERENCES rep_productos(id) ON DELETE SET NULL,
  receta_id         UUID REFERENCES rep_recetas(id)   ON DELETE SET NULL,
  nombre_lote       TEXT NOT NULL,
  categoria         TEXT NOT NULL DEFAULT 'bizcocho'
                    CHECK (categoria IN ('bizcocho','galleta','postre','pan','cupcake','otro')),
  cantidad_inicial  NUMERIC(10,2) NOT NULL DEFAULT 1,
  cantidad_actual   NUMERIC(10,2) NOT NULL DEFAULT 1,
  unidad            TEXT NOT NULL DEFAULT 'unidad',   -- unidad, porcion, caja, docena
  fecha_produccion  DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_vencimiento DATE NOT NULL,
  dias_vida         INTEGER GENERATED ALWAYS AS (fecha_vencimiento - fecha_produccion) STORED,
  costo_unitario    NUMERIC(12,2) NOT NULL DEFAULT 0,
  precio_venta      NUMERIC(12,2) NOT NULL DEFAULT 0,
  estado            TEXT NOT NULL DEFAULT 'disponible'
                    CHECK (estado IN ('disponible','agotado','vencido','descartado')),
  evento_id         UUID,   -- FK añadida más abajo (rep_eventos)
  notas             TEXT,
  usuario           TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_rep_lotes_updated ON rep_lotes;
CREATE TRIGGER trg_rep_lotes_updated BEFORE UPDATE ON rep_lotes
  FOR EACH ROW EXECUTE FUNCTION rep_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_rep_lotes_vencimiento ON rep_lotes(fecha_vencimiento);
CREATE INDEX IF NOT EXISTS idx_rep_lotes_estado      ON rep_lotes(estado);
CREATE INDEX IF NOT EXISTS idx_rep_lotes_producto    ON rep_lotes(producto_id);

CREATE TABLE IF NOT EXISTS rep_lote_movimientos (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lote_id    UUID NOT NULL REFERENCES rep_lotes(id) ON DELETE CASCADE,
  tipo       TEXT NOT NULL CHECK (tipo IN ('venta','descarte','merma','ajuste','reserva','produccion')),
  cantidad   NUMERIC(10,2) NOT NULL,
  motivo     TEXT,
  evento_id  UUID,
  venta_id   UUID,
  usuario    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rep_lotemov_lote ON rep_lote_movimientos(lote_id);

CREATE OR REPLACE FUNCTION rep_actualizar_lote()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_lote    UUID;
  v_inicial NUMERIC;
  v_movs    NUMERIC;
  v_nueva   NUMERIC;
BEGIN
  v_lote := COALESCE(NEW.lote_id, OLD.lote_id);

  SELECT cantidad_inicial INTO v_inicial FROM rep_lotes WHERE id = v_lote;

  SELECT COALESCE(SUM(
    CASE WHEN tipo IN ('venta','descarte','merma','reserva') THEN cantidad
         WHEN tipo IN ('ajuste','produccion')                THEN -cantidad
         ELSE 0 END), 0) INTO v_movs
    FROM rep_lote_movimientos WHERE lote_id = v_lote;

  v_nueva := GREATEST(COALESCE(v_inicial,0) - v_movs, 0);

  UPDATE rep_lotes
     SET cantidad_actual = v_nueva,
         estado = CASE WHEN v_nueva <= 0 THEN 'agotado' ELSE 'disponible' END
   WHERE id = v_lote AND estado NOT IN ('vencido','descartado');

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_rep_lote_mov ON rep_lote_movimientos;
CREATE TRIGGER trg_rep_lote_mov
  AFTER INSERT OR UPDATE OR DELETE ON rep_lote_movimientos
  FOR EACH ROW EXECUTE FUNCTION rep_actualizar_lote();

-- ============================================================================
-- 8. EQUIPOS PARA ALQUILER + bitácora de estado
-- ============================================================================
CREATE TABLE IF NOT EXISTS rep_equipos (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre           TEXT NOT NULL,
  descripcion      TEXT,
  categoria        TEXT NOT NULL DEFAULT 'general'
    CHECK (categoria IN ('mesa','silla','carpa','vajilla','mantel','decoracion','audio','iluminacion','cocina','general')),
  codigo           TEXT UNIQUE,
  cantidad_total   INTEGER NOT NULL DEFAULT 1 CHECK (cantidad_total >= 0),
  precio_alquiler  NUMERIC(12,2) NOT NULL DEFAULT 0,   -- por día
  costo_reposicion NUMERIC(12,2) NOT NULL DEFAULT 0,
  estado           rep_equipo_estado NOT NULL DEFAULT 'disponible',
  notas            TEXT,
  activo           BOOLEAN NOT NULL DEFAULT TRUE,
  usuario          TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_rep_equipos_updated ON rep_equipos;
CREATE TRIGGER trg_rep_equipos_updated BEFORE UPDATE ON rep_equipos
  FOR EACH ROW EXECUTE FUNCTION rep_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_rep_equipos_estado ON rep_equipos(estado);

CREATE TABLE IF NOT EXISTS rep_equipos_log (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  equipo_id       UUID NOT NULL REFERENCES rep_equipos(id) ON DELETE CASCADE,
  estado_anterior rep_equipo_estado,
  estado_nuevo    rep_equipo_estado NOT NULL,
  motivo          TEXT,
  evento_id       UUID,   -- FK añadida más abajo
  usuario         TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger: registrar automáticamente cada cambio de estado
CREATE OR REPLACE FUNCTION rep_log_estado_equipo()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.estado IS DISTINCT FROM OLD.estado THEN
    INSERT INTO rep_equipos_log (equipo_id, estado_anterior, estado_nuevo, motivo, usuario)
    VALUES (NEW.id, OLD.estado, NEW.estado, 'Cambio de estado', NEW.usuario);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rep_equipos_log ON rep_equipos;
CREATE TRIGGER trg_rep_equipos_log AFTER UPDATE ON rep_equipos
  FOR EACH ROW EXECUTE FUNCTION rep_log_estado_equipo();

-- ============================================================================
-- 9. EVENTOS + items
-- ============================================================================
CREATE TABLE IF NOT EXISTS rep_eventos (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  numero        TEXT UNIQUE,
  cliente_id    UUID REFERENCES rep_clientes(id) ON DELETE SET NULL,
  tipo_evento   rep_evento_tipo   NOT NULL DEFAULT 'otro',
  nombre_evento TEXT NOT NULL,
  fecha_evento  DATE NOT NULL,
  hora_inicio   TIME,
  hora_fin      TIME,
  lugar         TEXT,
  num_invitados INTEGER,
  estado        rep_evento_estado NOT NULL DEFAULT 'cotizado',
  subtotal      NUMERIC(12,2) NOT NULL DEFAULT 0,
  descuento     NUMERIC(12,2) NOT NULL DEFAULT 0,
  itbis         NUMERIC(12,2) NOT NULL DEFAULT 0,
  total         NUMERIC(12,2) NOT NULL DEFAULT 0,
  deposito      NUMERIC(12,2) NOT NULL DEFAULT 0,
  balance       NUMERIC(12,2) GENERATED ALWAYS AS (total - deposito) STORED,
  notas         TEXT,
  usuario       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_rep_eventos_updated ON rep_eventos;
CREATE TRIGGER trg_rep_eventos_updated BEFORE UPDATE ON rep_eventos
  FOR EACH ROW EXECUTE FUNCTION rep_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_rep_eventos_fecha   ON rep_eventos(fecha_evento);
CREATE INDEX IF NOT EXISTS idx_rep_eventos_estado  ON rep_eventos(estado);
CREATE INDEX IF NOT EXISTS idx_rep_eventos_cliente ON rep_eventos(cliente_id);

CREATE TABLE IF NOT EXISTS rep_evento_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  evento_id       UUID NOT NULL REFERENCES rep_eventos(id) ON DELETE CASCADE,
  tipo            TEXT NOT NULL CHECK (tipo IN ('producto','equipo','servicio')),
  producto_id     UUID REFERENCES rep_productos(id) ON DELETE SET NULL,
  equipo_id       UUID REFERENCES rep_equipos(id)   ON DELETE SET NULL,
  descripcion     TEXT NOT NULL,
  cantidad        NUMERIC(10,3) NOT NULL DEFAULT 1,
  dias_alquiler   INTEGER NOT NULL DEFAULT 1,
  precio_unitario NUMERIC(12,2) NOT NULL DEFAULT 0,
  descuento       NUMERIC(12,2) NOT NULL DEFAULT 0,
  subtotal        NUMERIC(12,2) GENERATED ALWAYS AS
                    (cantidad * dias_alquiler * precio_unitario - descuento) STORED,
  notas           TEXT
);

CREATE INDEX IF NOT EXISTS idx_rep_evitems_evento ON rep_evento_items(evento_id);

-- FKs circulares hacia eventos
ALTER TABLE rep_lotes       DROP CONSTRAINT IF EXISTS fk_rep_lote_evento;
ALTER TABLE rep_lotes       ADD  CONSTRAINT fk_rep_lote_evento
  FOREIGN KEY (evento_id) REFERENCES rep_eventos(id) ON DELETE SET NULL;

ALTER TABLE rep_equipos_log DROP CONSTRAINT IF EXISTS fk_rep_eqlog_evento;
ALTER TABLE rep_equipos_log ADD  CONSTRAINT fk_rep_eqlog_evento
  FOREIGN KEY (evento_id) REFERENCES rep_eventos(id) ON DELETE SET NULL;

-- Trigger: recalcular totales del evento cuando cambian sus items
CREATE OR REPLACE FUNCTION rep_recalcular_evento()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_evento UUID;
  v_sub    NUMERIC(12,2);
  v_itbis  NUMERIC(12,2);
  v_pct    NUMERIC(5,2);
BEGIN
  v_evento := COALESCE(NEW.evento_id, OLD.evento_id);

  SELECT COALESCE(SUM(subtotal), 0) INTO v_sub
    FROM rep_evento_items WHERE evento_id = v_evento;

  SELECT COALESCE((SELECT valor::NUMERIC FROM rep_config WHERE clave = 'itbis_pct'), 18) INTO v_pct;
  v_itbis := ROUND(v_sub * v_pct / 100, 2);

  UPDATE rep_eventos
     SET subtotal = v_sub,
         itbis    = v_itbis,
         total    = ROUND(v_sub + v_itbis - descuento, 2)
   WHERE id = v_evento;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_rep_evento_items ON rep_evento_items;
CREATE TRIGGER trg_rep_evento_items
  AFTER INSERT OR UPDATE OR DELETE ON rep_evento_items
  FOR EACH ROW EXECUTE FUNCTION rep_recalcular_evento();

-- Numeración de eventos: EV-YYYY-0001
CREATE SEQUENCE IF NOT EXISTS rep_evento_seq START 1;

CREATE OR REPLACE FUNCTION rep_numero_evento()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.numero IS NULL OR NEW.numero = '' THEN
    NEW.numero := 'EV-' || TO_CHAR(NOW(),'YYYY') || '-' ||
                  LPAD(nextval('rep_evento_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rep_numero_evento ON rep_eventos;
CREATE TRIGGER trg_rep_numero_evento BEFORE INSERT ON rep_eventos
  FOR EACH ROW EXECUTE FUNCTION rep_numero_evento();

-- ============================================================================
-- 10. COTIZACIONES + items
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS rep_cotizacion_seq START 1;

CREATE TABLE IF NOT EXISTS rep_cotizaciones (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  numero            TEXT UNIQUE,
  evento_id         UUID REFERENCES rep_eventos(id)  ON DELETE SET NULL,
  cliente_id        UUID REFERENCES rep_clientes(id) ON DELETE SET NULL,
  fecha             DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_vencimiento DATE,
  subtotal          NUMERIC(12,2) NOT NULL DEFAULT 0,
  descuento         NUMERIC(12,2) NOT NULL DEFAULT 0,
  itbis             NUMERIC(12,2) NOT NULL DEFAULT 0,
  total             NUMERIC(12,2) NOT NULL DEFAULT 0,
  estado            rep_cotizacion_estado NOT NULL DEFAULT 'borrador',
  condiciones       TEXT,
  notas             TEXT,
  usuario           TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_rep_cotizaciones_updated ON rep_cotizaciones;
CREATE TRIGGER trg_rep_cotizaciones_updated BEFORE UPDATE ON rep_cotizaciones
  FOR EACH ROW EXECUTE FUNCTION rep_set_updated_at();

CREATE TABLE IF NOT EXISTS rep_cotizacion_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cotizacion_id   UUID NOT NULL REFERENCES rep_cotizaciones(id) ON DELETE CASCADE,
  descripcion     TEXT NOT NULL,
  cantidad        NUMERIC(10,3) NOT NULL DEFAULT 1,
  precio_unitario NUMERIC(12,2) NOT NULL DEFAULT 0,
  descuento       NUMERIC(12,2) NOT NULL DEFAULT 0,
  subtotal        NUMERIC(12,2) GENERATED ALWAYS AS
                    (cantidad * precio_unitario - descuento) STORED
);

CREATE INDEX IF NOT EXISTS idx_rep_cotitems_cot ON rep_cotizacion_items(cotizacion_id);

CREATE OR REPLACE FUNCTION rep_numero_cotizacion()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.numero IS NULL OR NEW.numero = '' THEN
    NEW.numero := 'COT-' || LPAD(nextval('rep_cotizacion_seq')::TEXT, 5, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rep_numero_cotizacion ON rep_cotizaciones;
CREATE TRIGGER trg_rep_numero_cotizacion BEFORE INSERT ON rep_cotizaciones
  FOR EACH ROW EXECUTE FUNCTION rep_numero_cotizacion();

CREATE OR REPLACE FUNCTION rep_recalcular_cotizacion()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_cot UUID;
  v_sub NUMERIC(12,2);
  v_pct NUMERIC(5,2);
BEGIN
  v_cot := COALESCE(NEW.cotizacion_id, OLD.cotizacion_id);

  SELECT COALESCE(SUM(subtotal), 0) INTO v_sub
    FROM rep_cotizacion_items WHERE cotizacion_id = v_cot;

  SELECT COALESCE((SELECT valor::NUMERIC FROM rep_config WHERE clave = 'itbis_pct'), 18) INTO v_pct;

  UPDATE rep_cotizaciones
     SET subtotal = v_sub,
         itbis    = ROUND(v_sub * v_pct / 100, 2),
         total    = ROUND(v_sub + (v_sub * v_pct / 100) - descuento, 2)
   WHERE id = v_cot;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_rep_cot_items ON rep_cotizacion_items;
CREATE TRIGGER trg_rep_cot_items
  AFTER INSERT OR UPDATE OR DELETE ON rep_cotizacion_items
  FOR EACH ROW EXECUTE FUNCTION rep_recalcular_cotizacion();

-- ============================================================================
-- 11. SECUENCIAS NCF (fiscal RD) — independientes de las de ul_
-- ============================================================================
CREATE TABLE IF NOT EXISTS rep_secuencias_ncf (
  tipo      rep_ncf_tipo PRIMARY KEY,
  prefijo   TEXT NOT NULL,
  siguiente INTEGER NOT NULL DEFAULT 1,
  maximo    INTEGER NOT NULL DEFAULT 99999999,
  activo    BOOLEAN NOT NULL DEFAULT TRUE
);

INSERT INTO rep_secuencias_ncf (tipo, prefijo, siguiente) VALUES
  ('B01','B01',1), ('B02','B02',1), ('B14','B14',1), ('B15','B15',1)
ON CONFLICT (tipo) DO NOTHING;

-- ============================================================================
-- 12. FACTURAS + items  (cuentas por cobrar)
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS rep_factura_seq START 1;

CREATE TABLE IF NOT EXISTS rep_facturas (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  numero            TEXT UNIQUE,
  cotizacion_id     UUID REFERENCES rep_cotizaciones(id) ON DELETE SET NULL,
  evento_id         UUID REFERENCES rep_eventos(id)      ON DELETE SET NULL,
  cliente_id        UUID REFERENCES rep_clientes(id)     ON DELETE SET NULL,
  fecha_emision     DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_vencimiento DATE,
  tipo              TEXT NOT NULL DEFAULT 'contado' CHECK (tipo IN ('contado','credito')),
  ncf               TEXT,
  ncf_tipo          rep_ncf_tipo NOT NULL DEFAULT 'B02',
  subtotal          NUMERIC(12,2) NOT NULL DEFAULT 0,
  descuento         NUMERIC(12,2) NOT NULL DEFAULT 0,
  itbis             NUMERIC(12,2) NOT NULL DEFAULT 0,
  total             NUMERIC(12,2) NOT NULL DEFAULT 0,
  monto_pagado      NUMERIC(12,2) NOT NULL DEFAULT 0,
  balance           NUMERIC(12,2) GENERATED ALWAYS AS (total - monto_pagado) STORED,
  estado            rep_factura_estado NOT NULL DEFAULT 'pendiente',
  notas             TEXT,
  usuario           TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_rep_facturas_updated ON rep_facturas;
CREATE TRIGGER trg_rep_facturas_updated BEFORE UPDATE ON rep_facturas
  FOR EACH ROW EXECUTE FUNCTION rep_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_rep_facturas_estado  ON rep_facturas(estado);
CREATE INDEX IF NOT EXISTS idx_rep_facturas_cliente ON rep_facturas(cliente_id);

CREATE TABLE IF NOT EXISTS rep_factura_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  factura_id      UUID NOT NULL REFERENCES rep_facturas(id) ON DELETE CASCADE,
  producto_id     UUID REFERENCES rep_productos(id) ON DELETE SET NULL,
  descripcion     TEXT NOT NULL,
  cantidad        NUMERIC(10,3) NOT NULL DEFAULT 1,
  precio_unitario NUMERIC(12,2) NOT NULL DEFAULT 0,
  descuento       NUMERIC(12,2) NOT NULL DEFAULT 0,
  subtotal        NUMERIC(12,2) GENERATED ALWAYS AS
                    (cantidad * precio_unitario - descuento) STORED
);

CREATE INDEX IF NOT EXISTS idx_rep_facitems_factura ON rep_factura_items(factura_id);

-- Numeración + NCF automáticos
CREATE OR REPLACE FUNCTION rep_numero_factura()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_seq rep_secuencias_ncf%ROWTYPE;
BEGIN
  IF NEW.numero IS NULL OR NEW.numero = '' THEN
    NEW.numero := 'FAC-' || LPAD(nextval('rep_factura_seq')::TEXT, 5, '0');
  END IF;

  IF NEW.ncf IS NULL OR NEW.ncf = '' THEN
    SELECT * INTO v_seq FROM rep_secuencias_ncf
     WHERE tipo = NEW.ncf_tipo AND activo = TRUE FOR UPDATE;
    IF FOUND THEN
      NEW.ncf := v_seq.prefijo || LPAD(v_seq.siguiente::TEXT, 8, '0');
      UPDATE rep_secuencias_ncf SET siguiente = siguiente + 1 WHERE tipo = NEW.ncf_tipo;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rep_numero_factura ON rep_facturas;
CREATE TRIGGER trg_rep_numero_factura BEFORE INSERT ON rep_facturas
  FOR EACH ROW EXECUTE FUNCTION rep_numero_factura();

CREATE OR REPLACE FUNCTION rep_recalcular_factura()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_fac UUID;
  v_sub NUMERIC(12,2);
  v_pct NUMERIC(5,2);
BEGIN
  v_fac := COALESCE(NEW.factura_id, OLD.factura_id);

  SELECT COALESCE(SUM(subtotal), 0) INTO v_sub
    FROM rep_factura_items WHERE factura_id = v_fac;

  SELECT COALESCE((SELECT valor::NUMERIC FROM rep_config WHERE clave = 'itbis_pct'), 18) INTO v_pct;

  UPDATE rep_facturas
     SET subtotal = v_sub,
         itbis    = ROUND(v_sub * v_pct / 100, 2),
         total    = ROUND(v_sub + (v_sub * v_pct / 100) - descuento, 2)
   WHERE id = v_fac;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_rep_fac_items ON rep_factura_items;
CREATE TRIGGER trg_rep_fac_items
  AFTER INSERT OR UPDATE OR DELETE ON rep_factura_items
  FOR EACH ROW EXECUTE FUNCTION rep_recalcular_factura();

-- ============================================================================
-- 13. PAGOS RECIBIDOS
-- ============================================================================
CREATE TABLE IF NOT EXISTS rep_pagos (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  factura_id     UUID REFERENCES rep_facturas(id) ON DELETE CASCADE,
  evento_id      UUID REFERENCES rep_eventos(id)  ON DELETE SET NULL,
  cliente_id     UUID REFERENCES rep_clientes(id) ON DELETE SET NULL,
  fecha          DATE NOT NULL DEFAULT CURRENT_DATE,
  monto          NUMERIC(12,2) NOT NULL CHECK (monto > 0),
  metodo         rep_metodo_pago NOT NULL DEFAULT 'EFECTIVO',
  referencia     TEXT,
  notas          TEXT,
  caja_sesion_id UUID,   -- FK añadida más abajo
  usuario        TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rep_pagos_factura ON rep_pagos(factura_id);
CREATE INDEX IF NOT EXISTS idx_rep_pagos_fecha   ON rep_pagos(fecha);

CREATE OR REPLACE FUNCTION rep_actualizar_pago_factura()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_fac   UUID;
  v_pag   NUMERIC(12,2);
  v_total NUMERIC(12,2);
BEGIN
  v_fac := COALESCE(NEW.factura_id, OLD.factura_id);
  IF v_fac IS NULL THEN RETURN NULL; END IF;

  SELECT COALESCE(SUM(monto),0) INTO v_pag FROM rep_pagos WHERE factura_id = v_fac;
  SELECT total INTO v_total FROM rep_facturas WHERE id = v_fac;

  UPDATE rep_facturas
     SET monto_pagado = v_pag,
         estado = CASE
           WHEN estado = 'anulada'  THEN 'anulada'
           WHEN v_pag >= v_total AND v_total > 0 THEN 'pagada'
           WHEN v_pag > 0           THEN 'parcial'
           ELSE 'pendiente'
         END
   WHERE id = v_fac;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_rep_pagos_factura ON rep_pagos;
CREATE TRIGGER trg_rep_pagos_factura
  AFTER INSERT OR UPDATE OR DELETE ON rep_pagos
  FOR EACH ROW EXECUTE FUNCTION rep_actualizar_pago_factura();

-- ============================================================================
-- 14. CUENTAS POR PAGAR + sus pagos
-- ============================================================================
CREATE TABLE IF NOT EXISTS rep_cuentas_pagar (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  proveedor_id      UUID REFERENCES rep_proveedores(id) ON DELETE SET NULL,
  numero_factura    TEXT,
  descripcion       TEXT NOT NULL,
  categoria         TEXT,
  fecha_emision     DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_vencimiento DATE,
  monto_total       NUMERIC(12,2) NOT NULL CHECK (monto_total >= 0),
  monto_pagado      NUMERIC(12,2) NOT NULL DEFAULT 0,
  balance           NUMERIC(12,2) GENERATED ALWAYS AS (monto_total - monto_pagado) STORED,
  estado            TEXT NOT NULL DEFAULT 'pendiente'
                    CHECK (estado IN ('pendiente','parcial','pagada','vencida','anulada')),
  notas             TEXT,
  usuario           TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_rep_cxp_updated ON rep_cuentas_pagar;
CREATE TRIGGER trg_rep_cxp_updated BEFORE UPDATE ON rep_cuentas_pagar
  FOR EACH ROW EXECUTE FUNCTION rep_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_rep_cxp_estado    ON rep_cuentas_pagar(estado);
CREATE INDEX IF NOT EXISTS idx_rep_cxp_proveedor ON rep_cuentas_pagar(proveedor_id);

CREATE TABLE IF NOT EXISTS rep_cuentas_pagar_pagos (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cuenta_pagar_id  UUID NOT NULL REFERENCES rep_cuentas_pagar(id) ON DELETE CASCADE,
  fecha            DATE NOT NULL DEFAULT CURRENT_DATE,
  monto            NUMERIC(12,2) NOT NULL CHECK (monto > 0),
  metodo           rep_metodo_pago NOT NULL DEFAULT 'TRANSFERENCIA',
  referencia       TEXT,
  notas            TEXT,
  usuario          TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION rep_actualizar_cxp()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_cta   UUID;
  v_pag   NUMERIC(12,2);
  v_total NUMERIC(12,2);
BEGIN
  v_cta := COALESCE(NEW.cuenta_pagar_id, OLD.cuenta_pagar_id);

  SELECT COALESCE(SUM(monto),0) INTO v_pag
    FROM rep_cuentas_pagar_pagos WHERE cuenta_pagar_id = v_cta;
  SELECT monto_total INTO v_total FROM rep_cuentas_pagar WHERE id = v_cta;

  UPDATE rep_cuentas_pagar
     SET monto_pagado = v_pag,
         estado = CASE
           WHEN estado = 'anulada' THEN 'anulada'
           WHEN v_pag >= v_total AND v_total > 0 THEN 'pagada'
           WHEN v_pag > 0          THEN 'parcial'
           ELSE 'pendiente'
         END
   WHERE id = v_cta;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_rep_cxp_pagos ON rep_cuentas_pagar_pagos;
CREATE TRIGGER trg_rep_cxp_pagos
  AFTER INSERT OR UPDATE OR DELETE ON rep_cuentas_pagar_pagos
  FOR EACH ROW EXECUTE FUNCTION rep_actualizar_cxp();

-- ============================================================================
-- 15. CAJA (sesiones y movimientos)
-- ============================================================================
CREATE TABLE IF NOT EXISTS rep_caja_sesiones (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre             TEXT NOT NULL DEFAULT 'Caja Repostería',
  fecha_apertura     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fecha_cierre       TIMESTAMPTZ,
  monto_apertura     NUMERIC(12,2) NOT NULL DEFAULT 0,
  efectivo_esperado  NUMERIC(12,2) NOT NULL DEFAULT 0,
  efectivo_declarado NUMERIC(12,2),
  diferencia         NUMERIC(12,2) GENERATED ALWAYS AS
                       (COALESCE(efectivo_declarado,0) - efectivo_esperado) STORED,
  estado             TEXT NOT NULL DEFAULT 'abierta' CHECK (estado IN ('abierta','cerrada')),
  notas              TEXT,
  abierto_por        TEXT,
  cerrado_por        TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rep_caja_estado ON rep_caja_sesiones(estado);

CREATE TABLE IF NOT EXISTS rep_caja_movimientos (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sesion_id   UUID NOT NULL REFERENCES rep_caja_sesiones(id) ON DELETE CASCADE,
  tipo        TEXT NOT NULL CHECK (tipo IN ('ingreso','egreso')),
  descripcion TEXT NOT NULL,
  monto       NUMERIC(12,2) NOT NULL CHECK (monto >= 0),
  metodo      rep_metodo_pago NOT NULL DEFAULT 'EFECTIVO',
  referencia  TEXT,
  factura_id  UUID REFERENCES rep_facturas(id) ON DELETE SET NULL,
  pago_id     UUID REFERENCES rep_pagos(id)    ON DELETE SET NULL,
  venta_id    UUID,
  usuario     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rep_cajamov_sesion ON rep_caja_movimientos(sesion_id);

ALTER TABLE rep_pagos DROP CONSTRAINT IF EXISTS fk_rep_pago_caja;
ALTER TABLE rep_pagos ADD  CONSTRAINT fk_rep_pago_caja
  FOREIGN KEY (caja_sesion_id) REFERENCES rep_caja_sesiones(id) ON DELETE SET NULL;

-- Trigger: mantener el efectivo esperado de la sesión abierta
CREATE OR REPLACE FUNCTION rep_actualizar_caja()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_sesion UUID;
  v_neto   NUMERIC(12,2);
BEGIN
  v_sesion := COALESCE(NEW.sesion_id, OLD.sesion_id);

  SELECT COALESCE(SUM(CASE WHEN tipo = 'ingreso' THEN monto ELSE -monto END), 0)
    INTO v_neto
    FROM rep_caja_movimientos
   WHERE sesion_id = v_sesion AND metodo = 'EFECTIVO';

  UPDATE rep_caja_sesiones
     SET efectivo_esperado = monto_apertura + v_neto
   WHERE id = v_sesion;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_rep_caja_mov ON rep_caja_movimientos;
CREATE TRIGGER trg_rep_caja_mov
  AFTER INSERT OR UPDATE OR DELETE ON rep_caja_movimientos
  FOR EACH ROW EXECUTE FUNCTION rep_actualizar_caja();

-- ============================================================================
-- 16. CAJA CHICA
-- ============================================================================
CREATE TABLE IF NOT EXISTS rep_caja_chica (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre         TEXT NOT NULL DEFAULT 'Caja Chica Repostería',
  fondo_inicial  NUMERIC(12,2) NOT NULL DEFAULT 0,
  saldo_actual   NUMERIC(12,2) NOT NULL DEFAULT 0,
  umbral_reponer NUMERIC(12,2) NOT NULL DEFAULT 0,
  activo         BOOLEAN NOT NULL DEFAULT TRUE,
  usuario        TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_rep_cchica_updated ON rep_caja_chica;
CREATE TRIGGER trg_rep_cchica_updated BEFORE UPDATE ON rep_caja_chica
  FOR EACH ROW EXECUTE FUNCTION rep_set_updated_at();

CREATE TABLE IF NOT EXISTS rep_caja_chica_gastos (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fondo_id        UUID NOT NULL REFERENCES rep_caja_chica(id) ON DELETE CASCADE,
  fecha           DATE NOT NULL DEFAULT CURRENT_DATE,
  descripcion     TEXT NOT NULL,
  categoria       TEXT NOT NULL DEFAULT 'general',
  monto           NUMERIC(12,2) NOT NULL CHECK (monto > 0),
  comprobante_url TEXT,
  aprobado_por    TEXT,
  usuario         TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rep_caja_chica_reposiciones (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fondo_id    UUID NOT NULL REFERENCES rep_caja_chica(id) ON DELETE CASCADE,
  fecha       DATE NOT NULL DEFAULT CURRENT_DATE,
  monto       NUMERIC(12,2) NOT NULL CHECK (monto > 0),
  descripcion TEXT,
  usuario     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION rep_actualizar_caja_chica()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_fondo UUID;
BEGIN
  v_fondo := COALESCE(NEW.fondo_id, OLD.fondo_id);

  UPDATE rep_caja_chica
     SET saldo_actual = fondo_inicial
       + COALESCE((SELECT SUM(monto) FROM rep_caja_chica_reposiciones WHERE fondo_id = v_fondo), 0)
       - COALESCE((SELECT SUM(monto) FROM rep_caja_chica_gastos       WHERE fondo_id = v_fondo), 0)
   WHERE id = v_fondo;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_rep_cchica_gastos ON rep_caja_chica_gastos;
CREATE TRIGGER trg_rep_cchica_gastos
  AFTER INSERT OR UPDATE OR DELETE ON rep_caja_chica_gastos
  FOR EACH ROW EXECUTE FUNCTION rep_actualizar_caja_chica();

DROP TRIGGER IF EXISTS trg_rep_cchica_repo ON rep_caja_chica_reposiciones;
CREATE TRIGGER trg_rep_cchica_repo
  AFTER INSERT OR UPDATE OR DELETE ON rep_caja_chica_reposiciones
  FOR EACH ROW EXECUTE FUNCTION rep_actualizar_caja_chica();

-- ============================================================================
-- 17. INVENTARIO: movimientos + compras de ingredientes (FEFO)
-- ============================================================================
CREATE TABLE IF NOT EXISTS rep_movimientos_inventario (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tipo           TEXT NOT NULL CHECK (tipo IN ('entrada','salida','ajuste','merma')),
  ingrediente_id UUID REFERENCES rep_ingredientes(id) ON DELETE CASCADE,
  equipo_id      UUID REFERENCES rep_equipos(id)      ON DELETE SET NULL,
  cantidad       NUMERIC(12,3) NOT NULL,
  unidad         TEXT,
  costo_unitario NUMERIC(12,2),
  motivo         TEXT,
  referencia     TEXT,
  evento_id      UUID REFERENCES rep_eventos(id) ON DELETE SET NULL,
  usuario        TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rep_movinv_ing   ON rep_movimientos_inventario(ingrediente_id);
CREATE INDEX IF NOT EXISTS idx_rep_movinv_fecha ON rep_movimientos_inventario(created_at);

CREATE TABLE IF NOT EXISTS rep_compras_ingredientes (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ingrediente_id    UUID NOT NULL REFERENCES rep_ingredientes(id) ON DELETE CASCADE,
  proveedor_id      UUID REFERENCES rep_proveedores(id) ON DELETE SET NULL,
  cantidad          NUMERIC(12,3) NOT NULL CHECK (cantidad > 0),
  unidad            TEXT NOT NULL DEFAULT 'unidad',
  costo_unitario    NUMERIC(12,2) NOT NULL DEFAULT 0,
  fecha_compra      DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_vencimiento DATE,                       -- FEFO: First Expiry First Out
  numero_lote       TEXT,
  factura_ref       TEXT,
  cantidad_restante NUMERIC(12,3),
  notas             TEXT,
  usuario           TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rep_compras_fefo
  ON rep_compras_ingredientes(ingrediente_id, fecha_vencimiento ASC NULLS LAST);

-- Compra → sube stock, actualiza costo y deja rastro en movimientos
CREATE OR REPLACE FUNCTION rep_registrar_compra()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.cantidad_restante := COALESCE(NEW.cantidad_restante, NEW.cantidad);

  UPDATE rep_ingredientes
     SET stock_actual            = stock_actual + NEW.cantidad,
         costo_unitario          = NEW.costo_unitario,
         fecha_ultimo_movimiento = CURRENT_DATE
   WHERE id = NEW.ingrediente_id;

  INSERT INTO rep_movimientos_inventario
    (tipo, ingrediente_id, cantidad, unidad, costo_unitario, motivo, referencia, usuario)
  VALUES
    ('entrada', NEW.ingrediente_id, NEW.cantidad, NEW.unidad,
     NEW.costo_unitario, 'Compra a proveedor', NEW.factura_ref, NEW.usuario);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rep_compra ON rep_compras_ingredientes;
CREATE TRIGGER trg_rep_compra BEFORE INSERT ON rep_compras_ingredientes
  FOR EACH ROW EXECUTE FUNCTION rep_registrar_compra();

-- Salidas / mermas / ajustes → mueven el stock del ingrediente
CREATE OR REPLACE FUNCTION rep_aplicar_movimiento_inventario()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.ingrediente_id IS NULL THEN RETURN NEW; END IF;

  IF NEW.tipo IN ('salida','merma') THEN
    UPDATE rep_ingredientes
       SET stock_actual            = GREATEST(stock_actual - NEW.cantidad, 0),
           fecha_ultimo_movimiento = CURRENT_DATE
     WHERE id = NEW.ingrediente_id;
  ELSIF NEW.tipo = 'ajuste' THEN
    UPDATE rep_ingredientes
       SET stock_actual            = GREATEST(NEW.cantidad, 0),
           fecha_ultimo_movimiento = CURRENT_DATE
     WHERE id = NEW.ingrediente_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rep_mov_inventario ON rep_movimientos_inventario;
CREATE TRIGGER trg_rep_mov_inventario
  AFTER INSERT ON rep_movimientos_inventario
  FOR EACH ROW
  WHEN (NEW.tipo <> 'entrada')
  EXECUTE FUNCTION rep_aplicar_movimiento_inventario();

-- ============================================================================
-- 18. POS REPOSTERÍA: ventas, detalle y cuadre de caja
-- ============================================================================
CREATE TABLE IF NOT EXISTS rep_ventas (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  numero           TEXT UNIQUE,
  cliente_id       UUID REFERENCES rep_clientes(id) ON DELETE SET NULL,
  total            NUMERIC(12,2) NOT NULL CHECK (total >= 0),
  subtotal         NUMERIC(12,2) NOT NULL DEFAULT 0,
  itbis_total      NUMERIC(12,2) NOT NULL DEFAULT 0,
  descuento        NUMERIC(12,2) NOT NULL DEFAULT 0,
  metodo_pago      rep_metodo_pago NOT NULL DEFAULT 'EFECTIVO',
  ncf              TEXT,
  ncf_tipo         rep_ncf_tipo NOT NULL DEFAULT 'B02',
  cliente_nombre   TEXT,
  cliente_rnc      TEXT,
  caja_sesion_id   UUID REFERENCES rep_caja_sesiones(id) ON DELETE SET NULL,
  cajero           TEXT,
  notas            TEXT,
  anulada          BOOLEAN NOT NULL DEFAULT FALSE,
  motivo_anulacion TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rep_ventas_fecha   ON rep_ventas(created_at);
CREATE INDEX IF NOT EXISTS idx_rep_ventas_metodo  ON rep_ventas(metodo_pago);
CREATE INDEX IF NOT EXISTS idx_rep_ventas_anulada ON rep_ventas(anulada);

CREATE TABLE IF NOT EXISTS rep_detalle_ventas (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  venta_id        UUID NOT NULL REFERENCES rep_ventas(id) ON DELETE CASCADE,
  producto_id     UUID REFERENCES rep_productos(id) ON DELETE SET NULL,
  lote_id         UUID REFERENCES rep_lotes(id)     ON DELETE SET NULL,
  nombre_producto TEXT NOT NULL,
  categoria       TEXT,
  qty             NUMERIC(10,2) NOT NULL CHECK (qty > 0),
  precio_unitario NUMERIC(12,2) NOT NULL CHECK (precio_unitario >= 0),
  costo_unitario  NUMERIC(12,2) NOT NULL DEFAULT 0,
  itbis           NUMERIC(12,2) NOT NULL DEFAULT 0,
  descuento       NUMERIC(12,2) NOT NULL DEFAULT 0,
  subtotal        NUMERIC(12,2) NOT NULL CHECK (subtotal >= 0)
);

CREATE INDEX IF NOT EXISTS idx_rep_detventas_venta ON rep_detalle_ventas(venta_id);

-- Numeración de venta: REP-YYYYMMDD-0001
CREATE OR REPLACE FUNCTION rep_numero_venta()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF NEW.numero IS NULL OR NEW.numero = '' THEN
    SELECT COUNT(*) + 1 INTO v_count FROM rep_ventas
     WHERE DATE(created_at) = DATE(COALESCE(NEW.created_at, NOW()));
    NEW.numero := 'REP-' || TO_CHAR(COALESCE(NEW.created_at, NOW()), 'YYYYMMDD')
                  || '-' || LPAD(v_count::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rep_numero_venta ON rep_ventas;
CREATE TRIGGER trg_rep_numero_venta BEFORE INSERT ON rep_ventas
  FOR EACH ROW EXECUTE FUNCTION rep_numero_venta();

-- NCF automático en la venta POS
CREATE OR REPLACE FUNCTION rep_ncf_venta()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_seq rep_secuencias_ncf%ROWTYPE;
BEGIN
  IF NEW.ncf IS NOT NULL AND NEW.ncf <> '' THEN RETURN NEW; END IF;

  SELECT * INTO v_seq FROM rep_secuencias_ncf
   WHERE tipo = NEW.ncf_tipo AND activo = TRUE FOR UPDATE;
  IF NOT FOUND THEN RETURN NEW; END IF;

  NEW.ncf := v_seq.prefijo || LPAD(v_seq.siguiente::TEXT, 8, '0');
  UPDATE rep_secuencias_ncf SET siguiente = siguiente + 1 WHERE tipo = NEW.ncf_tipo;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rep_ncf_venta ON rep_ventas;
CREATE TRIGGER trg_rep_ncf_venta BEFORE INSERT ON rep_ventas
  FOR EACH ROW EXECUTE FUNCTION rep_ncf_venta();

-- Venta de un lote → descuenta del lote automáticamente
CREATE OR REPLACE FUNCTION rep_descontar_lote_venta()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.lote_id IS NOT NULL THEN
    INSERT INTO rep_lote_movimientos (lote_id, tipo, cantidad, motivo, venta_id)
    VALUES (NEW.lote_id, 'venta', NEW.qty, 'Venta POS', NEW.venta_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rep_venta_lote ON rep_detalle_ventas;
CREATE TRIGGER trg_rep_venta_lote AFTER INSERT ON rep_detalle_ventas
  FOR EACH ROW EXECUTE FUNCTION rep_descontar_lote_venta();

-- Anulación → devuelve al lote
CREATE OR REPLACE FUNCTION rep_anular_venta()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  d RECORD;
BEGIN
  IF OLD.anulada = FALSE AND NEW.anulada = TRUE THEN
    FOR d IN SELECT * FROM rep_detalle_ventas WHERE venta_id = NEW.id LOOP
      IF d.lote_id IS NOT NULL THEN
        INSERT INTO rep_lote_movimientos (lote_id, tipo, cantidad, motivo, venta_id)
        VALUES (d.lote_id, 'ajuste', d.qty,
                'Anulación: ' || COALESCE(NEW.motivo_anulacion,''), NEW.id);
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rep_anular_venta ON rep_ventas;
CREATE TRIGGER trg_rep_anular_venta AFTER UPDATE ON rep_ventas
  FOR EACH ROW EXECUTE FUNCTION rep_anular_venta();

CREATE TABLE IF NOT EXISTS rep_cuadre (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fecha                DATE NOT NULL,
  usuario              TEXT,
  ventas_efectivo      NUMERIC(12,2) NOT NULL DEFAULT 0,
  ventas_tarjeta       NUMERIC(12,2) NOT NULL DEFAULT 0,
  ventas_transferencia NUMERIC(12,2) NOT NULL DEFAULT 0,
  ventas_total         NUMERIC(12,2) NOT NULL DEFAULT 0,
  transacciones_count  INTEGER NOT NULL DEFAULT 0,
  efectivo_inicial     NUMERIC(12,2) NOT NULL DEFAULT 0,
  efectivo_contado     NUMERIC(12,2) NOT NULL DEFAULT 0,
  diferencia           NUMERIC(12,2) NOT NULL DEFAULT 0,
  notas                TEXT,
  cerrado              BOOLEAN NOT NULL DEFAULT FALSE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_rep_cuadre_fecha ON rep_cuadre(fecha);

-- ============================================================================
-- VISTAS
-- ============================================================================

-- Estado del inventario de ingredientes con alertas y FEFO
CREATE OR REPLACE VIEW rep_ingredientes_status AS
SELECT
  i.*,
  CASE
    WHEN i.stock_actual = 0                 THEN 'agotado'
    WHEN i.stock_actual <= i.punto_reorden  THEN 'critico'
    WHEN i.stock_actual <= i.stock_minimo   THEN 'bajo'
    ELSE 'ok'
  END                                          AS nivel_alerta,
  ROUND(i.stock_actual * i.costo_unitario, 2)  AS valor_stock,
  p.nombre                                     AS proveedor_nombre,
  (SELECT MIN(c.fecha_vencimiento)
     FROM rep_compras_ingredientes c
    WHERE c.ingrediente_id = i.id
      AND c.fecha_vencimiento IS NOT NULL
      AND COALESCE(c.cantidad_restante,0) > 0) AS proximo_vencimiento
FROM rep_ingredientes i
LEFT JOIN rep_proveedores p ON p.id = i.proveedor_id
WHERE i.activo = TRUE;

-- Lotes con semáforo de vencimiento
CREATE OR REPLACE VIEW rep_lotes_alerta AS
SELECT
  l.*,
  pr.nombre AS producto_nombre,
  (l.fecha_vencimiento - CURRENT_DATE) AS dias_restantes,
  CASE
    WHEN l.estado IN ('vencido','descartado')      THEN 'vencido'
    WHEN l.fecha_vencimiento <  CURRENT_DATE       THEN 'vencido'
    WHEN l.fecha_vencimiento <= CURRENT_DATE + 1   THEN 'critico'
    WHEN l.fecha_vencimiento <= CURRENT_DATE + 3   THEN 'proximo'
    ELSE 'ok'
  END AS nivel_alerta
FROM rep_lotes l
LEFT JOIN rep_productos pr ON pr.id = l.producto_id;

-- Ventas POS por día
CREATE OR REPLACE VIEW rep_ventas_diarias AS
SELECT
  DATE(created_at)                                                                 AS fecha,
  COUNT(*)                                                                         AS total_transacciones,
  SUM(CASE WHEN NOT anulada THEN 1 ELSE 0 END)                                     AS ventas_validas,
  SUM(CASE WHEN NOT anulada THEN total ELSE 0 END)                                 AS monto_total,
  SUM(CASE WHEN NOT anulada AND metodo_pago='EFECTIVO'      THEN total ELSE 0 END) AS efectivo,
  SUM(CASE WHEN NOT anulada AND metodo_pago='TARJETA'       THEN total ELSE 0 END) AS tarjeta,
  SUM(CASE WHEN NOT anulada AND metodo_pago='TRANSFERENCIA' THEN total ELSE 0 END) AS transferencia
FROM rep_ventas
GROUP BY DATE(created_at);

-- Cuadre automático del día
CREATE OR REPLACE VIEW rep_cuadre_auto AS
SELECT
  DATE(created_at) AS fecha,
  SUM(CASE WHEN NOT anulada AND metodo_pago='EFECTIVO'      THEN total ELSE 0 END) AS ventas_efectivo,
  SUM(CASE WHEN NOT anulada AND metodo_pago='TARJETA'       THEN total ELSE 0 END) AS ventas_tarjeta,
  SUM(CASE WHEN NOT anulada AND metodo_pago='TRANSFERENCIA' THEN total ELSE 0 END) AS ventas_transferencia,
  SUM(CASE WHEN NOT anulada THEN total ELSE 0 END)                                 AS ventas_total,
  COUNT(CASE WHEN NOT anulada THEN 1 END)                                          AS transacciones_count
FROM rep_ventas
GROUP BY DATE(created_at);

-- Productos más vendidos
CREATE OR REPLACE VIEW rep_top_productos AS
SELECT
  p.id, p.nombre, p.categoria, p.precio_venta,
  SUM(d.qty)      AS unidades_vendidas,
  SUM(d.subtotal) AS ingresos_total
FROM rep_detalle_ventas d
JOIN rep_productos p ON p.id = d.producto_id
JOIN rep_ventas    v ON v.id = d.venta_id
WHERE NOT v.anulada
GROUP BY p.id, p.nombre, p.categoria, p.precio_venta;

-- Cuentas por cobrar abiertas
CREATE OR REPLACE VIEW rep_cxc_abiertas AS
SELECT
  f.*,
  c.nombre || ' ' || c.apellido        AS cliente_nombre_full,
  (CURRENT_DATE - f.fecha_vencimiento) AS dias_vencida
FROM rep_facturas f
LEFT JOIN rep_clientes c ON c.id = f.cliente_id
WHERE f.estado IN ('pendiente','parcial','vencida');

-- Cuentas por pagar abiertas
CREATE OR REPLACE VIEW rep_cxp_abiertas AS
SELECT
  cp.*,
  p.nombre AS proveedor_nombre,
  (CURRENT_DATE - cp.fecha_vencimiento) AS dias_vencida
FROM rep_cuentas_pagar cp
LEFT JOIN rep_proveedores p ON p.id = cp.proveedor_id
WHERE cp.estado IN ('pendiente','parcial','vencida');

-- Agenda de eventos con datos del cliente
CREATE OR REPLACE VIEW rep_agenda_eventos AS
SELECT
  e.*,
  c.nombre || ' ' || c.apellido AS cliente_nombre_full,
  c.telefono                    AS cliente_telefono
FROM rep_eventos e
LEFT JOIN rep_clientes c ON c.id = e.cliente_id;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
DO $$
DECLARE
  t TEXT;
  tablas TEXT[] := ARRAY[
    'rep_config','rep_clientes','rep_proveedores','rep_ingredientes','rep_productos',
    'rep_recetas','rep_receta_ingredientes','rep_lotes','rep_lote_movimientos',
    'rep_equipos','rep_equipos_log','rep_eventos','rep_evento_items',
    'rep_cotizaciones','rep_cotizacion_items','rep_secuencias_ncf',
    'rep_facturas','rep_factura_items','rep_pagos',
    'rep_cuentas_pagar','rep_cuentas_pagar_pagos',
    'rep_caja_sesiones','rep_caja_movimientos',
    'rep_caja_chica','rep_caja_chica_gastos','rep_caja_chica_reposiciones',
    'rep_movimientos_inventario','rep_compras_ingredientes',
    'rep_ventas','rep_detalle_ventas','rep_cuadre'
  ];
BEGIN
  FOREACH t IN ARRAY tablas LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "%s_auth_all" ON %I', t, t);
    EXECUTE format(
      'CREATE POLICY "%s_auth_all" ON %I FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE)',
      t, t
    );
  END LOOP;
END $$;

-- Lectura pública del catálogo (menú / carta), igual que en ul_productos
DROP POLICY IF EXISTS "rep_productos_anon_select" ON rep_productos;
CREATE POLICY "rep_productos_anon_select" ON rep_productos
  FOR SELECT TO anon USING (activo = TRUE);

-- Nota: las API routes usan la service role key, que ignora RLS.

-- ============================================================================
-- SEED — configuración y datos base
-- ============================================================================
INSERT INTO rep_config (clave, valor, descripcion) VALUES
  ('nombre',      'Repostería UNLUPASO', 'Nombre del área de repostería'),
  ('slogan',      'Un lugar para soñar', 'Slogan'),
  ('telefono',    '829-644-7991',        'Teléfono'),
  ('rnc',         '',                    'RNC'),
  ('direccion',   '',                    'Dirección'),
  ('moneda',      'DOP',                 'Moneda ISO 4217'),
  ('itbis_pct',   '18',                  'Porcentaje ITBIS por defecto'),
  ('ncf_default', 'B02',                 'Tipo NCF por defecto'),
  ('deposito_pct','50',                  'Porcentaje de depósito para eventos'),
  ('logo_url',    '',                    'URL del logo')
ON CONFLICT (clave) DO NOTHING;

INSERT INTO rep_caja_chica (nombre, fondo_inicial, saldo_actual, umbral_reponer)
SELECT 'Caja Chica Repostería', 5000, 5000, 1000
WHERE NOT EXISTS (SELECT 1 FROM rep_caja_chica);

-- Los seeds solo corren la primera vez: si la tabla ya tiene datos, se omiten.
INSERT INTO rep_ingredientes (nombre, categoria, unidad, costo_unitario, stock_actual, stock_minimo, punto_reorden)
SELECT * FROM (VALUES
  ('Harina de trigo',      'harina',      'lb',     35.00, 100, 20, 30),
  ('Azúcar blanca',        'azucar',      'lb',     30.00,  80, 20, 30),
  ('Mantequilla',          'grasa',       'lb',    140.00,  40, 10, 15),
  ('Huevos',               'huevo',       'unidad',  9.00, 180, 60, 90),
  ('Leche líquida',        'lacteo',      'lt',     65.00,  30, 10, 15),
  ('Queso crema',          'lacteo',      'lb',    180.00,  20,  5,  8),
  ('Cacao en polvo',       'saborizante', 'lb',    220.00,  10,  3,  5),
  ('Esencia de vainilla',  'saborizante', 'oz',     45.00,  12,  4,  6),
  ('Polvo de hornear',     'otro',        'oz',     25.00,  20,  5,  8),
  ('Fondant blanco',       'decoracion',  'lb',    260.00,  15,  4,  6)
) AS s(nombre, categoria, unidad, costo_unitario, stock_actual, stock_minimo, punto_reorden)
WHERE NOT EXISTS (SELECT 1 FROM rep_ingredientes);

INSERT INTO rep_productos (nombre, categoria, precio_venta, costo_estimado, unidad, itbis)
SELECT * FROM (VALUES
  ('Bizcocho de chocolate 8 porciones', 'bizcocho', 1800.00,  700.00, 'unidad', 18),
  ('Bizcocho de vainilla 8 porciones',  'bizcocho', 1700.00,  650.00, 'unidad', 18),
  ('Bizcocho decorado 20 porciones',    'bizcocho', 4500.00, 1800.00, 'unidad', 18),
  ('Cupcake decorado',                  'cupcake',    90.00,   35.00, 'unidad', 18),
  ('Docena de cupcakes',                'cupcake',   950.00,  380.00, 'docena', 18),
  ('Cheesecake entero',                 'postre',   2200.00,  850.00, 'unidad', 18),
  ('Porción de cheesecake',             'postre',    250.00,   95.00, 'porcion',18),
  ('Tres leches 10 porciones',          'postre',   2400.00,  900.00, 'unidad', 18),
  ('Galletas decoradas (12u)',          'galleta',   750.00,  260.00, 'docena', 18),
  ('Pan dulce artesanal',               'pan',        60.00,   22.00, 'unidad', 18),
  ('Montaje y decoración de mesa',      'servicio', 3500.00,  800.00, 'servicio',18)
) AS s(nombre, categoria, precio_venta, costo_estimado, unidad, itbis)
WHERE NOT EXISTS (SELECT 1 FROM rep_productos);

INSERT INTO rep_equipos (nombre, categoria, cantidad_total, precio_alquiler, costo_reposicion)
SELECT * FROM (VALUES
  ('Mesa rectangular 6 pies', 'mesa',        20,  350.00,  4500.00),
  ('Silla Tiffany',           'silla',      100,   80.00,  1800.00),
  ('Mantel blanco',           'mantel',      40,  120.00,   900.00),
  ('Base para bizcocho',      'decoracion',  15,  250.00,  1200.00),
  ('Carpa 10x10',             'carpa',        4, 2500.00, 35000.00),
  ('Juego de vajilla (12p)',  'vajilla',     20,  400.00,  3200.00),
  ('Bocina + micrófono',      'audio',        2, 1800.00, 22000.00)
) AS s(nombre, categoria, cantidad_total, precio_alquiler, costo_reposicion)
WHERE NOT EXISTS (SELECT 1 FROM rep_equipos);

-- ============================================================================
-- ✅ ERP REPOSTERÍA LISTO
-- 31 tablas · 8 vistas · prefijo rep_ · sin cruce con las tablas ul_
-- ============================================================================
