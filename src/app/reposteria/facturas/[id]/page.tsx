"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import LineasEditor from "@/components/reposteria/Lineas";
import {
  api, Aviso, Badge, Btn, Card, Etiqueta, iconBtn, inputBase, RD, T, Tabla, fecha,
} from "@/components/reposteria/ui";
import { METODOS_PAGO } from "@/types/reposteria";
import type { RepCliente, RepFactura, RepPago } from "@/types/reposteria";

const tono: Record<string, string> = {
  pendiente: "warn", parcial: "info", pagada: "ok", vencida: "err", anulada: "neutro",
};

export default function FacturaDetalle() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [f, setF]             = useState<RepFactura | null>(null);
  const [cliente, setCliente] = useState<RepCliente | null>(null);
  const [pagos, setPagos]     = useState<RepPago[]>([]);
  const [error, setError]     = useState("");
  const [ocupado, setOcupado] = useState(false);

  const [pago, setPago] = useState({
    monto: "", metodo: "EFECTIVO", referencia: "",
    fecha: new Date().toISOString().slice(0, 10),
  });

  const cargar = useCallback(async () => {
    try {
      const r = await api<{ data: RepFactura }>(`/facturas/${id}`);
      setF(r.data);
      const p = await api<{ data: RepPago[] }>(`/pagos?factura_id=${id}`);
      setPagos(p.data ?? []);
      if (r.data.cliente_id) {
        const c = await api<{ data: RepCliente }>(`/clientes/${r.data.cliente_id}`);
        setCliente(c.data);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar la factura");
    }
  }, [id]);

  useEffect(() => { void cargar(); }, [cargar]);

  async function registrarPago() {
    if (!pago.monto || Number(pago.monto) <= 0) { setError("Indica el monto del pago"); return; }
    setOcupado(true);
    try {
      await api("/pagos", {
        metodo: "POST",
        body: {
          factura_id: id,
          cliente_id: f?.cliente_id ?? null,
          evento_id: f?.evento_id ?? null,
          monto: Number(pago.monto),
          metodo: pago.metodo,
          referencia: pago.referencia || null,
          fecha: pago.fecha,
        },
      });
      setPago({ monto: "", metodo: "EFECTIVO", referencia: "", fecha: new Date().toISOString().slice(0, 10) });
      setError("");
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al registrar el pago");
    } finally { setOcupado(false); }
  }

  async function borrarPago(pid: string) {
    if (!confirm("¿Eliminar este pago?")) return;
    try { await api(`/pagos/${pid}`, { metodo: "DELETE" }); await cargar(); }
    catch (e) { setError(e instanceof Error ? e.message : "Error al eliminar el pago"); }
  }

  async function anular() {
    if (!confirm("¿Anular esta factura?")) return;
    try { await api(`/facturas/${id}`, { metodo: "PATCH", body: { estado: "anulada" } }); await cargar(); }
    catch (e) { setError(e instanceof Error ? e.message : "Error al anular"); }
  }

  if (!f) return <div style={{ color: T.suave }}>{error ? <Aviso texto={error} /> : "Cargando…"}</div>;

  return (
    <div>
      <button onClick={() => router.push("/reposteria/facturas")} style={{ ...iconBtn, marginBottom: 14 }}>← Facturación</button>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap", marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 24, margin: 0 }}>🧾 Factura {f.numero}</h1>
          <p style={{ color: T.suave, fontSize: 13.5, marginTop: 6 }}>
            {f.ncf ? `NCF ${f.ncf} (${f.ncf_tipo}) · ` : ""}
            {fecha(f.fecha_emision)}
            {f.fecha_vencimiento ? ` · vence ${fecha(f.fecha_vencimiento)}` : ""}
            {cliente ? ` · ${cliente.nombre} ${cliente.apellido}` : ""}
          </p>
        </div>
        <Badge texto={f.estado} tono={tono[f.estado] ?? "neutro"} />
      </div>

      {error && <Aviso texto={error} />}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 18 }}>
        {[
          { l: "Subtotal", v: RD(f.subtotal) },
          { l: "ITBIS",    v: RD(f.itbis) },
          { l: "Descuento",v: RD(f.descuento) },
          { l: "Total",    v: RD(f.total) },
          { l: "Pagado",   v: RD(f.monto_pagado) },
          { l: "Balance",  v: RD(f.balance) },
        ].map((k) => (
          <Card key={k.l}>
            <div style={{ fontSize: 11, color: T.suave, textTransform: "uppercase", letterSpacing: 0.4 }}>{k.l}</div>
            <div style={{ fontSize: 18, fontWeight: 800, marginTop: 4 }}>{k.v}</div>
          </Card>
        ))}
      </div>

      <h2 style={{ fontSize: 17, margin: "0 0 12px" }}>Detalle</h2>
      <LineasEditor ruta="/factura-items" campoPadre="factura_id" padreId={String(id)} onCambio={cargar} />

      <h2 style={{ fontSize: 17, margin: "24px 0 12px" }}>Pagos recibidos</h2>

      <Card style={{ marginBottom: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "130px 150px 1fr 140px auto", gap: 10, alignItems: "end" }}>
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
          <Btn tono="ok" onClick={registrarPago} disabled={ocupado}>Registrar pago</Btn>
        </div>
      </Card>

      <Card style={{ padding: 0, overflow: "hidden" }}>
        <Tabla
          vacio="Aún no hay pagos registrados."
          columnas={[
            { name: "fecha",      label: "Fecha", fmt: (v) => fecha(v as string) },
            { name: "monto",      label: "Monto", alinear: "right", fmt: (v) => RD(v as number) },
            { name: "metodo",     label: "Método" },
            { name: "referencia", label: "Referencia" },
          ]}
          filas={pagos as unknown as Record<string, unknown>[]}
          acciones={(p) => <button onClick={() => borrarPago(String(p.id))} style={iconBtn} title="Eliminar">🗑️</button>}
        />
      </Card>

      <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
        <Btn tono="neutro" onClick={() => window.print()}>🖨️ Imprimir</Btn>
        {f.estado !== "anulada" && <Btn tono="err" onClick={anular}>Anular factura</Btn>}
      </div>
    </div>
  );
}
