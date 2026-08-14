-- =====================================================================
--  CORRECCIÓN · vista pr_v_inversionistas
--  Pégalo en Supabase → SQL Editor. Solo cambia una vista, no toca datos.
-- =====================================================================
--  Qué se arregla:
--
--  1. El retiro de GANANCIA ya no se resta del capital. Antes 'retiro' y
--     'retiro_ganancia' se sumaban juntos, así que sacar una ganancia hacía
--     ver menos capital aportado del que realmente había.
--
--  2. El capital disponible ahora se calcula contra el saldo REAL en la
--     calle (lo que falta por cobrar de los préstamos activos), no contra
--     el monto original de todos los préstamos. Con reenganches y préstamos
--     cancelados el número anterior se iba desviando.
--
--  3. Los movimientos de tipo 'ajuste' ya cuentan; antes se ignoraban.
--
--  4. Columnas nuevas: capital_aportado, ganancia_retirada,
--     ganancia_por_pagar y ajustes.
-- =====================================================================

drop view if exists pr_v_inversionistas;

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

alter view pr_v_inversionistas set (security_invoker = on);

-- Comprobación
select codigo, nombre, aportes, capital_aportado, capital_en_calle,
       capital_disponible, interes_ganado, ganancia_por_pagar, prestamos_activos
from pr_v_inversionistas
order by codigo;
