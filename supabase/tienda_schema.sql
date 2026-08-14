-- =====================================================================
--  MAXMATT SHOP — módulo de tienda dentro del proyecto UNLUPASO
--  Prefijo de tablas: ti_    ·    Ruta de la app: /tienda
-- =====================================================================
--  Cuarto módulo independiente del proyecto. Ninguna tabla ti_ referencia
--  tablas ul_, rep_ ni pr_: los clientes de la tienda son suyos y no se
--  mezclan con los del sistema de préstamos.
--
--  Ejecutar completo en Supabase → SQL Editor. Es idempotente.
-- =====================================================================

create extension if not exists "pgcrypto";

-- =====================================================================
-- 1. CONFIGURACIÓN DE LA EMPRESA
-- =====================================================================
create table if not exists ti_config (
  id               int primary key default 1 check (id = 1),
  nombre_empresa   text not null default 'MAXMATT SHOP',
  slogan           text,
  rnc              text,
  telefono         text,
  telefono2        text,
  email            text,
  direccion        text,
  moneda           text not null default 'DOP',
  simbolo_moneda   text not null default 'RD$',
  itbis_pct        numeric(6,3) not null default 18,      -- ITBIS por defecto de productos nuevos
  dias_credito     int not null default 30,               -- plazo por defecto a crédito
  fondo_caja       numeric(14,2) not null default 0,      -- efectivo con que abre la caja
  logo_url         text,
  pie_factura      text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
insert into ti_config (id) values (1) on conflict (id) do nothing;

-- =====================================================================
-- 2. SECUENCIAS DE CÓDIGO
-- =====================================================================
create sequence if not exists ti_seq_cliente    start 1;
create sequence if not exists ti_seq_proveedor  start 1;
create sequence if not exists ti_seq_producto   start 1;
create sequence if not exists ti_seq_venta      start 1;
create sequence if not exists ti_seq_compra     start 1;
create sequence if not exists ti_seq_recibo     start 1;

-- =====================================================================
-- 3. CLIENTES DE LA TIENDA  (independientes de pr_clientes)
-- =====================================================================
create table if not exists ti_clientes (
  id             uuid primary key default gen_random_uuid(),
  codigo         text unique not null default ('TC-' || lpad(nextval('ti_seq_cliente')::text, 4, '0')),
  nombre         text not null,
  tipo           text not null default 'persona' check (tipo in ('persona','empresa')),
  cedula_rnc     text,
  telefono       text,
  telefono2      text,
  email          text,
  direccion      text,
  -- Crédito
  permite_credito boolean not null default false,
  limite_credito  numeric(14,2) not null default 0,
  dias_credito    int not null default 30,
  notas          text,
  activo         boolean not null default true,
  usuario        text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists ti_idx_clientes_nombre on ti_clientes (lower(nombre));
create index if not exists ti_idx_clientes_doc    on ti_clientes (cedula_rnc);

-- =====================================================================
-- 4. PROVEEDORES
-- =====================================================================
create table if not exists ti_proveedores (
  id           uuid primary key default gen_random_uuid(),
  codigo       text unique not null default ('TP-' || lpad(nextval('ti_seq_proveedor')::text, 4, '0')),
  nombre       text not null,
  contacto     text,
  rnc          text,
  telefono     text,
  email        text,
  direccion    text,
  categoria    text,
  dias_credito int not null default 30,
  notas        text,
  activo       boolean not null default true,
  usuario      text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists ti_idx_proveedores_nombre on ti_proveedores (lower(nombre));

-- =====================================================================
-- 5. INVENTARIO
-- =====================================================================
create table if not exists ti_productos (
  id             uuid primary key default gen_random_uuid(),
  codigo         text unique not null default ('ART-' || lpad(nextval('ti_seq_producto')::text, 5, '0')),
  codigo_barra   text,
  nombre         text not null,
  descripcion    text,
  categoria      text,
  marca          text,
  unidad         text not null default 'unidad',
  costo          numeric(14,2) not null default 0,   -- lo que cuesta comprarlo
  precio         numeric(14,2) not null default 0,   -- precio de venta SIN ITBIS
  itbis_pct      numeric(6,3) not null default 0,    -- 0 = exento; 18 = se le suma 18 %
  stock_actual   numeric(14,3) not null default 0,
  stock_minimo   numeric(14,3) not null default 0,
  ubicacion      text,
  proveedor_id   uuid references ti_proveedores(id) on delete set null,
  imagen_url     text,
  activo         boolean not null default true,
  usuario        text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists ti_idx_productos_nombre on ti_productos (lower(nombre));
create index if not exists ti_idx_productos_barra  on ti_productos (codigo_barra);
create index if not exists ti_idx_productos_cat    on ti_productos (categoria);

-- Kardex: toda entrada y salida deja rastro
create table if not exists ti_movimientos_inventario (
  id            uuid primary key default gen_random_uuid(),
  producto_id   uuid not null references ti_productos(id) on delete cascade,
  fecha         date not null default current_date,
  tipo          text not null check (tipo in ('entrada','salida','ajuste','devolucion','merma')),
  cantidad      numeric(14,3) not null,          -- siempre positiva
  costo_unitario numeric(14,2) not null default 0,
  stock_antes   numeric(14,3) not null default 0,
  stock_despues numeric(14,3) not null default 0,
  referencia    text,                            -- factura, compra, conteo…
  origen        text not null default 'manual'
                  check (origen in ('manual','compra','venta','anulacion','conteo')),
  origen_id     uuid,
  notas         text,
  usuario       text,
  created_at    timestamptz not null default now()
);
create index if not exists ti_idx_mov_inv_prod  on ti_movimientos_inventario (producto_id, fecha);
create index if not exists ti_idx_mov_inv_fecha on ti_movimientos_inventario (fecha);

-- =====================================================================
-- 6. COMPRAS  (suben inventario y generan cuentas por pagar)
-- =====================================================================
create table if not exists ti_compras (
  id            uuid primary key default gen_random_uuid(),
  codigo        text unique not null default ('CMP-' || lpad(nextval('ti_seq_compra')::text, 5, '0')),
  proveedor_id  uuid references ti_proveedores(id) on delete restrict,
  fecha         date not null default current_date,
  ncf           text,
  condicion     text not null default 'contado' check (condicion in ('contado','credito')),
  fecha_vence   date,
  subtotal      numeric(14,2) not null default 0,
  itbis         numeric(14,2) not null default 0,
  descuento     numeric(14,2) not null default 0,
  total         numeric(14,2) not null default 0,
  pagado        numeric(14,2) not null default 0,
  estado        text not null default 'pendiente'
                  check (estado in ('pendiente','parcial','pagada','anulada')),
  notas         text,
  usuario       text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists ti_idx_compras_prov  on ti_compras (proveedor_id, fecha);
create index if not exists ti_idx_compras_estado on ti_compras (estado);

create table if not exists ti_compra_items (
  id          uuid primary key default gen_random_uuid(),
  compra_id   uuid not null references ti_compras(id) on delete cascade,
  producto_id uuid not null references ti_productos(id) on delete restrict,
  cantidad    numeric(14,3) not null check (cantidad > 0),
  costo       numeric(14,2) not null default 0,
  itbis_pct   numeric(6,3) not null default 0,
  importe     numeric(14,2) not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists ti_idx_compra_items on ti_compra_items (compra_id);

-- =====================================================================
-- 7. VENTAS  (bajan inventario y generan cuentas por cobrar)
-- =====================================================================
create table if not exists ti_ventas (
  id           uuid primary key default gen_random_uuid(),
  codigo       text unique not null default ('FAC-' || lpad(nextval('ti_seq_venta')::text, 6, '0')),
  cliente_id   uuid references ti_clientes(id) on delete restrict,   -- null = consumidor final
  fecha        date not null default current_date,
  ncf          text,
  condicion    text not null default 'contado' check (condicion in ('contado','credito')),
  fecha_vence  date,
  subtotal     numeric(14,2) not null default 0,
  itbis        numeric(14,2) not null default 0,
  descuento    numeric(14,2) not null default 0,
  total        numeric(14,2) not null default 0,
  pagado       numeric(14,2) not null default 0,
  costo_total  numeric(14,2) not null default 0,   -- para calcular la ganancia
  metodo_pago  text not null default 'efectivo'
                 check (metodo_pago in ('efectivo','transferencia','tarjeta','cheque','credito','mixto')),
  estado       text not null default 'pagada'
                 check (estado in ('pendiente','parcial','pagada','anulada')),
  caja_sesion_id uuid,
  notas        text,
  usuario      text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists ti_idx_ventas_cliente on ti_ventas (cliente_id, fecha);
create index if not exists ti_idx_ventas_fecha   on ti_ventas (fecha);
create index if not exists ti_idx_ventas_estado  on ti_ventas (estado);

create table if not exists ti_venta_items (
  id          uuid primary key default gen_random_uuid(),
  venta_id    uuid not null references ti_ventas(id) on delete cascade,
  producto_id uuid not null references ti_productos(id) on delete restrict,
  descripcion text,
  cantidad    numeric(14,3) not null check (cantidad > 0),
  precio      numeric(14,2) not null default 0,
  costo       numeric(14,2) not null default 0,
  itbis_pct   numeric(6,3) not null default 0,
  descuento   numeric(14,2) not null default 0,
  importe     numeric(14,2) not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists ti_idx_venta_items on ti_venta_items (venta_id);

-- =====================================================================
-- 8. COBROS Y PAGOS  (abonos a CxC y a CxP)
-- =====================================================================
create table if not exists ti_cobros (
  id          uuid primary key default gen_random_uuid(),
  recibo      text unique not null default ('REC-' || lpad(nextval('ti_seq_recibo')::text, 6, '0')),
  venta_id    uuid not null references ti_ventas(id) on delete cascade,
  cliente_id  uuid references ti_clientes(id) on delete set null,
  fecha       date not null default current_date,
  monto       numeric(14,2) not null check (monto > 0),
  metodo_pago text not null default 'efectivo'
                check (metodo_pago in ('efectivo','transferencia','tarjeta','cheque','otro')),
  referencia  text,
  notas       text,
  anulado     boolean not null default false,
  usuario     text,
  created_at  timestamptz not null default now()
);
create index if not exists ti_idx_cobros_venta on ti_cobros (venta_id);
create index if not exists ti_idx_cobros_fecha on ti_cobros (fecha) where not anulado;

create table if not exists ti_pagos_proveedor (
  id           uuid primary key default gen_random_uuid(),
  compra_id    uuid not null references ti_compras(id) on delete cascade,
  proveedor_id uuid references ti_proveedores(id) on delete set null,
  fecha        date not null default current_date,
  monto        numeric(14,2) not null check (monto > 0),
  metodo_pago  text not null default 'efectivo'
                 check (metodo_pago in ('efectivo','transferencia','tarjeta','cheque','otro')),
  referencia   text,
  notas        text,
  anulado      boolean not null default false,
  usuario      text,
  created_at   timestamptz not null default now()
);
create index if not exists ti_idx_pagos_prov on ti_pagos_proveedor (compra_id);
create index if not exists ti_idx_pagos_prov_fecha on ti_pagos_proveedor (fecha) where not anulado;

-- =====================================================================
-- 9. CAJA: sesiones (cuadre) y movimientos
-- =====================================================================
create table if not exists ti_caja_sesiones (
  id              uuid primary key default gen_random_uuid(),
  fecha_apertura  timestamptz not null default now(),
  fecha_cierre    timestamptz,
  monto_inicial   numeric(14,2) not null default 0,
  monto_contado   numeric(14,2),          -- lo que se contó físicamente al cerrar
  esperado_cierre numeric(14,2),          -- lo que el sistema dice que debe haber
  diferencia      numeric(14,2),          -- contado − esperado
  estado          text not null default 'abierta' check (estado in ('abierta','cerrada')),
  notas           text,
  abierta_por     text,
  cerrada_por     text,
  created_at      timestamptz not null default now()
);
create index if not exists ti_idx_caja_estado on ti_caja_sesiones (estado);

create table if not exists ti_caja_movimientos (
  id           uuid primary key default gen_random_uuid(),
  sesion_id    uuid references ti_caja_sesiones(id) on delete set null,
  fecha        date not null default current_date,
  tipo         text not null check (tipo in ('ingreso','egreso')),
  categoria    text not null default 'otro',   -- venta, cobro, compra, gasto, retiro, deposito…
  concepto     text not null,
  monto        numeric(14,2) not null check (monto > 0),
  metodo_pago  text not null default 'efectivo'
                 check (metodo_pago in ('efectivo','transferencia','tarjeta','cheque','otro')),
  referencia   text,
  origen       text not null default 'manual'
                 check (origen in ('manual','venta','cobro','compra','pago_proveedor')),
  origen_id    uuid,
  usuario      text,
  created_at   timestamptz not null default now()
);
create index if not exists ti_idx_caja_mov_sesion on ti_caja_movimientos (sesion_id);
create index if not exists ti_idx_caja_mov_fecha  on ti_caja_movimientos (fecha);

-- =====================================================================
-- 10. GASTOS  (van directo al estado de resultados y a la caja)
-- =====================================================================
create table if not exists ti_gastos (
  id           uuid primary key default gen_random_uuid(),
  fecha        date not null default current_date,
  categoria    text not null default 'general',
  concepto     text not null,
  monto        numeric(14,2) not null check (monto > 0),
  metodo_pago  text not null default 'efectivo'
                 check (metodo_pago in ('efectivo','transferencia','tarjeta','cheque','otro')),
  proveedor_id uuid references ti_proveedores(id) on delete set null,
  referencia   text,
  notas        text,
  usuario      text,
  created_at   timestamptz not null default now()
);
create index if not exists ti_idx_gastos_fecha on ti_gastos (fecha);

-- =====================================================================
-- 11. VISTAS
-- =====================================================================

-- 11.1 Inventario con su estado de stock y valor
create or replace view ti_v_productos as
select
  p.*,
  pr.nombre as proveedor_nombre,
  round(p.stock_actual * p.costo, 2)              as valor_costo,
  round(p.stock_actual * p.precio, 2)             as valor_venta,
  round(p.precio - p.costo, 2)                    as margen,
  case when p.costo > 0
       then round(100 * (p.precio - p.costo) / p.costo, 2)
       else 0 end                                 as margen_pct,
  case
    when p.stock_actual <= 0 then 'agotado'
    when p.stock_actual <= p.stock_minimo then 'bajo'
    else 'ok'
  end                                             as estado_stock
from ti_productos p
left join ti_proveedores pr on pr.id = p.proveedor_id;

-- 11.2 Ventas con saldo y días de vencimiento
create or replace view ti_v_ventas as
select
  v.*,
  coalesce(c.nombre, 'Consumidor final') as cliente_nombre,
  c.codigo                               as cliente_codigo,
  c.telefono                             as cliente_telefono,
  c.cedula_rnc                           as cliente_documento,
  round(v.total - v.pagado, 2)           as saldo,
  round(v.total - v.itbis - v.costo_total, 2) as ganancia,   -- el ITBIS no es ganancia
  case
    when v.estado = 'anulada' then 0
    when v.fecha_vence is null then 0
    else greatest(0, current_date - v.fecha_vence)
  end                                    as dias_vencida,
  case
    when v.estado = 'anulada' then 'anulada'
    when v.total - v.pagado <= 0.01 then 'pagada'
    when v.fecha_vence is not null and v.fecha_vence < current_date then 'vencida'
    when v.pagado > 0 then 'parcial'
    else 'pendiente'
  end                                    as estado_visual
from ti_ventas v
left join ti_clientes c on c.id = v.cliente_id;

-- 11.3 Cuentas por cobrar (ventas a crédito con saldo)
create or replace view ti_v_cuentas_cobrar as
select *
from ti_v_ventas
where estado <> 'anulada'
  and condicion = 'credito'
  and total - pagado > 0.01
order by fecha_vence nulls last, fecha;

-- 11.4 Compras con saldo
create or replace view ti_v_compras as
select
  c.*,
  coalesce(p.nombre, 'Sin proveedor') as proveedor_nombre,
  p.codigo                            as proveedor_codigo,
  p.telefono                          as proveedor_telefono,
  round(c.total - c.pagado, 2)        as saldo,
  case
    when c.estado = 'anulada' then 0
    when c.fecha_vence is null then 0
    else greatest(0, current_date - c.fecha_vence)
  end                                 as dias_vencida,
  case
    when c.estado = 'anulada' then 'anulada'
    when c.total - c.pagado <= 0.01 then 'pagada'
    when c.fecha_vence is not null and c.fecha_vence < current_date then 'vencida'
    when c.pagado > 0 then 'parcial'
    else 'pendiente'
  end                                 as estado_visual
from ti_compras c
left join ti_proveedores p on p.id = c.proveedor_id;

-- 11.5 Cuentas por pagar
create or replace view ti_v_cuentas_pagar as
select *
from ti_v_compras
where estado <> 'anulada'
  and condicion = 'credito'
  and total - pagado > 0.01
order by fecha_vence nulls last, fecha;

-- 11.6 Estado de cuenta por cliente
create or replace view ti_v_clientes as
select
  c.*,
  coalesce(v.compras, 0)         as compras_realizadas,
  coalesce(v.total_comprado, 0)  as total_comprado,
  coalesce(v.saldo_pendiente, 0) as saldo_pendiente,
  coalesce(v.vencido, 0)         as saldo_vencido,
  v.ultima_compra,
  round(greatest(0, c.limite_credito - coalesce(v.saldo_pendiente, 0)), 2) as credito_disponible
from ti_clientes c
left join (
  select
    cliente_id,
    count(*)                                                   as compras,
    sum(total)                                                 as total_comprado,
    sum(total - pagado)                                        as saldo_pendiente,
    sum(case when fecha_vence < current_date then total - pagado else 0 end) as vencido,
    max(fecha)                                                 as ultima_compra
  from ti_ventas
  where estado <> 'anulada' and cliente_id is not null
  group by cliente_id
) v on v.cliente_id = c.id;

-- 11.7 Caja: la sesión abierta con su efectivo esperado
create or replace view ti_v_caja_actual as
select
  s.*,
  coalesce(m.ingresos_efectivo, 0) as ingresos_efectivo,
  coalesce(m.egresos_efectivo, 0)  as egresos_efectivo,
  coalesce(m.ingresos_otros, 0)    as ingresos_otros,
  coalesce(m.egresos_otros, 0)     as egresos_otros,
  coalesce(m.movimientos, 0)       as movimientos,
  round(s.monto_inicial
        + coalesce(m.ingresos_efectivo, 0)
        - coalesce(m.egresos_efectivo, 0), 2) as efectivo_esperado
from ti_caja_sesiones s
left join (
  select
    sesion_id,
    count(*)                                                                        as movimientos,
    sum(case when tipo='ingreso' and metodo_pago='efectivo' then monto else 0 end)  as ingresos_efectivo,
    sum(case when tipo='egreso'  and metodo_pago='efectivo' then monto else 0 end)  as egresos_efectivo,
    sum(case when tipo='ingreso' and metodo_pago<>'efectivo' then monto else 0 end) as ingresos_otros,
    sum(case when tipo='egreso'  and metodo_pago<>'efectivo' then monto else 0 end) as egresos_otros
  from ti_caja_movimientos group by sesion_id
) m on m.sesion_id = s.id;

-- 11.8 Estado de resultados por mes
create or replace view ti_v_resultados_mensuales as
with ventas as (
  select date_trunc('month', fecha)::date as mes,
         sum(total - itbis)  as ingresos,
         sum(costo_total)    as costo_mercancia,
         count(*)            as facturas
  from ti_ventas where estado <> 'anulada' group by 1
),
gastos as (
  select date_trunc('month', fecha)::date as mes, sum(monto) as gastos
  from ti_gastos group by 1
)
select
  coalesce(v.mes, g.mes)                        as mes,
  coalesce(v.ingresos, 0)                       as ingresos,
  coalesce(v.costo_mercancia, 0)                as costo_mercancia,
  round(coalesce(v.ingresos,0) - coalesce(v.costo_mercancia,0), 2) as ganancia_bruta,
  coalesce(g.gastos, 0)                         as gastos,
  round(coalesce(v.ingresos,0) - coalesce(v.costo_mercancia,0)
        - coalesce(g.gastos,0), 2)              as ganancia_neta,
  coalesce(v.facturas, 0)                       as facturas
from ventas v
full outer join gastos g on g.mes = v.mes
order by 1 desc;

-- 11.9 Indicadores del tablero
create or replace view ti_v_dashboard as
select
  (select count(*) from ti_clientes where activo)                                    as clientes_activos,
  (select count(*) from ti_productos where activo)                                   as productos_activos,
  (select count(*) from ti_v_productos where activo and estado_stock = 'bajo')       as productos_bajos,
  (select count(*) from ti_v_productos where activo and estado_stock = 'agotado')    as productos_agotados,
  (select coalesce(sum(valor_costo),0) from ti_v_productos where activo)             as valor_inventario,
  (select coalesce(sum(total),0) from ti_ventas
     where estado <> 'anulada' and fecha = current_date)                             as ventas_hoy,
  (select coalesce(sum(total),0) from ti_ventas
     where estado <> 'anulada' and fecha >= date_trunc('month', current_date))       as ventas_mes,
  (select coalesce(sum(total - itbis - costo_total),0) from ti_ventas
     where estado <> 'anulada' and fecha >= date_trunc('month', current_date))       as ganancia_mes,
  (select coalesce(sum(monto),0) from ti_gastos
     where fecha >= date_trunc('month', current_date))                               as gastos_mes,
  (select coalesce(sum(saldo),0) from ti_v_cuentas_cobrar)                           as por_cobrar,
  (select coalesce(sum(saldo),0) from ti_v_cuentas_cobrar where dias_vencida > 0)    as por_cobrar_vencido,
  (select coalesce(sum(saldo),0) from ti_v_cuentas_pagar)                            as por_pagar,
  (select coalesce(sum(saldo),0) from ti_v_cuentas_pagar where dias_vencida > 0)     as por_pagar_vencido,
  (select count(*) from ti_caja_sesiones where estado = 'abierta')                   as caja_abierta,
  (select coalesce(max(efectivo_esperado),0) from ti_v_caja_actual where estado='abierta') as efectivo_en_caja;

-- 11.10 Productos más vendidos
create or replace view ti_v_top_productos as
select
  i.producto_id,
  p.codigo,
  p.nombre,
  p.categoria,
  sum(i.cantidad)                        as unidades,
  sum(i.importe)                         as vendido,
  round(sum(i.importe - i.costo * i.cantidad), 2) as ganancia
from ti_venta_items i
join ti_ventas v on v.id = i.venta_id and v.estado <> 'anulada'
join ti_productos p on p.id = i.producto_id
group by 1,2,3,4
order by vendido desc;

-- =====================================================================
-- 12. TRIGGERS DE NEGOCIO
-- =====================================================================

create or replace function ti_fn_touch()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

do $$
declare t text;
begin
  foreach t in array array['ti_config','ti_clientes','ti_proveedores','ti_productos','ti_compras','ti_ventas']
  loop
    execute format('drop trigger if exists %I on %I', 'ti_tg_touch_' || t, t);
    execute format('create trigger %I before update on %I for each row execute function ti_fn_touch()',
                   'ti_tg_touch_' || t, t);
  end loop;
end $$;

-- 12.1 El kardex mueve el stock del producto
create or replace function ti_fn_aplicar_movimiento()
returns trigger language plpgsql as $$
declare
  v_stock numeric(14,3);
  v_delta numeric(14,3);
begin
  select stock_actual into v_stock from ti_productos where id = new.producto_id for update;

  v_delta := case
    when new.tipo in ('entrada','devolucion') then abs(new.cantidad)
    when new.tipo in ('salida','merma')       then -abs(new.cantidad)
    else new.cantidad          -- 'ajuste' puede ser negativo
  end;

  new.stock_antes   := coalesce(v_stock, 0);
  new.stock_despues := round(coalesce(v_stock, 0) + v_delta, 3);

  update ti_productos
     set stock_actual = new.stock_despues,
         costo = case
           when new.tipo = 'entrada' and new.costo_unitario > 0 then new.costo_unitario
           else costo
         end,
         updated_at = now()
   where id = new.producto_id;

  return new;
end $$;

drop trigger if exists ti_tg_movimiento on ti_movimientos_inventario;
create trigger ti_tg_movimiento
  before insert on ti_movimientos_inventario
  for each row execute function ti_fn_aplicar_movimiento();

-- 12.2 Recalcular totales de una venta cuando cambian sus líneas
create or replace function ti_fn_totales_venta()
returns trigger language plpgsql as $$
declare v_id uuid;
begin
  v_id := coalesce(new.venta_id, old.venta_id);
  update ti_ventas v
     set subtotal    = coalesce(t.subtotal, 0),
         itbis       = coalesce(t.itbis, 0),
         total       = round(coalesce(t.subtotal,0) + coalesce(t.itbis,0) - v.descuento, 2),
         costo_total = coalesce(t.costo, 0),
         updated_at  = now()
    from (
      -- 'importe' es cantidad × precio − descuento de línea, SIN ITBIS.
      -- El impuesto se calcula encima con el itbis_pct de cada línea.
      select sum(importe)                          as subtotal,
             sum(round(importe * itbis_pct / 100, 2)) as itbis,
             sum(costo * cantidad)                 as costo
      from ti_venta_items where venta_id = v_id
    ) t
   where v.id = v_id;
  return null;
end $$;

drop trigger if exists ti_tg_totales_venta on ti_venta_items;
create trigger ti_tg_totales_venta
  after insert or update or delete on ti_venta_items
  for each row execute function ti_fn_totales_venta();

-- 12.3 Recalcular totales de una compra
create or replace function ti_fn_totales_compra()
returns trigger language plpgsql as $$
declare v_id uuid;
begin
  v_id := coalesce(new.compra_id, old.compra_id);
  update ti_compras c
     set subtotal   = coalesce(t.subtotal, 0),
         itbis      = coalesce(t.itbis, 0),
         total      = round(coalesce(t.subtotal,0) + coalesce(t.itbis,0) - c.descuento, 2),
         updated_at = now()
    from (
      select sum(importe)                             as subtotal,
             sum(round(importe * itbis_pct / 100, 2)) as itbis
      from ti_compra_items where compra_id = v_id
    ) t
   where c.id = v_id;
  return null;
end $$;

drop trigger if exists ti_tg_totales_compra on ti_compra_items;
create trigger ti_tg_totales_compra
  after insert or update or delete on ti_compra_items
  for each row execute function ti_fn_totales_compra();

-- 12.4 Un cobro actualiza el saldo y el estado de la venta, y entra a caja
create or replace function ti_fn_aplicar_cobro()
returns trigger language plpgsql as $$
declare
  v_id     uuid;
  v_pagado numeric(14,2);
  v_total  numeric(14,2);
  v_sesion uuid;
begin
  v_id := coalesce(new.venta_id, old.venta_id);

  select coalesce(sum(monto), 0) into v_pagado
    from ti_cobros where venta_id = v_id and not anulado;
  select total into v_total from ti_ventas where id = v_id;

  update ti_ventas
     set pagado = v_pagado,
         estado = case
           when estado = 'anulada' then 'anulada'
           when v_pagado >= v_total - 0.01 then 'pagada'
           when v_pagado > 0 then 'parcial'
           else 'pendiente' end,
         updated_at = now()
   where id = v_id;

  -- Reflejar en caja solo los cobros nuevos y no anulados
  if tg_op = 'INSERT' and not new.anulado then
    select id into v_sesion from ti_caja_sesiones where estado = 'abierta'
     order by fecha_apertura desc limit 1;
    insert into ti_caja_movimientos (sesion_id, fecha, tipo, categoria, concepto, monto,
                                     metodo_pago, referencia, origen, origen_id, usuario)
    values (v_sesion, new.fecha, 'ingreso', 'cobro',
            'Cobro recibo ' || new.recibo, new.monto,
            new.metodo_pago, new.referencia, 'cobro', new.id, new.usuario);
  end if;

  return null;
end $$;

drop trigger if exists ti_tg_cobro on ti_cobros;
create trigger ti_tg_cobro
  after insert or update or delete on ti_cobros
  for each row execute function ti_fn_aplicar_cobro();

-- 12.5 Un pago a proveedor actualiza la compra y sale de caja
create or replace function ti_fn_aplicar_pago_proveedor()
returns trigger language plpgsql as $$
declare
  v_id     uuid;
  v_pagado numeric(14,2);
  v_total  numeric(14,2);
  v_sesion uuid;
begin
  v_id := coalesce(new.compra_id, old.compra_id);

  select coalesce(sum(monto), 0) into v_pagado
    from ti_pagos_proveedor where compra_id = v_id and not anulado;
  select total into v_total from ti_compras where id = v_id;

  update ti_compras
     set pagado = v_pagado,
         estado = case
           when estado = 'anulada' then 'anulada'
           when v_pagado >= v_total - 0.01 then 'pagada'
           when v_pagado > 0 then 'parcial'
           else 'pendiente' end,
         updated_at = now()
   where id = v_id;

  if tg_op = 'INSERT' and not new.anulado then
    select id into v_sesion from ti_caja_sesiones where estado = 'abierta'
     order by fecha_apertura desc limit 1;
    insert into ti_caja_movimientos (sesion_id, fecha, tipo, categoria, concepto, monto,
                                     metodo_pago, referencia, origen, origen_id, usuario)
    values (v_sesion, new.fecha, 'egreso', 'pago_proveedor',
            'Pago a proveedor', new.monto,
            new.metodo_pago, new.referencia, 'pago_proveedor', new.id, new.usuario);
  end if;

  return null;
end $$;

drop trigger if exists ti_tg_pago_proveedor on ti_pagos_proveedor;
create trigger ti_tg_pago_proveedor
  after insert or update or delete on ti_pagos_proveedor
  for each row execute function ti_fn_aplicar_pago_proveedor();

-- 12.6 Un gasto sale de caja
create or replace function ti_fn_gasto_a_caja()
returns trigger language plpgsql as $$
declare v_sesion uuid;
begin
  select id into v_sesion from ti_caja_sesiones where estado = 'abierta'
   order by fecha_apertura desc limit 1;
  insert into ti_caja_movimientos (sesion_id, fecha, tipo, categoria, concepto, monto,
                                   metodo_pago, referencia, origen, origen_id, usuario)
  values (v_sesion, new.fecha, 'egreso', coalesce(new.categoria, 'gasto'),
          new.concepto, new.monto, new.metodo_pago, new.referencia, 'manual', new.id, new.usuario);
  return new;
end $$;

drop trigger if exists ti_tg_gasto on ti_gastos;
create trigger ti_tg_gasto
  after insert on ti_gastos
  for each row execute function ti_fn_gasto_a_caja();

-- =====================================================================
-- 13. SEGURIDAD
--   RLS activo SIN políticas: nadie lee con la anon key.
--   La app entra por /api/tienda/* con la service role key.
-- =====================================================================
do $$
declare t text;
begin
  foreach t in array array[
    'ti_config','ti_clientes','ti_proveedores','ti_productos','ti_movimientos_inventario',
    'ti_compras','ti_compra_items','ti_ventas','ti_venta_items','ti_cobros',
    'ti_pagos_proveedor','ti_caja_sesiones','ti_caja_movimientos','ti_gastos'
  ] loop
    execute format('alter table %I enable row level security', t);
  end loop;

  foreach t in array array[
    'ti_v_productos','ti_v_ventas','ti_v_cuentas_cobrar','ti_v_compras','ti_v_cuentas_pagar',
    'ti_v_clientes','ti_v_caja_actual','ti_v_resultados_mensuales','ti_v_dashboard','ti_v_top_productos'
  ] loop
    execute format('alter view %I set (security_invoker = on)', t);
  end loop;
end $$;

-- =====================================================================
-- FIN — 14 tablas, 10 vistas, prefijo ti_
-- =====================================================================
select
  (select count(*) from information_schema.tables
    where table_schema='public' and table_name like 'ti\_%' and table_type='BASE TABLE') as tablas,
  (select count(*) from information_schema.views
    where table_schema='public' and table_name like 'ti\_v\_%')                          as vistas,
  '✅ MAXMATT SHOP listo' as resultado;
