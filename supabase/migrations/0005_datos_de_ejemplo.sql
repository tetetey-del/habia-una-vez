-- =====================================================================
-- Había una Vez · 0005 · Datos de ejemplo y usuarios de prueba
-- Todo es sintético. Las fechas se calculan a partir de hoy, así la demo
-- siempre muestra turnos pasados, del fin de semana y futuros.
--
-- Reiniciar: select public.reiniciar_demo();   (SQL Editor de Supabase)
--            o el botón «Reiniciar datos de ejemplo» en Configuración.
-- =====================================================================

-- ---------- Usuario de prueba (sin confirmación por correo) ----------
create or replace function public.demo_usuario(p_email text, p_nombre text, p_rol public.rol_usuario, p_celular text default '')
returns uuid language plpgsql security definer
set search_path = public, extensions
as $$
declare v_id uuid;
begin
  select id into v_id from auth.users where email = p_email;
  if v_id is null then
    v_id := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change)
    values (
      '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', p_email,
      extensions.crypt('HabiaUnaVez2026', extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('nombre', p_nombre, 'celular', p_celular), now(), now(), '', '', '', '');
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), v_id, v_id::text,
            jsonb_build_object('sub', v_id::text, 'email', p_email, 'email_verified', true),
            'email', now(), now(), now());
  end if;
  insert into public.perfiles (id, rol, nombre) values (v_id, p_rol, p_nombre)
  on conflict (id) do update set rol = excluded.rol, nombre = excluded.nombre;
  if p_rol <> 'familia' then
    delete from public.familias where user_id = v_id;
  end if;
  return v_id;
end $$;

-- ---------- Alquiler de ejemplo con precios del catálogo vigente al cotizar ----------
create or replace function public.demo_alquiler(
  p_familia uuid, p_fecha date, p_turno int, p_estado public.estado_alquiler, p_combo int,
  p_chicos int, p_adultos int, p_adic text[], p_homenajeado text, p_edad int, p_creado timestamptz
)
returns uuid language plpgsql security definer
set search_path = public
as $$
declare
  v_cot date := (p_creado at time zone 'America/Argentina/Buenos_Aires')::date;
  v_tipo text := public.tipo_dia(p_fecha);
  v_pc numeric;
  v_ppe numeric;
  v_extra int := greatest(0, p_chicos + p_adultos - 50);
  v_adic numeric;
  v_total numeric;
  v_id uuid;
begin
  v_pc := public.precio_vigente('combo', p_combo, null, v_tipo, v_cot);
  v_ppe := public.precio_vigente('persona_extra', null, null, null, v_cot);
  select coalesce(sum(public.precio_vigente('adicional', null, a.id, null, v_cot)), 0) into v_adic
    from public.adicionales a where a.codigo = any (p_adic);
  v_total := v_pc + v_extra * v_ppe + v_adic;

  insert into public.alquileres (
    familia_id, fecha, turno_id, estado, homenajeado, edad, chicos, adultos, combo_id, tipo_dia,
    precio_combo, personas_extra, precio_persona_extra, monto_personas_extra, monto_adicionales,
    total, sena_requerida, cotizado_en, vence_en, creado_en, motivo_excedente)
  values (
    p_familia, p_fecha, p_turno, p_estado, p_homenajeado, p_edad, p_chicos, p_adultos, p_combo, v_tipo,
    v_pc, v_extra, v_ppe, v_extra * v_ppe, v_adic, v_total, round(v_total * public.cfg('sena_pct') / 100), v_cot,
    p_creado + make_interval(hours => public.cfg('horas_vencimiento')::int), p_creado,
    case when p_chicos + p_adultos > 50 then 'Familia numerosa, autorizado por administración' end)
  returning id into v_id;

  insert into public.alquiler_adicionales (alquiler_id, adicional_id, precio)
  select v_id, a.id, public.precio_vigente('adicional', null, a.id, null, v_cot)
    from public.adicionales a where a.codigo = any (p_adic);

  insert into public.eventos (alquiler_id, texto, creado_en)
  values (v_id, 'Pedido creado. Pre-reserva por ' || public.cfg('horas_vencimiento')::int || ' horas a la espera de la seña.', p_creado);
  return v_id;
end $$;

-- ---------- Pagos y contrato de ejemplo ----------
-- p_modo: 'unico' (todo en un pago) · 'dos' (seña y saldo) · 'sena' (solo seña)
create or replace function public.demo_pagos(
  p_alquiler uuid, p_modo text, p_sena timestamptz, p_saldo timestamptz, p_contrato timestamptz, p_medio text
)
returns void language plpgsql security definer
set search_path = public
as $$
declare
  v public.alquileres;
  v_sena numeric;
  v_saldo numeric;
  v_recargo numeric := 0;
  v_familia text;
begin
  select * into v from public.alquileres where id = p_alquiler;
  select nombre into v_familia from public.familias where id = v.familia_id;
  v_sena := case when p_modo = 'unico' then v.total else v.sena_requerida end;

  insert into public.movimientos (alquiler_id, tipo, monto, medio, detalle, creado_en)
  values (p_alquiler, 'sena', v_sena, p_medio,
          case when p_modo = 'unico' then 'Seña y saldo en un solo pago' else 'Seña' end, p_sena);
  insert into public.eventos (alquiler_id, texto, creado_en)
  values (p_alquiler, 'Seña registrada. Precio congelado en ' || public.pesos(v.total) || '.', p_sena);
  update public.alquileres set senado_en = p_sena, vence_en = null where id = p_alquiler;

  if p_contrato is not null then
    perform public.generar_contrato(p_alquiler, null, v_familia, p_contrato);
    insert into public.eventos (alquiler_id, texto, creado_en)
    values (p_alquiler, 'Contrato aceptado. El turno quedó firme.', p_contrato);
  end if;

  if p_modo = 'dos' and p_saldo is not null then
    v_saldo := v.total - v_sena;
    if (p_saldo at time zone 'America/Argentina/Buenos_Aires')::date > v.fecha - public.cfg('dias_saldo')::int then
      v_recargo := round(v_saldo * public.cfg('recargo_pct') / 100);
      insert into public.movimientos (alquiler_id, tipo, monto, detalle, creado_en)
      values (p_alquiler, 'recargo', v_recargo,
              'Recargo ' || public.cfg('recargo_pct')::int || ' % por saldo pagado fuera de plazo', p_saldo - interval '1 second');
    end if;
    insert into public.movimientos (alquiler_id, tipo, monto, medio, detalle, creado_en)
    values (p_alquiler, 'saldo', v_saldo + v_recargo, p_medio, 'Saldo', p_saldo);
    insert into public.eventos (alquiler_id, texto, creado_en)
    values (p_alquiler, 'Pago de saldo ' || public.pesos(v_saldo + v_recargo)
            || case when v_recargo > 0 then ' con recargo de ' || public.pesos(v_recargo) else '' end || '.', p_saldo);
  end if;
end $$;

-- ---------- Reinicio completo de la demo ----------
create or replace function public.reiniciar_demo()
returns jsonb language plpgsql security definer
set search_path = public, extensions
as $$
declare
  h date := public.hoy();
  d0 date;
  u_fam uuid;
  f uuid[] := '{}';
  f_lucia uuid;
  v_id uuid;
  v_tmp uuid;
  o_pelotero uuid;
  n text;
  i int := 0;
  v_dias int;
  v_pct int;
  v_cobrado numeric;
  hoja_completa jsonb := '{"checklist":{"recibir":true,"juegos_inicio":true,"conteo":true,"torta":true,"cocina":true,"juegos_cierre":true},"notas":"Todo en orden."}';
  nombres text[] := array[
    'Martín Gómez','Carolina Díaz','Sebastián Romero','Valeria Sosa','Diego Herrera','Florencia Medina',
    'Pablo Castro','Romina Ríos','Javier Morales','Agustina Ruiz','Nicolás Benítez','Mariana Acosta',
    'Federico Molina','Paula Ortiz','Gonzalo Suárez','Julieta Vega','Matías Rojas','Camila Navarro',
    'Leandro Peralta','Natalia Ibarra','Hernán Godoy','Soledad Luna','Ezequiel Cabrera','Daniela Ferreyra',
    'Tomás Aguirre','Lorena Paz'];
begin
  if auth.uid() is not null and coalesce(public.mi_rol()::text, '') <> 'admin' then
    raise exception 'Solo administración puede reiniciar los datos de ejemplo.';
  end if;
  perform set_config('app.reinicio_demo', 'si', true);
  -- Los horarios de ejemplo se escriben en hora de Argentina
  perform set_config('timezone', 'America/Argentina/Buenos_Aires', true);

  -- Próximo sábado (o hoy si es sábado)
  d0 := h + ((6 - extract(isodow from h)::int + 7) % 7);

  truncate table public.eventos, public.contratos, public.alquiler_adicionales, public.movimientos,
                 public.alquileres, public.ordenes, public.familias, public.precios, public.adicionales,
                 public.combos, public.juegos, public.turnos, public.feriados, public.configuracion
           restart identity cascade;
  perform setval('public.alquiler_codigo_seq', 1, false);
  perform setval('public.recibo_seq', 1, false);
  perform setval('public.orden_numero_seq', 1, false);

  -- ---------- Configuración (valores de prueba) ----------
  insert into public.configuracion (clave, valor, descripcion) values
    ('capacidad', 50, 'Tope de personas por evento (chicos + adultos)'),
    ('capacidad_maxima', 55, 'Máximo con autorización de administración y motivo'),
    ('chicos_referencia', 30, 'Chicos de referencia en el combo'),
    ('adultos_referencia', 20, 'Adultos de referencia en el combo'),
    ('sena_pct', 30, 'Seña sobre el total (%)'),
    ('horas_vencimiento', 48, 'Horas que dura una pre-reserva sin seña'),
    ('dias_saldo', 7, 'Días antes del evento para pagar el saldo'),
    ('recargo_pct', 8, 'Recargo por saldo fuera de plazo (%)'),
    ('compensacion_pct', 15, 'Compensación sobre el combo si la familia sigue en su fecha (%)'),
    ('dias_riesgo', 14, 'Días hacia adelante que afecta una orden crítica'),
    ('garantia_monto', 50000, 'Garantía opcional por roturas ($)');

  insert into public.turnos (nombre, hora_inicio, hora_fin, orden) values
    ('Mediodía', '11:30', '14:00', 1),
    ('Tarde', '15:30', '18:00', 2),
    ('Noche', '19:30', '22:00', 3);

  insert into public.feriados (fecha, nombre) values
    ('2026-11-23', 'Día de la Soberanía Nacional'),
    ('2026-12-08', 'Inmaculada Concepción de María'),
    ('2026-12-25', 'Navidad'),
    ('2027-01-01', 'Año Nuevo'),
    ('2027-02-08', 'Carnaval'),
    ('2027-02-09', 'Carnaval'),
    ('2027-03-24', 'Día de la Memoria'),
    ('2027-03-26', 'Viernes Santo'),
    ('2027-04-02', 'Día de las Malvinas'),
    ('2027-05-25', 'Revolución de Mayo'),
    ('2027-07-09', 'Día de la Independencia')
  on conflict do nothing;

  -- ---------- Catálogo ----------
  insert into public.combos (nombre, descripcion, incluye, no_incluye, chicos_incluidos, adultos_incluidos, orden) values
    ('Combo Salón',
     'El salón para ustedes: juegos, coordinadoras y cocina para armar la fiesta a su manera.',
     array['Tarjeta de invitación virtual','Dos coordinadoras para cuidar a los chicos','Acceso a todos los juegos','Cocina equipada'],
     array['Menú','Comida','Bebida','Torta','Piñata','Globos','Decoración personalizada'], 30, 20, 1),
    ('Combo Salón + Menú',
     'Todo lo del Combo Salón y además la comida y la bebida de los chicos.',
     array['Tarjeta de invitación virtual','Dos coordinadoras para cuidar a los chicos','Acceso a todos los juegos','Cocina equipada','Comida y bebida para los chicos'],
     array['Comida y bebida para adultos','Torta','Piñata','Globos','Decoración personalizada'], 30, 20, 2);

  insert into public.adicionales (codigo, nombre, descripcion, orden) values
    ('decoracion', 'Media hora extra para decorar', 'Entran 30 minutos antes para ambientar el salón.', 1),
    ('coordinadora', 'Coordinadora extra', 'Una tercera coordinadora para grupos grandes o chicos muy chiquitos.', 2),
    ('torta', 'Torta', 'Torta de cumpleaños para todos los invitados.', 3),
    ('pinata', 'Piñata y globos', 'Piñata con golosinas y globos de colores.', 4),
    ('deco_personalizada', 'Decoración personalizada', 'Ambientación con la temática que elijan.', 5),
    ('show', 'Show de animación', 'Animador con juegos, música y burbujas durante 45 minutos.', 6);

  insert into public.precios (concepto, combo_id, tipo_dia, monto, vigente_desde) values
    ('combo', 1, 'sabado', 420000, h - 400), ('combo', 1, 'domingo_feriado', 470000, h - 400),
    ('combo', 2, 'sabado', 640000, h - 400), ('combo', 2, 'domingo_feriado', 690000, h - 400);
  insert into public.precios (concepto, adicional_id, monto, vigente_desde)
  select 'adicional', a.id, x.monto, h - 400
    from public.adicionales a
    join (values ('decoracion', 35000), ('coordinadora', 45000), ('torta', 55000), ('pinata', 30000),
                 ('deco_personalizada', 70000), ('show', 90000)) x(codigo, monto) on x.codigo = a.codigo;
  insert into public.precios (concepto, monto, vigente_desde) values ('persona_extra', 9500, h - 400);
  -- Aumento ya cargado con vigencia futura: no toca nada de lo cotizado antes.
  insert into public.precios (concepto, combo_id, tipo_dia, monto, vigente_desde) values
    ('combo', 1, 'sabado', 450000, (date_trunc('month', h) + interval '1 month')::date),
    ('combo', 1, 'domingo_feriado', 500000, (date_trunc('month', h) + interval '1 month')::date);

  -- ---------- Juegos y sectores (12 fichas) ----------
  insert into public.juegos (nombre, tipo, descripcion, principal, frecuencia_tipo, frecuencia_valor, contador, ultima_revision, estado, orden) values
    ('Castillo inflable grande', 'juego', 'Castillo de 6 x 5 m con tobogán interno.', true, 'eventos', 20, 12, h - 67, 'operativo', 1),
    ('Castillo inflable chico', 'juego', 'Castillo para los más chiquitos, hasta 6 años.', false, 'eventos', 20, 4, h - 58, 'operativo', 2),
    ('Pelotero', 'juego', 'Pelotero de dos niveles con red de contención.', true, 'eventos', 15, 7, h - 80, 'fuera_de_servicio', 3),
    ('Tobogán estructural', 'juego', 'Tobogán fijo de 3 m con escalera.', false, 'eventos', 30, 22, h - 120, 'en_reparacion', 4),
    ('Mesa de tejo', 'juego', 'Mesa de tejo de madera con discos.', false, null, null, 0, null, 'operativo', 5),
    ('Toro mecánico', 'juego', 'Toro con colchón inflable y control de velocidad.', true, 'eventos', 10, 9, h - 43, 'operativo', 6),
    ('Metegol', 'juego', 'Metegol profesional de 8 varillas.', false, null, null, 0, null, 'operativo', 7),
    ('Cancha de fútbol y básquet', 'juego', 'Cancha con arcos chicos y aro regulable.', false, null, null, 0, null, 'operativo', 8),
    ('Espacio libre', 'juego', 'Zona abierta para bailar y jugar.', false, null, null, 0, null, 'operativo', 9),
    ('Asador', 'sector', 'Parrilla techada con mesada.', false, null, null, 0, null, 'operativo', 10),
    ('Cocina equipada', 'sector', 'Horno, anafe, heladera y vajilla. Revisión de instalación eléctrica y gas.', false, 'dias', 90, 0, h - 100, 'operativo', 11),
    ('Baños', 'sector', 'Baños para chicos y adultos.', false, null, null, 0, null, 'operativo', 12);

  -- ---------- Órdenes de mantenimiento (8) ----------
  insert into public.ordenes (juego_id, tipo, prioridad, estado, titulo, descripcion, repuesto, costo, reportada_por_nombre, creado_en, actualizado_en, resuelta_en, verificada_en, notas) values
    (1, 'preventiva', 'media', 'verificada', 'Revisión preventiva: Castillo inflable grande',
     'Se cumplieron 20 eventos desde la última revisión.', 'Kit de costura de lona', 130000, 'Sistema',
     (h - 70) + time '10:00', (h - 67) + time '18:00', (h - 68) + time '17:00', (h - 67) + time '18:00',
     'Costuras reforzadas y motor del soplador revisado.'),
    (2, 'preventiva', 'media', 'verificada', 'Revisión preventiva: Castillo inflable chico',
     'Se cumplieron 20 eventos desde la última revisión.', null, 42000, 'Sistema',
     (h - 60) + time '10:00', (h - 58) + time '12:00', (h - 59) + time '16:00', (h - 58) + time '12:00',
     'Limpieza profunda y parche en la base.'),
    (6, 'correctiva', 'media', 'verificada', 'Correa del motor gastada',
     'El toro patinaba al subir la velocidad.', 'Correa de transmisión', 95000, 'Coordinación',
     (h - 45) + time '19:00', (h - 43) + time '11:00', (h - 44) + time '15:00', (h - 43) + time '11:00',
     'Se cambió la correa y se probó a todas las velocidades.'),
    (12, 'correctiva', 'baja', 'verificada', 'Depósito del inodoro pierde agua',
     'El baño de chicos pierde agua constantemente.', 'Válvula de descarga', 18500, 'Coordinación',
     (h - 30) + time '14:00', (h - 29) + time '10:00', (h - 29) + time '09:00', (h - 29) + time '10:00', ''),
    (11, 'preventiva', 'media', 'resuelta', 'Revisión preventiva: Cocina equipada',
     'Revisión de instalación eléctrica y gas cada 90 días.', null, 60000, 'Sistema',
     (h - 20) + time '09:00', (h - 18) + time '16:00', (h - 18) + time '16:00', null,
     'Gasista matriculado: sin pérdidas. Falta que administración verifique.'),
    (3, 'correctiva', 'critica', 'esperando_repuesto', 'Red de contención rota',
     'Se cortó la red del segundo nivel del pelotero. No se puede usar.', 'Red perimetral 4 x 3 m', 180000, 'Coordinación',
     (d0 - 13) + time '18:30', (d0 - 12) + time '10:00', null, null,
     'Red pedida al proveedor. Demora estimada: 10 días.'),
    (4, 'correctiva', 'media', 'en_curso', 'Escalón flojo',
     'El tercer escalón del tobogán se mueve.', 'Bulones y arandelas', 25000, 'Mantenimiento',
     (h - 9) + time '11:00', (h - 8) + time '10:00', null, null, ''),
    (7, 'correctiva', 'baja', 'abierta', 'Varilla trabada',
     'La varilla del arquero rojo no gira bien.', null, 12000, 'Coordinación',
     (h - 5) + time '20:00', (h - 5) + time '20:00', null, null, '');
  update public.ordenes o set numero = o.numero + 1000 where true;
  update public.ordenes o set numero = x.rn from (
    select id, row_number() over (order by creado_en) rn from public.ordenes) x where x.id = o.id;
  perform setval('public.orden_numero_seq', (select max(numero) from public.ordenes));
  select id into o_pelotero from public.ordenes where juego_id = 3;
  insert into public.eventos (orden_id, texto, creado_en)
  select id, 'Orden #' || numero || ' abierta: ' || titulo || '.', creado_en from public.ordenes;

  -- ---------- Usuarios de prueba (contraseña: HabiaUnaVez2026) ----------
  perform public.demo_usuario('admin@habiaunavez.test', 'Administración', 'admin');
  perform public.demo_usuario('coordinacion@habiaunavez.test', 'Coordinación', 'coordinacion');
  perform public.demo_usuario('mantenimiento@habiaunavez.test', 'Mantenimiento', 'mantenimiento');
  u_fam := public.demo_usuario('familia@habiaunavez.test', 'Lucía Fernández', 'familia', '11 5823-4410');
  insert into public.familias (user_id, nombre, celular, email)
  values (u_fam, 'Lucía Fernández', '11 5823-4410', 'familia@habiaunavez.test')
  on conflict (user_id) do update set nombre = excluded.nombre, celular = excluded.celular
  returning id into f_lucia;

  -- ---------- Familias sintéticas ----------
  foreach n in array nombres loop
    i := i + 1;
    insert into public.familias (nombre, celular)
    values (n, '11 ' || (5000 + (i * 7919) % 4999)::text || '-' || lpad(((i * 104729) % 9999)::text, 4, '0'))
    returning id into v_tmp;
    f := f || v_tmp;
  end loop;

  -- ---------- 30 alquileres en todos los estados ----------
  -- Cerrados (7)
  v_id := public.demo_alquiler(f[1], d0 - 49, 2, 'cerrado', 1, 28, 18, '{}', 'Benjamín', 6, (d0 - 95) + time '13:00');
  perform public.demo_pagos(v_id, 'unico', (d0 - 79) + time '12:00', null, (d0 - 78) + time '20:00', 'Transferencia');
  update public.alquileres set hoja = hoja_completa, iniciado_en = (d0 - 49) + time '18:20', finalizado_en = (d0 - 49) + time '21:05', cerrado_en = (d0 - 48) + time '13:00' where id = v_id;

  v_id := public.demo_alquiler(f[2], d0 - 48, 1, 'cerrado', 2, 30, 20, '{torta}', 'Mía', 5, (d0 - 90) + time '10:00');
  perform public.demo_pagos(v_id, 'unico', (d0 - 76) + time '11:00', null, (d0 - 75) + time '19:00', 'Efectivo');
  update public.alquileres set hoja = hoja_completa, iniciado_en = (d0 - 48) + time '14:20', finalizado_en = (d0 - 48) + time '17:05', cerrado_en = (d0 - 47) + time '12:00' where id = v_id;

  v_id := public.demo_alquiler(f[3], d0 - 42, 3, 'cerrado', 1, 26, 20, '{decoracion,pinata}', 'Thiago', 7, (d0 - 85) + time '09:30');
  perform public.demo_pagos(v_id, 'dos', (d0 - 82) + time '17:00', (d0 - 51) + time '12:00', (d0 - 81) + time '21:00', 'Transferencia');
  update public.alquileres set hoja = hoja_completa, iniciado_en = (d0 - 42) + time '22:20', finalizado_en = (d0 - 41) + time '01:05', cerrado_en = (d0 - 41) + time '15:00' where id = v_id;

  v_id := public.demo_alquiler(f[4], d0 - 41, 2, 'cerrado', 2, 32, 18, '{show}', 'Emma', 4, (d0 - 80) + time '16:00');
  perform public.demo_pagos(v_id, 'unico', (d0 - 66) + time '10:30', null, (d0 - 65) + time '22:00', 'Tarjeta de débito');
  update public.alquileres set hoja = hoja_completa, iniciado_en = (d0 - 41) + time '18:20', finalizado_en = (d0 - 41) + time '21:05', cerrado_en = (d0 - 40) + time '11:00' where id = v_id;

  v_id := public.demo_alquiler(f_lucia, d0 - 35, 2, 'cerrado', 1, 25, 20, '{torta}', 'Tomás', 6, (d0 - 75) + time '20:00');
  perform public.demo_pagos(v_id, 'unico', (d0 - 65) + time '12:00', null, (d0 - 64) + time '21:30', 'Transferencia');
  update public.alquileres set hoja = hoja_completa, iniciado_en = (d0 - 35) + time '18:20', finalizado_en = (d0 - 35) + time '21:05', cerrado_en = (d0 - 34) + time '12:00' where id = v_id;

  v_id := public.demo_alquiler(f[5], d0 - 34, 1, 'cerrado', 1, 30, 15, '{show}', 'Lautaro', 8, (d0 - 60) + time '18:00');
  perform public.demo_pagos(v_id, 'unico', (d0 - 54) + time '11:00', null, (d0 - 53) + time '10:00', 'Efectivo');
  update public.alquileres set hoja = hoja_completa, iniciado_en = (d0 - 34) + time '14:20', finalizado_en = (d0 - 34) + time '17:05', cerrado_en = (d0 - 33) + time '12:00' where id = v_id;

  v_id := public.demo_alquiler(f[6], d0 - 28, 2, 'cerrado', 2, 30, 20, '{}', 'Valentina', 10, (d0 - 55) + time '15:00');
  perform public.demo_pagos(v_id, 'unico', (d0 - 49) + time '16:00', null, (d0 - 48) + time '20:00', 'Transferencia');
  update public.alquileres set hoja = hoja_completa, iniciado_en = (d0 - 28) + time '18:20', finalizado_en = (d0 - 28) + time '21:05', cerrado_en = (d0 - 27) + time '13:00' where id = v_id;

  -- Cancelado sin seña (pasado)
  v_id := public.demo_alquiler(f[2], d0 - 27, 1, 'cancelado', 1, 30, 20, '{}', 'Dante', 5, (d0 - 52) + time '11:00');
  update public.alquileres set estado_previo = 'pre_reserva', cancelado_por = 'familia', motivo_cancelacion = 'Eligieron festejar en casa.',
         cancelado_en = (d0 - 51) + time '09:00', vence_en = null where id = v_id;
  insert into public.eventos (alquiler_id, texto, creado_en) values (v_id, 'Alquiler cancelado por la familia. Devolución: $0 (sin seña).', (d0 - 51) + time '09:00');

  -- Vencido (pasado)
  v_id := public.demo_alquiler(f[20], d0 - 21, 1, 'vencido', 1, 30, 20, '{}', 'Renata', 3, (d0 - 50) + time '19:00');
  update public.alquileres set estado_previo = 'pre_reserva' where id = v_id;
  insert into public.eventos (alquiler_id, texto, creado_en) values (v_id, 'La pre-reserva venció sin seña y el turno quedó libre.', (d0 - 48) + time '19:00');

  -- Vencido (pasado)
  v_id := public.demo_alquiler(f[23], d0 - 14, 3, 'vencido', 1, 28, 20, '{}', 'Valentino', 9, (d0 - 34) + time '22:00');
  update public.alquileres set estado_previo = 'pre_reserva' where id = v_id;
  insert into public.eventos (alquiler_id, texto, creado_en) values (v_id, 'La pre-reserva venció sin seña y el turno quedó libre.', (d0 - 32) + time '22:00');

  -- Cancelado por el salón con devolución del 100 %
  v_id := public.demo_alquiler(f[25], d0 - 13, 2, 'cancelado', 2, 30, 20, '{}', 'Lorenzo', 7, (d0 - 50) + time '12:00');
  perform public.demo_pagos(v_id, 'sena', (d0 - 43) + time '15:00', null, null, 'Transferencia');
  select pagado into v_cobrado from public.saldo_de(v_id);
  insert into public.movimientos (alquiler_id, tipo, monto, detalle, creado_en)
  values (v_id, 'devolucion', -v_cobrado, 'Devolución 100 % por cancelación por causa del salón', (d0 - 16) + time '10:00');
  update public.alquileres set estado_previo = 'senado', cancelado_por = 'salon',
         motivo_cancelacion = 'Corte de luz programado por la distribuidora en la zona.', cancelado_en = (d0 - 16) + time '10:00' where id = v_id;
  insert into public.eventos (alquiler_id, texto, creado_en)
  values (v_id, 'Alquiler cancelado por causa del salón. Devolución: ' || public.pesos(v_cobrado) || ' (100 %).', (d0 - 16) + time '10:00');

  -- Realizados (2): esperan el cierre de administración
  v_id := public.demo_alquiler(f[7], d0 - 7, 2, 'realizado', 1, 29, 21, '{coordinadora}', 'Bautista', 3, (d0 - 42) + time '17:00');
  perform public.demo_pagos(v_id, 'dos', (d0 - 40) + time '12:00', (d0 - 11) + time '18:00', (d0 - 39) + time '21:00', 'Transferencia');
  update public.alquileres set hoja = hoja_completa, iniciado_en = (d0 - 7) + time '18:20', finalizado_en = (d0 - 7) + time '21:05' where id = v_id;

  v_id := public.demo_alquiler(f[8], d0 - 7, 3, 'realizado', 2, 30, 20, '{pinata}', 'Olivia', 6, (d0 - 30) + time '10:00');
  perform public.demo_pagos(v_id, 'unico', (d0 - 21) + time '13:00', null, (d0 - 20) + time '20:00', 'Efectivo');
  update public.alquileres set iniciado_en = (d0 - 7) + time '19:20', finalizado_en = (d0 - 7) + time '22:05',
         hoja = '{"checklist":{"recibir":true,"juegos_inicio":true,"conteo":true,"torta":true,"cocina":true,"juegos_cierre":true},"notas":"Un chico se golpeó jugando al metegol, sin consecuencias."}'::jsonb,
         dano_reportado = 'Se despegó una manija del metegol.' where id = v_id;

  -- Este fin de semana: en curso, y en riesgo por el pelotero (orden crítica abierta)
  v_id := public.demo_alquiler(f[9], d0, 1, 'en_curso', 1, 28, 22, '{pinata}', 'Joaquín', 9, (d0 - 30) + time '18:00');
  perform public.demo_pagos(v_id, 'unico', (d0 - 10) + time '12:00', null, (d0 - 9) + time '21:00', 'Transferencia');
  -- Pagó todo de una vez, ya descontada la compensación
  update public.movimientos m set monto = a.total - round(a.precio_combo * 0.15)
    from public.alquileres a where a.id = v_id and m.alquiler_id = v_id and m.tipo = 'sena';
  insert into public.movimientos (alquiler_id, tipo, monto, detalle, creado_en)
  select v_id, 'compensacion', -round(precio_combo * 0.15), 'Compensación 15 % del combo por juego fuera de servicio', (d0 - 12) + time '11:00'
    from public.alquileres where id = v_id;
  update public.alquileres set compensacion_aplicada = true, iniciado_en = now(),
         hoja = '{"checklist":{"recibir":true,"juegos_inicio":true,"conteo":true},"notas":""}'::jsonb where id = v_id;
  insert into public.eventos (alquiler_id, texto, creado_en) values
    (v_id, 'La familia sigue en su fecha con una compensación del 15 % del combo.', (d0 - 12) + time '11:00'),
    (v_id, 'Turno iniciado.', now());

  v_id := public.demo_alquiler(f_lucia, d0, 2, 'en_riesgo', 2, 30, 20, '{decoracion,torta}', 'Sofía', 9, (d0 - 24) + time '21:00');
  perform public.demo_pagos(v_id, 'sena', (d0 - 22) + time '10:00', null, (d0 - 21) + time '22:00', 'Transferencia');
  update public.alquileres set estado_previo = 'contrato_aceptado', orden_riesgo_id = o_pelotero where id = v_id;
  insert into public.eventos (alquiler_id, orden_id, texto, creado_en)
  values (v_id, o_pelotero, 'En riesgo por la orden de mantenimiento: Red de contención rota del pelotero.', (d0 - 13) + time '18:31');

  -- Próximo fin de semana: los dos alquileres que usan el toro mecánico
  v_id := public.demo_alquiler(f[10], d0 + 7, 2, 'saldo_pagado', 1, 30, 20, '{decoracion}', 'Catalina', 7, (d0 - 30) + time '19:00');
  perform public.demo_pagos(v_id, 'dos', (d0 - 28) + time '11:00', now() - interval '1 day', (d0 - 27) + time '21:00', 'Transferencia');

  v_id := public.demo_alquiler(f[11], d0 + 8, 1, 'contrato_aceptado', 2, 27, 23, '{torta}', 'Santino', 5, (d0 - 16) + time '14:00');
  perform public.demo_pagos(v_id, 'sena', (d0 - 14) + time '10:00', null, (d0 - 13) + time '20:00', 'Efectivo');

  -- Vencido (futuro): el turno volvió a quedar libre
  v_id := public.demo_alquiler(f[21], d0 + 14, 1, 'vencido', 2, 30, 20, '{}', 'Ignacio', 8, (d0 - 12) + time '20:00');
  update public.alquileres set estado_previo = 'pre_reserva' where id = v_id;
  insert into public.eventos (alquiler_id, texto, creado_en) values (v_id, 'La pre-reserva venció sin seña y el turno quedó libre.', (d0 - 10) + time '20:00');

  v_id := public.demo_alquiler(f[12], d0 + 15, 2, 'saldo_pagado', 1, 30, 20, '{}', 'Isabella', 8, (d0 - 11) + time '13:00');
  perform public.demo_pagos(v_id, 'unico', (d0 - 10) + time '12:00', null, (d0 - 9) + time '22:00', 'Tarjeta de débito');

  v_id := public.demo_alquiler(f[13], d0 + 21, 3, 'contrato_aceptado', 1, 24, 20, '{show}', 'Felipe', 11, (d0 - 12) + time '09:00');
  perform public.demo_pagos(v_id, 'sena', (d0 - 11) + time '15:00', null, (d0 - 10) + time '21:00', 'Transferencia');

  -- Cancelado por la familia entre 30 y 15 días: devolución del 50 %
  v_id := public.demo_alquiler(f[24], d0 + 21, 1, 'cancelado', 1, 30, 20, '{}', 'Zoe', 4, (d0 - 26) + time '19:00');
  perform public.demo_pagos(v_id, 'sena', (d0 - 25) + time '12:00', null, null, 'Efectivo');
  v_dias := (d0 + 21) - (h - 1);
  v_pct := case when v_dias > 30 then 100 when v_dias >= 15 then 50 else 0 end;
  select pagado into v_cobrado from public.saldo_de(v_id);
  if round(v_cobrado * v_pct / 100) > 0 then
    insert into public.movimientos (alquiler_id, tipo, monto, detalle, creado_en)
    values (v_id, 'devolucion', -round(v_cobrado * v_pct / 100),
            'Devolución ' || v_pct || ' % por cancelación con ' || v_dias || ' días de anticipación', now() - interval '1 day');
  end if;
  update public.alquileres set estado_previo = 'senado', cancelado_por = 'familia',
         motivo_cancelacion = 'Se mudan de ciudad ese mes.', cancelado_en = now() - interval '1 day' where id = v_id;
  insert into public.eventos (alquiler_id, texto, creado_en)
  values (v_id, 'Alquiler cancelado por la familia. Devolución: ' || public.pesos(round(v_cobrado * v_pct / 100)) || ' (' || v_pct || ' %).', now() - interval '1 day');

  -- Señados (3): falta que la familia acepte el contrato
  v_id := public.demo_alquiler(f_lucia, d0 + 22, 1, 'senado', 1, 30, 20, '{pinata}', 'Juana', 4, now() - interval '4 days');
  perform public.demo_pagos(v_id, 'sena', now() - interval '3 days', null, null, 'Transferencia');

  v_id := public.demo_alquiler(f[14], d0 + 28, 2, 'contrato_aceptado', 2, 30, 20, '{show,pinata}', 'Martina', 6, now() - interval '7 days');
  perform public.demo_pagos(v_id, 'sena', now() - interval '6 days', null, now() - interval '5 days', 'Transferencia');

  v_id := public.demo_alquiler(f[15], d0 + 29, 2, 'senado', 1, 28, 20, '{}', 'Juan Cruz', 4, now() - interval '3 days');
  perform public.demo_pagos(v_id, 'sena', now() - interval '2 days', null, null, 'Efectivo');

  v_id := public.demo_alquiler(f[16], d0 + 35, 1, 'senado', 2, 30, 20, '{coordinadora}', 'Delfina', 9, now() - interval '2 days');
  perform public.demo_pagos(v_id, 'sena', now() - interval '1 day', null, null, 'Tarjeta de débito');

  -- Cancelado sin seña (futuro)
  v_id := public.demo_alquiler(f[26], d0 + 35, 3, 'cancelado', 1, 30, 20, '{}', 'Guadalupe', 10, now() - interval '3 days');
  update public.alquileres set estado_previo = 'pre_reserva', cancelado_por = 'familia', motivo_cancelacion = 'Prefieren otro horario.',
         cancelado_en = now() - interval '2 days', vence_en = null where id = v_id;
  insert into public.eventos (alquiler_id, texto, creado_en) values (v_id, 'Alquiler cancelado por la familia. Devolución: $0 (sin seña).', now() - interval '2 days');

  -- Pre-reservas (3): una vence dentro de una hora
  perform public.demo_alquiler(f[17], d0 + 36, 2, 'pre_reserva', 1, 25, 20, '{}', 'Ramiro', 7, now() - interval '47 hours');
  perform public.demo_alquiler(f[18], d0 + 42, 1, 'pre_reserva', 2, 30, 20, '{torta}', 'Alma', 5, now() - interval '30 hours');
  perform public.demo_alquiler(f[19], d0 + 43, 3, 'pre_reserva', 1, 30, 20, '{show}', 'Bruno', 10, now() - interval '2 hours');

  -- Vencido (futuro lejano)
  v_id := public.demo_alquiler(f[22], d0 + 49, 2, 'vencido', 1, 30, 20, '{}', 'Pilar', 6, now() - interval '5 days');
  update public.alquileres set estado_previo = 'pre_reserva' where id = v_id;
  insert into public.eventos (alquiler_id, texto, creado_en) values (v_id, 'La pre-reserva venció sin seña y el turno quedó libre.', now() - interval '3 days');

  -- Recibos correlativos desde 0001, en orden de cobro
  update public.movimientos m set recibo = x.rn
    from (select id, row_number() over (order by creado_en, id) rn
            from public.movimientos where tipo in ('sena', 'saldo', 'garantia')) x
   where x.id = m.id;
  perform setval('public.recibo_seq', (select coalesce(max(recibo), 0) + 1 from public.movimientos), false);

  return jsonb_build_object(
    'alquileres', (select count(*) from public.alquileres),
    'pagos', (select count(*) from public.movimientos where recibo is not null),
    'ordenes', (select count(*) from public.ordenes),
    'juegos', (select count(*) from public.juegos),
    'proximo_sabado', d0);
end $$;

revoke execute on function public.demo_usuario(text, text, public.rol_usuario, text) from public, anon, authenticated;
revoke execute on function public.demo_alquiler(uuid, date, int, public.estado_alquiler, int, int, int, text[], text, int, timestamptz) from public, anon, authenticated;
revoke execute on function public.demo_pagos(uuid, text, timestamptz, timestamptz, timestamptz, text) from public, anon, authenticated;
revoke execute on function public.reiniciar_demo() from public, anon;
grant execute on function public.reiniciar_demo() to authenticated;

select public.reiniciar_demo();
