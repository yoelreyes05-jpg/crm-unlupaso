-- =====================================================================
--  INVENTARIO DEL MÓDULO DE PRÉSTAMOS
--  Pega esto en Supabase → SQL Editor y ejecútalo.
--  Solo LEE: no crea, no modifica y no borra nada.
-- =====================================================================

-- ─── 1. QUÉ HAY AHORA MISMO (tablas pr_ con su cantidad de filas) ────
select
  t.table_name                                        as objeto,
  case t.table_type when 'VIEW' then 'vista' else 'tabla' end as tipo,
  (xpath(
     '/row/c/text()',
     query_to_xml(format('select count(*) as c from public.%I', t.table_name), false, true, '')
   ))[1]::text::bigint                                as filas,
  (select count(*) from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = t.table_name) as columnas
from information_schema.tables t
where t.table_schema = 'public'
  and t.table_name like 'pr\_%'
order by tipo desc, objeto;


-- ─── 2. DIAGNÓSTICO: qué falta, qué sobra, qué está bien ─────────────
with esperado(objeto, tipo) as (values
  ('pr_config','tabla'), ('pr_clientes','tabla'), ('pr_inversionistas','tabla'),
  ('pr_movimientos_inversionista','tabla'), ('pr_prestamos','tabla'),
  ('pr_cuotas','tabla'), ('pr_pagos','tabla'), ('pr_distribuciones','tabla'),
  ('pr_reenganches','tabla'),
  ('pr_v_prestamos','vista'), ('pr_v_cuotas','vista'), ('pr_v_inversionistas','vista'),
  ('pr_v_ganancias_mensuales','vista'), ('pr_v_ganancias_inversionista','vista'),
  ('pr_v_dashboard','vista'), ('pr_v_cobranza','vista')
),
actual as (
  select table_name as objeto,
         case table_type when 'VIEW' then 'vista' else 'tabla' end as tipo
  from information_schema.tables
  where table_schema = 'public' and table_name like 'pr\_%'
)
select
  coalesce(e.objeto, a.objeto) as objeto,
  coalesce(e.tipo, a.tipo)     as tipo,
  case
    when a.objeto is null then '❌ FALTA — la crea el script de actualización'
    when e.objeto is null then '⚠️  SOBRA — no la usa el módulo, el script la elimina'
    else '✅ está'
  end as estado
from esperado e
full outer join actual a on a.objeto = e.objeto
order by 3, 1;


-- ─── 3. VERSIÓN DEL ESQUEMA QUE TIENES INSTALADA ─────────────────────
select
  case
    when not exists (select 1 from information_schema.tables
                      where table_schema='public' and table_name='pr_prestamos')
      then 'VACÍO — nunca se instaló. Ejecuta prestamos_actualizar.sql y queda todo listo.'
    when exists (select 1 from information_schema.columns
                  where table_schema='public' and table_name='pr_clientes' and column_name='creado_en')
      then 'VERSIÓN 1 (app independiente) — usa creado_en/actualizado_en y tabla pr_perfiles. Ejecuta prestamos_actualizar.sql para pasarla al módulo.'
    when exists (select 1 from information_schema.columns
                  where table_schema='public' and table_name='pr_clientes' and column_name='usuario')
      then 'VERSIÓN 2 (módulo de UNLUPASO) — ya está al día. El script de actualización no cambiaría nada.'
    else 'MEZCLA — ejecuta prestamos_actualizar.sql para normalizarla.'
  end as diagnostico;


-- ─── 4. COLUMNAS DE CADA TABLA (para revisar a detalle) ──────────────
select table_name as tabla,
       string_agg(column_name, ', ' order by ordinal_position) as columnas
from information_schema.columns
where table_schema = 'public'
  and table_name like 'pr\_%'
  and table_name not like 'pr\_v\_%'
group by table_name
order by table_name;
