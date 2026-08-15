-- =====================================================================
--  MAXMATT SHOP · PACAS, CATEGORÍAS Y VENTA POR GRUPO
-- =====================================================================
--  Pégalo en Supabase → SQL Editor DESPUÉS de tienda_schema.sql.
--  Es idempotente y no borra datos: solo agrega.
--
--  Qué resuelve:
--
--  1. Una tienda de pacas no mete la ropa pieza por pieza. Ahora un
--     producto puede ser un LOTE: entra la paca completa con lo que
--     costó y cuántas piezas trae, y se vende de ahí.
--
--  2. CATEGORÍAS de verdad (Ropa nueva, Ropa usada, Calzado…) en vez de
--     un texto suelto, para poder ver la ganancia por categoría.
--
--  3. RECUPERACIÓN de la paca: si costó 3,000 y vendes una pieza en 200,
--     esos 200 se descuentan de lo que falta por recuperar. Cuando llega
--     a 3,000 la paca está paga y lo demás es ganancia.
-- =====================================================================

create extension if not exists "pgcrypto";

-- =====================================================================
-- 1. CATEGORÍAS
-- =====================================================================
create table if not exists ti_categorias (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null unique,
  descripcion text,
  color      text not null default '#7c3aed',
  orden      int  not null default 0,
  activo     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into ti_categorias (nombre, descripcion, color, orden) values
  ('Ropa nueva',  'Prendas nuevas, con etiqueta',      '#7c3aed', 1),
  ('Ropa usada',  'Pacas y prendas de segunda mano',   '#0f766e', 2),
  ('Calzado',     'Zapatos, tenis y sandalias',        '#b45309', 3),
  ('Accesorios',  'Carteras, correas, gorras',         '#be123c', 4),
  ('Hogar',       'Sábanas, toallas, cortinas',        '#1d4ed8', 5),
  ('Varios',      'Lo que no entra en las anteriores', '#64748b', 9)
on conflict (nombre) do nothing;

-- =====================================================================
-- 2. PRODUCTOS: soporte de LOTE (paca)
-- =====================================================================
alter table ti_productos add column if not exists categoria_id uuid references ti_categorias(id) on delete set null;

-- 'unitario' = artículo suelto de siempre · 'lote' = paca que se vende por piezas
alter table ti_productos add column if not exists tipo_inventario text not null default 'unitario';
do $$
begin
  alter table ti_productos drop constraint if exists ti_productos_tipo_inventario_check;
  alter table ti_productos add constraint ti_productos_tipo_inventario_check
    check (tipo_inventario in ('unitario','lote'));
end $$;

alter table ti_productos add column if not exists costo_lote     numeric(14,2) not null default 0;  -- lo que costó la paca completa
alter table ti_productos add column if not exists piezas_lote    numeric(14,3) not null default 0;  -- piezas que trae
alter table ti_productos add column if not exists lote_codigo    text;                              -- referencia del proveedor
alter table ti_productos add column if not exists fecha_lote     date;
alter table ti_productos add column if not exists precio_sugerido numeric(14,2) not null default 0; -- precio típico por pieza

create index if not exists ti_idx_productos_categoria on ti_productos (categoria_id);
create index if not exists ti_idx_productos_tipo      on ti_productos (tipo_inventario);

-- Pasar las categorías de texto que ya existan a la tabla nueva
insert into ti_categorias (nombre)
select distinct categoria from ti_productos
where categoria is not null and btrim(categoria) <> ''
  and not exists (select 1 from ti_categorias c where lower(c.nombre) = lower(ti_productos.categoria))
on conflict (nombre) do nothing;

update ti_productos p
   set categoria_id = c.id
  from ti_categorias c
 where p.categoria_id is null
   and p.categoria is not null
   and lower(c.nombre) = lower(p.categoria);

-- =====================================================================
-- 3. El costo por pieza de una paca es el costo del lote entre sus piezas
-- =====================================================================
create or replace function ti_fn_costo_lote()
returns trigger language plpgsql as $$
begin
  if new.tipo_inventario = 'lote' then
    -- Prorrateo: cada pieza carga su parte del costo de la paca.
    if coalesce(new.piezas_lote, 0) > 0 then
      new.costo := round(coalesce(new.costo_lote, 0) / new.piezas_lote, 2);
    else
      new.costo := 0;
    end if;
    -- Si no se puso precio por pieza, usar el sugerido
    if coalesce(new.precio, 0) = 0 and coalesce(new.precio_sugerido, 0) > 0 then
      new.precio := new.precio_sugerido;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists ti_tg_costo_lote on ti_productos;
create trigger ti_tg_costo_lote
  before insert or update on ti_productos
  for each row execute function ti_fn_costo_lote();

-- Recalcular las pacas que ya existan
update ti_productos set updated_at = now() where tipo_inventario = 'lote';

-- =====================================================================
-- 4. La entrada de inventario de una paca NO debe pisar el costo por pieza
-- =====================================================================
create or replace function ti_fn_aplicar_movimiento()
returns trigger language plpgsql as $$
declare
  v_stock numeric(14,3);
  v_tipo  text;
  v_delta numeric(14,3);
begin
  select stock_actual, tipo_inventario into v_stock, v_tipo
    from ti_productos where id = new.producto_id for update;

  v_delta := case
    when new.tipo in ('entrada','devolucion') then abs(new.cantidad)
    when new.tipo in ('salida','merma')       then -abs(new.cantidad)
    else new.cantidad          -- 'ajuste' puede ser negativo
  end;

  new.stock_antes   := coalesce(v_stock, 0);
  new.stock_despues := round(coalesce(v_stock, 0) + v_delta, 3);

  update ti_productos
     set stock_actual = new.stock_despues,
         -- En un lote el costo por pieza lo calcula ti_fn_costo_lote,
         -- así que aquí solo se toca el costo de los artículos unitarios.
         costo = case
           when coalesce(v_tipo, 'unitario') = 'unitario'
                and new.tipo = 'entrada'
                and new.costo_unitario > 0 then new.costo_unitario
           else costo
         end,
         updated_at = now()
   where id = new.producto_id;

  return new;
end $$;

-- =====================================================================
-- 5. VISTAS
-- =====================================================================

-- Las vistas se sueltan y se vuelven a crear: 'create or replace' no admite
-- que cambie el orden de las columnas, y ti_productos ganó campos nuevos.
drop view if exists ti_v_dashboard          cascade;
drop view if exists ti_v_ganancia_categoria cascade;
drop view if exists ti_v_lotes              cascade;
drop view if exists ti_v_productos          cascade;

-- 5.1 Productos, ahora con categoría y datos de lote
create view ti_v_productos as
select
  p.*,
  pr.nombre  as proveedor_nombre,
  cat.nombre as categoria_nombre,
  cat.color  as categoria_color,
  round(p.stock_actual * p.costo, 2)  as valor_costo,
  round(p.stock_actual * p.precio, 2) as valor_venta,
  round(p.precio - p.costo, 2)        as margen,
  case when p.costo > 0
       then round(100 * (p.precio - p.costo) / p.costo, 2)
       else 0 end                     as margen_pct,
  case
    when p.stock_actual <= 0 then 'agotado'
    when p.stock_actual <= p.stock_minimo then 'bajo'
    else 'ok'
  end                                 as estado_stock,
  case when p.tipo_inventario = 'lote' then true else false end as es_lote,
  case
    when p.tipo_inventario = 'lote' and coalesce(p.piezas_lote,0) > 0
      then round(p.piezas_lote - p.stock_actual, 3)
    else 0
  end                                 as piezas_vendidas
from ti_productos p
left join ti_proveedores pr on pr.id = p.proveedor_id
left join ti_categorias  cat on cat.id = p.categoria_id;

-- 5.2 PACAS: recuperación de la inversión y ganancia del grupo
create view ti_v_lotes as
with ventas_lote as (
  select
    i.producto_id,
    sum(i.cantidad)                                   as piezas_vendidas,
    sum(i.importe)                                    as vendido,
    min(v.fecha)                                      as primera_venta,
    max(v.fecha)                                      as ultima_venta,
    count(distinct v.id)                              as facturas
  from ti_venta_items i
  join ti_ventas v on v.id = i.venta_id and v.estado <> 'anulada'
  group by i.producto_id
)
select
  p.id,
  p.codigo,
  p.lote_codigo,
  p.nombre,
  p.categoria_id,
  coalesce(c.nombre, 'Sin categoría') as categoria_nombre,
  coalesce(c.color, '#64748b')        as categoria_color,
  p.proveedor_id,
  pr.nombre                           as proveedor_nombre,
  p.fecha_lote,
  p.activo,
  p.unidad,
  -- Inversión
  p.costo_lote,
  p.piezas_lote                       as piezas_iniciales,
  p.stock_actual                      as piezas_restantes,
  coalesce(vl.piezas_vendidas, 0)     as piezas_vendidas,
  p.costo                             as costo_por_pieza,
  p.precio                            as precio_por_pieza,
  p.precio_sugerido,
  -- Dinero
  coalesce(vl.vendido, 0)             as vendido,
  least(coalesce(vl.vendido, 0), p.costo_lote)                         as recuperado,
  greatest(round(p.costo_lote - coalesce(vl.vendido, 0), 2), 0)        as falta_recuperar,
  case when p.costo_lote > 0
       then least(round(100 * coalesce(vl.vendido,0) / p.costo_lote, 2), 100)
       else 100 end                                                    as recuperacion_pct,
  -- Ganancia contable: lo vendido menos el costo de las piezas que salieron
  round(coalesce(vl.vendido, 0) - coalesce(vl.piezas_vendidas, 0) * p.costo, 2) as ganancia,
  -- Lo que falta cobrar si vende el resto al precio actual
  round(p.stock_actual * p.precio, 2) as por_vender,
  -- Ganancia final si logra vender toda la paca al precio actual
  round(coalesce(vl.vendido, 0) + p.stock_actual * p.precio - p.costo_lote, 2) as ganancia_proyectada,
  vl.facturas,
  vl.primera_venta,
  vl.ultima_venta,
  case
    when p.stock_actual <= 0 then 'agotada'
    when coalesce(vl.vendido, 0) >= p.costo_lote then 'recuperada'
    when coalesce(vl.piezas_vendidas, 0) > 0 then 'en_venta'
    else 'nueva'
  end                                 as estado_lote
from ti_productos p
left join ti_categorias  c  on c.id  = p.categoria_id
left join ti_proveedores pr on pr.id = p.proveedor_id
left join ventas_lote    vl on vl.producto_id = p.id
where p.tipo_inventario = 'lote';

-- 5.3 Ganancia por categoría
create view ti_v_ganancia_categoria as
select
  coalesce(c.id::text, 'sin')            as categoria_id,
  coalesce(c.nombre, 'Sin categoría')    as categoria_nombre,
  coalesce(c.color, '#64748b')           as categoria_color,
  count(distinct p.id)                   as productos,
  coalesce(sum(i.cantidad), 0)           as unidades_vendidas,
  coalesce(sum(i.importe), 0)            as vendido,
  coalesce(sum(i.costo * i.cantidad), 0) as costo,
  round(coalesce(sum(i.importe), 0) - coalesce(sum(i.costo * i.cantidad), 0), 2) as ganancia,
  round(coalesce(sum(p2.valor_costo), 0), 2) as valor_en_stock
from ti_productos p
left join ti_categorias c on c.id = p.categoria_id
left join ti_venta_items i on i.producto_id = p.id
left join ti_ventas v on v.id = i.venta_id and v.estado <> 'anulada'
left join (select id, stock_actual * costo as valor_costo from ti_productos) p2 on p2.id = p.id
where v.id is not null or i.id is null
group by 1,2,3
order by ganancia desc;

-- 5.4 El tablero ahora también cuenta las pacas
create view ti_v_dashboard as
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
  (select coalesce(max(efectivo_esperado),0) from ti_v_caja_actual where estado='abierta') as efectivo_en_caja,
  -- Pacas
  (select count(*) from ti_v_lotes where activo)                                     as lotes_total,
  -- Abierta = todavía le quedan piezas, aunque ya haya recuperado la inversión
  (select count(*) from ti_v_lotes where activo and estado_lote <> 'agotada')          as lotes_abiertos,
  (select coalesce(sum(falta_recuperar),0) from ti_v_lotes where activo)             as falta_recuperar,
  (select coalesce(sum(ganancia),0) from ti_v_lotes where activo)                    as ganancia_lotes;

alter view ti_v_productos          set (security_invoker = on);
alter view ti_v_lotes              set (security_invoker = on);
alter view ti_v_ganancia_categoria set (security_invoker = on);
alter view ti_v_dashboard          set (security_invoker = on);
alter table ti_categorias          enable row level security;

-- =====================================================================
-- COMPROBACIÓN
-- =====================================================================
select
  (select count(*) from ti_categorias)                                     as categorias,
  (select count(*) from information_schema.columns
    where table_schema='public' and table_name='ti_productos'
      and column_name in ('tipo_inventario','costo_lote','piezas_lote','categoria_id')) as campos_lote,
  '✅ Pacas y categorías listas' as resultado;
