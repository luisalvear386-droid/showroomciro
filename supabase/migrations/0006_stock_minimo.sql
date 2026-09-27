-- ShowroomCiro — Umbral de stock bajo por variante
-- Requiere 0001 a 0005 ya aplicadas.
--
-- Motivo: el panel de Alertas del Dashboard (Módulo 4) marca "stock bajo" las variantes
-- con `stock <= stock_minimo`. El umbral es por variante (un talle que rota mucho puede
-- necesitar más margen que otro); el Módulo 5 va a permitir editarlo desde el alta/edición
-- de productos. Mientras tanto todas las variantes quedan con el default.
--
-- No hace falta tocar RLS: las policies de `variantes` son por fila, así que la columna
-- nueva queda cubierta por las mismas reglas de lectura/escritura que el resto.

alter table public.variantes
  add column stock_minimo integer not null default 3;

alter table public.variantes
  add constraint chk_variantes_stock_minimo_no_negativo check (stock_minimo >= 0);

comment on column public.variantes.stock_minimo is
  'Umbral de alerta: la variante aparece en "Stock bajo" del Dashboard cuando stock <= stock_minimo.';
