"use client";

import { useRouter } from "next/navigation";
import { Badge, CrudPage, RD, fecha, type Campo, type Columna } from "@/components/reposteria/ui";

const ESTADOS = ["borrador", "enviada", "aceptada", "rechazada", "vencida"];
const hoy = new Date().toISOString().slice(0, 10);

const campos: Campo[] = [
  { name: "cliente_id",        label: "Cliente", tipo: "select",
    fuente: { ruta: "/clientes", etiqueta: (r) => `${r.nombre} ${r.apellido ?? ""}`.trim() } },
  { name: "evento_id",         label: "Evento asociado", tipo: "select",
    fuente: { ruta: "/eventos", etiqueta: (r) => `${r.numero ?? ""} ${r.nombre_evento}`.trim() } },
  { name: "fecha",             label: "Fecha", tipo: "date", defecto: hoy },
  { name: "fecha_vencimiento", label: "Válida hasta", tipo: "date" },
  { name: "estado",            label: "Estado", tipo: "select", defecto: "borrador",
    opciones: ESTADOS.map((e) => ({ value: e, label: e })) },
  { name: "descuento",         label: "Descuento", tipo: "number", paso: "0.01", defecto: 0 },
  { name: "condiciones",       label: "Condiciones", tipo: "textarea" },
  { name: "notas",             label: "Notas", tipo: "textarea" },
];

const tono: Record<string, string> = {
  borrador: "neutro", enviada: "info", aceptada: "ok", rechazada: "err", vencida: "warn",
};

const columnas: Columna[] = [
  { name: "numero",            label: "N°" },
  { name: "fecha",             label: "Fecha", fmt: (v) => fecha(v as string) },
  { name: "fecha_vencimiento", label: "Vence", fmt: (v) => fecha(v as string) },
  { name: "subtotal",          label: "Subtotal", alinear: "right", fmt: (v) => RD(v as number) },
  { name: "itbis",             label: "ITBIS",    alinear: "right", fmt: (v) => RD(v as number) },
  { name: "total",             label: "Total",    alinear: "right", fmt: (v) => RD(v as number) },
  { name: "estado",            label: "Estado",   fmt: (v) => <Badge texto={String(v)} tono={tono[String(v)] ?? "neutro"} /> },
];

export default function CotizacionesPage() {
  const router = useRouter();
  return (
    <CrudPage
      titulo="Cotizaciones" icono="💬" ruta="/cotizaciones"
      campos={campos} columnas={columnas} textoNuevo="Cotización"
      onFila={(f) => router.push(`/reposteria/cotizaciones/${f.id}`)}
      filtros={[{ name: "estado", label: "Estado", opciones: ESTADOS.map((e) => ({ value: e, label: e })) }]}
    />
  );
}
