-- database/migrations/20261028_03_contactos_adicionales_telefonos.sql
-- Amplía los teléfonos de contactos_adicionales a 40, igual que en contactos.
-- En PersonalClientes de Clarion hay teléfonos de hasta 36 caracteres (con texto libre).

ALTER TABLE public.contactos_adicionales ALTER COLUMN telefono TYPE varchar(40);
ALTER TABLE public.contactos_adicionales ALTER COLUMN telefono_secundario TYPE varchar(40);
