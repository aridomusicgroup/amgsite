-- Cierra dos grietas del sistema de fidelidad (ver memoria project_fidelidad_cliente):
--  1) Borrar una venta que ya había sumado su escalón no lo revertía.
--  2) Completar el saldo de una venta DESPUÉS de creada (agregar/editar/borrar
--     un pago) no la hacía sumar retroactivamente, aunque ya quedara "de contado".
--
-- Esta columna es el marcador de "esta venta ya sumó su escalón de fidelidad"
-- — sin ella no hay forma confiable de saber, al borrar o editar pagos, si hay
-- algo que revertir o que apenas ahora hay que contar.
alter table ventas add column if not exists fidelidad_contada boolean not null default false;
