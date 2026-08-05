"use client";

import { Badge, CrudPage, type Campo, type Columna } from "@/components/reposteria/ui";

const campos: Campo[] = [
  { name: "nombre",     label: "Nombre",   requerido: true },
  { name: "apellido",   label: "Apellido" },
  { name: "telefono",   label: "Teléfono" },
  { name: "email",      label: "Email", tipo: "email" },
  { name: "cedula_rnc", label: "Cédula / RNC" },
  { name: "tipo",       label: "Tipo", tipo: "select", defecto: "persona",
    opciones: [{ value: "persona", label: "Persona" }, { value: "empresa", label: "Empresa" }] },
  { name: "direccion",  label: "Dirección", ancho: 2 },
  { name: "notas",      label: "Notas", tipo: "textarea" },
  { name: "activo",     label: "Activo", tipo: "checkbox", defecto: true, ayuda: "Cliente activo" },
];

const columnas: Columna[] = [
  { name: "nombre", label: "Cliente", fmt: (_v, f) => `${f.nombre ?? ""} ${f.apellido ?? ""}`.trim() },
  { name: "telefono",   label: "Teléfono" },
  { name: "email",      label: "Email" },
  { name: "cedula_rnc", label: "Cédula / RNC" },
  { name: "tipo",       label: "Tipo", fmt: (v) => <Badge texto={String(v)} tono={v === "empresa" ? "info" : "neutro"} /> },
  { name: "activo",     label: "Estado", fmt: (v) => <Badge texto={v ? "activo" : "inactivo"} tono={v ? "ok" : "neutro"} /> },
];

export default function ClientesPage() {
  return (
    <CrudPage
      titulo="Clientes" icono="👥" ruta="/clientes"
      campos={campos} columnas={columnas} textoNuevo="Cliente"
      filtros={[
        { name: "tipo",   label: "Tipo",   opciones: [{ value: "persona", label: "Persona" }, { value: "empresa", label: "Empresa" }] },
        { name: "activo", label: "Estado", opciones: [{ value: "true", label: "Activos" }, { value: "false", label: "Inactivos" }] },
      ]}
    />
  );
}
