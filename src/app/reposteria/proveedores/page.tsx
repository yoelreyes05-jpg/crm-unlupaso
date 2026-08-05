"use client";

import { Badge, CrudPage, type Campo, type Columna } from "@/components/reposteria/ui";

const campos: Campo[] = [
  { name: "nombre",    label: "Nombre",   requerido: true },
  { name: "contacto",  label: "Contacto" },
  { name: "telefono",  label: "Teléfono" },
  { name: "email",     label: "Email", tipo: "email" },
  { name: "rnc",       label: "RNC" },
  { name: "categoria", label: "Categoría", ayuda: "Ej: ingredientes, empaques, alquiler" },
  { name: "direccion", label: "Dirección", ancho: 2 },
  { name: "notas",     label: "Notas", tipo: "textarea" },
  { name: "activo",    label: "Activo", tipo: "checkbox", defecto: true },
];

const columnas: Columna[] = [
  { name: "nombre",    label: "Proveedor" },
  { name: "contacto",  label: "Contacto" },
  { name: "telefono",  label: "Teléfono" },
  { name: "rnc",       label: "RNC" },
  { name: "categoria", label: "Categoría" },
  { name: "activo",    label: "Estado", fmt: (v) => <Badge texto={v ? "activo" : "inactivo"} tono={v ? "ok" : "neutro"} /> },
];

export default function ProveedoresPage() {
  return (
    <CrudPage
      titulo="Proveedores" icono="🚚" ruta="/proveedores"
      campos={campos} columnas={columnas} textoNuevo="Proveedor"
      filtros={[{ name: "activo", label: "Estado", opciones: [{ value: "true", label: "Activos" }, { value: "false", label: "Inactivos" }] }]}
    />
  );
}
