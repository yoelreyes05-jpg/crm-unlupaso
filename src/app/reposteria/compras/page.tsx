"use client";

import { CrudPage, RD, fecha, type Campo, type Columna } from "@/components/reposteria/ui";

const hoy = new Date().toISOString().slice(0, 10);

const campos: Campo[] = [
  { name: "ingrediente_id",    label: "Ingrediente", tipo: "select", requerido: true,
    fuente: { ruta: "/ingredientes", etiqueta: (r) => `${r.nombre} (${r.unidad})` } },
  { name: "proveedor_id",      label: "Proveedor", tipo: "select",
    fuente: { ruta: "/proveedores", etiqueta: (r) => String(r.nombre) } },
  { name: "cantidad",          label: "Cantidad", tipo: "number", paso: "0.001", requerido: true },
  { name: "unidad",            label: "Unidad", defecto: "unidad" },
  { name: "costo_unitario",    label: "Costo unitario", tipo: "number", paso: "0.01", defecto: 0 },
  { name: "fecha_compra",      label: "Fecha de compra", tipo: "date", defecto: hoy },
  { name: "fecha_vencimiento", label: "Vencimiento (FEFO)", tipo: "date",
    ayuda: "Se usa para consumir primero lo que vence antes" },
  { name: "numero_lote",       label: "Número de lote" },
  { name: "factura_ref",       label: "Factura / referencia" },
  { name: "notas",             label: "Notas", tipo: "textarea" },
];

const columnas: Columna[] = [
  { name: "fecha_compra",      label: "Fecha", fmt: (v) => fecha(v as string) },
  { name: "numero_lote",       label: "Lote / referencia", fmt: (v, f) => String(v ?? f.factura_ref ?? "—") },
  { name: "cantidad",          label: "Cantidad", alinear: "right", fmt: (v, f) => `${Number(v ?? 0)} ${f.unidad ?? ""}` },
  { name: "costo_unitario",    label: "Costo unit.", alinear: "right", fmt: (v) => RD(v as number) },
  { name: "total",             label: "Total", alinear: "right",
    fmt: (_v, f) => RD(Number(f.cantidad ?? 0) * Number(f.costo_unitario ?? 0)) },
  { name: "fecha_vencimiento", label: "Vence", fmt: (v) => fecha(v as string) },
  { name: "cantidad_restante", label: "Restante", alinear: "right" },
];

export default function ComprasPage() {
  return (
    <CrudPage
      titulo="Compras de ingredientes" icono="🛒" ruta="/compras"
      campos={campos} columnas={columnas} textoNuevo="Compra" buscar={false}
    />
  );
}
