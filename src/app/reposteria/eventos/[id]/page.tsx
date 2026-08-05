"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import LineasEditor from "@/components/reposteria/Lineas";
import { api, Aviso, Badge, Btn, Card, Etiqueta, iconBtn, inputBase, RD, T, fecha } from "@/components/reposteria/ui";
import type { RepCliente, RepEvento } from "@/types/reposteria";

const ESTADOS = ["cotizado", "confirmado", "en_preparacion", "entregado", "cerrado", "cancelado"];
const tono: Record<string, string> = {
  cotizado: "info", confirmado: "ok", en_preparacion: "warn",
  entregado: "ok", cerrado: "neutro", cancelado: "err",
};

export default function EventoDetalle() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [ev, setEv]           = useState<RepEvento | null>(null);
  const [cliente, setCliente] = useState<RepCliente | null>(null);
  const [error, setError]     = useState("");
  const [deposito, setDep]    = useState("");
  const [guardando, setG]     = useState(false);

  const cargar = useCallback(async () => {
    try {
      const r = await api<{ data: RepEvento }>(`/eventos/${id}`);
      setEv(r.data);
      setDep(String(r.data.deposito ?? 0));
      if (r.data.cliente_id) {
        const c = await api<{ data: RepCliente }>(`/clientes/${r.data.cliente_id}`);
        setCliente(c.data);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar el evento");
    }
  }, [id]);

  useEffect(() => { void cargar(); }, [cargar]);

  async function cambiarEstado(estado: string) {
    setG(true);
    try { await api(`/eventos/${id}`, { metodo: "PATCH", body: { estado } }); await cargar(); }
    catch (e) { setError(e instanceof Error ? e.message : "Error al cambiar el estado"); }
    finally { setG(false); }
  }

  async function guardarDeposito() {
    setG(true);
    try { await api(`/eventos/${id}`, { metodo: "PATCH", body: { deposito: Number(deposito || 0) } }); await cargar(); }
    catch (e) { setError(e instanceof Error ? e.message : "Error al guardar el depósito"); }
    finally { setG(false); }
  }

  async function generarFactura() {
    if (!ev) return;
    setG(true);
    try {
      const r = await api<{ data: { id: string } }>("/facturas", {
        metodo: "POST",
        body: {
          evento_id: ev.id,
          cliente_id: ev.cliente_id,
          tipo: "credito",
          fecha_emision: new Date().toISOString().slice(0, 10),
          notas: `Generada desde el evento ${ev.numero ?? ""}`.trim(),
        },
      });
      const items = await api<{ data: Record<string, unknown>[] }>(`/evento-items?evento_id=${ev.id}`);
      for (const it of items.data ?? []) {
        await api("/factura-items", {
          metodo: "POST",
          body: {
            factura_id: r.data.id,
            producto_id: it.producto_id ?? null,
            descripcion: it.descripcion,
            cantidad: Number(it.cantidad ?? 1) * Number(it.dias_alquiler ?? 1),
            precio_unitario: it.precio_unitario,
            descuento: it.descuento ?? 0,
          },
        });
      }
      router.push(`/reposteria/facturas/${r.data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al generar la factura");
    } finally { setG(false); }
  }

  if (!ev) return <div style={{ color: T.suave }}>{error ? <Aviso texto={error} /> : "Cargando…"}</div>;

  return (
    <div>
      <button onClick={() => router.push("/reposteria/eventos")} style={{ ...iconBtn, marginBottom: 14 }}>← Eventos</button>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap", marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 24, margin: 0 }}>🎉 {ev.nombre_evento}</h1>
          <p style={{ color: T.suave, fontSize: 13.5, marginTop: 6 }}>
            {ev.numero} · {fecha(ev.fecha_evento)}
            {ev.hora_inicio ? ` · ${ev.hora_inicio.slice(0, 5)}` : ""}
            {ev.lugar ? ` · ${ev.lugar}` : ""}
            {cliente ? ` · ${cliente.nombre} ${cliente.apellido}` : ""}
          </p>
        </div>
        <Badge texto={ev.estado.replace("_", " ")} tono={tono[ev.estado] ?? "neutro"} />
      </div>

      {error && <Aviso texto={error} />}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(165px, 1fr))", gap: 12, marginBottom: 18 }}>
        {[
          { l: "Subtotal", v: RD(ev.subtotal) },
          { l: "ITBIS",    v: RD(ev.itbis) },
          { l: "Descuento",v: RD(ev.descuento) },
          { l: "Total",    v: RD(ev.total) },
          { l: "Depósito", v: RD(ev.deposito) },
          { l: "Balance",  v: RD(ev.balance) },
        ].map((k) => (
          <Card key={k.l}>
            <div style={{ fontSize: 11, color: T.suave, textTransform: "uppercase", letterSpacing: 0.4 }}>{k.l}</div>
            <div style={{ fontSize: 18, fontWeight: 800, marginTop: 4 }}>{k.v}</div>
          </Card>
        ))}
      </div>

      <Card style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ minWidth: 220 }}>
            <Etiqueta>Estado del evento</Etiqueta>
            <select value={ev.estado} onChange={(e) => cambiarEstado(e.target.value)} style={inputBase} disabled={guardando}>
              {ESTADOS.map((e) => <option key={e} value={e}>{e.replace("_", " ")}</option>)}
            </select>
          </div>
          <div style={{ minWidth: 180 }}>
            <Etiqueta>Depósito recibido</Etiqueta>
            <input type="number" step="0.01" value={deposito} onChange={(e) => setDep(e.target.value)} style={inputBase} />
          </div>
          <Btn tono="neutro" onClick={guardarDeposito} disabled={guardando}>Guardar depósito</Btn>
          <Btn onClick={generarFactura} disabled={guardando}>🧾 Generar factura</Btn>
        </div>
      </Card>

      <h2 style={{ fontSize: 17, margin: "0 0 12px" }}>Productos, equipos y servicios</h2>
      <LineasEditor ruta="/evento-items" campoPadre="evento_id" padreId={String(id)} conEquipos onCambio={cargar} />

      {ev.notas && (
        <Card style={{ marginTop: 18 }}>
          <strong style={{ display: "block", marginBottom: 8 }}>Notas</strong>
          <div style={{ whiteSpace: "pre-wrap", fontSize: 13.5, lineHeight: 1.6 }}>{ev.notas}</div>
        </Card>
      )}
    </div>
  );
}
