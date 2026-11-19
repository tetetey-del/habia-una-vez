-- =====================================================================
-- Había una Vez · 0009 · Las familias no ven que el salón está en arreglo
-- Las fechas bloqueadas por mantenimiento se muestran como «No disponible».
-- (Si ejecutás las migraciones desde cero, 0002 ya trae este texto.)
-- =====================================================================
do $$
declare f text; d text;
begin
  foreach f in array array['public.crear_pedido(jsonb)', 'public.reprogramar_alquiler(uuid, date, integer)'] loop
    d := pg_get_functiondef(f::regprocedure);
    d := replace(d, 'Ese día no está disponible por un arreglo en el salón. Elegí otra fecha.', 'Ese turno no está disponible, elegí otro.');
    execute d;
  end loop;
end $$;
