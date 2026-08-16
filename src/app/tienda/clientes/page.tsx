"use client";

import { Badge, CrudPage, RD, T, fecha, type Campo, type Columna } from "@/components/tienda/ui";
import { BarraContactos } from "@/components/tienda/SelectorContacto";

/** Clientes de MAXMATT SHOP — independientes de los del sistema de préstamos. */

const campos: Campo[] = [
  { name: "nombre",     label: "Nombre o razón social", requerido: true, ancho: 2 },
  { name: "tipo",       label: "Tipo", tipo: "select", defecto: "persona",
    opciones: [{ value: "persona", label: "Persona" }, { value: "empresa", label: "Empresa" }] },
  { name: "cedula_rnc", label: "Cédula / RNC" },
  { name: "telefono",   label: "Teléfono" },
  { name: "telefono2",  label: "Teléfono alterno" },
  { name: "email",      label: "Correo", tipo: "email" },
  { name: "direccion",  label: "Dirección", ancho: 2 },
  { name: "permite_credito", label: "Crédito", tipo: "checkbox", defecto: false,
    ayuda: "Puede llevarse mercancía a crédito" },
  { name: "limite_credito", label: "Límite de crédito", tipo: "number", paso: "0.01", defecto: 0,
    visible: (v) => !!v.permite_credito },
  { name: "dias_credito", label: "Días de plazo", tipo: "number", defecto: 30,
    visible: (v) => !!v.permite_credito },
  { name: "notas",  label: "Notas", tipo: "textarea" },
  { name: "activo", label: "Activo", tipo: "checkbox", defecto: true, ayuda: "Cliente activo" },
];

const columnas: Columna[] = [
  { name: "codigo", label: "Código", fmt: (v) => <span style={{ fontSize: 12, color: T.suave }}>{String(v)}</span> },
  { name: "nombre", label: "Cliente", fmt: (v, f) => (
    <div>
      <strong>{String(v)}</strong>
      {f.telefono ? <div style={{ fontSize: 11, color: T.suave }}>{String(f.telefono)}</div> : null}
    </div>
  ) },
  { name: "cedula_rnc", label: "Cédula / RNC" },
  { name: "tipo", label: "Tipo",
    fmt: (v) => <Badge texto={String(v)} tono={v === "empresa" ? "info" : "neutro"} /> },
  { name: "compras_realizadas", label: "Compras", alinear: "right" },
  { name: "total_comprado", label: "Total comprado", alinear: "right", fmt: (v) => RD(v as number) },
  { name: "saldo_pendiente", label: "Le debe", alinear: "right",
    fmt: (v, f) => Number(v) > 0
      ? <strong style={{ color: Number(f.saldo_vencido) > 0 ? T.err : T.texto }}>{RD(v as number)}</strong>
      : "—" },
  { name: "credito_disponible", label: "Crédito disp.", alinear: "right",
    fmt: (v, f) => f.permite_credito ? RD(v as number) : <span style={{ color: T.suave }}>sin crédito</span> },
  { name: "ultima_compra", label: "Última compra", fmt: (v) => v ? fecha(v as string) : "—" },
  { name: "activo", label: "Estado",
    fmt: (v) => <Badge texto={v ? "activo" : "inactivo"} tono={v ? "ok" : "neutro"} /> },
];

export default function ClientesTienda() {
  return (
    <CrudPage
      titulo="Clientes"
      icono="👤"
      ruta="/clientes"
      textoNuevo="Cliente"
      subtitulo="Clientes de la tienda, separados de los del sistema de préstamos"
      campos={campos}
      columnas={columnas}
      filaRoja={(f) => Number(f.saldo_vencido) > 0}
      encabezadoFormulario={(llenar) => (
        <BarraContactos
          botones={[
            {
              etiqueta: "Traer de la agenda",
              onElegir: (c) => llenar({
                nombre: c.nombre,
                telefono: c.telefono,
                telefono2: c.telefono2,
                email: c.email,
                direccion: c.direccion,
              }),
            },
          ]}
        />
      )}
      filtros={[
        { name: "tipo", label: "Tipo", opciones: [{ value: "persona", label: "Persona" }, { value: "empresa", label: "Empresa" }] },
        { name: "activo", label: "Estado", opciones: [{ value: "true", label: "Activos" }, { value: "false", label: "Inactivos" }] },
      ]}
    />
  );
}
