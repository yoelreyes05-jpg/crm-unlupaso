"use client";

import { useState } from "react";
import {
  api, Aviso, Badge, Btn, CrudPage, Etiqueta, Modal, RD, fecha, inputBase,
  type Campo, type Columna,
} from "@/components/reposteria/ui";
import { METODOS_PAGO } from "@/types/reposteria";

const ESTADOS = ["pendiente", "parcial", "pagada", "vencida", "anulada"];
const hoy = new Date().toISOString().slice(0, 10);

const campos: Campo[] = [
  { name: "descripcion",       label: "Descripción", requerido: true, ancho: 2 },
  { name: "proveedor_id",      label: "Proveedor", tipo: "select",
    fuente: { ruta: "/proveedores", etiqueta: (r) => String(r.nombre) } },
  { name: "numero_factura",    label: "N° de factura del proveedor" },
  { name: "monto_total",       label: "Monto total", tipo: "number", paso: "0.01", requerido: true },
  { name: "categoria",         label: "Categoría", ayuda: "ingredientes, alquiler, servicios…" },
  { name: "fecha_emision",     label: "Fecha de emisión", tipo: "date", defecto: hoy },
  { name: "fecha_vencimiento", label: "Vencimiento", tipo: "date" },
  { name: "estado",            label: "Estado", tipo: "select", defecto: "pendiente",
    opciones: ESTADOS.map((e) => ({ value: e, label: e })) },
  { name: "notas",             label: "Notas", tipo: "textarea" },
];

const tono: Record<string, string> = {
  pendiente: "warn", parcial: "info", pagada: "ok", vencida: "err", anulada: "neutro",
};

const columnas: Columna[] = [
  { name: "descripcion",       label: "Descripción" },
  { name: "numero_factura",    label: "N° factura" },
  { name: "fecha_vencimiento", label: "Vence", fmt: (v) => fecha(v as string) },
  { name: "monto_total",       label: "Total",   alinear: "right", fmt: (v) => RD(v as number) },
  { name: "monto_pagado",      label: "Pagado",  alinear: "right", fmt: (v) => RD(v as number) },
  { name: "balance",           label: "Balance", alinear: "right", fmt: (v) => RD(v as number) },
  { name: "estado",            label: "Estado",  fmt: (v) => <Badge texto={String(v)} tono={tono[String(v)] ?? "neutro"} /> },
];

export default function CuentasPagarPage() {
  const [cuenta, setCuenta]   = useState<Record<string, unknown> | null>(null);
  const [recargar, setRec]    = useState<(() => void) | null>(null);
  const [error, setError]     = useState("");
  const [pago, setPago]       = useState({ monto: "", metodo: "TRANSFERENCIA", referencia: "", fecha: hoy });

  async function registrar() {
    if (!cuenta || !pago.monto) { setError("Indica el monto"); return; }
    try {
      await api("/cuentas-pagar-pagos", {
        metodo: "POST",
        body: {
          cuenta_pagar_id: cuenta.id,
          monto: Number(pago.monto),
          metodo: pago.metodo,
          referencia: pago.referencia || null,
          fecha: pago.fecha,
        },
      });
      setCuenta(null);
      setPago({ monto: "", metodo: "TRANSFERENCIA", referencia: "", fecha: hoy });
      setError("");
      recargar?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al registrar el pago");
    }
  }

  return (
    <>
      <CrudPage
        titulo="Cuentas por pagar" icono="📤" ruta="/cuentas-pagar"
        campos={campos} columnas={columnas} textoNuevo="Cuenta"
        filtros={[{ name: "estado", label: "Estado", opciones: ESTADOS.map((e) => ({ value: e, label: e })) }]}
        extraAcciones={(f, rec) => (
          <Btn tono="ok" style={{ padding: "5px 10px", fontSize: 12 }}
            onClick={() => { setCuenta(f); setRec(() => rec); setPago((p) => ({ ...p, monto: String(f.balance ?? "") })); }}>
            Pagar
          </Btn>
        )}
      />

      <Modal abierto={Boolean(cuenta)} titulo="Registrar pago a proveedor" onCerrar={() => setCuenta(null)} ancho={520}>
        {error && <Aviso texto={error} />}
        <div style={{ marginBottom: 14, fontSize: 13.5 }}>
          <strong>{String(cuenta?.descripcion ?? "")}</strong>
          <div style={{ color: "#94a3b8", marginTop: 4 }}>Balance actual: {RD(Number(cuenta?.balance ?? 0))}</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <Etiqueta>Monto</Etiqueta>
            <input type="number" step="0.01" value={pago.monto}
              onChange={(e) => setPago((p) => ({ ...p, monto: e.target.value }))} style={inputBase} />
          </div>
          <div>
            <Etiqueta>Método</Etiqueta>
            <select value={pago.metodo} onChange={(e) => setPago((p) => ({ ...p, metodo: e.target.value }))} style={inputBase}>
              {METODOS_PAGO.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <Etiqueta>Referencia</Etiqueta>
            <input value={pago.referencia} onChange={(e) => setPago((p) => ({ ...p, referencia: e.target.value }))} style={inputBase} />
          </div>
          <div>
            <Etiqueta>Fecha</Etiqueta>
            <input type="date" value={pago.fecha} onChange={(e) => setPago((p) => ({ ...p, fecha: e.target.value }))} style={inputBase} />
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
          <Btn tono="neutro" onClick={() => setCuenta(null)}>Cancelar</Btn>
          <Btn tono="ok" onClick={registrar}>Registrar pago</Btn>
        </div>
      </Modal>
    </>
  );
}
