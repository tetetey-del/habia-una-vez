-- =====================================================================
-- Había una Vez · 0001 · Esquema base
-- Tablas, tipos, índices y funciones auxiliares.
-- =====================================================================

-- ---------- Tipos ----------
create type public.rol_usuario as enum ('admin', 'coordinacion', 'mantenimiento', 'familia');

create type public.estado_alquiler as enum (
  'pre_reserva', 'senado', 'contrato_aceptado', 'saldo_pagado', 'en_curso',
  'realizado', 'cerrado', 'en_riesgo', 'vencido', 'cancelado'
);

create type public.estado_orden as enum ('abierta', 'en_curso', 'esperando_repuesto', 'resuelta', 'verificada');

create type public.prioridad_orden as enum ('baja', 'media', 'critica', 'cierre_salon');

-- Pagos (llevan recibo): sena, saldo, garantia
-- Cargos / créditos sin recibo: recargo (+), compensacion (-)
-- Salidas de dinero: devolucion (-), devolucion_garantia (-)
create type public.tipo_movimiento as enum (
  'sena', 'saldo', 'garantia', 'recargo', 'compensacion', 'devolucion', 'devolucion_garantia'
);

-- ---------- Perfiles (un rol por usuario) ----------
create table public.perfiles (
  id uuid primary key references auth.users (id) on delete cascade,
  rol public.rol_usuario not null default 'familia',
  nombre text not null default '',
  creado_en timestamptz not null default now()
);

-- ---------- Configuración (parámetros de prueba) ----------
create table public.configuracion (
  clave text primary key,
  valor numeric not null,
  descripcion text not null
);

-- ---------- Grilla de turnos (horarios editables) ----------
create table public.turnos (
  id serial primary key,
  nombre text not null,
  hora_inicio time not null,
  hora_fin time not null,
  orden int not null default 0,
  activo boolean not null default true,
  constraint turnos_horario_valido check (hora_fin > hora_inicio)
);

create table public.feriados (
  fecha date primary key,
  nombre text not null
);

-- ---------- Catálogo ----------
create table public.combos (
  id serial primary key,
  nombre text not null,
  descripcion text not null,
  incluye text[] not null default '{}',
  chicos_incluidos int not null default 30,
  adultos_incluidos int not null default 20,
  activo boolean not null default true,
  orden int not null default 0
);

create table public.adicionales (
  id serial primary key,
  codigo text not null unique,
  nombre text not null,
  descripcion text not null,
  activo boolean not null default true,
  orden int not null default 0
);

-- Precios con vigencia: nunca se editan, se agrega una fila nueva.
-- Una cotización usa el precio vigente al día en que se cotiza.
create table public.precios (
  id serial primary key,
  concepto text not null check (concepto in ('combo', 'adicional', 'persona_extra')),
  combo_id int references public.combos (id),
  adicional_id int references public.adicionales (id),
  tipo_dia text check (tipo_dia in ('sabado', 'domingo_feriado')),
  monto numeric(12, 2) not null check (monto >= 0),
  vigente_desde date not null,
  creado_en timestamptz not null default now(),
  constraint precios_referencia check (
    (concepto = 'combo' and combo_id is not null and tipo_dia is not null and adicional_id is null)
    or (concepto = 'adicional' and adicional_id is not null and combo_id is null)
    or (concepto = 'persona_extra' and combo_id is null and adicional_id is null)
  )
);
create index precios_busqueda on public.precios (concepto, combo_id, adicional_id, tipo_dia, vigente_desde desc);

-- ---------- Familias ----------
create table public.familias (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users (id) on delete set null,
  nombre text not null,
  celular text not null default '',
  email text,
  creado_en timestamptz not null default now()
);

-- ---------- Juegos y sectores ----------
create table public.juegos (
  id serial primary key,
  nombre text not null,
  tipo text not null check (tipo in ('juego', 'sector')),
  descripcion text not null default '',
  principal boolean not null default false,
  frecuencia_tipo text check (frecuencia_tipo in ('eventos', 'dias')),
  frecuencia_valor int check (frecuencia_valor > 0),
  contador int not null default 0,
  ultima_revision date,
  estado text not null default 'operativo' check (estado in ('operativo', 'en_reparacion', 'fuera_de_servicio')),
  orden int not null default 0
);

-- ---------- Órdenes de mantenimiento ----------
create sequence public.orden_numero_seq;

create table public.ordenes (
  id uuid primary key default gen_random_uuid(),
  numero int not null unique default nextval('public.orden_numero_seq'),
  juego_id int not null references public.juegos (id),
  tipo text not null check (tipo in ('preventiva', 'correctiva')),
  prioridad public.prioridad_orden not null,
  estado public.estado_orden not null default 'abierta',
  titulo text not null,
  descripcion text not null default '',
  repuesto text,
  costo numeric(12, 2) not null default 0 check (costo >= 0),
  alquiler_id uuid,
  reportada_por uuid references auth.users (id) on delete set null,
  reportada_por_nombre text not null default '',
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  resuelta_en timestamptz,
  verificada_en timestamptz,
  notas text not null default ''
);
create index ordenes_juego on public.ordenes (juego_id, estado);

-- ---------- Alquileres (centro del sistema) ----------
create sequence public.alquiler_codigo_seq;

create table public.alquileres (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique default ('HV-' || lpad(nextval('public.alquiler_codigo_seq')::text, 4, '0')),
  familia_id uuid not null references public.familias (id),
  fecha date not null,
  turno_id int not null references public.turnos (id),
  estado public.estado_alquiler not null default 'pre_reserva',
  estado_previo public.estado_alquiler,
  homenajeado text not null,
  edad int not null check (edad between 1 and 17),
  chicos int not null check (chicos >= 0),
  adultos int not null check (adultos >= 0),
  motivo_excedente text,
  combo_id int not null references public.combos (id),
  tipo_dia text not null check (tipo_dia in ('sabado', 'domingo_feriado')),
  -- Importes congelados al cotizar (no cambian con nuevas tarifas)
  precio_combo numeric(12, 2) not null,
  personas_extra int not null default 0,
  precio_persona_extra numeric(12, 2) not null default 0,
  monto_personas_extra numeric(12, 2) not null default 0,
  monto_adicionales numeric(12, 2) not null default 0,
  total numeric(12, 2) not null,
  sena_requerida numeric(12, 2) not null,
  cotizado_en date not null,
  quiere_garantia boolean not null default false,
  vence_en timestamptz,
  senado_en timestamptz,
  reprogramaciones int not null default 0,
  orden_riesgo_id uuid references public.ordenes (id),
  bloqueado boolean not null default false,
  compensacion_aplicada boolean not null default false,
  cancelado_por text check (cancelado_por in ('familia', 'salon')),
  motivo_cancelacion text,
  cancelado_en timestamptz,
  hoja jsonb not null default '{}'::jsonb,
  iniciado_en timestamptz,
  finalizado_en timestamptz,
  cerrado_en timestamptz,
  dano_reportado text,
  garantia_retenida numeric(12, 2) not null default 0,
  motivo_retencion text,
  notas text not null default '',
  creado_en timestamptz not null default now(),
  creado_por uuid,
  constraint capacidad_maxima check (chicos + adultos <= 55)
);

-- Un solo evento por fecha y turno: la base rechaza el segundo pedido.
create unique index alquileres_turno_unico
  on public.alquileres (fecha, turno_id)
  where estado not in ('vencido', 'cancelado');

create index alquileres_familia on public.alquileres (familia_id);
create index alquileres_fecha on public.alquileres (fecha, estado);

alter table public.ordenes
  add constraint ordenes_alquiler_fk foreign key (alquiler_id) references public.alquileres (id);

create table public.alquiler_adicionales (
  alquiler_id uuid not null references public.alquileres (id) on delete cascade,
  adicional_id int not null references public.adicionales (id),
  precio numeric(12, 2) not null,
  primary key (alquiler_id, adicional_id) -- cada adicional una vez por turno
);

-- ---------- Contratos (versión congelada) ----------
create table public.contratos (
  id uuid primary key default gen_random_uuid(),
  alquiler_id uuid not null references public.alquileres (id) on delete cascade,
  version int not null,
  datos jsonb not null,
  texto text not null,
  aceptado_por uuid,
  aceptado_por_nombre text not null default '',
  aceptado_en timestamptz not null default now(),
  unique (alquiler_id, version)
);

-- ---------- Cobranzas: movimientos que nunca se borran ----------
create sequence public.recibo_seq;

create table public.movimientos (
  id uuid primary key default gen_random_uuid(),
  alquiler_id uuid not null references public.alquileres (id),
  tipo public.tipo_movimiento not null,
  monto numeric(12, 2) not null,
  recibo int unique,
  medio text,
  detalle text not null default '',
  anulado boolean not null default false,
  anulado_en timestamptz,
  motivo_anulacion text,
  anulado_por uuid,
  clave_idempotencia text unique,
  creado_en timestamptz not null default now(),
  creado_por uuid,
  constraint signo_movimiento check (
    (tipo in ('sena', 'saldo', 'garantia', 'recargo') and monto > 0)
    or (tipo in ('compensacion', 'devolucion', 'devolucion_garantia') and monto < 0)
  )
);
create index movimientos_alquiler on public.movimientos (alquiler_id);
create index movimientos_fecha on public.movimientos (creado_en);

-- ---------- Bitácora ----------
create table public.eventos (
  id bigserial primary key,
  alquiler_id uuid references public.alquileres (id) on delete cascade,
  orden_id uuid references public.ordenes (id) on delete cascade,
  texto text not null,
  actor uuid,
  creado_en timestamptz not null default now()
);
create index eventos_alquiler on public.eventos (alquiler_id);
create index eventos_orden on public.eventos (orden_id);

-- =====================================================================
-- Funciones auxiliares
-- =====================================================================

-- Fecha de hoy en Argentina
create or replace function public.hoy()
returns date language sql stable
set search_path = public
as $$ select (now() at time zone 'America/Argentina/Buenos_Aires')::date $$;

create or replace function public.mi_rol()
returns public.rol_usuario language sql stable security definer
set search_path = public
as $$ select rol from public.perfiles where id = auth.uid() $$;

create or replace function public.cfg(p_clave text)
returns numeric language sql stable security definer
set search_path = public
as $$ select valor from public.configuracion where clave = p_clave $$;

-- Tipo de día: sabado, domingo_feriado o null si el salón no abre
create or replace function public.tipo_dia(p_fecha date)
returns text language sql stable security definer
set search_path = public
as $$
  select case
    when exists (select 1 from public.feriados f where f.fecha = p_fecha) then 'domingo_feriado'
    when extract(isodow from p_fecha) = 6 then 'sabado'
    when extract(isodow from p_fecha) = 7 then 'domingo_feriado'
    else null
  end
$$;

create or replace function public.precio_vigente(
  p_concepto text, p_combo_id int, p_adicional_id int, p_tipo_dia text, p_a_fecha date default null
)
returns numeric language sql stable security definer
set search_path = public
as $$
  select p.monto from public.precios p
  where p.concepto = p_concepto
    and p.combo_id is not distinct from p_combo_id
    and p.adicional_id is not distinct from p_adicional_id
    and (p_concepto <> 'combo' or p.tipo_dia = p_tipo_dia)
    and p.vigente_desde <= coalesce(p_a_fecha, public.hoy())
  order by p.vigente_desde desc, p.id desc
  limit 1
$$;

-- Día de trabajo de coordinación: hoy, o el próximo día con evento
create or replace function public.jornada_coordinacion()
returns date language sql stable security definer
set search_path = public
as $$
  select coalesce(
    (select min(a.fecha) from public.alquileres a
      where a.fecha >= public.hoy() and a.estado not in ('vencido', 'cancelado')),
    public.hoy())
$$;

-- ¿La fecha cae dentro de la ventana de una orden crítica sobre un juego principal
-- o de un cierre del salón todavía no resuelto? Esos turnos no se ofrecen.
create or replace function public.fecha_bloqueada_por_mantenimiento(p_fecha date)
returns boolean language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.ordenes o join public.juegos j on j.id = o.juego_id
    where o.estado not in ('resuelta', 'verificada')
      and (o.prioridad = 'cierre_salon' or (o.prioridad = 'critica' and j.principal))
      and p_fecha between (o.creado_en at time zone 'America/Argentina/Buenos_Aires')::date
                      and (o.creado_en at time zone 'America/Argentina/Buenos_Aires')::date
                          + public.cfg('dias_riesgo')::int
  )
$$;

-- La media hora extra para decorar solo se ofrece si el turno anterior
-- terminó al menos una hora antes del inicio de este turno.
create or replace function public.decoracion_permitida(p_turno_id int)
returns boolean language sql stable security definer
set search_path = public
as $$
  select coalesce((
    select t.hora_inicio - (
      select max(p.hora_fin) from public.turnos p
      where p.activo and p.id <> t.id and p.hora_fin <= t.hora_inicio
    ) >= interval '1 hour'
    from public.turnos t where t.id = p_turno_id
  ), true)
$$;

create or replace function public.registrar_evento(p_alquiler uuid, p_orden uuid, p_texto text)
returns void language sql security definer
set search_path = public
as $$
  insert into public.eventos (alquiler_id, orden_id, texto, actor) values (p_alquiler, p_orden, p_texto, auth.uid())
$$;

-- Saldo de un alquiler a partir de los movimientos (nunca se guarda)
create or replace function public.saldo_de(p_alquiler uuid)
returns table (
  total numeric, recargos numeric, compensaciones numeric, pagado numeric,
  devuelto numeric, saldo numeric, garantia_pagada numeric, garantia_devuelta numeric
)
language sql stable security definer
set search_path = public
as $$
  select
    a.total,
    coalesce(sum(m.monto) filter (where m.tipo = 'recargo' and not m.anulado), 0),
    coalesce(sum(m.monto) filter (where m.tipo = 'compensacion' and not m.anulado), 0),
    coalesce(sum(m.monto) filter (where m.tipo in ('sena', 'saldo') and not m.anulado), 0),
    coalesce(sum(m.monto) filter (where m.tipo = 'devolucion' and not m.anulado), 0),
    a.total
      + coalesce(sum(m.monto) filter (where m.tipo in ('recargo', 'compensacion') and not m.anulado), 0)
      - coalesce(sum(m.monto) filter (where m.tipo in ('sena', 'saldo') and not m.anulado), 0),
    coalesce(sum(m.monto) filter (where m.tipo = 'garantia' and not m.anulado), 0),
    coalesce(sum(m.monto) filter (where m.tipo = 'devolucion_garantia' and not m.anulado), 0)
  from public.alquileres a
  left join public.movimientos m on m.alquiler_id = a.id
  where a.id = p_alquiler
  group by a.id, a.total
$$;

-- ---------- Movimientos: no se borran ni se editan (solo se anulan) ----------
create or replace function public.proteger_movimientos()
returns trigger language plpgsql
set search_path = public
as $$
begin
  if coalesce(current_setting('app.reinicio_demo', true), '') = 'si' then
    return coalesce(new, old);
  end if;
  if tg_op = 'DELETE' then
    raise exception 'Los movimientos de cobranza no se pueden borrar. Anulalo si fue un error.';
  end if;
  if new.alquiler_id <> old.alquiler_id or new.tipo <> old.tipo or new.monto <> old.monto
     or new.recibo is distinct from old.recibo or new.creado_en <> old.creado_en
     or (old.anulado and not new.anulado) then
    raise exception 'Un movimiento registrado no se modifica. Solo se puede anular.';
  end if;
  return new;
end $$;

create trigger movimientos_inmutables
  before update or delete on public.movimientos
  for each row execute function public.proteger_movimientos();

-- ---------- Alta de usuarios: siempre como familia ----------
-- El rol nunca se elige desde un formulario: se asigna acá.
create or replace function public.nuevo_usuario()
returns trigger language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.perfiles (id, rol, nombre)
  values (new.id, 'familia', coalesce(new.raw_user_meta_data ->> 'nombre', ''))
  on conflict (id) do nothing;

  insert into public.familias (user_id, nombre, celular, email)
  values (new.id,
          coalesce(nullif(new.raw_user_meta_data ->> 'nombre', ''), split_part(new.email, '@', 1)),
          coalesce(new.raw_user_meta_data ->> 'celular', ''),
          new.email)
  on conflict (user_id) do nothing;
  return new;
end $$;

create trigger al_crear_usuario
  after insert on auth.users
  for each row execute function public.nuevo_usuario();
