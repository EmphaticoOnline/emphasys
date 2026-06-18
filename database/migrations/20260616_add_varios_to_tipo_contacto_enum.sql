-- Agrega el valor 'Varios' al enum tipo_contacto_enum.
-- Contactos con tipo 'Varios' aparecen tanto en contextos de Ventas (como Clientes) como en Compras (como Proveedores).
ALTER TYPE public.tipo_contacto_enum ADD VALUE IF NOT EXISTS 'Varios';
