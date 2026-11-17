-- =====================================================================
-- Había una Vez · 0004 · El armado del contrato pasa a una función propia
-- (la usan la aceptación en pantalla y la carga de datos de ejemplo).
-- =====================================================================

create or replace function public.generar_contrato(
  p_alquiler uuid, p_aceptado_por uuid, p_aceptado_por_nombre text, p_cuando timestamptz default now()
)
returns uuid language plpgsql security definer
set search_path = public
as $$
declare
  v public.alquileres;
  t public.turnos;
  c public.combos;
  f public.familias;
  s record;
  v_adic text;
  v_ingreso time;
  v_vence date;
  v_texto text;
  v_id uuid;
begin
  select * into v from public.alquileres where id = p_alquiler;
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
  v_vence := v.fecha - public.cfg('dias_saldo')::int;

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
    || ', a pagar hasta el ' || public.fecha_larga(v_vence)
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

  insert into public.contratos (alquiler_id, version, datos, texto, aceptado_por, aceptado_por_nombre, aceptado_en)
  values (
    p_alquiler,
    coalesce((select max(version) from public.contratos where alquiler_id = p_alquiler), 0) + 1,
    jsonb_build_object(
      'codigo', v.codigo, 'familia', f.nombre, 'celular', f.celular,
      'homenajeado', v.homenajeado, 'edad', v.edad, 'fecha', v.fecha,
      'turno', t.nombre, 'hora_inicio', t.hora_inicio, 'hora_fin', t.hora_fin, 'ingreso', v_ingreso,
      'combo', c.nombre, 'incluye', c.incluye, 'no_incluye', c.no_incluye,
      'chicos', v.chicos, 'adultos', v.adultos,
      'precio_combo', v.precio_combo, 'personas_extra', v.personas_extra, 'monto_personas_extra', v.monto_personas_extra,
      'adicionales', coalesce(v_adic, ''), 'monto_adicionales', v.monto_adicionales,
      'total', v.total, 'pagado', s.pagado, 'saldo', s.saldo,
      'vence_saldo', v_vence, 'recargo_pct', public.cfg('recargo_pct'),
      'compensacion_pct', public.cfg('compensacion_pct'), 'garantia', v.quiere_garantia,
      'garantia_monto', public.cfg('garantia_monto')),
    v_texto, p_aceptado_por, p_aceptado_por_nombre, p_cuando)
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.aceptar_contrato(p_alquiler uuid)
returns jsonb language plpgsql security definer
set search_path = public
as $$
declare
  v_rol public.rol_usuario := public.exigir_rol(array['admin','familia']::public.rol_usuario[]);
  v public.alquileres;
  v_familia text;
  s record;
  v_nuevo public.estado_alquiler;
begin
  v := public.tomar_alquiler(p_alquiler, v_rol);
  if v.estado <> 'senado' then
    if exists (select 1 from public.contratos where alquiler_id = p_alquiler) then
      return jsonb_build_object('ok', true, 'repetido', true);
    end if;
    raise exception 'El contrato se acepta después de que administración registra la seña.';
  end if;

  select nombre into v_familia from public.familias where id = v.familia_id;
  perform public.generar_contrato(p_alquiler, auth.uid(),
    case when v_rol = 'familia' then v_familia else 'Administración, en nombre de ' || v_familia end);

  select * into s from public.saldo_de(p_alquiler);
  v_nuevo := case when s.saldo <= 0 then 'saldo_pagado' else 'contrato_aceptado' end;
  update public.alquileres set estado = v_nuevo where id = p_alquiler;
  perform public.registrar_evento(p_alquiler, null, 'Contrato aceptado. El turno quedó firme.');
  return jsonb_build_object('ok', true, 'estado', v_nuevo);
end $$;

revoke execute on function public.generar_contrato(uuid, uuid, text, timestamptz) from public, anon, authenticated;
grant execute on function public.aceptar_contrato(uuid) to authenticated;
