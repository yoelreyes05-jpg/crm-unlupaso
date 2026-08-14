-- =====================================================================
--  Nombre de la empresa del sistema de préstamos: CGSSOLUTIONS
--  Pégalo en Supabase → SQL Editor. Una sola línea, no toca nada más.
-- =====================================================================
--  Aparece en el estado de cuenta, en el recibo de pago y en el sidebar.
--  Después lo puedes cambiar cuando quieras desde /prestamos/configuracion.
-- =====================================================================

update pr_config
   set nombre_empresa = 'CGSSOLUTIONS'
 where id = 1;

-- Para instalaciones nuevas, ese ya es el valor por defecto.
alter table pr_config alter column nombre_empresa set default 'CGSSOLUTIONS';

select nombre_empresa, rnc, telefono, direccion, simbolo_moneda from pr_config;
