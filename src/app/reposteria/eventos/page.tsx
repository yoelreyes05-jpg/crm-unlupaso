"use client";

import { useRouter } from "next/navigation";
import { Badge, CrudPage, RD, fecha, type Campo, type Columna } from "@/components/reposteria/ui";

const ESTADOS = ["cotizado", "confirmado", "en_preparacion", "entregado", "cerrado", "cancelado"];
const TIPOS    = ["cumpleanos", "boda", "baby_shower", "aniversario", "corporativo", "otro"];

const campos: Campo[] = [
  { name: "nombre_evento", label: "Nombre del evento", requerido: true, ancho: 2 },
  { name: "cliente_id",    label: "Cliente", tipo: "select",
    fuente: { ruta: "/clientes", etiqueta: (r) => `${r.nombre} ${r.apellido ?? ""}`.trim() } },
  { name: "tipo_evento",   label: "Tipo", tipo: "select", defecto: "otro",
    opciones: TIPOS.map((t) => ({ value: t, label: t.replace("_", " ") })) },
  { name: "fecha_evento",  label: "Fecha", tipo: "date", requerido: true },
  { name: "estado",        label: "Estado", tipo: "select", defecto: "cotizado",
    opciones: ESTADOS.map((e) => ({ value: e, label: e.replace("_", " ") })) },
  { name: "hora_inicio",   label: "Hora inicio", tipo: "time" },
  { name: "hora_fin",      label: "Hora fin", tipo: "time" },
  { name: "lugar",         label: "Lugar", ancho: 2 },
  { name: "num_invitados", label: "Invitados", tipo: "number" },
  { name: "descuento",     label: "Descuento", tipo: "number", paso: "0.01", defecto: 0 },
  { name: "deposito",      label: "Depósito recibido", tipo: "number", paso: "0.01", defecto: 0 },
  { name: "notas",         label: "Notas", tipo: "textarea" },
];

const tono: Record<string, string> = {
  cotizado: "info", confirmado: "ok", en_preparacion: "warn",
  entregado: "ok", cerrado: "neutro", cancelado: "err",
};

const columnas: Columna[] = [
  { name: "numero",        label: "N°" },
  { name: "nombre_evento", label: "Evento" },
  { name: "fecha_evento",  label: "Fecha", fmt: (v) => fecha(v as string) },
  { name: "lugar",         label: "Lugar" },
  { name: "num_invitados", label: "Inv.", alinear: "right" },
  { name: "total",         label: "Total",   alinear: "right", fmt: (v) => RD(v as number) },
  { name: "deposito",      label: "Depósito",alinear: "right", fmt: (v) => RD(v as number) },
  { name: "balance",       label: "Balance", alinear: "right", fmt: (v) => RD(v as number) },
  { name: "estado",        label: "Estado",  fmt: (v) => <Badge texto={String(v).replace("_", " ")} tono={tono[String(v)] ?? "neutro"} /> },
];

export default function EventosPage() {
  const router = useRouter();
  return (
    <CrudPage
      titulo="Eventos" icono="🎉" ruta="/eventos"
      campos={campos} columnas={columnas} textoNuevo="Evento"
      onFila={(f) => router.push(`/reposteria/eventos/${f.id}`)}
      filtros={[
        { name: "estado",      label: "Estado", opciones: ESTADOS.map((e) => ({ value: e, label: e.replace("_", " ") })) },
        { name: "tipo_evento", label: "Tipo",   opciones: TIPOS.map((t) => ({ value: t, label: t.replace("_", " ") })) },
      ]}
    />
  );
}
