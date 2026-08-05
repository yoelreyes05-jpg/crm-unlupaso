"use client";

import { Badge, CrudPage, RD, fecha, type Campo, type Columna } from "@/components/reposteria/ui";
import { CATEGORIAS_LOTE } from "@/types/reposteria";

const hoy = new Date().toISOString().slice(0, 10);

const campos: Campo[] = [
  { name: "nombre_lote",       label: "Nombre del lote", requerido: true, ancho: 2 },
  { name: "producto_id",       label: "Producto", tipo: "select",
    fuente: { ruta: "/productos", etiqueta: (r) => String(r.nombre) } },
  { name: "receta_id",         label: "Receta", tipo: "select",
    fuente: { ruta: "/recetas", etiqueta: (r) => String(r.nombre) } },
  { name: "categoria",         label: "Categoría", tipo: "select", defecto: "bizcocho",
    opciones: CATEGORIAS_LOTE.map((c) => ({ value: c, label: c })) },
  { name: "unidad",            label: "Unidad", defecto: "unidad", ayuda: "unidad, porcion, caja, docena" },
  { name: "cantidad_inicial",  label: "Cantidad producida", tipo: "number", paso: "0.01", defecto: 1 },
  { name: "cantidad_actual",   label: "Cantidad disponible", tipo: "number", paso: "0.01", defecto: 1 },
  { name: "fecha_produccion",  label: "Fecha de producción", tipo: "date", defecto: hoy },
  { name: "fecha_vencimiento", label: "Fecha de vencimiento", tipo: "date", requerido: true },
  { name: "costo_unitario",    label: "Costo unitario", tipo: "number", paso: "0.01", defecto: 0 },
  { name: "precio_venta",      label: "Precio de venta", tipo: "number", paso: "0.01", defecto: 0 },
  { name: "estado",            label: "Estado", tipo: "select", defecto: "disponible",
    opciones: ["disponible", "agotado", "vencido", "descartado"].map((e) => ({ value: e, label: e })) },
  { name: "notas",             label: "Notas", tipo: "textarea" },
];

function diasRestantes(v: string) {
  const d = Math.round((new Date(v + "T12:00:00").getTime() - Date.now()) / 86400000);
  return d;
}

const columnas: Columna[] = [
  { name: "nombre_lote", label: "Lote" },
  { name: "categoria",   label: "Categoría" },
  { name: "cantidad_actual", label: "Disponible", alinear: "right",
    fmt: (v, f) => `${Number(v ?? 0)} / ${Number(f.cantidad_inicial ?? 0)} ${f.unidad ?? ""}` },
  { name: "fecha_produccion",  label: "Producción",  fmt: (v) => fecha(v as string) },
  { name: "fecha_vencimiento", label: "Vence",       fmt: (v) => fecha(v as string) },
  { name: "dias", label: "Días", alinear: "right", fmt: (_v, f) => {
    const d = diasRestantes(String(f.fecha_vencimiento));
    const tono = d < 0 ? "err" : d <= 1 ? "err" : d <= 3 ? "warn" : "ok";
    return <Badge texto={d < 0 ? `vencido ${-d}d` : `${d} d`} tono={tono} />;
  } },
  { name: "precio_venta", label: "Precio", alinear: "right", fmt: (v) => RD(v as number) },
  { name: "estado", label: "Estado", fmt: (v) => (
    <Badge texto={String(v)} tono={v === "disponible" ? "ok" : v === "agotado" ? "neutro" : "err"} />
  ) },
];

export default function LotesPage() {
  return (
    <CrudPage
      titulo="Lotes de producción" icono="⏱️" ruta="/lotes"
      campos={campos} columnas={columnas} textoNuevo="Lote"
      filtros={[
        { name: "estado",    label: "Estado",    opciones: ["disponible", "agotado", "vencido", "descartado"].map((e) => ({ value: e, label: e })) },
        { name: "categoria", label: "Categoría", opciones: CATEGORIAS_LOTE.map((c) => ({ value: c, label: c })) },
      ]}
    />
  );
}
