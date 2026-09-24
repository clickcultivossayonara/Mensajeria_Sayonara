-- Ejecutar en el proyecto Supabase (Módulo Gestión Humana) -> SQL Editor -> Run
--
-- Agrega la fecha a la que queda pospuesto un pedido. Solo tiene valor
-- cuando el estado es 'pospuesta'; en cualquier otro estado se limpia.

alter table confirmacion_pedidos add column if not exists fecha_pospuesta date;

-- La version anterior (3 parametros) se elimina para que no haya dos
-- funciones con el mismo nombre y PostgREST no se confunda al llamarla.
drop function if exists mensajeria_actualizar_estado(text, bigint, text);

create or replace function mensajeria_actualizar_estado(
  p_pin text,
  p_id bigint,
  p_estado text,
  p_fecha_pospuesta date default null
)
returns void
language plpgsql security definer as $$
begin
  if not mensajeria_pin_valido(p_pin) then
    raise exception 'PIN invalido';
  end if;
  if p_estado = 'pospuesta' and p_fecha_pospuesta is null then
    raise exception 'La fecha de pospuesta es obligatoria';
  end if;
  update confirmacion_pedidos
    set estado = p_estado,
        fecha_pospuesta = case when p_estado = 'pospuesta' then p_fecha_pospuesta else null end
    where id = p_id;
end;
$$;

grant execute on function mensajeria_actualizar_estado(text, bigint, text, date) to anon;
