-- =====================================================================
--  ACTUALIZAR EL MÓDULO DE PRÉSTAMOS  (prefijo pr_)
-- =====================================================================
--  Deja la base exactamente como la necesita /prestamos, sin importar
--  desde dónde partas:
--
--    · Si no hay nada        → crea las 9 tablas y las 7 vistas.
--    · Si tienes la versión 1 → renombra columnas, quita lo que sobra
--                               y agrega lo que falta, SIN borrar datos.
--    · Si ya está al día     → no cambia nada.
--
--  Se puede volver a ejecutar cuantas veces quieras.
--  Ninguna tabla ul_ ni rep_ se toca.
-- =====================================================================

begin;

create extension if not exists "pgcrypto";

-- =====================================================================
-- PASO 1 · Quitar las vistas (se vuelven a crear al final, ya corregidas)
-- =====================================================================
drop view if exists pr_v_cobranza               cascade;
drop view if exists pr_v_dashboard              cascade;
drop view if exists pr_v_ganancias_inversionista cascade;
drop view if exists pr_v_ganancias_mensuales    cascade;
drop view if exists pr_v_inversionistas         cascade;
drop view if exists pr_v_prestamos              cascade;
drop view if exists pr_v_cuotas                 cascade;

-- =====================================================================
-- PASO 2 · Eliminar lo que el módulo NO usa
--          (venía de la versión con login propio; aquí se entra igual
--           que a /reposteria, sin autenticación por módulo)
-- =====================================================================
drop trigger  if exists pr_tg_perfil_nuevo on auth.users;
drop function if exists pr_fn_perfil_nuevo()          cascade;
drop function if exists pr_fn_rol()                   cascade;
drop function if exists pr_fn_es_staff()              cascade;
drop function if exists pr_fn_inversionista_actual()  cascade;
drop function if exists pr_fn_anular_pago(uuid)       cascade;  -- ahora se anula desde /api/prestamos/anular-pago
drop table    if exists pr_perfiles                   cascade;

-- Políticas de la versión anterior
do $$
declare r record;
begin
  for r in
    select policyname, tablename from pg_policies
    where schemaname = 'public' and tablename like 'pr\_%'
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- Columnas que ya no se usan
alter table if exists pr_pagos     drop column if exists registrado_por;
alter table if exists pr_prestamos drop column if exists prestamo_origen_id;

-- El trigger de la versión anterior escribía en 'actualizado_en'.
-- Se apaga aquí para que no estorbe durante la migración; al final se
-- vuelve a crear apuntando a 'updated_at'.
drop trigger if exists pr_tg_touch_clientes  on pr_clientes;
drop trigger if exists pr_tg_touch_inv       on pr_inversionistas;
drop trigger if exists pr_tg_touch_prestamos on pr_prestamos;
drop trigger if exists pr_tg_touch_config    on pr_config;

-- =====================================================================
-- PASO 3 · Renombrar las columnas de la versión anterior
--          creado_en → created_at    ·    actualizado_en → updated_at
--          (los datos se conservan, solo cambia el nombre)
-- =====================================================================
do $$
declare
  r      record;
  destino text;
begin
  for r in
    select c.table_name, c.column_name
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name like 'pr\_%'
      and c.column_name in ('creado_en', 'actualizado_en')
  loop
    destino := case r.column_name when 'creado_en' then 'created_at' else 'updated_at' end;
    -- solo si la columna destino todavía no existe
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = r.table_name and column_name = destino
    ) then
      execute format('alter table public.%I rename column %I to %I', r.table_name, r.column_name, destino);
      raise notice 'Renombrada %.% → %', r.table_name, r.column_name, destino;
    end if;
  end loop;
end $$;

-- pr_config: tasa_admin_default → tasa_cliente_default
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='pr_config' and column_name='tasa_admin_default')
     and not exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='pr_config' and column_name='tasa_cliente_default')
  then
    alter table pr_config rename column tasa_admin_default to tasa_cliente_default;
    raise notice 'Renombrada pr_config.tasa_admin_default → tasa_cliente_default';
  end if;
end $$;

-- =====================================================================
-- PASO 4 · Crear lo que falte (si la base estaba vacía, aquí nace todo)
-- =====================================================================
create sequence if not exists pr_seq_cliente       start 1;
create sequence if not exists pr_seq_inversionista start 1;
create sequence if not exists pr_seq_prestamo      start 1;
create sequence if not exists pr_seq_recibo        start 1;

create table if not exists pr_config (
  id                   int primary key default 1 check (id = 1),
  nombre_empresa       text not null default 'CGSSOLUTIONS',
  rnc                  text,
  telefono             text,
  direccion            text,
  moneda               text not null default 'DOP',
  simbolo_moneda       text not null default 'RD$',
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

create table if not exists pr_inversionistas (
  id                   uuid primary key default gen_random_uuid(),
  codigo               text unique not null default ('INV-' || lpad(nextval('pr_seq_inversionista')::text, 3, '0')),
  nombre               text not null,
  cedula               text,
  telefono             text,
  email                text,
  direccion            text,
  modo_reparto_default text not null default 'tasa' check (modo_reparto_default in ('tasa','porcentaje')),
  tasa_default         numeric(6,3) not null default 12,
  porcentaje_default   numeric(6,3) not null default 60,
  notas                text,
  activo               boolean not null default true,
  usuario              text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

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

create table if not exists pr_prestamos (
  id                 uuid primary key default gen_random_uuid(),
  codigo             text unique not null default ('PR-' || lpad(nextval('pr_seq_prestamo')::text, 5, '0')),
  cliente_id         uuid not null references pr_clientes(id) on delete restrict,
  inversionista_id   uuid references pr_inversionistas(id) on delete restrict,
  capital            numeric(14,2) not null check (capital > 0),
  capital_original   numeric(14,2) not null,
  tasa_interes       numeric(6,3)  not null check (tasa_interes >= 0),
  metodo             text not null default 'interes_fijo'
                       check (metodo in ('interes_fijo','saldo_insoluto','solo_interes')),
  frecuencia         text not null default 'mensual'
                       check (frecuencia in ('semanal','quincenal','mensual','personalizada')),
  dias_periodo       int  not null default 30 check (dias_periodo > 0),
  num_cuotas         int  not null check (num_cuotas > 0),
  fecha_inicio       date not null default current_date,
  fecha_primer_pago  date not null,
  fecha_fin_estimada date not null,
  modo_reparto             text not null default 'tasa' check (modo_reparto in ('tasa','porcentaje')),
  tasa_inversionista       numeric(6,3) not null default 0,
  porcentaje_inversionista numeric(6,3) not null default 0,
  mora_activa        boolean not null default false,
  tasa_mora          numeric(6,3) not null default 0,
  dias_gracia        int not null default 3,
  monto_cuota        numeric(14,2) not null default 0,
  interes_programado numeric(14,2) not null default 0,
  total_programado   numeric(14,2) not null default 0,
  estado             text not null default 'activo',
  ciclo              int not null default 1,
  garantia           text,
  notas              text,
  usuario            text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

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
  activa     boolean not null default true,
  origen     text not null default 'cronograma'
               check (origen in ('cronograma','solo_interes','reenganche','manual')),
  notas      text,
  created_at timestamptz not null default now()
);

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

-- =====================================================================
-- PASO 5 · Agregar las columnas que falten en tablas que ya existían
-- =====================================================================
alter table pr_config      add column if not exists logo_url             text;
alter table pr_config      add column if not exists tasa_cliente_default numeric(6,3) not null default 20;
alter table pr_config      add column if not exists created_at           timestamptz not null default now();
alter table pr_config      add column if not exists updated_at           timestamptz not null default now();

alter table pr_clientes    add column if not exists usuario    text;
alter table pr_clientes    add column if not exists created_at timestamptz not null default now();
alter table pr_clientes    add column if not exists updated_at timestamptz not null default now();

alter table pr_inversionistas add column if not exists usuario    text;
alter table pr_inversionistas add column if not exists created_at timestamptz not null default now();
alter table pr_inversionistas add column if not exists updated_at timestamptz not null default now();

alter table pr_movimientos_inversionista add column if not exists usuario    text;
alter table pr_movimientos_inversionista add column if not exists created_at timestamptz not null default now();

alter table pr_prestamos   add column if not exists usuario    text;
alter table pr_prestamos   add column if not exists created_at timestamptz not null default now();
alter table pr_prestamos   add column if not exists updated_at timestamptz not null default now();

alter table pr_cuotas      add column if not exists created_at timestamptz not null default now();

alter table pr_pagos       add column if not exists usuario    text;
alter table pr_pagos       add column if not exists created_at timestamptz not null default now();

alter table pr_distribuciones add column if not exists created_at timestamptz not null default now();

alter table pr_reenganches add column if not exists interes_capitalizado numeric(14,2) not null default 0;
alter table pr_reenganches add column if not exists usuario              text;
alter table pr_reenganches add column if not exists created_at           timestamptz not null default now();

-- =====================================================================
-- PASO 6 · Normalizar restricciones e índices
-- =====================================================================
-- El estado 'reenganchado' ya no existe: el reenganche deja el préstamo activo
update pr_prestamos set estado = 'activo' where estado = 'reenganchado';
alter table pr_prestamos drop constraint if exists pr_prestamos_estado_check;
alter table pr_prestamos add  constraint pr_prestamos_estado_check
  check (estado in ('activo','pagado','cancelado'));

create index        if not exists pr_idx_clientes_nombre on pr_clientes (lower(nombre));
create index        if not exists pr_idx_clientes_cedula on pr_clientes (cedula);
create index        if not exists pr_idx_mov_inv         on pr_movimientos_inversionista (inversionista_id, fecha);
create index        if not exists pr_idx_prestamos_cliente on pr_prestamos (cliente_id);
create index        if not exists pr_idx_prestamos_inv     on pr_prestamos (inversionista_id);
create index        if not exists pr_idx_prestamos_estado  on pr_prestamos (estado);
create unique index if not exists pr_idx_cuota_unica       on pr_cuotas (prestamo_id, ciclo, numero);
create index        if not exists pr_idx_cuotas_venc       on pr_cuotas (fecha_vencimiento) where activa;
create index        if not exists pr_idx_pagos_prestamo    on pr_pagos (prestamo_id, fecha);
create index        if not exists pr_idx_pagos_fecha       on pr_pagos (fecha) where not anulado;
create index        if not exists pr_idx_dist_inv          on pr_distribuciones (inversionista_id, fecha);
create index        if not exists pr_idx_dist_fecha        on pr_distribuciones (fecha);
create index        if not exists pr_idx_reenganches       on pr_reenganches (prestamo_id, fecha);

-- =====================================================================
-- PASO 7 · Vistas (versión corregida: 'solo_interes' cuenta como saldada)
-- =====================================================================
create view pr_v_cuotas as
select
  c.*,
  p.codigo    as prestamo_codigo,
  p.cliente_id,
  cl.nombre   as cliente_nombre,
  cl.telefono as cliente_telefono,
  p.inversionista_id,
  p.dias_gracia,
  round(c.total - c.capital_pagado - c.interes_pagado, 2) as pendiente,
  round(c.mora_generada - c.mora_pagada, 2)              as mora_pendiente,
  case
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
    count(*) filter (where estado in ('pagada','solo_interes'))                 as cuotas_pagadas,
    count(*)                                                                    as cuotas_totales,
    count(*) filter (where estado not in ('pagada','condonada','solo_interes')) as cuotas_pendientes,
    count(*) filter (where estado not in ('pagada','condonada','solo_interes')
                       and fecha_vencimiento < current_date)                    as cuotas_atrasadas,
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
  round(coalesce(a.capital_programado,0) - coalesce(a.capital_pagado,0), 2)      as saldo_capital,
  round(coalesce(a.interes_programado_real,0) - coalesce(a.interes_pagado,0), 2) as saldo_interes,
  round(coalesce(a.total_programado_real,0)
        - coalesce(a.capital_pagado,0) - coalesce(a.interes_pagado,0)
        + coalesce(a.mora_generada,0) - coalesce(a.mora_pagada,0), 2)            as saldo_total,
  round(coalesce(a.capital_pagado,0) + coalesce(a.interes_pagado,0)
        + coalesce(a.mora_pagada,0), 2)                                          as total_cobrado,
  coalesce(a.cuotas_pagadas, 0)    as cuotas_pagadas,
  coalesce(a.cuotas_totales, 0)    as cuotas_totales,
  coalesce(a.cuotas_pendientes, 0) as cuotas_pendientes,
  coalesce(a.cuotas_atrasadas, 0)  as cuotas_atrasadas,
  a.proximo_vencimiento,
  a.ultimo_vencimiento             as fecha_fin_real,
  case
    when p.estado = 'cancelado' then 'cancelado'
    when coalesce(a.cuotas_atrasadas,0) > 0 then 'atrasado'
    when coalesce(a.cuotas_pendientes,0) = 0 then 'pagado'
    else 'al_dia'
  end                              as estado_visual,
  case
    when coalesce(a.total_programado_real,0) = 0 then 0
    else round(100 * (coalesce(a.capital_pagado,0) + coalesce(a.interes_pagado,0))
               / a.total_programado_real, 2)
  end                              as avance_pct
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


create view pr_v_ganancias_mensuales as
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

create view pr_v_ganancias_inversionista as
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

create view pr_v_cobranza as
select *
from pr_v_cuotas
where activa
  and estado not in ('pagada','reemplazada','condonada','solo_interes')
order by fecha_vencimiento;

-- =====================================================================
-- PASO 8 · Triggers de updated_at
-- =====================================================================
create or replace function pr_fn_touch()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists pr_tg_touch_clientes  on pr_clientes;
create trigger pr_tg_touch_clientes  before update on pr_clientes
  for each row execute function pr_fn_touch();

drop trigger if exists pr_tg_touch_inv       on pr_inversionistas;
create trigger pr_tg_touch_inv       before update on pr_inversionistas
  for each row execute function pr_fn_touch();

drop trigger if exists pr_tg_touch_prestamos on pr_prestamos;
create trigger pr_tg_touch_prestamos before update on pr_prestamos
  for each row execute function pr_fn_touch();

drop trigger if exists pr_tg_touch_config    on pr_config;
create trigger pr_tg_touch_config    before update on pr_config
  for each row execute function pr_fn_touch();

-- =====================================================================
-- PASO 9 · Seguridad
--   RLS activo SIN políticas: nadie lee estas tablas con la anon key.
--   La app entra por /api/prestamos/* con la service role key, que la ignora.
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

commit;

-- =====================================================================
-- COMPROBACIÓN FINAL — debe decir "todo en orden"
-- =====================================================================
select
  (select count(*) from information_schema.tables
    where table_schema='public' and table_name like 'pr\_%' and table_type='BASE TABLE') as tablas,
  (select count(*) from information_schema.views
    where table_schema='public' and table_name like 'pr\_v\_%')                          as vistas,
  case
    when (select count(*) from information_schema.tables
           where table_schema='public' and table_name like 'pr\_%' and table_type='BASE TABLE') = 9
     and (select count(*) from information_schema.views
           where table_schema='public' and table_name like 'pr\_v\_%') = 7
     and not exists (select 1 from information_schema.tables
                      where table_schema='public' and table_name='pr_perfiles')
     and exists (select 1 from information_schema.columns
                  where table_schema='public' and table_name='pr_clientes' and column_name='usuario')
    then '✅ todo en orden — 9 tablas, 7 vistas, módulo listo'
    else '⚠️  revisa el resultado de arriba'
  end as resultado;
