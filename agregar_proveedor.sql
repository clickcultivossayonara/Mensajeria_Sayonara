-- Ejecutar en el proyecto Supabase (Módulo Gestión Humana) -> SQL Editor -> Run
--
-- Agrega el campo proveedor (texto libre, opcional) a las dos tablas de
-- Mensajería. mensajeria_listar_pedidos devuelve la fila completa, así que
-- el campo nuevo le llega a la vista de Confirmar Pedidos sin más cambios,
-- y el aviso por correo lo toma del registro tal cual.
--
-- CORRER ESTO ANTES de publicar la página con el campo nuevo: si la página
-- sale primero, las solicitudes fallarían por una columna que no existe.

alter table solicitudes_mensajeria add column if not exists proveedor text;
alter table confirmacion_pedidos add column if not exists proveedor text;
