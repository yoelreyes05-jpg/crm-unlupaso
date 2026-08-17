-- =====================================================================
-- CGSSOLUTIONS · Poder eliminar inversionistas
-- =====================================================================
--
-- Antes no se podía borrar un inversionista que hubiera financiado algún
-- préstamo: la llave foránea era `on delete restrict`.
--
-- Ahora sí. Para que el historial no se pierda, cada préstamo y cada
-- distribución guardan por su cuenta el NOMBRE del inversionista que puso
-- el dinero. Así, si el inversionista se borra, los préstamos viejos y el
-- reparto de ganancias siguen diciendo de quién era el capital.
--
-- Se ejecuta después de prestamos_schema.sql. Es idempotente.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. El nombre del inversionista queda escrito en cada documento
-- ---------------------------------------------------------------------
alter table pr_prestamos      add column if not exists inversionista_nombre_hist text;
alter table pr_distribuciones add column if not exists inversionista_nombre_hist text;

update pr_prestamos p
   set inversionista_nombre_hist = i.nombre
  from pr_inversionistas i
 where i.id = p.inversionista_id
   and (p.inversionista_nombre_hist is null or p.inversionista_nombre_hist = '');

update pr_distribuciones d
   set inversionista_nombre_hist = i.nombre
  from pr_inversionistas i
 where i.id = d.inversionista_id
   and (d.inversionista_nombre_hist is null or d.inversionista_nombre_hist = '');

-- Que se siga escribiendo solo en los préstamos nuevos
create or replace function pr_fn_nombre_inversionista()
returns trigger language plpgsql as $$
begin
  if new.inversionista_id is not null
     and (new.inversionista_nombre_hist is null or new.inversionista_nombre_hist = '') then
    select nombre into new.inversionista_nombre_hist
      from pr_inversionistas where id = new.inversionista_id;
  end if;
  return new;
end $$;

drop trigger if exists pr_tg_nombre_inv_prestamo on pr_prestamos;
create trigger pr_tg_nombre_inv_prestamo
  before insert or update of inversionista_id on pr_prestamos
  for each row execute function pr_fn_nombre_inversionista();

drop trigger if exists pr_tg_nombre_inv_distrib on pr_distribuciones;
create trigger pr_tg_nombre_inv_distrib
  before insert or update of inversionista_id on pr_distribuciones
  for each row execute function pr_fn_nombre_inversionista();

-- ---------------------------------------------------------------------
-- 2. Soltar el candado del préstamo: al borrar el inversionista, el
--    préstamo se queda sin enlace pero conserva su nombre y sus montos
-- ---------------------------------------------------------------------
do $$
declare r record;
begin
  for r in
    select con.conname
      from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
      join pg_attribute att
        on att.attrelid = con.conrelid and att.attnum = con.conkey[1]
     where con.contype = 'f'
       and rel.relname = 'pr_prestamos'
       and att.attname = 'inversionista_id'
  loop
    execute format('alter table pr_prestamos drop constraint %I', r.conname);
  end loop;
end $$;

alter table pr_prestamos
  add constraint pr_prestamos_inversionista_id_fkey
  foreign key (inversionista_id) references pr_inversionistas(id) on delete set null;

-- ---------------------------------------------------------------------
-- 3. Las vistas usan el nombre guardado cuando el inversionista ya no está
-- ---------------------------------------------------------------------
-- pr_v_prestamos usa p.*, y como pr_prestamos ganó una columna hay que
-- soltarla y volver a crearla (junto con las dos vistas que dependen de ella).
-- Se mantiene el p.* a propósito: así la vista no se queda corta si la tabla
-- tiene columnas que este script no conoce.
drop view if exists pr_v_dashboard      cascade;
drop view if exists pr_v_inversionistas cascade;
drop view if exists pr_v_prestamos      cascade;

create view pr_v_prestamos as
with agg as (
  select
    prestamo_id,
    sum(capital)        as capital_programado,
    sum(interes)        as interes_programado_real,
    sum(total)          as total_programado_real,
    sum(capital_pagado) as capital_pagado,
    sum(interes_pagado) as interes_pagado,
    sum(mora_generada)  as mora_generada,
    sum(mora_pagada)    as mora_pagada,
    count(*) filter (where estado in ('pagada','solo_interes'))                  as cuotas_pagadas,
    count(*)                                                                     as cuotas_totales,
    count(*) filter (where estado not in ('pagada','condonada','solo_interes'))  as cuotas_pendientes,
    count(*) filter (where estado not in ('pagada','condonada','solo_interes')
                       and fecha_vencimiento < current_date)                     as cuotas_atrasadas,
    min(fecha_vencimiento) filter (where estado not in ('pagada','condonada','solo_interes')) as proximo_vencimiento,
    max(fecha_vencimiento) as ultimo_vencimiento
  from pr_cuotas
  where activa
  group by prestamo_id
)
select
  p.*,
  cl.nombre    as cliente_nombre,
  cl.codigo    as cliente_codigo,
  cl.telefono  as cliente_telefono,
  cl.cedula    as cliente_cedula,
  cl.direccion as cliente_direccion,
  -- Si el inversionista se borró, queda el nombre que guardó el préstamo
  coalesce(i.nombre, p.inversionista_nombre_hist) as inversionista_nombre,
  i.codigo                                        as inversionista_codigo,
  coalesce(a.capital_programado, 0) as capital_programado,
  coalesce(a.capital_pagado, 0)     as capital_pagado,
  coalesce(a.interes_pagado, 0)     as interes_pagado,
  coalesce(a.mora_generada, 0)      as mora_generada,
  coalesce(a.mora_pagada, 0)        as mora_pagada,
  round(coalesce(a.capital_programado,0) - coalesce(a.capital_pagado,0), 2)       as saldo_capital,
  round(coalesce(a.interes_programado_real,0) - coalesce(a.interes_pagado,0), 2)  as saldo_interes,
  round(coalesce(a.total_programado_real,0)
        - coalesce(a.capital_pagado,0) - coalesce(a.interes_pagado,0)
        + coalesce(a.mora_generada,0) - coalesce(a.mora_pagada,0), 2)             as saldo_total,
  round(coalesce(a.capital_pagado,0) + coalesce(a.interes_pagado,0)
        + coalesce(a.mora_pagada,0), 2)                                           as total_cobrado,
  coalesce(a.cuotas_pagadas, 0)     as cuotas_pagadas,
  coalesce(a.cuotas_totales, 0)     as cuotas_totales,
  coalesce(a.cuotas_pendientes, 0)  as cuotas_pendientes,
  coalesce(a.cuotas_atrasadas, 0)   as cuotas_atrasadas,
  a.proximo_vencimiento,
  a.ultimo_vencimiento              as fecha_fin_real,
  case
    when p.estado = 'cancelado' then 'cancelado'
    when coalesce(a.cuotas_atrasadas,0) > 0 then 'atrasado'
    when coalesce(a.cuotas_pendientes,0) = 0 then 'pagado'
    else 'al_dia'
  end                               as estado_visual,
  case
    when coalesce(a.total_programado_real,0) = 0 then 0
    else round(100 * (coalesce(a.capital_pagado,0) + coalesce(a.interes_pagado,0))
               / a.total_programado_real, 2)
  end                               as avance_pct
from pr_prestamos p
join pr_clientes cl on cl.id = p.cliente_id
left join pr_inversionistas i on i.id = p.inversionista_id
left join agg a on a.prestamo_id = p.id;

create view pr_v_inversionistas as
with mov as (
  select
    inversionista_id,
    coalesce(sum(monto) filter (where tipo = 'aporte'), 0)          as aportes,
    coalesce(sum(monto) filter (where tipo = 'retiro'), 0)          as retiros_capital,
    coalesce(sum(monto) filter (where tipo = 'retiro_ganancia'), 0) as ganancia_retirada,
    coalesce(sum(monto) filter (where tipo = 'ajuste'), 0)          as ajustes
  from pr_movimientos_inversionista
  group by inversionista_id
),
cartera as (
  select
    inversionista_id,
    coalesce(sum(capital)      filter (where estado <> 'cancelado'), 0) as capital_colocado,
    count(*)                   filter (where estado = 'activo')         as prestamos_activos,
    coalesce(sum(saldo_capital) filter (where estado = 'activo'), 0)    as saldo_en_calle
  from pr_v_prestamos
  where inversionista_id is not null
  group by inversionista_id
),
ganancias as (
  select
    inversionista_id,
    coalesce(sum(capital_devuelto), 0)      as capital_devuelto,
    coalesce(sum(interes_inversionista), 0) as interes_ganado
  from pr_distribuciones
  where inversionista_id is not null
  group by inversionista_id
)
select
  i.*,
  -- Capital
  coalesce(mv.aportes, 0)          as aportes,
  coalesce(mv.retiros_capital, 0)  as retiros,            -- solo retiros de CAPITAL
  coalesce(mv.ajustes, 0)          as ajustes,
  round(coalesce(mv.aportes,0) - coalesce(mv.retiros_capital,0)
        + coalesce(mv.ajustes,0), 2)                      as capital_aportado,
  round(coalesce(c.saldo_en_calle, 0), 2)                 as capital_en_calle,
  round(coalesce(mv.aportes,0) - coalesce(mv.retiros_capital,0)
        + coalesce(mv.ajustes,0) - coalesce(c.saldo_en_calle,0), 2) as capital_disponible,
  -- Cartera
  coalesce(c.capital_colocado, 0)  as capital_colocado,
  coalesce(c.prestamos_activos, 0) as prestamos_activos,
  coalesce(g.capital_devuelto, 0)  as capital_recuperado,
  -- Ganancia
  coalesce(g.interes_ganado, 0)      as interes_ganado,
  coalesce(mv.ganancia_retirada, 0)  as ganancia_retirada,
  round(coalesce(g.interes_ganado,0) - coalesce(mv.ganancia_retirada,0), 2) as ganancia_por_pagar
from pr_inversionistas i
left join mov       mv on mv.inversionista_id = i.id
left join cartera   c  on c.inversionista_id  = i.id
left join ganancias g  on g.inversionista_id  = i.id;

create view pr_v_dashboard as
select
  (select count(*) from pr_clientes where activo)                                     as clientes_activos,
  (select count(*) from pr_inversionistas where activo)                               as inversionistas_activos,
  (select count(*) from pr_prestamos where estado = 'activo')                         as prestamos_activos,
  (select coalesce(sum(capital),0) from pr_prestamos where estado = 'activo')         as capital_colocado,
  (select coalesce(sum(saldo_capital),0) from pr_v_prestamos where estado = 'activo') as capital_por_recuperar,
  (select coalesce(sum(saldo_total),0)   from pr_v_prestamos where estado = 'activo') as cartera_por_cobrar,
  (select count(*) from pr_v_prestamos where estado_visual = 'atrasado')              as prestamos_atrasados,
  (select coalesce(sum(pendiente + mora_pendiente),0) from pr_v_cuotas
     where estado_visual = 'atrasada' and activa)                                     as monto_atrasado,
  (select coalesce(sum(interes_total),0) from pr_distribuciones)                      as interes_cobrado_total,
  (select coalesce(sum(interes_administrador + mora_administrador),0) from pr_distribuciones) as ganancia_administrador,
  (select coalesce(sum(interes_inversionista),0) from pr_distribuciones)              as ganancia_inversionistas,
  (select coalesce(sum(interes_administrador + mora_administrador),0) from pr_distribuciones
     where fecha >= date_trunc('month', current_date))                                as ganancia_admin_mes,
  (select coalesce(sum(monto),0) from pr_pagos
     where not anulado and fecha >= date_trunc('month', current_date))                as cobrado_mes;

alter view pr_v_prestamos      set (security_invoker = on);
alter view pr_v_inversionistas set (security_invoker = on);
alter view pr_v_dashboard      set (security_invoker = on);

commit;

-- ---------------------------------------------------------------------
-- Comprobación
-- ---------------------------------------------------------------------
select
  (select count(*) from information_schema.columns
    where table_name = 'pr_prestamos' and column_name = 'inversionista_nombre_hist')  as guarda_nombre,
  (select con.confdeltype from pg_constraint con
     join pg_class rel on rel.oid = con.conrelid
    where rel.relname = 'pr_prestamos' and con.contype = 'f'
      and con.conname = 'pr_prestamos_inversionista_id_fkey')                    as regla_borrado,
  '✅ Ya se pueden eliminar inversionistas'                                       as resultado;
