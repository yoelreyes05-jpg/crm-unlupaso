-- =====================================================================
--  MÓDULO DE PRÉSTAMOS — dentro del proyecto UNLUPASO
--  Prefijo de tablas: pr_    ·    Ruta de la app: /prestamos
-- =====================================================================
--  Ninguna tabla de este módulo referencia tablas ul_ ni rep_,
--  así que los datos nunca se mezclan con la heladería ni con CROW EVENTS.
--
--  Ejecutar completo en Supabase → SQL Editor. Es idempotente.
-- =====================================================================

create extension if not exists "pgcrypto";

-- =====================================================================
-- 1. CONFIGURACIÓN
-- =====================================================================
create table if not exists pr_config (
  id                   int primary key default 1 check (id = 1),
  nombre_empresa       text not null default 'Préstamos UNLUPASO',
  rnc                  text,
  telefono             text,
  direccion            text,
  moneda               text not null default 'DOP',
  simbolo_moneda       text not null default 'RD$',
  -- 'divisor' → mensual = tasa, quincenal = tasa/2, semanal = tasa/4
  -- 'dias'    → tasa × (días del período ÷ 30)
  metodo_prorrateo     text not null default 'divisor' check (metodo_prorrateo in ('divisor','dias')),
  dias_gracia          int  not null default 3,
  tasa_mora            numeric(6,3) not null default 5,
  mora_activa_default  boolean not null default false,
  tasa_cliente_default numeric(6,3) not null default 20,
  tasa_inv_default     numeric(6,3) not null default 12,
  logo_url             text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
insert into pr_config (id) values (1) on conflict (id) do nothing;

-- =====================================================================
-- 2. SECUENCIAS DE CÓDIGO
-- =====================================================================
create sequence if not exists pr_seq_cliente       start 1;
create sequence if not exists pr_seq_inversionista start 1;
create sequence if not exists pr_seq_prestamo      start 1;
create sequence if not exists pr_seq_recibo        start 1;

-- =====================================================================
-- 3. CLIENTES
-- =====================================================================
create table if not exists pr_clientes (
  id              uuid primary key default gen_random_uuid(),
  codigo          text unique not null default ('CLI-' || lpad(nextval('pr_seq_cliente')::text, 4, '0')),
  nombre          text not null,
  cedula          text,
  telefono        text,
  telefono2       text,
  email           text,
  direccion       text,
  ocupacion       text,
  lugar_trabajo   text,
  ingreso_mensual numeric(14,2),
  ref1_nombre     text,
  ref1_telefono   text,
  ref2_nombre     text,
  ref2_telefono   text,
  notas           text,
  activo          boolean not null default true,
  usuario         text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists pr_idx_clientes_nombre on pr_clientes (lower(nombre));
create index if not exists pr_idx_clientes_cedula on pr_clientes (cedula);

-- =====================================================================
-- 4. INVERSIONISTAS
-- =====================================================================
create table if not exists pr_inversionistas (
  id                   uuid primary key default gen_random_uuid(),
  codigo               text unique not null default ('INV-' || lpad(nextval('pr_seq_inversionista')::text, 3, '0')),
  nombre               text not null,
  cedula               text,
  telefono             text,
  email                text,
  direccion            text,
  -- 'tasa'       → se le pacta una tasa mensual (8 %, 12 %, 15 %…)
  -- 'porcentaje' → se lleva un % del interés generado
  modo_reparto_default text not null default 'tasa' check (modo_reparto_default in ('tasa','porcentaje')),
  tasa_default         numeric(6,3) not null default 12,
  porcentaje_default   numeric(6,3) not null default 60,
  notas                text,
  activo               boolean not null default true,
  usuario              text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- Caja del inversionista: aportes, retiros y retiros de ganancia
create table if not exists pr_movimientos_inversionista (
  id               uuid primary key default gen_random_uuid(),
  inversionista_id uuid not null references pr_inversionistas(id) on delete cascade,
  fecha            date not null default current_date,
  tipo             text not null check (tipo in ('aporte','retiro','retiro_ganancia','ajuste')),
  monto            numeric(14,2) not null,
  descripcion      text,
  usuario          text,
  created_at       timestamptz not null default now()
);
create index if not exists pr_idx_mov_inv on pr_movimientos_inversionista (inversionista_id, fecha);

-- =====================================================================
-- 5. PRÉSTAMOS
-- =====================================================================
create table if not exists pr_prestamos (
  id                 uuid primary key default gen_random_uuid(),
  codigo             text unique not null default ('PR-' || lpad(nextval('pr_seq_prestamo')::text, 5, '0')),
  cliente_id         uuid not null references pr_clientes(id) on delete restrict,
  inversionista_id   uuid references pr_inversionistas(id) on delete restrict,  -- null = capital propio

  -- Condiciones
  capital            numeric(14,2) not null check (capital > 0),  -- capital vigente (sube con el reenganche)
  capital_original   numeric(14,2) not null,
  tasa_interes       numeric(6,3)  not null check (tasa_interes >= 0),  -- % MENSUAL al cliente
  metodo             text not null default 'interes_fijo'
                       check (metodo in ('interes_fijo','saldo_insoluto','solo_interes')),
  frecuencia         text not null default 'mensual'
                       check (frecuencia in ('semanal','quincenal','mensual','personalizada')),
  dias_periodo       int  not null default 30 check (dias_periodo > 0),
  num_cuotas         int  not null check (num_cuotas > 0),

  fecha_inicio       date not null default current_date,
  fecha_primer_pago  date not null,
  fecha_fin_estimada date not null,

  -- Reparto con el inversionista
  modo_reparto             text not null default 'tasa' check (modo_reparto in ('tasa','porcentaje')),
  tasa_inversionista       numeric(6,3) not null default 0,
  porcentaje_inversionista numeric(6,3) not null default 0,

  -- Mora
  mora_activa        boolean not null default false,
  tasa_mora          numeric(6,3) not null default 0,
  dias_gracia        int not null default 3,

  -- Calculados al generar el cronograma
  monto_cuota        numeric(14,2) not null default 0,
  interes_programado numeric(14,2) not null default 0,
  total_programado   numeric(14,2) not null default 0,

  estado             text not null default 'activo'
                       check (estado in ('activo','pagado','cancelado')),
  ciclo              int not null default 1,   -- sube con cada reenganche
  garantia           text,
  notas              text,
  usuario            text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists pr_idx_prestamos_cliente on pr_prestamos (cliente_id);
create index if not exists pr_idx_prestamos_inv     on pr_prestamos (inversionista_id);
create index if not exists pr_idx_prestamos_estado  on pr_prestamos (estado);

-- =====================================================================
-- 6. CUOTAS (cronograma)
-- =====================================================================
create table if not exists pr_cuotas (
  id                uuid primary key default gen_random_uuid(),
  prestamo_id       uuid not null references pr_prestamos(id) on delete cascade,
  ciclo             int not null default 1,
  numero            int not null,
  fecha_vencimiento date not null,

  capital        numeric(14,2) not null default 0,
  interes        numeric(14,2) not null default 0,
  total          numeric(14,2) not null default 0,
  saldo_despues  numeric(14,2) not null default 0,

  capital_pagado numeric(14,2) not null default 0,
  interes_pagado numeric(14,2) not null default 0,
  mora_generada  numeric(14,2) not null default 0,
  mora_pagada    numeric(14,2) not null default 0,

  estado     text not null default 'pendiente'
               check (estado in ('pendiente','parcial','pagada','solo_interes','reemplazada','condonada')),
  fecha_pago date,
  activa     boolean not null default true,   -- false = reemplazada por un reenganche
  origen     text not null default 'cronograma'
               check (origen in ('cronograma','solo_interes','reenganche','manual')),
  notas      text,
  created_at timestamptz not null default now()
);
create unique index if not exists pr_idx_cuota_unica on pr_cuotas (prestamo_id, ciclo, numero);
create index if not exists pr_idx_cuotas_venc on pr_cuotas (fecha_vencimiento) where activa;

-- =====================================================================
-- 7. PAGOS
-- =====================================================================
create table if not exists pr_pagos (
  id            uuid primary key default gen_random_uuid(),
  recibo        text unique not null default ('REC-' || lpad(nextval('pr_seq_recibo')::text, 6, '0')),
  prestamo_id   uuid not null references pr_prestamos(id) on delete cascade,
  cuota_id      uuid references pr_cuotas(id) on delete set null,
  fecha         date not null default current_date,
  monto         numeric(14,2) not null check (monto > 0),
  tipo          text not null default 'cuota'
                  check (tipo in ('cuota','solo_interes','abono_capital','saldo_total','mora')),
  monto_capital numeric(14,2) not null default 0,
  monto_interes numeric(14,2) not null default 0,
  monto_mora    numeric(14,2) not null default 0,
  metodo_pago   text not null default 'efectivo'
                  check (metodo_pago in ('efectivo','transferencia','cheque','tarjeta','otro')),
  referencia    text,
  notas         text,
  anulado       boolean not null default false,
  usuario       text,
  created_at    timestamptz not null default now()
);
create index if not exists pr_idx_pagos_prestamo on pr_pagos (prestamo_id, fecha);
create index if not exists pr_idx_pagos_fecha    on pr_pagos (fecha) where not anulado;

-- =====================================================================
-- 8. DISTRIBUCIÓN DE GANANCIAS
--    Cada pago deja registrado cuánto capital se devolvió, cuánto
--    interés le tocó al inversionista y cuánto al administrador.
-- =====================================================================
create table if not exists pr_distribuciones (
  id                    uuid primary key default gen_random_uuid(),
  pago_id               uuid not null references pr_pagos(id) on delete cascade,
  prestamo_id           uuid not null references pr_prestamos(id) on delete cascade,
  inversionista_id      uuid references pr_inversionistas(id) on delete set null,
  fecha                 date not null default current_date,
  capital_devuelto      numeric(14,2) not null default 0,
  interes_total         numeric(14,2) not null default 0,
  interes_inversionista numeric(14,2) not null default 0,
  interes_administrador numeric(14,2) not null default 0,
  mora_administrador    numeric(14,2) not null default 0,
  created_at            timestamptz not null default now()
);
create index if not exists pr_idx_dist_inv   on pr_distribuciones (inversionista_id, fecha);
create index if not exists pr_idx_dist_fecha on pr_distribuciones (fecha);

-- =====================================================================
-- 9. REENGANCHES
-- =====================================================================
create table if not exists pr_reenganches (
  id                   uuid primary key default gen_random_uuid(),
  prestamo_id          uuid not null references pr_prestamos(id) on delete cascade,
  fecha                date not null default current_date,
  monto_adicional      numeric(14,2) not null check (monto_adicional > 0),
  saldo_capital_previo numeric(14,2) not null,
  interes_capitalizado numeric(14,2) not null default 0,
  capital_nuevo        numeric(14,2) not null,
  tasa_previa          numeric(6,3) not null,
  tasa_nueva           numeric(6,3) not null,
  num_cuotas_nuevas    int not null,
  frecuencia_nueva     text not null,
  ciclo_previo         int not null,
  ciclo_nuevo          int not null,
  notas                text,
  usuario              text,
  created_at           timestamptz not null default now()
);
create index if not exists pr_idx_reenganches on pr_reenganches (prestamo_id, fecha);

-- =====================================================================
-- 10. VISTAS
-- =====================================================================

-- 10.1 Cuotas con el atraso calculado al vuelo
create or replace view pr_v_cuotas as
select
  c.*,
  p.codigo                        as prestamo_codigo,
  p.cliente_id,
  cl.nombre                       as cliente_nombre,
  cl.telefono                     as cliente_telefono,
  p.inversionista_id,
  p.dias_gracia,
  round(c.total - c.capital_pagado - c.interes_pagado, 2) as pendiente,
  round(c.mora_generada - c.mora_pagada, 2)              as mora_pendiente,
  case
    -- 'solo_interes' ya quedó saldada: su capital se movió al final del cronograma
    when c.estado in ('pagada','reemplazada','condonada','solo_interes') then 0
    else greatest(0, (current_date - c.fecha_vencimiento))
  end                                                    as dias_atraso,
  case
    when c.estado = 'pagada'       then 'pagada'
    when c.estado = 'reemplazada'  then 'reemplazada'
    when c.estado = 'condonada'    then 'condonada'
    when c.estado = 'solo_interes' then 'solo_interes'
    when current_date - c.fecha_vencimiento > p.dias_gracia then 'atrasada'
    when c.estado = 'parcial'      then 'parcial'
    when c.fecha_vencimiento = current_date then 'vence_hoy'
    else 'pendiente'
  end                                                    as estado_visual
from pr_cuotas c
join pr_prestamos p on p.id = c.prestamo_id
join pr_clientes  cl on cl.id = p.cliente_id;

-- 10.2 Resumen por préstamo
create or replace view pr_v_prestamos as
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
  i.nombre     as inversionista_nombre,
  i.codigo     as inversionista_codigo,
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

-- 10.3 Estado de cuenta del inversionista
create or replace view pr_v_inversionistas as
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


-- 10.4 Ganancias por mes
create or replace view pr_v_ganancias_mensuales as
select
  date_trunc('month', d.fecha)::date as mes,
  sum(d.capital_devuelto)            as capital_recuperado,
  sum(d.interes_total)               as interes_total,
  sum(d.interes_inversionista)       as ganancia_inversionistas,
  sum(d.interes_administrador + d.mora_administrador) as ganancia_administrador,
  count(distinct d.prestamo_id)      as prestamos_con_movimiento
from pr_distribuciones d
group by 1
order by 1 desc;

-- 10.5 Ganancias por inversionista y mes
create or replace view pr_v_ganancias_inversionista as
select
  d.inversionista_id,
  coalesce(i.nombre, 'Capital propio') as inversionista_nombre,
  date_trunc('month', d.fecha)::date   as mes,
  sum(d.capital_devuelto)              as capital_recuperado,
  sum(d.interes_inversionista)         as ganancia,
  sum(d.interes_administrador + d.mora_administrador) as ganancia_administrador
from pr_distribuciones d
left join pr_inversionistas i on i.id = d.inversionista_id
group by 1,2,3
order by 3 desc;

-- 10.6 Indicadores globales
create or replace view pr_v_dashboard as
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

-- 10.7 Agenda de cobros (lo vencido y lo que viene)
create or replace view pr_v_cobranza as
select *
from pr_v_cuotas
where activa
  and estado not in ('pagada','reemplazada','condonada','solo_interes')
order by fecha_vencimiento;

-- =====================================================================
-- 11. TRIGGERS de updated_at
-- =====================================================================
create or replace function pr_fn_touch()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists pr_tg_touch_clientes on pr_clientes;
create trigger pr_tg_touch_clientes before update on pr_clientes
  for each row execute function pr_fn_touch();

drop trigger if exists pr_tg_touch_inv on pr_inversionistas;
create trigger pr_tg_touch_inv before update on pr_inversionistas
  for each row execute function pr_fn_touch();

drop trigger if exists pr_tg_touch_prestamos on pr_prestamos;
create trigger pr_tg_touch_prestamos before update on pr_prestamos
  for each row execute function pr_fn_touch();

drop trigger if exists pr_tg_touch_config on pr_config;
create trigger pr_tg_touch_config before update on pr_config
  for each row execute function pr_fn_touch();

-- =====================================================================
-- 12. SEGURIDAD
--     RLS activo sin políticas: nadie entra con la anon key.
--     La app usa la service role key desde /api/prestamos/*, que la ignora.
-- =====================================================================
alter table pr_config                    enable row level security;
alter table pr_clientes                  enable row level security;
alter table pr_inversionistas            enable row level security;
alter table pr_movimientos_inversionista enable row level security;
alter table pr_prestamos                 enable row level security;
alter table pr_cuotas                    enable row level security;
alter table pr_pagos                     enable row level security;
alter table pr_distribuciones            enable row level security;
alter table pr_reenganches               enable row level security;

alter view pr_v_cuotas                  set (security_invoker = on);
alter view pr_v_prestamos               set (security_invoker = on);
alter view pr_v_inversionistas          set (security_invoker = on);
alter view pr_v_ganancias_mensuales     set (security_invoker = on);
alter view pr_v_ganancias_inversionista set (security_invoker = on);
alter view pr_v_dashboard               set (security_invoker = on);
alter view pr_v_cobranza                set (security_invoker = on);

-- =====================================================================
-- FIN — 9 tablas, 7 vistas, prefijo pr_
-- =====================================================================
