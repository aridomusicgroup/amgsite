// Mapeo de estados entre el módulo Producción (proyectos) y Pedidos (orders).
// El estado del pedido es lo que ve el cliente en "Mis compras" (panel de cuenta),
// así que mover el proyecto de etapa se refleja automáticamente para el cliente.

/** estado de proyecto → status de pedido */
export const PROY_TO_ORDER: Record<string, string> = {
  cola: "nuevo",
  produccion: "en_produccion",
  revision: "revision",
  entregado: "entregado",
  cerrado: "entregado",
  cancelado: "cancelado",
  pausado: "en_produccion",
};

/** status de pedido → estado de proyecto */
export const ORDER_TO_PROY: Record<string, string> = {
  nuevo: "cola",
  en_produccion: "produccion",
  revision: "revision",
  entregado: "entregado",
  cancelado: "cancelado",
};
