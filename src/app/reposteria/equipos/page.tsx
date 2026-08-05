"use client";

import { Badge, CrudPage, RD, type Campo, type Columna } from "@/components/reposteria/ui";
import { CATEGORIAS_EQUIPO } from "@/types/reposteria";

const ESTADOS = ["disponible", "alquilado", "mantenimiento", "danado", "baja"];

const campos: Campo[] = [
  { name: "nombre",           label: "Equipo", requerido: true },
  { name: "categoria",        label: "Categoría", tipo: "select", defecto: "general",
    opciones: CATEGORIAS_EQUIPO.map((c) => ({ value: c, label: c })) },
  { name: "codigo",           label: "Código" },
  { name: "cantidad_total",   label: "Cantidad total", tipo: "number", defecto: 1 },
  { name: "precio_alquiler",  label: "Precio de alquiler / día", tipo: "number", paso: "0.01", defecto: 0 },
  { name: "costo_reposicion", label: "Costo de reposición", tipo: "number", paso: "0.01", defecto: 0 },
  { name: "estado",           label: "Estado", tipo: "select", defecto: "disponible",
    opciones: ESTADOS.map((e) => ({ value: e, label: e })) },
  { name: "descripcion",      label: "Descripción", tipo: "textarea" },
  { name: "notas",            label: "Notas", tipo: "textarea" },
  { name: "activo",           label: "Activo", tipo: "checkbox", defecto: true },
];

const columnas: Columna[] = [
  { name: "nombre",           label: "Equipo" },
  { name: "categoria",        label: "Categoría" },
  { name: "codigo",           label: "Código" },
  { name: "cantidad_total",   label: "Cantidad", alinear: "right" },
  { name: "precio_alquiler",  label: "Alquiler/día", alinear: "right", fmt: (v) => RD(v as number) },
  { name: "costo_reposicion", label: "Reposición",   alinear: "right", fmt: (v) => RD(v as number) },
  { name: "estado", label: "Estado", fmt: (v) => (
    <Badge texto={String(v)} tono={v === "disponible" ? "ok" : v === "alquilado" ? "info" : v === "mantenimiento" ? "warn" : "err"} />
  ) },
];

export default function EquiposPage() {
  return (
    <CrudPage
      titulo="Equipos de alquiler" icono="🪑" ruta="/equipos"
      campos={campos} columnas={columnas} textoNuevo="Equipo"
      filtros={[
        { name: "estado",    label: "Estado",    opciones: ESTADOS.map((e) => ({ value: e, label: e })) },
        { name: "categoria", label: "Categoría", opciones: CATEGORIAS_EQUIPO.map((c) => ({ value: c, label: c })) },
        { name: "activo",    label: "Activo",    opciones: [{ value: "true", label: "Activos" }, { value: "false", label: "Inactivos" }] },
      ]}
    />
  );
}
