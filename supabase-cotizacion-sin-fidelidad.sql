-- Deja al staff desactivar el descuento de fidelidad en una cotización "de
-- contado" puntual (cliente VIP al que igual se le va a cobrar el 100%, caso
-- especial, etc.) sin tener que bajarle el escalón al contacto para lograrlo.
-- Se guarda (no se infiere) porque cada edición de la cotización recalcula el
-- descuento en el servidor — sin esta columna, la próxima edición lo
-- reactivaría solo.
alter table cotizaciones add column if not exists sin_descuento_fidelidad boolean not null default false;
