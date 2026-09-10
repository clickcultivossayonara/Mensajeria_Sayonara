-- Ejecutar en el proyecto Supabase (Módulo Gestión Humana) -> SQL Editor -> Run
--
-- Reemplaza el booleano confirmacion_realizado (solo pendiente/realizado)
-- por un campo de estado con 4 valores: pendiente, realizado, cancelado,
-- pospuesta.

alter table confirmacion_pedidos add column if not exists estado text;

update confirmacion_pedidos
  set estado = case when confirmacion_realizado then 'realizado' else 'pendiente' end
  where estado is null;

alter table confirmacion_pedidos alter column estado set not null;
alter table confirmacion_pedidos alter column estado set default 'pendiente';

alter table confirmacion_pedidos drop constraint if exists confirmacion_pedidos_estado_check;
alter table confirmacion_pedidos add constraint confirmacion_pedidos_estado_check
  check (estado in ('pendiente', 'realizado', 'cancelado', 'pospuesta'));

alter table confirmacion_pedidos drop column if exists confirmacion_realizado;

-- Reemplaza mensajeria_confirmar_pedido (solo true/false) por una version
-- que acepta cualquiera de los 4 estados. El check constraint de arriba ya
-- rechaza valores invalidos.
drop function if exists mensajeria_confirmar_pedido(text, bigint, boolean);

create or replace function mensajeria_actualizar_estado(p_pin text, p_id bigint, p_estado text)
returns void
language plpgsql security definer as $$
begin
  if not mensajeria_pin_valido(p_pin) then
    raise exception 'PIN invalido';
  end if;
  update confirmacion_pedidos set estado = p_estado where id = p_id;
end;
$$;

grant execute on function mensajeria_actualizar_estado(text, bigint, text) to anon;
