"use client";

import { useRouter } from "next/navigation";
import { Badge, CrudPage, RD, fecha, type Campo, type Columna } from "@/components/reposteria/ui";
import { NCF_TIPOS } from "@/types/reposteria";

const ESTADOS = ["pendiente", "parcial", "pagada", "vencida", "anulada"];
const hoy = new Date().toISOString().slice(0, 10);

const campos: Campo[] = [
  { name: "cliente_id",        label: "Cliente", tipo: "select",
    fuente: { ruta: "/clientes", etiqueta: (r) => `${r.nombre} ${r.apellido ?? ""}`.trim() } },
  { name: "evento_id",         label: "Evento", tipo: "select",
    fuente: { ruta: "/eventos", etiqueta: (r) => `${r.numero ?? ""} ${r.nombre_evento}`.trim() } },
  { name: "fecha_emision",     label: "Fecha de emisión", tipo: "date", defecto: hoy },
  { name: "fecha_vencimiento", label: "Vencimiento", tipo: "date" },
  { name: "tipo",              label: "Tipo", tipo: "select", defecto: "contado",
    opciones: [{ value: "contado", label: "Contado" }, { value: "credito", label: "Crédito" }] },
  { name: "ncf_tipo",          label: "Tipo de NCF", tipo: "select", defecto: "B02",
    opciones: NCF_TIPOS.map((n) => ({ value: n.key, label: `${n.key} — ${n.desc}` })) },
  { name: "descuento",         label: "Descuento", tipo: "number", paso: "0.01", defecto: 0 },
  { name: "estado",            label: "Estado", tipo: "select", defecto: "pendiente",
    opciones: ESTADOS.map((e) => ({ value: e, label: e })) },
  { name: "notas",             label: "Notas", tipo: "textarea" },
];

const tono: Record<string, string> = {
  pendiente: "warn", parcial: "info", pagada: "ok", vencida: "err", anulada: "neutro",
};

const columnas: Columna[] = [
  { name: "numero",        label: "N°" },
  { name: "ncf",           label: "NCF" },
  { name: "fecha_emision", label: "Emisión", fmt: (v) => fecha(v as string) },
  { name: "fecha_vencimiento", label: "Vence", fmt: (v) => fecha(v as string) },
  { name: "total",         label: "Total",   alinear: "right", fmt: (v) => RD(v as number) },
  { name: "monto_pagado",  label: "Pagado",  alinear: "right", fmt: (v) => RD(v as number) },
  { name: "balance",       label: "Balance", alinear: "right", fmt: (v) => RD(v as number) },
  { name: "estado",        label: "Estado",  fmt: (v) => <Badge texto={String(v)} tono={tono[String(v)] ?? "neutro"} /> },
];

export default function FacturasPage() {
  const router = useRouter();
  return (
    <CrudPage
      titulo="Facturación" icono="🧾" ruta="/facturas"
      campos={campos} columnas={columnas} textoNuevo="Factura"
      onFila={(f) => router.push(`/reposteria/facturas/${f.id}`)}
      filtros={[
        { name: "estado", label: "Estado", opciones: ESTADOS.map((e) => ({ value: e, label: e })) },
        { name: "tipo",   label: "Tipo",   opciones: [{ value: "contado", label: "Contado" }, { value: "credito", label: "Crédito" }] },
      ]}
    />
  );
}
