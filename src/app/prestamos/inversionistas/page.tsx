"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Aviso, Badge, Btn, CrudPage, Etiqueta, Kpi, Modal, PCT, RD, T,
  api, hoyISO, inputBase, rejilla, type Campo, type Columna,
} from "@/components/prestamos/ui";

const campos: Campo[] = [
  { name: "nombre",    label: "Nombre completo", requerido: true, ancho: 2 },
  { name: "cedula",    label: "Cédula" },
  { name: "telefono",  label: "Teléfono" },
  { name: "email",     label: "Correo", tipo: "email" },
  { name: "direccion", label: "Dirección" },
  {
    name: "modo_reparto_default", label: "Modo de reparto", tipo: "select", defecto: "tasa",
    opciones: [
      { value: "tasa", label: "Tasa pactada al inversionista" },
      { value: "porcentaje", label: "Porcentaje del interés" },
    ],
    ayuda: "Cómo se le paga su parte del interés",
  },
  {
    name: "tasa_default", label: "Su tasa mensual (%)", tipo: "number", paso: "0.1", defecto: 12,
    visible: (v) => (v.modo_reparto_default ?? "tasa") === "tasa",
    ayuda: "Ej. 8, 10, 12, 15… Lo que sobre de la tasa del cliente queda para el administrador",
  },
  {
    name: "porcentaje_default", label: "% del interés para él", tipo: "number", paso: "0.1", defecto: 60,
    visible: (v) => v.modo_reparto_default === "porcentaje",
    ayuda: "Ej. 70 significa que se lleva el 70 % del interés generado",
  },
  { name: "notas",  label: "Notas", tipo: "textarea" },
  { name: "activo", label: "Activo", tipo: "checkbox", defecto: true, ayuda: "Inversionista activo" },
];

const columnas: Columna[] = [
  { name: "codigo", label: "Código", fmt: (v) => <span style={{ fontSize: 12, color: T.suave }}>{String(v)}</span> },
  { name: "nombre", label: "Inversionista",
    fmt: (v, f) => (
      <Link href={`/prestamos/inversionistas/${f.id}`} style={{ color: T.texto, fontWeight: 700, textDecoration: "none" }}>
        {String(v)}
      </Link>
    ) },
  { name: "modo_reparto_default", label: "Reparto pactado",
    fmt: (v, f) => v === "tasa"
      ? <Badge texto={`${PCT(f.tasa_default as number, 1)} mensual`} tono="acento" />
      : <Badge texto={`${PCT(f.porcentaje_default as number, 1)} del interés`} tono="info" /> },
  { name: "aportes",            label: "Aportes",       alinear: "right", fmt: (v) => RD(v as number) },
  { name: "capital_en_calle",   label: "En la calle",   alinear: "right", fmt: (v) => <strong>{RD(v as number)}</strong> },
  { name: "capital_disponible", label: "Disponible",    alinear: "right", fmt: (v) => RD(v as number) },
  { name: "interes_ganado",     label: "Interés ganado", alinear: "right",
    fmt: (v) => <strong style={{ color: T.ok }}>{RD(v as number)}</strong> },
  { name: "prestamos_activos",  label: "Préstamos", alinear: "right" },
];

export default function InversionistasPage() {
  const [mov, setMov] = useState<Record<string, unknown> | null>(null);
  const [form, setForm] = useState({ tipo: "aporte", monto: "", fecha: hoyISO(), descripcion: "" });
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [recarga, setRecarga] = useState<(() => void) | null>(null);

  async function guardarMov() {
    if (!mov) return;
    setGuardando(true); setError("");
    try {
      await api("/movimientos", {
        metodo: "POST",
        body: {
          inversionista_id: mov.id,
          tipo: form.tipo,
          monto: Number(form.monto),
          fecha: form.fecha,
          descripcion: form.descripcion || null,
        },
      });
      setMov(null);
      setForm({ tipo: "aporte", monto: "", fecha: hoyISO(), descripcion: "" });
      recarga?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo registrar");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <>
      <CrudPage
        titulo="Inversionistas"
        icono="⭐"
        ruta="/inversionistas"
        textoNuevo="Inversionista"
        subtitulo="Quienes ponen el capital. El administrador coloca y comparte el interés."
        campos={campos}
        columnas={columnas}
        filtros={[
          { name: "activo", label: "Estado", opciones: [{ value: "true", label: "Activos" }, { value: "false", label: "Inactivos" }] },
        ]}
        encabezado={(filas) => {
          const t = filas.reduce(
            (a: { calle: number; ganado: number; disp: number }, i) => ({
              calle: a.calle + Number(i.capital_en_calle ?? 0),
              ganado: a.ganado + Number(i.interes_ganado ?? 0),
              disp: a.disp + Number(i.capital_disponible ?? 0),
            }),
            { calle: 0, ganado: 0, disp: 0 }
          );
          return (
            <div style={rejilla(215)}>
              <Kpi titulo="Capital en la calle" valor={RD(t.calle)} tono="acento" />
              <Kpi titulo="Interés ganado (total)" valor={RD(t.ganado)} tono="ok" />
              <Kpi titulo="Capital disponible" valor={RD(t.disp)}
                   detalle="Aportes − retiros − colocado + recuperado" />
            </div>
          );
        }}
        extraAcciones={(f, recargar) => (
          <button
            onClick={() => { setMov(f); setRecarga(() => recargar); }}
            style={{ background: "transparent", border: "none", color: T.acento, cursor: "pointer", fontSize: 12.5, fontWeight: 700 }}
          >
            Movimiento
          </button>
        )}
      />

      <Modal
        abierto={!!mov}
        titulo={`Movimiento de caja · ${mov?.nombre ?? ""}`}
        onCerrar={() => setMov(null)}
        ancho={480}
        pie={
          <>
            <Btn tono="neutro" onClick={() => setMov(null)}>Cancelar</Btn>
            <Btn onClick={guardarMov} disabled={guardando || !Number(form.monto)}>
              {guardando ? "Guardando…" : "Registrar"}
            </Btn>
          </>
        }
      >
        {error && <Aviso texto={error} />}
        <div style={{ display: "grid", gap: 13 }}>
          <div>
            <Etiqueta>Tipo</Etiqueta>
            <select style={inputBase} value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
              <option value="aporte">Aporte de capital</option>
              <option value="retiro">Retiro de capital</option>
              <option value="retiro_ganancia">Retiro de ganancias</option>
              <option value="ajuste">Ajuste</option>
            </select>
          </div>
          <div>
            <Etiqueta>Monto</Etiqueta>
            <input type="number" step="0.01" style={inputBase} value={form.monto}
                   onChange={(e) => setForm({ ...form, monto: e.target.value })} />
          </div>
          <div>
            <Etiqueta>Fecha</Etiqueta>
            <input type="date" style={inputBase} value={form.fecha}
                   onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
          </div>
          <div>
            <Etiqueta>Descripción</Etiqueta>
            <input style={inputBase} value={form.descripcion}
                   onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
          </div>
        </div>
      </Modal>
    </>
  );
}
