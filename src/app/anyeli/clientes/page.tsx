"use client";

import Link from "next/link";
import { Badge, CrudPage, RD, T, fecha, type Campo, type Columna } from "@/components/anyeli/ui";
import { BarraContactos } from "@/components/anyeli/SelectorContacto";

const campos: Campo[] = [
  { name: "nombre",          label: "Nombre completo", requerido: true, ancho: 2 },
  { name: "cedula",          label: "Cédula", ayuda: "000-0000000-0" },
  { name: "telefono",        label: "Teléfono" },
  { name: "telefono2",       label: "Teléfono alterno" },
  { name: "email",           label: "Correo", tipo: "email" },
  { name: "direccion",       label: "Dirección", ancho: 2 },
  { name: "ocupacion",       label: "Ocupación" },
  { name: "lugar_trabajo",   label: "Lugar de trabajo" },
  { name: "ingreso_mensual", label: "Ingreso mensual", tipo: "number", paso: "0.01" },
  { name: "ref1_nombre",     label: "Referencia 1" },
  { name: "ref1_telefono",   label: "Teléfono ref. 1" },
  { name: "ref2_nombre",     label: "Referencia 2" },
  { name: "ref2_telefono",   label: "Teléfono ref. 2" },
  { name: "notas",           label: "Notas", tipo: "textarea" },
  { name: "activo",          label: "Activo", tipo: "checkbox", defecto: true, ayuda: "Cliente activo" },
];

const columnas: Columna[] = [
  { name: "codigo",    label: "Código", fmt: (v) => <span style={{ fontSize: 12, color: T.suave }}>{String(v)}</span> },
  { name: "nombre",    label: "Cliente", fmt: (v) => <strong>{String(v)}</strong> },
  { name: "cedula",    label: "Cédula" },
  { name: "telefono",  label: "Teléfono" },
  { name: "ocupacion", label: "Ocupación" },
  { name: "ingreso_mensual", label: "Ingreso", alinear: "right",
    fmt: (v) => (v ? RD(v as number) : "—") },
  { name: "created_at", label: "Alta", fmt: (v) => fecha(String(v)) },
  { name: "activo",     label: "Estado",
    fmt: (v) => <Badge texto={v ? "activo" : "inactivo"} tono={v ? "ok" : "neutro"} /> },
];

export default function ClientesPrestamos() {
  return (
    <CrudPage
      titulo="Clientes"
      icono="👤"
      ruta="/clientes"
      textoNuevo="Cliente"
      subtitulo="Personas a las que se les presta dinero"
      campos={campos}
      columnas={columnas}
      filtros={[
        { name: "activo", label: "Estado", opciones: [{ value: "true", label: "Activos" }, { value: "false", label: "Inactivos" }] },
      ]}
      encabezadoFormulario={(llenar) => (
        <BarraContactos
          botones={[
            {
              etiqueta: "Cliente",
              onElegir: (c) => llenar({
                nombre: c.nombre,
                telefono: c.telefono,
                telefono2: c.telefono2,
                email: c.email,
                direccion: c.direccion,
              }),
            },
            {
              etiqueta: "Referencia 1",
              onElegir: (c) => llenar({ ref1_nombre: c.nombre, ref1_telefono: c.telefono }),
            },
            {
              etiqueta: "Referencia 2",
              onElegir: (c) => llenar({ ref2_nombre: c.nombre, ref2_telefono: c.telefono }),
            },
          ]}
        />
      )}
      borrar={{
        query: "definitivo=1",
        etiqueta: "Eliminar",
        confirmar: (f) =>
          `¿Eliminar al cliente ${f.nombre}?\n\n` +
          "Se borra su ficha y TODO su historial: préstamos, cuotas, pagos, recibos\n" +
          "y el reparto de ganancias de esos préstamos.\n" +
          "No se puede recuperar.\n\n" +
          "Si todavía tiene un préstamo activo el sistema no lo dejará: primero\n" +
          "hay que terminar de cobrarlo o cancelarlo.",
        reintentar: {
          query: "forzar=1",
          confirmar: (mensaje) => `${mensaje}\n\n¿Continuar y borrarlo todo?`,
        },
      }}
      extraAcciones={(f) => (
        <Link
          href={`/anyeli/creditos/nuevo?cliente=${f.id}`}
          style={{ color: T.acento, fontSize: 12.5, fontWeight: 700, textDecoration: "none" }}
        >
          Prestar
        </Link>
      )}
    />
  );
}
