"use client";

import { Badge, CrudPage, T, type Campo, type Columna } from "@/components/tienda/ui";
import { BarraContactos } from "@/components/tienda/SelectorContacto";

const campos: Campo[] = [
  { name: "nombre",       label: "Nombre del proveedor", requerido: true, ancho: 2 },
  { name: "contacto",     label: "Persona de contacto" },
  { name: "rnc",          label: "RNC" },
  { name: "telefono",     label: "Teléfono" },
  { name: "email",        label: "Correo", tipo: "email" },
  { name: "categoria",    label: "Categoría", ayuda: "Ej.: accesorios, ropa, tecnología" },
  { name: "dias_credito", label: "Días de plazo que te da", tipo: "number", defecto: 30 },
  { name: "direccion",    label: "Dirección", ancho: 2 },
  { name: "notas",        label: "Notas", tipo: "textarea" },
  { name: "activo",       label: "Activo", tipo: "checkbox", defecto: true, ayuda: "Proveedor activo" },
];

const columnas: Columna[] = [
  { name: "codigo",   label: "Código", fmt: (v) => <span style={{ fontSize: 12, color: T.suave }}>{String(v)}</span> },
  { name: "nombre",   label: "Proveedor", fmt: (v) => <strong>{String(v)}</strong> },
  { name: "contacto", label: "Contacto" },
  { name: "telefono", label: "Teléfono" },
  { name: "rnc",      label: "RNC" },
  { name: "categoria",label: "Categoría" },
  { name: "dias_credito", label: "Plazo", alinear: "right", fmt: (v) => `${v} días` },
  { name: "activo",   label: "Estado",
    fmt: (v) => <Badge texto={v ? "activo" : "inactivo"} tono={v ? "ok" : "neutro"} /> },
];

export default function ProveedoresTienda() {
  return (
    <CrudPage
      titulo="Proveedores"
      icono="🚚"
      ruta="/proveedores"
      textoNuevo="Proveedor"
      subtitulo="A quién le compras la mercancía"
      campos={campos}
      columnas={columnas}
      filtros={[
        { name: "activo", label: "Estado", opciones: [{ value: "true", label: "Activos" }, { value: "false", label: "Inactivos" }] },
      ]}
      encabezadoFormulario={(llenar) => (
        <BarraContactos
          botones={[
            {
              etiqueta: "Datos del proveedor",
              onElegir: (c) => llenar({
                nombre: c.nombre,
                telefono: c.telefono,
                email: c.email,
                direccion: c.direccion,
              }),
            },
            {
              etiqueta: "Persona de contacto",
              onElegir: (c) => llenar({ contacto: c.nombre, telefono: c.telefono }),
            },
          ]}
        />
      )}
    />
  );
}
