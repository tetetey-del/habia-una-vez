-- =====================================================================
-- Había una Vez · 0008 · El reinicio de la demo funciona desde la app
-- Supabase rechaza los UPDATE sin WHERE que llegan por la API; el
-- renumerado de órdenes en reiniciar_demo() ahora lleva «where true».
-- (Si ejecutás las migraciones desde cero, 0005 ya trae la corrección.)
-- =====================================================================
do $$
declare d text;
begin
  d := pg_get_functiondef('public.reiniciar_demo()'::regprocedure);
  d := replace(d, 'set numero = o.numero + 1000;', 'set numero = o.numero + 1000 where true;');
  execute d;
end $$;
