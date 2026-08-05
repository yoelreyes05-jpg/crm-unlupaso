"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import LineasEditor from "@/components/reposteria/Lineas";
import { api, Aviso, Badge, Btn, Card, Etiqueta, iconBtn, inputBase, RD, T, fecha } from "@/components/reposteria/ui";
import { documentoHTML, imprimirHTML, type LineaDoc } from "@/components/reposteria/imprimir";
import { negocioDesdeConfig } from "@/lib/reposteria/negocio";
import type { RepCliente, RepCotizacion } from "@/types/reposteria";

const ESTADOS = ["borrador", "enviada", "aceptada", "rechazada", "vencida"];
const tono: Record<string, string> = {
  borrador: "neutro", enviada: "info", aceptada: "ok", rechazada: "err", vencida: "warn",
};

export default function CotizacionDetalle() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [c, setC] = useState<RepCotizacion | null>(null);
  const [cliente, setCliente] = useState<RepCliente | null>(null);
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const r = await api<{ data: RepCotizacion }>(`/cotizaciones/${id}`);
      setC(r.data);
      if (r.data.cliente_id) {
        const cl = await api<{ data: RepCliente }>(`/clientes/${r.data.cliente_id}`);
        setCliente(cl.data);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar la cotización");
    }
  }, [id]);

  useEffect(() => { void cargar(); }, [cargar]);

  async function cambiarEstado(estado: string) {
    setOcupado(true);
    try { await api(`/cotizaciones/${id}`, { metodo: "PATCH", body: { estado } }); await cargar(); }
    catch (e) { setError(e instanceof Error ? e.message : "Error al cambiar el estado"); }
    finally { setOcupado(false); }
  }

  async function convertirEnFactura() {
    if (!c) return;
    setOcupado(true);
    try {
      const f = await api<{ data: { id: string } }>("/facturas", {
        metodo: "POST",
        body: {
          cotizacion_id: c.id,
          cliente_id: c.cliente_id,
          evento_id: c.evento_id,
          tipo: "credito",
          fecha_emision: new Date().toISOString().slice(0, 10),
          notas: `Desde cotización ${c.numero ?? ""}`.trim(),
        },
      });
      const items = await api<{ data: Record<string, unknown>[] }>(`/cotizacion-items?cotizacion_id=${c.id}`);
      for (const it of items.data ?? []) {
        await api("/factura-items", {
          metodo: "POST",
          body: {
            factura_id: f.data.id,
            descripcion: it.descripcion,
            cantidad: it.cantidad,
            precio_unitario: it.precio_unitario,
            descuento: it.descuento ?? 0,
          },
        });
      }
      await api(`/cotizaciones/${c.id}`, { metodo: "PATCH", body: { estado: "aceptada" } });
      router.push(`/reposteria/facturas/${f.data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al convertir en factura");
    } finally { setOcupado(false); }
  }

  async function imprimirCotizacion() {
    if (!c) return;
    try {
      const [items, cfg] = await Promise.all([
        api<{ data: LineaDoc[] }>(`/cotizacion-items?cotizacion_id=${c.id}`),
        api<{ data: Record<string, string> }>("/config"),
      ]);
      imprimirHTML(documentoHTML(negocioDesdeConfig(cfg.data), {
        titulo: "COTIZACIÓN",
        numero: c.numero ?? "",
        fecha: c.fecha,
        vencimiento: c.fecha_vencimiento,
        cliente: cliente ? `${cliente.nombre} ${cliente.apellido}`.trim() : null,
        telefonoCliente: cliente?.telefono ?? null,
        rncCliente: cliente?.cedula_rnc ?? null,
        lineas: items.data ?? [],
        subtotal: Number(c.subtotal), itbis: Number(c.itbis),
        descuento: Number(c.descuento), total: Number(c.total),
        condiciones: c.condiciones,
        notas: c.notas,
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al preparar la impresión");
    }
  }

  if (!c) return <div style={{ color: T.suave }}>{error ? <Aviso texto={error} /> : "Cargando…"}</div>;

  return (
    <div>
      <button onClick={() => router.push("/reposteria/cotizaciones")} style={{ ...iconBtn, marginBottom: 14 }}>← Cotizaciones</button>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap", marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 24, margin: 0 }}>💬 Cotización {c.numero}</h1>
          <p style={{ color: T.suave, fontSize: 13.5, marginTop: 6 }}>
            {fecha(c.fecha)}
            {c.fecha_vencimiento ? ` · válida hasta ${fecha(c.fecha_vencimiento)}` : ""}
            {cliente ? ` · ${cliente.nombre} ${cliente.apellido}` : ""}
          </p>
        </div>
        <Badge texto={c.estado} tono={tono[c.estado] ?? "neutro"} />
      </div>

      {error && <Aviso texto={error} />}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(165px, 1fr))", gap: 12, marginBottom: 18 }}>
        {[
          { l: "Subtotal", v: RD(c.subtotal) },
          { l: "ITBIS",    v: RD(c.itbis) },
          { l: "Descuento",v: RD(c.descuento) },
          { l: "Total",    v: RD(c.total) },
        ].map((k) => (
          <Card key={k.l}>
            <div style={{ fontSize: 11, color: T.suave, textTransform: "uppercase", letterSpacing: 0.4 }}>{k.l}</div>
            <div style={{ fontSize: 18, fontWeight: 800, marginTop: 4 }}>{k.v}</div>
          </Card>
        ))}
      </div>

      <Card style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ minWidth: 210 }}>
            <Etiqueta>Estado</Etiqueta>
            <select value={c.estado} onChange={(e) => cambiarEstado(e.target.value)} style={inputBase} disabled={ocupado}>
              {ESTADOS.map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
          <Btn onClick={convertirEnFactura} disabled={ocupado}>🧾 Convertir en factura</Btn>
          <Btn tono="neutro" onClick={imprimirCotizacion}>🖨️ Imprimir cotización</Btn>
        </div>
      </Card>

      <h2 style={{ fontSize: 17, margin: "0 0 12px" }}>Detalle</h2>
      <LineasEditor ruta="/cotizacion-items" campoPadre="cotizacion_id" padreId={String(id)} onCambio={cargar} />

      {c.condiciones && (
        <Card style={{ marginTop: 18 }}>
          <strong style={{ display: "block", marginBottom: 8 }}>Condiciones</strong>
          <div style={{ whiteSpace: "pre-wrap", fontSize: 13.5, lineHeight: 1.6 }}>{c.condiciones}</div>
        </Card>
      )}
    </div>
  );
}
