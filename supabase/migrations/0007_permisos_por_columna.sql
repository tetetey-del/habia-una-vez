-- =====================================================================
-- Había una Vez · 0007 · Edición directa solo de las columnas permitidas
-- Contadores, estados y fechas de revisión los cambian únicamente las
-- funciones de negocio, nunca un update desde el navegador.
-- =====================================================================

revoke update on public.juegos, public.configuracion, public.turnos, public.combos, public.adicionales from authenticated;

grant update (descripcion, frecuencia_tipo, frecuencia_valor, principal) on public.juegos to authenticated;
grant update (valor) on public.configuracion to authenticated;
grant update (hora_inicio, hora_fin, activo) on public.turnos to authenticated;
grant update (nombre, descripcion, incluye, no_incluye, activo) on public.combos to authenticated;
grant update (nombre, descripcion, activo) on public.adicionales to authenticated;

-- Marcar un juego como principal es decisión de administración
create or replace function public.proteger_juego_principal()
returns trigger language plpgsql
set search_path = public
as $$
begin
  if new.principal is distinct from old.principal and auth.uid() is not null
     and coalesce(public.mi_rol()::text, '') <> 'admin' then
    raise exception 'Solo administración puede marcar un juego como principal.';
  end if;
  return new;
end $$;

create trigger juegos_principal
  before update on public.juegos
  for each row execute function public.proteger_juego_principal();
