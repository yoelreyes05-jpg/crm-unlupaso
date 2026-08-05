"use client";

import { useRouter } from "next/navigation";
import { Badge, CrudPage, RD, type Campo, type Columna } from "@/components/reposteria/ui";

const campos: Campo[] = [
  { name: "nombre",             label: "Nombre de la receta", requerido: true },
  { name: "producto_id",        label: "Producto asociado", tipo: "select",
    fuente: { ruta: "/productos", etiqueta: (r) => String(r.nombre) } },
  { name: "rendimiento",        label: "Rendimiento", tipo: "number", paso: "0.001", defecto: 1,
    ayuda: "Cuántas unidades produce" },
  { name: "unidad_rendimiento", label: "Unidad del rendimiento", defecto: "unidad" },
  { name: "descripcion",        label: "Descripción", tipo: "textarea" },
  { name: "instrucciones",      label: "Instrucciones", tipo: "textarea" },
  { name: "activo",             label: "Activa", tipo: "checkbox", defecto: true },
];

const columnas: Columna[] = [
  { name: "nombre",           label: "Receta" },
  { name: "rendimiento",      label: "Rinde", alinear: "right",
    fmt: (v, f) => `${Number(v ?? 0)} ${f.unidad_rendimiento ?? ""}` },
  { name: "costo_total",      label: "Costo total", alinear: "right", fmt: (v) => RD(v as number) },
  { name: "costo_por_unidad", label: "Costo x unidad", alinear: "right", fmt: (v) => RD(v as number) },
  { name: "activo",           label: "Estado", fmt: (v) => <Badge texto={v ? "activa" : "inactiva"} tono={v ? "ok" : "neutro"} /> },
];

export default function RecetasPage() {
  const router = useRouter();
  return (
    <CrudPage
      titulo="Recetas" icono="📖" ruta="/recetas"
      campos={campos} columnas={columnas} textoNuevo="Receta"
      onFila={(f) => router.push(`/reposteria/recetas/${f.id}`)}
      filtros={[{ name: "activo", label: "Estado", opciones: [{ value: "true", label: "Activas" }, { value: "false", label: "Inactivas" }] }]}
    />
  );
}
