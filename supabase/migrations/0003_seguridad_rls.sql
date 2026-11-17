-- =====================================================================
-- Había una Vez · 0003 · Seguridad: RLS por rol, permisos y vistas
--   familia        → solo sus alquileres, pagos y contratos
--   coordinacion   → los turnos del día (hoy o el próximo día con evento)
--   mantenimiento  → juegos y órdenes
--   admin          → todo
-- Las escrituras de negocio pasan por funciones (ver 0002); las tablas
-- solo aceptan escritura directa de administración en la configuración.
-- =====================================================================

create or replace function public.mi_familia_id()
returns uuid language sql stable security definer
set search_path = public
as $$ select id from public.familias where user_id = auth.uid() $$;

-- ---------- RLS en todas las tablas ----------
alter table public.perfiles enable row level security;
alter table public.configuracion enable row level security;
alter table public.turnos enable row level security;
alter table public.feriados enable row level security;
alter table public.combos enable row level security;
alter table public.adicionales enable row level security;
alter table public.precios enable row level security;
alter table public.familias enable row level security;
alter table public.juegos enable row level security;
alter table public.ordenes enable row level security;
alter table public.alquileres enable row level security;
alter table public.alquiler_adicionales enable row level security;
alter table public.contratos enable row level security;
alter table public.movimientos enable row level security;
alter table public.eventos enable row level security;

-- ---------- Permisos de tabla ----------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

grant select on all tables in schema public to authenticated;
grant insert, update on public.configuracion, public.turnos, public.combos, public.adicionales to authenticated;
grant update on public.juegos to authenticated;
grant insert, delete on public.feriados to authenticated;
grant insert on public.precios to authenticated;
grant usage on sequence public.precios_id_seq, public.turnos_id_seq, public.combos_id_seq, public.adicionales_id_seq to authenticated;

-- ---------- Políticas ----------
create policy perfiles_ver on public.perfiles for select to authenticated
  using (id = auth.uid() or public.mi_rol() = 'admin');

create policy configuracion_ver on public.configuracion for select to authenticated using (true);
create policy configuracion_editar on public.configuracion for update to authenticated
  using (public.mi_rol() = 'admin') with check (public.mi_rol() = 'admin');

create policy turnos_ver on public.turnos for select to authenticated using (true);
create policy turnos_alta on public.turnos for insert to authenticated with check (public.mi_rol() = 'admin');
create policy turnos_editar on public.turnos for update to authenticated
  using (public.mi_rol() = 'admin') with check (public.mi_rol() = 'admin');

create policy feriados_ver on public.feriados for select to authenticated using (true);
create policy feriados_alta on public.feriados for insert to authenticated with check (public.mi_rol() = 'admin');
create policy feriados_baja on public.feriados for delete to authenticated using (public.mi_rol() = 'admin');

create policy combos_ver on public.combos for select to authenticated using (true);
create policy combos_alta on public.combos for insert to authenticated with check (public.mi_rol() = 'admin');
create policy combos_editar on public.combos for update to authenticated
  using (public.mi_rol() = 'admin') with check (public.mi_rol() = 'admin');

create policy adicionales_ver on public.adicionales for select to authenticated using (true);
create policy adicionales_alta on public.adicionales for insert to authenticated with check (public.mi_rol() = 'admin');
create policy adicionales_editar on public.adicionales for update to authenticated
  using (public.mi_rol() = 'admin') with check (public.mi_rol() = 'admin');

-- Precios: historial; solo se agregan con vigencia desde hoy en adelante.
create policy precios_ver on public.precios for select to authenticated using (public.mi_rol() = 'admin');
create policy precios_alta on public.precios for insert to authenticated
  with check (public.mi_rol() = 'admin' and vigente_desde >= public.hoy());

create policy familias_ver on public.familias for select to authenticated
  using (
    user_id = auth.uid()
    or public.mi_rol() = 'admin'
    or (public.mi_rol() = 'coordinacion' and exists (
          select 1 from public.alquileres a
          where a.familia_id = familias.id and a.fecha = public.jornada_coordinacion()))
  );

create policy alquileres_ver on public.alquileres for select to authenticated
  using (
    public.mi_rol() = 'admin'
    or familia_id = public.mi_familia_id()
    or (public.mi_rol() = 'coordinacion' and fecha = public.jornada_coordinacion())
  );

create policy alquiler_adicionales_ver on public.alquiler_adicionales for select to authenticated
  using (exists (select 1 from public.alquileres a where a.id = alquiler_id));

create policy contratos_ver on public.contratos for select to authenticated
  using (public.mi_rol() = 'admin'
         or exists (select 1 from public.alquileres a where a.id = alquiler_id and a.familia_id = public.mi_familia_id()));

create policy movimientos_ver on public.movimientos for select to authenticated
  using (public.mi_rol() = 'admin'
         or exists (select 1 from public.alquileres a where a.id = alquiler_id and a.familia_id = public.mi_familia_id()));

create policy eventos_ver on public.eventos for select to authenticated
  using (
    public.mi_rol() = 'admin'
    or (alquiler_id is not null and exists (select 1 from public.alquileres a where a.id = alquiler_id))
    or (orden_id is not null and public.mi_rol() = 'mantenimiento')
  );

create policy juegos_ver on public.juegos for select to authenticated
  using (public.mi_rol() in ('admin', 'coordinacion', 'mantenimiento'));
create policy juegos_editar on public.juegos for update to authenticated
  using (public.mi_rol() in ('admin', 'mantenimiento'))
  with check (public.mi_rol() in ('admin', 'mantenimiento'));

create policy ordenes_ver on public.ordenes for select to authenticated
  using (public.mi_rol() in ('admin', 'mantenimiento')
         or (public.mi_rol() = 'coordinacion' and reportada_por = auth.uid()));

-- ---------- Vistas (respetan la RLS de quien consulta) ----------
create view public.v_alquileres with (security_invoker = true) as
select
  a.*,
  f.nombre as familia, f.celular, f.email,
  t.nombre as turno, t.hora_inicio, t.hora_fin,
  c.nombre as combo,
  coalesce(m.pagado, 0) as pagado,
  coalesce(m.recargos, 0) as recargos,
  coalesce(m.compensaciones, 0) as compensaciones,
  coalesce(m.devuelto, 0) as devuelto,
  coalesce(m.garantia, 0) as garantia,
  a.total + coalesce(m.recargos, 0) + coalesce(m.compensaciones, 0) - coalesce(m.pagado, 0) as saldo
from public.alquileres a
join public.familias f on f.id = a.familia_id
join public.turnos t on t.id = a.turno_id
join public.combos c on c.id = a.combo_id
left join lateral (
  select
    sum(x.monto) filter (where x.tipo in ('sena', 'saldo') and not x.anulado) as pagado,
    sum(x.monto) filter (where x.tipo = 'recargo' and not x.anulado) as recargos,
    sum(x.monto) filter (where x.tipo = 'compensacion' and not x.anulado) as compensaciones,
    sum(x.monto) filter (where x.tipo in ('devolucion', 'devolucion_garantia') and not x.anulado) as devuelto,
    sum(x.monto) filter (where x.tipo = 'garantia' and not x.anulado) as garantia
  from public.movimientos x where x.alquiler_id = a.id
) m on true;

create view public.v_movimientos with (security_invoker = true) as
select m.*, a.codigo, a.fecha as fecha_evento, a.homenajeado, f.nombre as familia
from public.movimientos m
join public.alquileres a on a.id = m.alquiler_id
join public.familias f on f.id = a.familia_id;

create view public.v_ordenes with (security_invoker = true) as
select o.*, j.nombre as juego, j.tipo as juego_tipo, j.principal,
       public.afectados_por_orden(o.id) as afectados
from public.ordenes o
join public.juegos j on j.id = o.juego_id;

grant select on public.v_alquileres, public.v_movimientos, public.v_ordenes to authenticated;

-- ---------- Funciones: nada se ejecuta sin permiso explícito ----------
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function
  public.disponibilidad(date, date),
  public.catalogo_publico(),
  public.cotizar(date, int, int, int, int, int[]),
  public.hoy(), public.tipo_dia(date), public.pesos(numeric), public.fecha_larga(date),
  public.mi_rol(), public.decoracion_permitida(int)
to anon, authenticated;

grant execute on function
  public.mi_familia_id(), public.es_mi_alquiler(uuid), public.jornada_coordinacion(),
  public.afectados_por_orden(uuid),
  public.abrir_panel(), public.tablero(), public.informe(date, date),
  public.crear_pedido(jsonb), public.estado_de_cuenta(uuid),
  public.registrar_sena(uuid, numeric, text, text),
  public.aceptar_contrato(uuid),
  public.registrar_pago(uuid, text, numeric, text, text),
  public.anular_pago(uuid, text),
  public.calcular_cancelacion(uuid, boolean),
  public.cancelar_alquiler(uuid, text, boolean),
  public.reprogramar_alquiler(uuid, date, int),
  public.aceptar_compensacion(uuid),
  public.crear_orden(int, public.prioridad_orden, text, text, uuid),
  public.cambiar_prioridad_orden(uuid, public.prioridad_orden),
  public.actualizar_orden(uuid, public.estado_orden, numeric, text, text),
  public.iniciar_turno(uuid), public.guardar_hoja(uuid, jsonb), public.finalizar_turno(uuid, jsonb, text),
  public.cerrar_alquiler(uuid, numeric, text)
to authenticated;

-- Las funciones nuevas no quedan abiertas por defecto.
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- ---------- Tarea programada (además de la llamada al abrir el panel) ----------
create extension if not exists pg_cron;
select cron.schedule('vencer-prereservas', '*/10 * * * *', $$select public.vencer_prereservas()$$);
select cron.schedule('mantenimiento-por-dias', '15 3 * * *', $$select public.crear_preventivas()$$);
