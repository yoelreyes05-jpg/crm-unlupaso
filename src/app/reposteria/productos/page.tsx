"use client";

import { Badge, CrudPage, RD, type Campo, type Columna } from "@/components/reposteria/ui";
import { CATEGORIAS_PRODUCTO } from "@/types/reposteria";

const campos: Campo[] = [
  { name: "nombre",         label: "Producto", requerido: true },
  { name: "categoria",      label: "Categoría", tipo: "select", defecto: "bizcocho",
    opciones: CATEGORIAS_PRODUCTO.map((c) => ({ value: c, label: c })) },
  { name: "precio_venta",   label: "Precio de venta", tipo: "number", paso: "0.01", requerido: true, defecto: 0 },
  { name: "costo_estimado", label: "Costo estimado", tipo: "number", paso: "0.01", defecto: 0 },
  { name: "itbis",          label: "ITBIS %", tipo: "number", paso: "0.01", defecto: 18 },
  { name: "unidad",         label: "Unidad", defecto: "unidad", ayuda: "unidad, porcion, docena…" },
  { name: "codigo",         label: "Código" },
  { name: "imagen_url",     label: "URL de imagen" },
  { name: "descripcion",    label: "Descripción", tipo: "textarea" },
  { name: "vende_en_pos",   label: "Se vende en POS", tipo: "checkbox", defecto: true, ayuda: "Aparece en el punto de venta" },
  { name: "activo",         label: "Activo", tipo: "checkbox", defecto: true },
];

const columnas: Columna[] = [
  { name: "nombre",       label: "Producto" },
  { name: "categoria",    label: "Categoría" },
  { name: "precio_venta", label: "Precio", alinear: "right", fmt: (v) => RD(v as number) },
  { name: "costo_estimado", label: "Costo", alinear: "right", fmt: (v) => RD(v as number) },
  { name: "margen", label: "Margen", alinear: "right", fmt: (_v, f) => {
    const p = Number(f.precio_venta ?? 0), c = Number(f.costo_estimado ?? 0);
    if (p <= 0) return "—";
    return `${(((p - c) / p) * 100).toFixed(0)}%`;
  } },
  { name: "unidad", label: "Unidad" },
  { name: "vende_en_pos", label: "POS", fmt: (v) => <Badge texto={v ? "sí" : "no"} tono={v ? "ok" : "neutro"} /> },
  { name: "activo", label: "Estado", fmt: (v) => <Badge texto={v ? "activo" : "inactivo"} tono={v ? "ok" : "neutro"} /> },
];

export default function ProductosPage() {
  return (
    <CrudPage
      titulo="Productos" icono="🎂" ruta="/productos"
      campos={campos} columnas={columnas} textoNuevo="Producto"
      filtros={[
        { name: "categoria",    label: "Categoría", opciones: CATEGORIAS_PRODUCTO.map((c) => ({ value: c, label: c })) },
        { name: "vende_en_pos", label: "POS",       opciones: [{ value: "true", label: "En POS" }, { value: "false", label: "Fuera de POS" }] },
        { name: "activo",       label: "Estado",    opciones: [{ value: "true", label: "Activos" }, { value: "false", label: "Inactivos" }] },
      ]}
    />
  );
}
