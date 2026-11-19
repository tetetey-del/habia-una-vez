-- =====================================================================
-- Había una Vez · 0002 · Reglas de negocio
-- Cada acción que toca saldo, cupo o estado se resuelve en UNA función:
-- valida el estado actual, rechaza sin cambios parciales y es idempotente.
-- =====================================================================

alter table public.combos add column no_incluye text[] not null default '{}';

-- ---------- Formatos ----------
create or replace function public.pesos(n numeric)
returns text language sql immutable
set search_path = public
as $$ select '$' || replace(to_char(round(coalesce(n, 0)), 'FM999,999,999,990'), ',', '.') $$;

create or replace function public.fecha_larga(d date)
returns text language sql immutable
set search_path = public
as $$
  select (array['lunes','martes','miércoles','jueves','viernes','sábado','domingo'])[extract(isodow from d)::int]
    || ' ' || extract(day from d)::int || ' de '
    || (array['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'])[extract(month from d)::int]
    || ' de ' || extract(year from d)::int
$$;

-- ---------- Permisos ----------
create or replace function public.exigir_rol(p_roles public.rol_usuario[])
returns public.rol_usuario language plpgsql stable security definer
set search_path = public
as $$
declare v_rol public.rol_usuario := public.mi_rol();
begin
  if v_rol is null or not (v_rol = any (p_roles)) then
    raise exception 'Tu usuario no tiene permiso para hacer esto.' using errcode = '42501';
  end if;
  return v_rol;
end $$;

create or replace function public.es_mi_alquiler(p_alquiler uuid)
returns boolean language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.alquileres a join public.familias f on f.id = a.familia_id
    where a.id = p_alquiler and f.user_id = auth.uid())
$$;

-- Busca el alquiler, lo bloquea y verifica que el usuario pueda tocarlo.
create or replace function public.tomar_alquiler(p_alquiler uuid, p_rol public.rol_usuario)
returns public.alquileres language plpgsql security definer
set search_path = public
as $$
declare v public.alquileres;
begin
  select * into v from public.alquileres where id = p_alquiler for update;
  if not found or (p_rol = 'familia' and not public.es_mi_alquiler(p_alquiler))
     or (p_rol = 'coordinacion' and v.fecha <> public.jornada_coordinacion()) then
    raise exception 'No encontramos ese alquiler. Actualizá la pantalla e intentá de nuevo.';
  end if;
  return v;
end $$;

-- ---------- Vencimiento automático de pre-reservas ----------
create or replace function public.vencer_prereservas()
returns int language plpgsql security definer
set search_path = public
as $$
declare n int;
begin
  with v as (
    update public.alquileres
       set estado = 'vencido', estado_previo = 'pre_reserva'
     where estado = 'pre_reserva' and vence_en <= now()
    returning id
  )
  insert into public.eventos (alquiler_id, texto)
  select id, 'La pre-reserva venció sin seña y el turno quedó libre.' from v;
  get diagnostics n = row_count;
  return n;
end $$;

-- ---------- Mantenimiento preventivo automático ----------
create or replace function public.crear_preventivas()
returns int language plpgsql security definer
set search_path = public
as $$
declare n int;
begin
  with nuevas as (
    insert into public.ordenes (juego_id, tipo, prioridad, titulo, descripcion, reportada_por_nombre)
    select j.id, 'preventiva', 'media',
           'Revisión preventiva: ' || j.nombre,
           case when j.frecuencia_tipo = 'eventos'
                then 'Se cumplieron ' || j.frecuencia_valor || ' eventos desde la última revisión.'
                else 'Se cumplieron ' || j.frecuencia_valor || ' días desde la última revisión.' end,
           'Sistema'
    from public.juegos j
    where j.frecuencia_tipo is not null
      and ((j.frecuencia_tipo = 'eventos' and j.contador >= j.frecuencia_valor)
        or (j.frecuencia_tipo = 'dias' and coalesce(j.ultima_revision, date '2000-01-01') + j.frecuencia_valor <= public.hoy()))
      and not exists (select 1 from public.ordenes o
                      where o.juego_id = j.id and o.tipo = 'preventiva' and o.estado <> 'verificada')
    returning id
  )
  insert into public.eventos (orden_id, texto)
  select id, 'Orden preventiva creada automáticamente por frecuencia.' from nuevas;
  get diagnostics n = row_count;
  return n;
end $$;

-- Se llama al abrir el panel (además de la tarea programada).
create or replace function public.abrir_panel()
returns jsonb language plpgsql security definer
set search_path = public
as $$
declare v_venc int; v_prev int;
begin
  perform public.exigir_rol(array['admin','coordinacion','mantenimiento']::public.rol_usuario[]);
  v_venc := public.vencer_prereservas();
  v_prev := public.crear_preventivas();
  return jsonb_build_object('vencidas', v_venc, 'preventivas', v_prev);
end $$;

-- ---------- Cotización (se recalcula en vivo) ----------
create or replace function public.cotizar(
  p_fecha date, p_turno_id int, p_combo_id int, p_chicos int, p_adultos int, p_adicionales int[] default '{}'
)
returns jsonb language plpgsql stable security definer
set search_path = public
as $$
declare
  v_tipo text := public.tipo_dia(p_fecha);
  v_combo public.combos;
  v_precio_combo numeric := 0;
  v_ppe numeric := coalesce(public.precio_vigente('persona_extra', null, null, null), 0);
  v_personas int := coalesce(p_chicos, 0) + coalesce(p_adultos, 0);
  v_incluidas int;
  v_extra int;
  v_adic jsonb := '[]'::jsonb;
  v_monto_adic numeric := 0;
  v_errores text[] := '{}';
  v_avisos text[] := '{}';
  v_deco boolean := public.decoracion_permitida(p_turno_id);
  v_total numeric;
  r record;
begin
  select * into v_combo from public.combos where id = p_combo_id and activo;
  if v_combo.id is null then v_errores := v_errores || 'Elegí un combo.'::text; end if;
  if p_fecha is not null and v_tipo is null then
    v_errores := v_errores || 'El salón abre sábados, domingos y feriados. Elegí otra fecha.'::text;
  end if;
  if p_turno_id is not null and not exists (select 1 from public.turnos where id = p_turno_id and activo) then
    v_errores := v_errores || 'Elegí un turno.'::text;
  end if;
  if v_personas > public.cfg('capacidad_maxima') then
    v_errores := v_errores || format('El máximo absoluto es de %s personas.', public.cfg('capacidad_maxima')::int);
  elsif v_personas > public.cfg('capacidad') then
    if public.mi_rol() = 'admin' then
      v_avisos := v_avisos || format('Pasa el tope de %s personas: cargá el motivo.', public.cfg('capacidad')::int);
    else
      v_errores := v_errores || format('Entran hasta %s personas entre chicos y adultos.', public.cfg('capacidad')::int);
    end if;
  end if;

  if v_combo.id is not null then
    v_precio_combo := coalesce(public.precio_vigente('combo', v_combo.id, null, coalesce(v_tipo, 'sabado')), 0);
  end if;
  v_incluidas := coalesce(v_combo.chicos_incluidos, 30) + coalesce(v_combo.adultos_incluidos, 20);
  v_extra := greatest(0, v_personas - v_incluidas);

  for r in
    select a.id, a.codigo, a.nombre, coalesce(public.precio_vigente('adicional', null, a.id, null), 0) as precio
    from public.adicionales a
    where a.id = any (coalesce(p_adicionales, '{}')) and a.activo
    order by a.orden
  loop
    if r.codigo = 'decoracion' and not v_deco then
      v_errores := v_errores || 'La media hora extra para decorar no se ofrece en este turno: el anterior termina muy cerca.'::text;
    else
      v_adic := v_adic || jsonb_build_object('id', r.id, 'codigo', r.codigo, 'nombre', r.nombre, 'precio', r.precio);
      v_monto_adic := v_monto_adic + r.precio;
    end if;
  end loop;

  v_total := v_precio_combo + v_extra * v_ppe + v_monto_adic;

  return jsonb_build_object(
    'tipo_dia', v_tipo,
    'combo_id', v_combo.id,
    'combo', v_combo.nombre,
    'precio_combo', v_precio_combo,
    'personas', v_personas,
    'incluidas', v_incluidas,
    'personas_extra', v_extra,
    'precio_persona_extra', v_ppe,
    'monto_personas_extra', v_extra * v_ppe,
    'adicionales', v_adic,
    'monto_adicionales', v_monto_adic,
    'total', v_total,
    'sena', round(v_total * public.cfg('sena_pct') / 100),
    'decoracion_permitida', v_deco,
    'errores', to_jsonb(v_errores),
    'avisos', to_jsonb(v_avisos)
  );
end $$;

-- ---------- Pedido (pre-reserva) ----------
create or replace function public.crear_pedido(p jsonb)
returns jsonb language plpgsql security definer
set search_path = public
as $$
declare
  v_rol public.rol_usuario := public.exigir_rol(array['admin','familia']::public.rol_usuario[]);
  v_fecha date := nullif(p ->> 'fecha', '')::date;
  v_turno int := nullif(p ->> 'turno_id', '')::int;
  v_combo int := nullif(p ->> 'combo_id', '')::int;
  v_chicos int := coalesce(nullif(p ->> 'chicos', '')::int, 0);
  v_adultos int := coalesce(nullif(p ->> 'adultos', '')::int, 0);
  v_edad int := nullif(p ->> 'edad', '')::int;
  v_adic int[] := coalesce(array(select jsonb_array_elements_text(coalesce(p -> 'adicionales', '[]'::jsonb))::int), '{}');
  v_cot jsonb;
  v_familia uuid;
  v_id uuid;
  v_codigo text;
  v_previo public.alquileres;
begin
  perform public.vencer_prereservas();

  -- Doble toque en "Pedir turno": devolvemos el mismo pedido sin duplicarlo.
  select * into v_previo from public.alquileres
   where fecha = v_fecha and turno_id = v_turno and creado_por = auth.uid()
     and estado not in ('vencido', 'cancelado') and creado_en > now() - interval '10 minutes';
  if found then
    return jsonb_build_object('id', v_previo.id, 'codigo', v_previo.codigo, 'vence_en', v_previo.vence_en, 'repetido', true);
  end if;

  if v_fecha is null or v_fecha <= public.hoy() then
    raise exception 'Elegí una fecha a partir de mañana.';
  end if;
  if coalesce(trim(p ->> 'homenajeado'), '') = '' then
    raise exception 'Contanos el nombre de quien cumple años.';
  end if;
  if v_edad is null or v_edad not between 1 and 17 then
    raise exception 'La edad tiene que estar entre 1 y 17 años.';
  end if;
  if v_chicos < 1 then
    raise exception 'Indicá cuántos chicos vienen.';
  end if;

  v_cot := public.cotizar(v_fecha, v_turno, v_combo, v_chicos, v_adultos, v_adic);
  if jsonb_array_length(v_cot -> 'errores') > 0 then
    raise exception '%', v_cot -> 'errores' ->> 0;
  end if;
  if (v_cot ->> 'personas')::int > public.cfg('capacidad') and coalesce(trim(p ->> 'motivo_excedente'), '') = '' then
    raise exception 'Para pasar de % personas cargá el motivo.', public.cfg('capacidad')::int;
  end if;
  if public.fecha_bloqueada_por_mantenimiento(v_fecha) then
    raise exception 'Ese turno no está disponible, elegí otro.';
  end if;
  if exists (select 1 from public.alquileres
             where fecha = v_fecha and turno_id = v_turno and estado not in ('vencido', 'cancelado')) then
    raise exception 'Ese turno se ocupó recién, elegí otro.';
  end if;

  if v_rol = 'familia' then
    select id into v_familia from public.familias where user_id = auth.uid();
    if v_familia is null then
      insert into public.familias (user_id, nombre, celular)
      values (auth.uid(), coalesce(p ->> 'nombre', ''), coalesce(p ->> 'celular', ''))
      returning id into v_familia;
    end if;
    update public.familias
       set nombre = coalesce(nullif(trim(p ->> 'nombre'), ''), nombre),
           celular = coalesce(nullif(trim(p ->> 'celular'), ''), celular)
     where id = v_familia;
  else
    v_familia := nullif(p ->> 'familia_id', '')::uuid;
    if v_familia is null then
      if coalesce(trim(p ->> 'nombre'), '') = '' or coalesce(trim(p ->> 'celular'), '') = '' then
        raise exception 'Cargá nombre y celular de la familia.';
      end if;
      insert into public.familias (nombre, celular, email)
      values (trim(p ->> 'nombre'), trim(p ->> 'celular'), nullif(trim(p ->> 'email'), ''))
      returning id into v_familia;
    elsif not exists (select 1 from public.familias where id = v_familia) then
      raise exception 'No encontramos esa familia.';
    end if;
  end if;

  begin
    insert into public.alquileres (
      familia_id, fecha, turno_id, homenajeado, edad, chicos, adultos, motivo_excedente, combo_id, tipo_dia,
      precio_combo, personas_extra, precio_persona_extra, monto_personas_extra, monto_adicionales,
      total, sena_requerida, cotizado_en, quiere_garantia, vence_en, creado_por, notas)
    values (
      v_familia, v_fecha, v_turno, trim(p ->> 'homenajeado'), v_edad, v_chicos, v_adultos,
      nullif(trim(p ->> 'motivo_excedente'), ''), v_combo, v_cot ->> 'tipo_dia',
      (v_cot ->> 'precio_combo')::numeric, (v_cot ->> 'personas_extra')::int, (v_cot ->> 'precio_persona_extra')::numeric,
      (v_cot ->> 'monto_personas_extra')::numeric, (v_cot ->> 'monto_adicionales')::numeric,
      (v_cot ->> 'total')::numeric, (v_cot ->> 'sena')::numeric, public.hoy(),
      coalesce((p ->> 'quiere_garantia')::boolean, false),
      now() + make_interval(hours => public.cfg('horas_vencimiento')::int),
      auth.uid(), coalesce(trim(p ->> 'notas'), ''))
    returning id, codigo into v_id, v_codigo;
  exception when unique_violation then
    raise exception 'Ese turno se ocupó recién, elegí otro.';
  end;

  insert into public.alquiler_adicionales (alquiler_id, adicional_id, precio)
  select v_id, (x ->> 'id')::int, (x ->> 'precio')::numeric from jsonb_array_elements(v_cot -> 'adicionales') x;

  perform public.registrar_evento(v_id, null,
    'Pedido creado. Pre-reserva por ' || public.cfg('horas_vencimiento')::int || ' horas a la espera de la seña.');

  return jsonb_build_object('id', v_id, 'codigo', v_codigo,
    'vence_en', now() + make_interval(hours => public.cfg('horas_vencimiento')::int));
end $$;

-- ---------- Saldo visible para familia y administración ----------
create or replace function public.estado_de_cuenta(p_alquiler uuid)
returns jsonb language plpgsql stable security definer
set search_path = public
as $$
declare
  v_rol public.rol_usuario := public.exigir_rol(array['admin','familia']::public.rol_usuario[]);
  v public.alquileres;
  s record;
  v_vence date;
  v_recargo numeric := 0;
begin
  select * into v from public.alquileres where id = p_alquiler;
  if not found or (v_rol = 'familia' and not public.es_mi_alquiler(p_alquiler)) then
    raise exception 'No encontramos ese alquiler.';
  end if;
  select * into s from public.saldo_de(p_alquiler);
  v_vence := v.fecha - public.cfg('dias_saldo')::int;
  if s.saldo > 0 and public.hoy() > v_vence
     and v.estado in ('senado','contrato_aceptado','en_riesgo','en_curso','realizado')
     and not exists (select 1 from public.movimientos where alquiler_id = p_alquiler and tipo = 'recargo' and not anulado) then
    v_recargo := round(s.saldo * public.cfg('recargo_pct') / 100);
  end if;
  return jsonb_build_object(
    'total', s.total, 'recargos', s.recargos, 'compensaciones', s.compensaciones,
    'pagado', s.pagado, 'devuelto', s.devuelto, 'saldo', s.saldo,
    'garantia_pagada', s.garantia_pagada, 'garantia_devuelta', s.garantia_devuelta,
    'vence_saldo', v_vence, 'saldo_vencido', public.hoy() > v_vence,
    'recargo_si_paga_hoy', v_recargo, 'recargo_pct', public.cfg('recargo_pct'),
    'garantia_monto', public.cfg('garantia_monto'));
end $$;

-- ---------- Seña: congela el precio y pasa a Señado ----------
create or replace function public.registrar_sena(p_alquiler uuid, p_monto numeric, p_medio text, p_clave text default null)
returns jsonb language plpgsql security definer
set search_path = public
as $$
declare
  v public.alquileres;
  v_mov public.movimientos;
  v_recibo int;
begin
  perform public.exigir_rol(array['admin']::public.rol_usuario[]);
  if p_clave is not null then
    select * into v_mov from public.movimientos where clave_idempotencia = p_clave;
    if found then return jsonb_build_object('ok', true, 'repetido', true, 'recibo', v_mov.recibo); end if;
  end if;

  v := public.tomar_alquiler(p_alquiler, 'admin');
  if v.estado <> 'pre_reserva' then
    if exists (select 1 from public.movimientos where alquiler_id = p_alquiler and tipo = 'sena' and not anulado) then
      raise exception 'La seña de este alquiler ya estaba registrada. Actualizá la ficha para ver el estado actual.';
    end if;
    raise exception 'Solo se registra la seña de una pre-reserva, y este alquiler está en otro estado.';
  end if;
  if v.vence_en <= now() then
    raise exception 'La pre-reserva venció y el turno se liberó. Si la familia todavía quiere esa fecha, cargá un pedido nuevo.';
  end if;
  if p_monto is null or p_monto < v.sena_requerida then
    raise exception 'La seña mínima es de %.', public.pesos(v.sena_requerida);
  end if;
  if p_monto > v.total then
    raise exception 'El monto supera el total del alquiler (%).', public.pesos(v.total);
  end if;

  insert into public.movimientos (alquiler_id, tipo, monto, recibo, medio, detalle, clave_idempotencia, creado_por)
  values (p_alquiler, 'sena', p_monto, nextval('public.recibo_seq'), coalesce(p_medio, 'Efectivo'),
          'Seña', p_clave, auth.uid())
  returning recibo into v_recibo;

  update public.alquileres set estado = 'senado', senado_en = now(), vence_en = null where id = p_alquiler;
  perform public.registrar_evento(p_alquiler, null,
    'Seña registrada (recibo ' || lpad(v_recibo::text, 4, '0') || '). Precio congelado en ' || public.pesos(v.total) || '.');
  return jsonb_build_object('ok', true, 'recibo', v_recibo);
end $$;

-- ---------- Contrato: versión congelada al aceptar ----------
create or replace function public.aceptar_contrato(p_alquiler uuid)
returns jsonb language plpgsql security definer
set search_path = public
as $$
declare
  v_rol public.rol_usuario := public.exigir_rol(array['admin','familia']::public.rol_usuario[]);
  v public.alquileres;
  t public.turnos;
  c public.combos;
  f public.familias;
  s record;
  v_adic text;
  v_ingreso time;
  v_datos jsonb;
  v_texto text;
  v_nuevo public.estado_alquiler;
begin
  v := public.tomar_alquiler(p_alquiler, v_rol);
  if v.estado <> 'senado' then
    if exists (select 1 from public.contratos where alquiler_id = p_alquiler) then
      return jsonb_build_object('ok', true, 'repetido', true);
    end if;
    raise exception 'El contrato se acepta después de que administración registra la seña.';
  end if;

  select * into t from public.turnos where id = v.turno_id;
  select * into c from public.combos where id = v.combo_id;
  select * into f from public.familias where id = v.familia_id;
  select * into s from public.saldo_de(p_alquiler);
  select string_agg(ad.nombre || ' (' || public.pesos(aa.precio) || ')', ', ' order by ad.orden)
    into v_adic
    from public.alquiler_adicionales aa join public.adicionales ad on ad.id = aa.adicional_id
   where aa.alquiler_id = p_alquiler;
  v_ingreso := t.hora_inicio - interval '10 minutes'
    - case when exists (select 1 from public.alquiler_adicionales aa join public.adicionales ad on ad.id = aa.adicional_id
                        where aa.alquiler_id = p_alquiler and ad.codigo = 'decoracion')
           then interval '30 minutes' else interval '0' end;

  v_datos := jsonb_build_object(
    'codigo', v.codigo, 'familia', f.nombre, 'celular', f.celular,
    'homenajeado', v.homenajeado, 'edad', v.edad, 'fecha', v.fecha,
    'turno', t.nombre, 'hora_inicio', t.hora_inicio, 'hora_fin', t.hora_fin, 'ingreso', v_ingreso,
    'combo', c.nombre, 'incluye', c.incluye, 'no_incluye', c.no_incluye,
    'chicos', v.chicos, 'adultos', v.adultos,
    'precio_combo', v.precio_combo, 'personas_extra', v.personas_extra, 'monto_personas_extra', v.monto_personas_extra,
    'adicionales', coalesce(v_adic, ''), 'monto_adicionales', v.monto_adicionales,
    'total', v.total, 'pagado', s.pagado, 'saldo', s.saldo,
    'vence_saldo', v.fecha - public.cfg('dias_saldo')::int, 'recargo_pct', public.cfg('recargo_pct'),
    'compensacion_pct', public.cfg('compensacion_pct'), 'garantia', v.quiere_garantia,
    'garantia_monto', public.cfg('garantia_monto'));

  v_texto :=
    'CONTRATO DE ALQUILER DE SALÓN · ' || v.codigo || E'\n\n'
    || '1. Objeto. Había una Vez alquila el salón a ' || f.nombre || ' para el cumpleaños de '
    || v.homenajeado || ' (' || v.edad || ' años), el ' || public.fecha_larga(v.fecha) || ', turno '
    || t.nombre || ' de ' || to_char(t.hora_inicio, 'HH24:MI') || ' a ' || to_char(t.hora_fin, 'HH24:MI')
    || '. Ingreso desde las ' || to_char(v_ingreso, 'HH24:MI') || '. El salón hace un solo evento por turno.' || E'\n\n'
    || '2. Combo. ' || c.nombre || '. Incluye: ' || array_to_string(c.incluye, ', ') || '. '
    || case when cardinality(c.no_incluye) > 0 then 'No incluye: ' || array_to_string(c.no_incluye, ', ') || '.' else '' end || E'\n\n'
    || '3. Personas. ' || v.chicos || ' chicos y ' || v.adultos || ' adultos. Capacidad máxima del salón: '
    || public.cfg('capacidad')::int || ' personas en total.' || E'\n\n'
    || '4. Adicionales. ' || coalesce(v_adic, 'Sin adicionales') || '.' || E'\n\n'
    || '5. Precio. Total ' || public.pesos(v.total) || ': combo ' || public.pesos(v.precio_combo)
    || case when v.personas_extra > 0 then ', ' || v.personas_extra || ' personas extra ' || public.pesos(v.monto_personas_extra) else '' end
    || case when v.monto_adicionales > 0 then ', adicionales ' || public.pesos(v.monto_adicionales) else '' end
    || '. El precio quedó congelado al registrarse la seña y no cambia con nuevas tarifas.' || E'\n\n'
    || '6. Pagos. Pagado a la fecha: ' || public.pesos(s.pagado) || '. Saldo: ' || public.pesos(s.saldo)
    || ', a pagar hasta el ' || public.fecha_larga(v.fecha - public.cfg('dias_saldo')::int)
    || '. Si se paga después, se aplica un recargo del ' || public.cfg('recargo_pct')::int || ' % sobre el saldo.' || E'\n\n'
    || '7. Cancelación y cambios. Con más de 30 días de anticipación se devuelve el 100 % de lo cobrado; '
    || 'entre 30 y 15 días, el 50 %; con menos de 15 días no hay devolución. '
    || 'Se permite una sola reprogramación sin cargo pedida con más de 15 días de anticipación.' || E'\n\n'
    || '8. Mantenimiento. Si un juego principal queda fuera de servicio, la familia elige entre trasladarse sin costo a otro turno libre '
    || 'o mantener su fecha con una compensación del ' || public.cfg('compensacion_pct')::int || ' % del combo. '
    || 'Si el salón debe cerrar, el traslado es obligatorio y, sin acuerdo, se cancela con devolución del 100 % de lo pagado.' || E'\n\n'
    || '9. Garantía por roturas. '
    || case when v.quiere_garantia
         then 'La familia deja una garantía de ' || public.pesos(public.cfg('garantia_monto'))
              || ' que se devuelve al cerrar el turno si no hubo daños. Si hubo daños, administración informa el monto retenido y el motivo.'
         else 'La familia eligió no dejar garantía.' end;

  insert into public.contratos (alquiler_id, version, datos, texto, aceptado_por, aceptado_por_nombre)
  values (p_alquiler, coalesce((select max(version) from public.contratos where alquiler_id = p_alquiler), 0) + 1,
          v_datos, v_texto, auth.uid(),
          case when v_rol = 'familia' then f.nombre else 'Administración (en nombre de ' || f.nombre || ')' end);

  v_nuevo := case when s.saldo <= 0 then 'saldo_pagado' else 'contrato_aceptado' end;
  update public.alquileres set estado = v_nuevo where id = p_alquiler;
  perform public.registrar_evento(p_alquiler, null, 'Contrato aceptado. El turno quedó firme.');
  return jsonb_build_object('ok', true, 'estado', v_nuevo);
end $$;

-- ---------- Pagos de saldo y garantía ----------
create or replace function public.registrar_pago(
  p_alquiler uuid, p_tipo text, p_monto numeric, p_medio text, p_clave text default null
)
returns jsonb language plpgsql security definer
set search_path = public
as $$
declare
  v public.alquileres;
  v_mov public.movimientos;
  s record;
  v_saldo numeric;
  v_recargo numeric := 0;
  v_recibo int;
begin
  perform public.exigir_rol(array['admin']::public.rol_usuario[]);
  if p_clave is not null then
    select * into v_mov from public.movimientos where clave_idempotencia = p_clave;
    if found then return jsonb_build_object('ok', true, 'repetido', true, 'recibo', v_mov.recibo); end if;
  end if;
  if p_monto is null or p_monto <= 0 then
    raise exception 'Ingresá un monto mayor a cero.';
  end if;

  v := public.tomar_alquiler(p_alquiler, 'admin');

  if p_tipo = 'saldo' then
    if v.estado not in ('senado', 'contrato_aceptado', 'en_riesgo', 'en_curso', 'realizado')
       or (v.estado = 'en_riesgo' and v.estado_previo = 'pre_reserva') then
      raise exception 'Este alquiler no admite pagos de saldo en su estado actual.';
    end if;
    select * into s from public.saldo_de(p_alquiler);
    v_saldo := s.saldo;
    if v_saldo <= 0 then
      raise exception 'Este alquiler ya no tiene saldo pendiente. Actualizá la ficha.';
    end if;
    if public.hoy() > v.fecha - public.cfg('dias_saldo')::int
       and not exists (select 1 from public.movimientos where alquiler_id = p_alquiler and tipo = 'recargo' and not anulado) then
      v_recargo := round(v_saldo * public.cfg('recargo_pct') / 100);
      insert into public.movimientos (alquiler_id, tipo, monto, detalle, creado_por)
      values (p_alquiler, 'recargo', v_recargo,
              'Recargo ' || public.cfg('recargo_pct')::int || ' % por saldo pagado fuera de plazo', auth.uid());
      v_saldo := v_saldo + v_recargo;
    end if;
    if p_monto > v_saldo then
      raise exception 'El monto supera el saldo pendiente de %.', public.pesos(v_saldo);
    end if;

    insert into public.movimientos (alquiler_id, tipo, monto, recibo, medio, detalle, clave_idempotencia, creado_por)
    values (p_alquiler, 'saldo', p_monto, nextval('public.recibo_seq'), coalesce(p_medio, 'Efectivo'),
            case when p_monto = v_saldo then 'Saldo' else 'Pago a cuenta del saldo' end, p_clave, auth.uid())
    returning recibo into v_recibo;

    if v_saldo - p_monto <= 0 then
      if v.estado = 'contrato_aceptado' then
        update public.alquileres set estado = 'saldo_pagado' where id = p_alquiler;
      elsif v.estado = 'en_riesgo' and v.estado_previo = 'contrato_aceptado' then
        update public.alquileres set estado_previo = 'saldo_pagado' where id = p_alquiler;
      end if;
    end if;
    perform public.registrar_evento(p_alquiler, null,
      'Pago de saldo ' || public.pesos(p_monto) || ' (recibo ' || lpad(v_recibo::text, 4, '0') || ')'
      || case when v_recargo > 0 then ' con recargo de ' || public.pesos(v_recargo) else '' end || '.');

  elsif p_tipo = 'garantia' then
    if v.estado in ('cancelado', 'vencido', 'cerrado', 'pre_reserva') then
      raise exception 'La garantía se cobra con el turno señado y antes del cierre.';
    end if;
    if exists (select 1 from public.movimientos where alquiler_id = p_alquiler and tipo = 'garantia' and not anulado) then
      raise exception 'La garantía de este alquiler ya está cobrada.';
    end if;
    insert into public.movimientos (alquiler_id, tipo, monto, recibo, medio, detalle, clave_idempotencia, creado_por)
    values (p_alquiler, 'garantia', p_monto, nextval('public.recibo_seq'), coalesce(p_medio, 'Efectivo'),
            'Garantía por roturas', p_clave, auth.uid())
    returning recibo into v_recibo;
    update public.alquileres set quiere_garantia = true where id = p_alquiler;
    perform public.registrar_evento(p_alquiler, null, 'Garantía cobrada (recibo ' || lpad(v_recibo::text, 4, '0') || ').');
  else
    raise exception 'Tipo de pago desconocido.';
  end if;

  return jsonb_build_object('ok', true, 'recibo', v_recibo, 'recargo', v_recargo);
end $$;

-- ---------- Anulación de pagos: el recibo queda visible como anulado ----------
create or replace function public.anular_pago(p_movimiento uuid, p_motivo text)
returns jsonb language plpgsql security definer
set search_path = public
as $$
declare
  m public.movimientos;
  v public.alquileres;
  s record;
  v_estado public.estado_alquiler;
begin
  perform public.exigir_rol(array['admin']::public.rol_usuario[]);
  select * into m from public.movimientos where id = p_movimiento for update;
  if not found then raise exception 'No encontramos ese pago.'; end if;
  if m.tipo not in ('sena', 'saldo', 'garantia') then
    raise exception 'Solo se anulan pagos con recibo.';
  end if;
  if m.anulado then return jsonb_build_object('ok', true, 'repetido', true); end if;
  if coalesce(trim(p_motivo), '') = '' then raise exception 'Escribí el motivo de la anulación.'; end if;

  v := public.tomar_alquiler(m.alquiler_id, 'admin');
  if v.estado in ('cancelado', 'cerrado') then
    raise exception 'El alquiler ya está % y sus pagos no se pueden anular.', replace(v.estado::text, '_', ' ');
  end if;

  update public.movimientos
     set anulado = true, anulado_en = now(), motivo_anulacion = trim(p_motivo), anulado_por = auth.uid()
   where id = p_movimiento;

  select * into s from public.saldo_de(v.id);
  v_estado := case when v.estado = 'en_riesgo' then v.estado_previo else v.estado end;

  if m.tipo = 'sena' and v_estado in ('senado', 'contrato_aceptado', 'saldo_pagado')
     and not exists (select 1 from public.movimientos where alquiler_id = v.id and tipo = 'sena' and not anulado) then
    v_estado := 'pre_reserva';
  elsif v_estado = 'saldo_pagado' and s.saldo > 0 then
    v_estado := 'contrato_aceptado';
  end if;

  if v.estado = 'en_riesgo' then
    update public.alquileres set estado_previo = v_estado where id = v.id;
  elsif v_estado = 'pre_reserva' and v.estado <> 'pre_reserva' then
    update public.alquileres
       set estado = 'pre_reserva', senado_en = null,
           vence_en = now() + make_interval(hours => public.cfg('horas_vencimiento')::int)
     where id = v.id;
  elsif v_estado <> v.estado then
    update public.alquileres set estado = v_estado where id = v.id;
  end if;

  perform public.registrar_evento(v.id, null,
    'Recibo ' || lpad(m.recibo::text, 4, '0') || ' anulado: ' || trim(p_motivo) || '.');
  return jsonb_build_object('ok', true, 'saldo', s.saldo);
end $$;

-- ---------- Cancelación ----------
-- Devolución sobre lo efectivamente cobrado según los días que faltan.
create or replace function public.calcular_cancelacion(p_alquiler uuid, p_por_salon boolean default false)
returns jsonb language plpgsql stable security definer
set search_path = public
as $$
declare
  v_rol public.rol_usuario := public.exigir_rol(array['admin','familia']::public.rol_usuario[]);
  v public.alquileres;
  s record;
  v_salon boolean;
  v_dias int;
  v_pct int;
  v_cobrado numeric;
begin
  select * into v from public.alquileres where id = p_alquiler;
  if not found or (v_rol = 'familia' and not public.es_mi_alquiler(p_alquiler)) then
    raise exception 'No encontramos ese alquiler.';
  end if;
  select * into s from public.saldo_de(p_alquiler);
  v_salon := (v_rol = 'admin' and coalesce(p_por_salon, false)) or v.bloqueado;
  v_dias := v.fecha - public.hoy();
  v_pct := case when v_salon then 100 when v_dias > 30 then 100 when v_dias >= 15 then 50 else 0 end;
  v_cobrado := s.pagado + s.devuelto;
  return jsonb_build_object(
    'dias', v_dias, 'porcentaje', v_pct, 'cobrado', v_cobrado,
    'devolucion', round(v_cobrado * v_pct / 100),
    'garantia', s.garantia_pagada + s.garantia_devuelta,
    'por_salon', v_salon);
end $$;

create or replace function public.cancelar_alquiler(p_alquiler uuid, p_motivo text, p_por_salon boolean default false)
returns jsonb language plpgsql security definer
set search_path = public
as $$
declare
  v_rol public.rol_usuario := public.exigir_rol(array['admin','familia']::public.rol_usuario[]);
  v public.alquileres;
  c jsonb;
begin
  v := public.tomar_alquiler(p_alquiler, v_rol);
  if v.estado = 'cancelado' then return jsonb_build_object('ok', true, 'repetido', true); end if;
  if v.estado in ('vencido', 'cerrado', 'realizado', 'en_curso') then
    raise exception 'Este alquiler no se puede cancelar porque está %.', replace(v.estado::text, '_', ' ');
  end if;
  if coalesce(trim(p_motivo), '') = '' then raise exception 'Contanos el motivo de la cancelación.'; end if;

  c := public.calcular_cancelacion(p_alquiler, p_por_salon);

  if (c ->> 'devolucion')::numeric > 0 then
    insert into public.movimientos (alquiler_id, tipo, monto, detalle, creado_por)
    values (p_alquiler, 'devolucion', -((c ->> 'devolucion')::numeric),
            'Devolución ' || (c ->> 'porcentaje') || ' % por cancelación'
            || case when (c ->> 'por_salon')::boolean then ' por causa del salón'
                    else ' con ' || (c ->> 'dias') || ' días de anticipación' end,
            auth.uid());
  end if;
  if (c ->> 'garantia')::numeric > 0 then
    insert into public.movimientos (alquiler_id, tipo, monto, detalle, creado_por)
    values (p_alquiler, 'devolucion_garantia', -((c ->> 'garantia')::numeric), 'Devolución de garantía por cancelación', auth.uid());
  end if;

  update public.alquileres
     set estado_previo = case when estado = 'en_riesgo' then estado_previo else estado end,
         estado = 'cancelado',
         cancelado_por = case when (c ->> 'por_salon')::boolean then 'salon' else 'familia' end,
         motivo_cancelacion = trim(p_motivo), cancelado_en = now(), bloqueado = false, vence_en = null
   where id = p_alquiler;

  perform public.registrar_evento(p_alquiler, null,
    'Alquiler cancelado' || case when (c ->> 'por_salon')::boolean then ' por causa del salón' else ' por la familia' end
    || '. Devolución: ' || public.pesos((c ->> 'devolucion')::numeric) || ' (' || (c ->> 'porcentaje') || ' %).');
  return jsonb_build_object('ok', true) || c;
end $$;

-- ---------- Reprogramación y traslado ----------
create or replace function public.reprogramar_alquiler(p_alquiler uuid, p_fecha date, p_turno int)
returns jsonb language plpgsql security definer
set search_path = public
as $$
declare
  v_rol public.rol_usuario := public.exigir_rol(array['admin','familia']::public.rol_usuario[]);
  v public.alquileres;
  v_traslado boolean;
begin
  v := public.tomar_alquiler(p_alquiler, v_rol);
  if v.fecha = p_fecha and v.turno_id = p_turno and v.estado <> 'en_riesgo' then
    return jsonb_build_object('ok', true, 'repetido', true);
  end if;
  perform public.vencer_prereservas();

  if p_fecha is null or p_fecha <= public.hoy() then raise exception 'Elegí una fecha a partir de mañana.'; end if;
  if public.tipo_dia(p_fecha) is null then raise exception 'El salón abre sábados, domingos y feriados. Elegí otra fecha.'; end if;
  if not exists (select 1 from public.turnos where id = p_turno and activo) then raise exception 'Elegí un turno.'; end if;
  if public.fecha_bloqueada_por_mantenimiento(p_fecha) then
    raise exception 'Ese turno no está disponible, elegí otro.';
  end if;
  if exists (select 1 from public.alquileres
             where fecha = p_fecha and turno_id = p_turno and estado not in ('vencido', 'cancelado') and id <> p_alquiler) then
    raise exception 'Ese turno se ocupó recién, elegí otro.';
  end if;

  v_traslado := v.estado = 'en_riesgo';
  if not v_traslado then
    if v.estado not in ('pre_reserva', 'senado', 'contrato_aceptado', 'saldo_pagado') then
      raise exception 'Este alquiler no se puede reprogramar en su estado actual.';
    end if;
    if v.reprogramaciones >= 1 then
      raise exception 'Ya se usó la reprogramación sin cargo de este alquiler.';
    end if;
    if v.fecha - public.hoy() <= 15 then
      raise exception 'La reprogramación sin cargo se pide con más de 15 días de anticipación.';
    end if;
  end if;

  begin
    if v_traslado then
      update public.alquileres
         set fecha = p_fecha, turno_id = p_turno, estado = estado_previo, estado_previo = null,
             orden_riesgo_id = null, bloqueado = false
       where id = p_alquiler;
    else
      update public.alquileres
         set fecha = p_fecha, turno_id = p_turno, reprogramaciones = reprogramaciones + 1
       where id = p_alquiler;
    end if;
  exception when unique_violation then
    raise exception 'Ese turno se ocupó recién, elegí otro.';
  end;

  perform public.registrar_evento(p_alquiler, null,
    case when v_traslado then 'Traslado sin costo por mantenimiento' else 'Reprogramación sin cargo' end
    || ' al ' || public.fecha_larga(p_fecha) || ', turno ' || (select nombre from public.turnos where id = p_turno) || '.');
  return jsonb_build_object('ok', true, 'traslado', v_traslado);
end $$;

-- ---------- Alquiler en riesgo: seguir en la fecha con compensación ----------
create or replace function public.aceptar_compensacion(p_alquiler uuid)
returns jsonb language plpgsql security definer
set search_path = public
as $$
declare
  v_rol public.rol_usuario := public.exigir_rol(array['admin','familia']::public.rol_usuario[]);
  v public.alquileres;
  v_monto numeric;
  s record;
begin
  v := public.tomar_alquiler(p_alquiler, v_rol);
  if v.estado <> 'en_riesgo' then
    if v.compensacion_aplicada then return jsonb_build_object('ok', true, 'repetido', true); end if;
    raise exception 'Este alquiler ya no está en riesgo. Actualizá la pantalla.';
  end if;
  if v.bloqueado then
    raise exception 'Por el cierre del salón no se puede mantener esta fecha: elegí otro turno.';
  end if;
  if v.compensacion_aplicada then
    raise exception 'Este alquiler ya recibió una compensación.';
  end if;

  v_monto := round(v.precio_combo * public.cfg('compensacion_pct') / 100);
  insert into public.movimientos (alquiler_id, tipo, monto, detalle, creado_por)
  values (p_alquiler, 'compensacion', -v_monto,
          'Compensación ' || public.cfg('compensacion_pct')::int || ' % del combo por juego fuera de servicio', auth.uid());

  update public.alquileres
     set estado = estado_previo, estado_previo = null, orden_riesgo_id = null, compensacion_aplicada = true
   where id = p_alquiler;

  select * into s from public.saldo_de(p_alquiler);
  if s.saldo <= 0 then
    update public.alquileres set estado = 'saldo_pagado' where id = p_alquiler and estado = 'contrato_aceptado';
  end if;

  perform public.registrar_evento(p_alquiler, null,
    'La familia sigue en su fecha con una compensación de ' || public.pesos(v_monto) || '.');
  return jsonb_build_object('ok', true, 'compensacion', v_monto);
end $$;

-- ---------- Riesgo por mantenimiento ----------
create or replace function public.aplicar_riesgo(p_orden uuid)
returns int language plpgsql security definer
set search_path = public
as $$
declare
  o public.ordenes;
  v_cierre boolean;
  v_hasta date;
  n int := 0;
begin
  select * into o from public.ordenes where id = p_orden;
  v_cierre := o.prioridad = 'cierre_salon';
  v_hasta := public.hoy() + public.cfg('dias_riesgo')::int;

  with u as (
    update public.alquileres
       set estado_previo = estado, estado = 'en_riesgo', orden_riesgo_id = p_orden, bloqueado = v_cierre
     where fecha between public.hoy() and v_hasta
       and estado in ('pre_reserva', 'senado', 'contrato_aceptado', 'saldo_pagado')
    returning id
  )
  insert into public.eventos (alquiler_id, orden_id, texto, actor)
  select id, p_orden, 'En riesgo por la orden de mantenimiento #' || o.numero || ': ' || o.titulo || '.', auth.uid() from u;
  get diagnostics n = row_count;

  if v_cierre then
    update public.alquileres
       set bloqueado = true, orden_riesgo_id = p_orden
     where estado = 'en_riesgo' and fecha between public.hoy() and v_hasta and not bloqueado;
  end if;
  return n;
end $$;

create or replace function public.afectados_por_orden(p_orden uuid)
returns int language sql stable security definer
set search_path = public
as $$ select count(*)::int from public.alquileres where orden_riesgo_id = p_orden and estado = 'en_riesgo' $$;

create or replace function public.crear_orden(
  p_juego int, p_prioridad public.prioridad_orden, p_titulo text, p_descripcion text, p_alquiler uuid default null
)
returns jsonb language plpgsql security definer
set search_path = public
as $$
declare
  v_rol public.rol_usuario := public.exigir_rol(array['admin','coordinacion','mantenimiento']::public.rol_usuario[]);
  j public.juegos;
  o public.ordenes;
  n int := 0;
begin
  if p_prioridad = 'cierre_salon' and v_rol <> 'admin' then
    raise exception 'Solo administración puede marcar un cierre del salón.';
  end if;
  if coalesce(trim(p_titulo), '') = '' then raise exception 'Escribí qué pasa con el juego.'; end if;
  select * into j from public.juegos where id = p_juego for update;
  if not found then raise exception 'Elegí un juego o sector.'; end if;
  if p_alquiler is not null and v_rol = 'coordinacion' and not exists (
       select 1 from public.alquileres where id = p_alquiler and fecha = public.jornada_coordinacion()) then
    raise exception 'Ese turno no está en tu hoja del día.';
  end if;

  -- Mismo reporte enviado dos veces: no se duplica.
  select * into o from public.ordenes
   where juego_id = p_juego and titulo = trim(p_titulo) and reportada_por = auth.uid()
     and estado <> 'verificada' and creado_en > now() - interval '10 minutes';
  if found then
    return jsonb_build_object('id', o.id, 'numero', o.numero, 'afectados', public.afectados_por_orden(o.id), 'repetido', true);
  end if;

  insert into public.ordenes (juego_id, tipo, prioridad, titulo, descripcion, alquiler_id, reportada_por, reportada_por_nombre)
  values (p_juego, 'correctiva', p_prioridad, trim(p_titulo), coalesce(trim(p_descripcion), ''), p_alquiler, auth.uid(),
          coalesce((select nullif(nombre, '') from public.perfiles where id = auth.uid()), 'Equipo'))
  returning * into o;

  if p_prioridad in ('critica', 'cierre_salon') then
    update public.juegos set estado = 'fuera_de_servicio' where id = p_juego;
  end if;
  if p_prioridad = 'cierre_salon' or (p_prioridad = 'critica' and j.principal) then
    n := public.aplicar_riesgo(o.id);
  end if;

  perform public.registrar_evento(p_alquiler, o.id, 'Orden #' || o.numero || ' abierta: ' || o.titulo || '.');
  return jsonb_build_object('id', o.id, 'numero', o.numero, 'afectados', n);
end $$;

create or replace function public.cambiar_prioridad_orden(p_orden uuid, p_prioridad public.prioridad_orden)
returns jsonb language plpgsql security definer
set search_path = public
as $$
declare
  o public.ordenes;
  j public.juegos;
  n int := 0;
begin
  perform public.exigir_rol(array['admin']::public.rol_usuario[]);
  select * into o from public.ordenes where id = p_orden for update;
  if not found then raise exception 'No encontramos esa orden.'; end if;
  if o.estado in ('resuelta', 'verificada') then raise exception 'La orden ya está resuelta.'; end if;
  if o.prioridad = p_prioridad then return jsonb_build_object('ok', true, 'repetido', true); end if;
  select * into j from public.juegos where id = o.juego_id;

  update public.ordenes set prioridad = p_prioridad, actualizado_en = now() where id = p_orden;
  if p_prioridad in ('critica', 'cierre_salon') then
    update public.juegos set estado = 'fuera_de_servicio' where id = o.juego_id;
  end if;
  if p_prioridad = 'cierre_salon' or (p_prioridad = 'critica' and j.principal) then
    n := public.aplicar_riesgo(p_orden);
  end if;
  perform public.registrar_evento(null, p_orden, 'Prioridad cambiada a ' || replace(p_prioridad::text, '_', ' ') || '.');
  return jsonb_build_object('ok', true, 'afectados', n);
end $$;

create or replace function public.actualizar_orden(
  p_orden uuid, p_estado public.estado_orden, p_costo numeric default null,
  p_repuesto text default null, p_nota text default null
)
returns jsonb language plpgsql security definer
set search_path = public
as $$
declare
  o public.ordenes;
  n int := 0;
begin
  perform public.exigir_rol(array['admin','mantenimiento']::public.rol_usuario[]);
  select * into o from public.ordenes where id = p_orden for update;
  if not found then raise exception 'No encontramos esa orden.'; end if;
  if o.estado = 'verificada' then
    if p_estado = 'verificada' then return jsonb_build_object('ok', true, 'repetido', true); end if;
    raise exception 'La orden ya está verificada y cerrada.';
  end if;
  if p_estado = 'verificada' and o.estado <> 'resuelta' then
    raise exception 'Primero marcala como resuelta; después se verifica.';
  end if;
  if p_costo is not null and p_costo < 0 then raise exception 'El costo no puede ser negativo.'; end if;

  update public.ordenes
     set estado = p_estado,
         costo = coalesce(p_costo, costo),
         repuesto = coalesce(nullif(trim(p_repuesto), ''), repuesto),
         notas = case when coalesce(trim(p_nota), '') = '' then notas
                      else trim(both E'\n' from notas || E'\n' || to_char(now() at time zone 'America/Argentina/Buenos_Aires', 'DD/MM HH24:MI') || ' · ' || trim(p_nota)) end,
         actualizado_en = now(),
         resuelta_en = case when p_estado = 'resuelta' then now() else resuelta_en end,
         verificada_en = case when p_estado = 'verificada' then now() else verificada_en end
   where id = p_orden;

  if p_estado in ('resuelta', 'verificada') then
    update public.juegos set estado = 'operativo'
     where id = o.juego_id
       and not exists (select 1 from public.ordenes x where x.juego_id = o.juego_id and x.id <> p_orden
                         and x.estado not in ('resuelta', 'verificada') and x.prioridad in ('critica', 'cierre_salon'));
    -- El juego volvió: los alquileres que seguían en riesgo por esta orden recuperan su estado.
    with u as (
      update public.alquileres
         set estado = estado_previo, estado_previo = null, orden_riesgo_id = null, bloqueado = false
       where orden_riesgo_id = p_orden and estado = 'en_riesgo'
      returning id
    )
    insert into public.eventos (alquiler_id, orden_id, texto, actor)
    select id, p_orden, 'El juego quedó reparado: el alquiler vuelve a su estado anterior.', auth.uid() from u;
    get diagnostics n = row_count;
  elsif p_estado in ('en_curso', 'esperando_repuesto') then
    update public.juegos set estado = 'en_reparacion' where id = o.juego_id and estado = 'operativo';
  end if;

  if p_estado = 'verificada' then
    update public.juegos
       set ultima_revision = public.hoy(),
           contador = case when o.tipo = 'preventiva' then 0 else contador end
     where id = o.juego_id;
  end if;

  perform public.registrar_evento(null, p_orden, 'Estado: ' || replace(p_estado::text, '_', ' ')
    || case when coalesce(trim(p_nota), '') <> '' then ' · ' || trim(p_nota) else '' end || '.');
  return jsonb_build_object('ok', true, 'liberados', n);
end $$;

-- ---------- Hoja del turno (coordinación) ----------
create or replace function public.iniciar_turno(p_alquiler uuid)
returns jsonb language plpgsql security definer
set search_path = public
as $$
declare
  v_rol public.rol_usuario := public.exigir_rol(array['admin','coordinacion']::public.rol_usuario[]);
  v public.alquileres;
begin
  v := public.tomar_alquiler(p_alquiler, v_rol);
  if v.estado = 'en_curso' then return jsonb_build_object('ok', true, 'repetido', true); end if;
  if v.estado = 'en_riesgo' then
    raise exception 'Este alquiler está en riesgo por mantenimiento. Consultá con administración antes de empezar.';
  end if;
  if v.estado in ('senado', 'contrato_aceptado') then
    raise exception 'Falta que administración registre el saldo antes de empezar.';
  end if;
  if v.estado <> 'saldo_pagado' then
    raise exception 'Este turno no se puede iniciar porque está %.', replace(v.estado::text, '_', ' ');
  end if;
  update public.alquileres set estado = 'en_curso', iniciado_en = now() where id = p_alquiler;
  perform public.registrar_evento(p_alquiler, null, 'Turno iniciado.');
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.guardar_hoja(p_alquiler uuid, p_hoja jsonb)
returns jsonb language plpgsql security definer
set search_path = public
as $$
declare
  v_rol public.rol_usuario := public.exigir_rol(array['admin','coordinacion']::public.rol_usuario[]);
  v public.alquileres;
begin
  v := public.tomar_alquiler(p_alquiler, v_rol);
  if v.estado not in ('saldo_pagado', 'en_curso') then
    raise exception 'La hoja se completa mientras el turno está por empezar o en curso.';
  end if;
  update public.alquileres set hoja = coalesce(p_hoja, '{}'::jsonb) where id = p_alquiler;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.finalizar_turno(p_alquiler uuid, p_hoja jsonb, p_dano text default null)
returns jsonb language plpgsql security definer
set search_path = public
as $$
declare
  v_rol public.rol_usuario := public.exigir_rol(array['admin','coordinacion']::public.rol_usuario[]);
  v public.alquileres;
begin
  v := public.tomar_alquiler(p_alquiler, v_rol);
  if v.estado = 'realizado' then return jsonb_build_object('ok', true, 'repetido', true); end if;
  if v.estado <> 'en_curso' then raise exception 'Solo se finaliza un turno en curso.'; end if;
  update public.alquileres
     set estado = 'realizado', finalizado_en = now(), hoja = coalesce(p_hoja, hoja),
         dano_reportado = nullif(trim(coalesce(p_dano, '')), '')
   where id = p_alquiler;
  perform public.registrar_evento(p_alquiler, null, 'Turno finalizado'
    || case when coalesce(trim(p_dano), '') <> '' then '. Coordinación reportó un daño: ' || trim(p_dano) else ' sin daños' end || '.');
  return jsonb_build_object('ok', true);
end $$;

-- ---------- Cierre: garantía y contadores de mantenimiento ----------
create or replace function public.cerrar_alquiler(p_alquiler uuid, p_retener numeric default 0, p_motivo text default null)
returns jsonb language plpgsql security definer
set search_path = public
as $$
declare
  v public.alquileres;
  s record;
  v_gar numeric;
  v_ret numeric := coalesce(p_retener, 0);
  v_prev int;
begin
  perform public.exigir_rol(array['admin']::public.rol_usuario[]);
  v := public.tomar_alquiler(p_alquiler, 'admin');
  if v.estado = 'cerrado' then return jsonb_build_object('ok', true, 'repetido', true); end if;
  if v.estado <> 'realizado' then raise exception 'Solo se cierran alquileres realizados.'; end if;

  select * into s from public.saldo_de(p_alquiler);
  if s.saldo > 0 then
    raise exception 'Queda un saldo pendiente de %. Registralo antes de cerrar.', public.pesos(s.saldo);
  end if;

  v_gar := s.garantia_pagada + s.garantia_devuelta;
  if v_gar > 0 then
    if v_ret < 0 or v_ret > v_gar then
      raise exception 'Lo retenido tiene que estar entre $0 y %.', public.pesos(v_gar);
    end if;
    if v_ret > 0 and coalesce(trim(p_motivo), '') = '' then
      raise exception 'Cargá el motivo de la retención.';
    end if;
    if v_gar - v_ret > 0 then
      insert into public.movimientos (alquiler_id, tipo, monto, detalle, creado_por)
      values (p_alquiler, 'devolucion_garantia', -(v_gar - v_ret),
              case when v_ret > 0 then 'Devolución parcial de garantía' else 'Devolución de garantía sin daños' end, auth.uid());
    end if;
  elsif v_ret > 0 then
    raise exception 'Este alquiler no tiene garantía cobrada.';
  end if;

  update public.alquileres
     set estado = 'cerrado', cerrado_en = now(), garantia_retenida = v_ret,
         motivo_retencion = nullif(trim(coalesce(p_motivo, '')), '')
   where id = p_alquiler;

  -- Cada evento cerrado suma 1 al contador de los juegos que se miden por eventos.
  update public.juegos set contador = contador + 1 where frecuencia_tipo = 'eventos';
  v_prev := public.crear_preventivas();

  perform public.registrar_evento(p_alquiler, null, 'Alquiler cerrado'
    || case when v_ret > 0 then '. Garantía retenida: ' || public.pesos(v_ret) || ' (' || trim(p_motivo) || ')' else '' end || '.');
  return jsonb_build_object('ok', true, 'preventivas', v_prev);
end $$;

-- =====================================================================
-- Consultas públicas (campos autorizados solamente)
-- =====================================================================
create or replace function public.disponibilidad(p_desde date, p_hasta date)
returns table (fecha date, tipo_dia text, turno_id int, turno text, hora_inicio time, hora_fin time, estado text)
language sql volatile security definer
set search_path = public
as $$
  select public.vencer_prereservas();
  select d::date, public.tipo_dia(d::date), t.id, t.nombre, t.hora_inicio, t.hora_fin,
         case
           when d::date <= public.hoy() then 'pasado'
           when exists (select 1 from public.alquileres a
                        where a.fecha = d::date and a.turno_id = t.id and a.estado not in ('vencido', 'cancelado')) then 'ocupado'
           when public.fecha_bloqueada_por_mantenimiento(d::date) then 'mantenimiento'
           else 'libre'
         end
  from generate_series(p_desde, least(p_hasta, p_desde + 120), interval '1 day') d
  cross join public.turnos t
  where t.activo and public.tipo_dia(d::date) is not null
  order by 1, t.hora_inicio;
$$;

create or replace function public.catalogo_publico()
returns jsonb language sql stable security definer
set search_path = public
as $$
  select jsonb_build_object(
    'combos', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', c.id, 'nombre', c.nombre, 'descripcion', c.descripcion, 'incluye', c.incluye, 'no_incluye', c.no_incluye,
        'chicos_incluidos', c.chicos_incluidos, 'adultos_incluidos', c.adultos_incluidos,
        'precio_sabado', public.precio_vigente('combo', c.id, null, 'sabado'),
        'precio_domingo_feriado', public.precio_vigente('combo', c.id, null, 'domingo_feriado')) order by c.orden), '[]')
      from public.combos c where c.activo),
    'adicionales', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', a.id, 'codigo', a.codigo, 'nombre', a.nombre, 'descripcion', a.descripcion,
        'precio', public.precio_vigente('adicional', null, a.id, null)) order by a.orden), '[]')
      from public.adicionales a where a.activo),
    'turnos', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', t.id, 'nombre', t.nombre, 'hora_inicio', t.hora_inicio, 'hora_fin', t.hora_fin,
        'decoracion', public.decoracion_permitida(t.id)) order by t.hora_inicio), '[]')
      from public.turnos t where t.activo),
    'juegos', (select coalesce(jsonb_agg(jsonb_build_object(
        'nombre', j.nombre, 'tipo', j.tipo, 'disponible', j.estado = 'operativo') order by j.orden), '[]')
      from public.juegos j),
    'persona_extra', public.precio_vigente('persona_extra', null, null, null),
    'capacidad', public.cfg('capacidad'),
    'chicos_referencia', public.cfg('chicos_referencia'),
    'adultos_referencia', public.cfg('adultos_referencia'),
    'sena_pct', public.cfg('sena_pct'),
    'horas_vencimiento', public.cfg('horas_vencimiento'),
    'garantia_monto', public.cfg('garantia_monto'),
    'dias_saldo', public.cfg('dias_saldo'),
    'recargo_pct', public.cfg('recargo_pct'));
$$;

-- =====================================================================
-- Tablero e informes (administración)
-- =====================================================================
create or replace function public.tablero()
returns jsonb language plpgsql security definer
set search_path = public
as $$
declare v_mes date := date_trunc('month', public.hoy())::date;
begin
  perform public.exigir_rol(array['admin']::public.rol_usuario[]);
  perform public.vencer_prereservas();
  perform public.crear_preventivas();
  return jsonb_build_object(
    'hoy', public.hoy(),
    'proximos_7', (select count(*) from public.alquileres
                    where fecha between public.hoy() and public.hoy() + 7 and estado not in ('vencido', 'cancelado')),
    'pre_reservas', (select count(*) from public.alquileres where estado = 'pre_reserva'),
    'por_vencer', (select count(*) from public.alquileres where estado = 'pre_reserva' and vence_en < now() + interval '12 hours'),
    'en_riesgo', (select count(*) from public.alquileres where estado = 'en_riesgo'),
    'saldos_vencidos', (select count(*) from public.alquileres a, public.saldo_de(a.id) s
                         where a.estado in ('senado', 'contrato_aceptado', 'en_riesgo', 'en_curso', 'realizado')
                           and s.saldo > 0 and public.hoy() > a.fecha - public.cfg('dias_saldo')::int),
    'por_cerrar', (select count(*) from public.alquileres where estado = 'realizado'),
    'ordenes_abiertas', (select count(*) from public.ordenes where estado not in ('resuelta', 'verificada')),
    'ordenes_criticas', (select count(*) from public.ordenes where estado not in ('resuelta', 'verificada')
                          and prioridad in ('critica', 'cierre_salon')),
    'ingresos_mes', (select coalesce(sum(monto), 0) from public.movimientos
                      where tipo in ('sena', 'saldo', 'garantia') and not anulado
                        and (creado_en at time zone 'America/Argentina/Buenos_Aires')::date >= v_mes),
    'deuda_total', (select coalesce(sum(s.saldo), 0) from public.alquileres a, public.saldo_de(a.id) s
                     where a.estado in ('senado', 'contrato_aceptado', 'en_riesgo', 'en_curso', 'realizado') and s.saldo > 0));
end $$;

create or replace function public.informe(p_desde date, p_hasta date)
returns jsonb language plpgsql security definer
set search_path = public
as $$
begin
  perform public.exigir_rol(array['admin']::public.rol_usuario[]);
  return jsonb_build_object(
    'desde', p_desde, 'hasta', p_hasta,
    'pagos', (select coalesce(jsonb_agg(jsonb_build_object(
        'recibo', lpad(m.recibo::text, 4, '0'),
        'fecha', (m.creado_en at time zone 'America/Argentina/Buenos_Aires')::date,
        'alquiler', a.codigo, 'familia', f.nombre, 'tipo', m.tipo, 'medio', m.medio, 'monto', m.monto)
        order by m.recibo), '[]')
      from public.movimientos m join public.alquileres a on a.id = m.alquiler_id join public.familias f on f.id = a.familia_id
      where m.tipo in ('sena', 'saldo', 'garantia') and not m.anulado
        and (m.creado_en at time zone 'America/Argentina/Buenos_Aires')::date between p_desde and p_hasta),
    'ingresos', (select coalesce(sum(m.monto), 0) from public.movimientos m
      where m.tipo in ('sena', 'saldo', 'garantia') and not m.anulado
        and (m.creado_en at time zone 'America/Argentina/Buenos_Aires')::date between p_desde and p_hasta),
    'por_tipo', (select coalesce(jsonb_object_agg(tipo, total), '{}') from (
        select m.tipo, sum(m.monto) total from public.movimientos m
        where not m.anulado and (m.creado_en at time zone 'America/Argentina/Buenos_Aires')::date between p_desde and p_hasta
        group by m.tipo) x),
    'anulados', (select jsonb_build_object('cantidad', count(*), 'monto', coalesce(sum(m.monto), 0)) from public.movimientos m
      where m.anulado and m.recibo is not null
        and (m.creado_en at time zone 'America/Argentina/Buenos_Aires')::date between p_desde and p_hasta),
    'deudas', (select coalesce(jsonb_agg(jsonb_build_object(
        'alquiler', a.codigo, 'id', a.id, 'familia', f.nombre, 'fecha', a.fecha, 'estado', a.estado, 'saldo', s.saldo,
        'vencido', public.hoy() > a.fecha - public.cfg('dias_saldo')::int) order by a.fecha), '[]')
      from public.alquileres a join public.familias f on f.id = a.familia_id, public.saldo_de(a.id) s
      where a.estado in ('senado', 'contrato_aceptado', 'en_riesgo', 'en_curso', 'realizado') and s.saldo > 0),
    'mantenimiento', (select jsonb_build_object(
        'ordenes', count(*), 'costo', coalesce(sum(o.costo), 0),
        'por_juego', coalesce((select jsonb_agg(jsonb_build_object('juego', jj.nombre, 'ordenes', x.n, 'costo', x.costo) order by x.costo desc)
           from (select o2.juego_id, count(*) n, sum(o2.costo) costo from public.ordenes o2
                 where (o2.creado_en at time zone 'America/Argentina/Buenos_Aires')::date between p_desde and p_hasta
                 group by o2.juego_id) x join public.juegos jj on jj.id = x.juego_id), '[]'))
      from public.ordenes o
      where (o.creado_en at time zone 'America/Argentina/Buenos_Aires')::date between p_desde and p_hasta),
    'alquileres', (select coalesce(jsonb_object_agg(estado, n), '{}') from (
        select a.estado, count(*) n from public.alquileres a where a.fecha between p_desde and p_hasta group by a.estado) x));
end $$;
