-- =====================================================================
-- MAXMATT SHOP · Permitir borrar artículos aunque ya estén facturados
-- =====================================================================
--
-- Antes, un producto que aparecía en una factura no se podía borrar: la
-- llave foránea era `on delete restrict` y la base lo impedía.
--
-- Ahora se puede. La factura NO se pierde: cada línea guarda su propia
-- descripción, cantidad, precio, costo e importe, así que los totales, la
-- ganancia y la contabilidad siguen exactamente igual. Lo único que se
-- pierde es el enlace al artículo del catálogo, que ya no existe.
--
-- Se ejecuta después de tienda_schema.sql y tienda_pacas.sql.
-- Es idempotente: se puede volver a correr sin problema.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Las líneas de compra necesitan su propia descripción
--    (las de venta ya la tenían)
-- ---------------------------------------------------------------------
alter table ti_compra_items add column if not exists descripcion text;

-- Rellenar las compras viejas con el nombre que tiene hoy el producto
update ti_compra_items i
   set descripcion = p.nombre
  from ti_productos p
 where p.id = i.producto_id
   and (i.descripcion is null or i.descripcion = '');

-- Lo mismo para cualquier línea de venta que se haya quedado sin texto
update ti_venta_items i
   set descripcion = p.nombre
  from ti_productos p
 where p.id = i.producto_id
   and (i.descripcion is null or i.descripcion = '');

-- ---------------------------------------------------------------------
-- 2. Guardar también el código del artículo en la línea
--    Así la factura vieja sigue mostrando el código aunque ya no exista.
-- ---------------------------------------------------------------------
alter table ti_venta_items  add column if not exists codigo_articulo text;
alter table ti_compra_items add column if not exists codigo_articulo text;

update ti_venta_items i
   set codigo_articulo = p.codigo
  from ti_productos p
 where p.id = i.producto_id and i.codigo_articulo is null;

update ti_compra_items i
   set codigo_articulo = p.codigo
  from ti_productos p
 where p.id = i.producto_id and i.codigo_articulo is null;

-- ---------------------------------------------------------------------
-- 3. Soltar el candado: al borrar el producto, la línea se queda
--    sin enlace pero conserva todos sus datos
-- ---------------------------------------------------------------------
alter table ti_venta_items  alter column producto_id drop not null;
alter table ti_compra_items alter column producto_id drop not null;

do $$
declare
  r record;
begin
  -- Quitar las llaves foráneas viejas, se llamen como se llamen
  for r in
    select con.conname, rel.relname
      from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
      join pg_attribute att
        on att.attrelid = con.conrelid and att.attnum = con.conkey[1]
     where con.contype = 'f'
       and rel.relname in ('ti_venta_items', 'ti_compra_items')
       and att.attname = 'producto_id'
  loop
    execute format('alter table %I drop constraint %I', r.relname, r.conname);
  end loop;
end $$;

alter table ti_venta_items
  add constraint ti_venta_items_producto_id_fkey
  foreign key (producto_id) references ti_productos(id) on delete set null;

alter table ti_compra_items
  add constraint ti_compra_items_producto_id_fkey
  foreign key (producto_id) references ti_productos(id) on delete set null;

-- ---------------------------------------------------------------------
-- 4. Los productos más vendidos ya no dependen de que el artículo exista
-- ---------------------------------------------------------------------
drop view if exists ti_v_top_productos cascade;

create view ti_v_top_productos as
select
  i.producto_id,
  coalesce(p.codigo, i.codigo_articulo, '—')                as codigo,
  coalesce(p.nombre, i.descripcion, 'Artículo eliminado')   as nombre,
  coalesce(p.categoria, cat.nombre)                         as categoria,
  (p.id is null)                                            as eliminado,
  sum(i.cantidad)                                           as unidades,
  sum(i.importe)                                            as vendido,
  round(sum(i.importe - i.costo * i.cantidad), 2)           as ganancia
from ti_venta_items i
join ti_ventas v on v.id = i.venta_id and v.estado <> 'anulada'
left join ti_productos p  on p.id = i.producto_id
left join ti_categorias cat on cat.id = p.categoria_id
group by 1,2,3,4,5
order by vendido desc;

alter view ti_v_top_productos set (security_invoker = on);

commit;

-- ---------------------------------------------------------------------
-- Comprobación
-- ---------------------------------------------------------------------
select
  (select count(*) from information_schema.columns
    where table_name = 'ti_compra_items' and column_name = 'descripcion')     as compra_descripcion,
  (select count(*) from information_schema.columns
    where table_name = 'ti_venta_items' and column_name = 'codigo_articulo')  as venta_codigo,
  (select con.confdeltype from pg_constraint con
     join pg_class rel on rel.oid = con.conrelid
    where rel.relname = 'ti_venta_items' and con.contype = 'f'
      and con.conname = 'ti_venta_items_producto_id_fkey')                    as regla_venta,
  '✅ Ya se pueden borrar artículos facturados'                                as resultado;
