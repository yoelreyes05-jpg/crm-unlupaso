/**
 * Una paca es un producto con tipo_inventario = 'lote', así que se maneja
 * con la misma ruta: editar, desactivar y borrar definitivo (?definitivo=1).
 */
export { GET, PATCH, PUT, DELETE } from "../../productos/[id]/route";
