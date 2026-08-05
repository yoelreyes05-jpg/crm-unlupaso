"use client";

import { useCallback, useEffect, useState } from "react";
import {
  api, Aviso, Badge, Btn, Card, Etiqueta, inputBase, RD, T, Tabla, fechaHora,
} from "@/components/reposteria/ui";
import { METODOS_PAGO } from "@/types/reposteria";
import type { RepCajaMovimiento, RepCajaSesion } from "@/types/reposteria";

export default function CajaPage() {
  const [sesion, setSesion]   = useState<RepCajaSesion | null>(null);
  const [movs, setMovs]       = useState<RepCajaMovimiento[]>([]);
  const [historial, setHist]  = useState<RepCajaSesion[]>([]);
  const [error, setError]     = useState("");
  const [ocupado, setOcupado] = useState(false);

  const [apertura, setApertura] = useState({ monto: "", usuario: "" });
  const [cierre, setCierre]     = useState({ contado: "", notas: "" });
  const [mov, setMov]           = useState({ tipo: "egreso", descripcion: "", monto: "", metodo: "EFECTIVO" });

  const cargar = useCallback(async () => {
    try {
      const abierta = await api<{ data: RepCajaSesion | RepCajaSesion[] | null; movimientos?: RepCajaMovimiento[] }>("/caja?estado=abierta");
      const s = Array.isArray(abierta.data) ? (abierta.data[0] ?? null) : abierta.data;
      setSesion(s);
      setMovs(abierta.movimientos ?? []);
      const h = await api<{ data: RepCajaSesion[] }>("/caja");
      setHist(Array.isArray(h.data) ? h.data.filter((x) => x.estado === "cerrada").slice(0, 10) : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar la caja");
    }
  }, []);

  useEffect(() => { void cargar(); }, [cargar]);

  async function abrir() {
    setOcupado(true);
    try {
      await api("/caja", {
        metodo: "POST",
        body: { monto_apertura: Number(apertura.monto || 0), abierto_por: apertura.usuario || null },
      });
      setApertura({ monto: "", usuario: "" }); setError("");
      await cargar();
    } catch (e) { setError(e instanceof Error ? e.message : "Error al abrir caja"); }
    finally { setOcupado(false); }
  }

  async function cerrar() {
    if (!sesion) return;
    setOcupado(true);
    try {
      await api("/caja", {
        metodo: "PATCH",
        body: { id: sesion.id, efectivo_declarado: Number(cierre.contado || 0), notas: cierre.notas || null },
      });
      setCierre({ contado: "", notas: "" }); setError("");
      await cargar();
    } catch (e) { setError(e instanceof Error ? e.message : "Error al cerrar caja"); }
    finally { setOcupado(false); }
  }

  async function agregarMov() {
    if (!sesion || !mov.descripcion || !mov.monto) { setError("Completa descripción y monto"); return; }
    try {
      await api("/caja-movimientos", {
        metodo: "POST",
        body: {
          sesion_id: sesion.id, tipo: mov.tipo, descripcion: mov.descripcion,
          monto: Number(mov.monto), metodo: mov.metodo,
        },
      });
      setMov({ tipo: "egreso", descripcion: "", monto: "", metodo: "EFECTIVO" });
      setError("");
      await cargar();
    } catch (e) { setError(e instanceof Error ? e.message : "Error al registrar el movimiento"); }
  }

  const ingresos = movs.filter((m) => m.tipo === "ingreso").reduce((a, m) => a + Number(m.monto), 0);
  const egresos  = movs.filter((m) => m.tipo === "egreso").reduce((a, m) => a + Number(m.monto), 0);

  return (
    <div>
      <h1 style={{ fontSize: 24, margin: "0 0 18px" }}>💵 Caja</h1>
      {error && <Aviso texto={error} />}

      {!sesion ? (
        <Card style={{ maxWidth: 520 }}>
          <strong style={{ display: "block", marginBottom: 12 }}>No hay una sesión de caja abierta</strong>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <Etiqueta>Monto de apertura</Etiqueta>
              <input type="number" step="0.01" value={apertura.monto}
                onChange={(e) => setApertura((p) => ({ ...p, monto: e.target.value }))} style={inputBase} />
            </div>
            <div>
              <Etiqueta>Abierta por</Etiqueta>
              <input value={apertura.usuario}
                onChange={(e) => setApertura((p) => ({ ...p, usuario: e.target.value }))} style={inputBase} />
            </div>
          </div>
          <Btn onClick={abrir} disabled={ocupado} style={{ marginTop: 16 }}>Abrir caja</Btn>
        </Card>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, marginBottom: 18 }}>
            {[
              { l: "Apertura",          v: RD(sesion.monto_apertura) },
              { l: "Ingresos",          v: RD(ingresos) },
              { l: "Egresos",           v: RD(egresos) },
              { l: "Efectivo esperado", v: RD(sesion.efectivo_esperado) },
            ].map((k) => (
              <Card key={k.l}>
                <div style={{ fontSize: 11, color: T.suave, textTransform: "uppercase", letterSpacing: 0.4 }}>{k.l}</div>
                <div style={{ fontSize: 19, fontWeight: 800, marginTop: 4 }}>{k.v}</div>
              </Card>
            ))}
          </div>

          <Card style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, alignItems: "center" }}>
              <strong>Sesión abierta desde {fechaHora(sesion.fecha_apertura)}</strong>
              <Badge texto="abierta" tono="ok" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "120px 1fr 130px 150px auto", gap: 10, alignItems: "end" }}>
              <div>
                <Etiqueta>Tipo</Etiqueta>
                <select value={mov.tipo} onChange={(e) => setMov((p) => ({ ...p, tipo: e.target.value }))} style={inputBase}>
                  <option value="ingreso">Ingreso</option>
                  <option value="egreso">Egreso</option>
                </select>
              </div>
              <div>
                <Etiqueta>Descripción</Etiqueta>
                <input value={mov.descripcion} onChange={(e) => setMov((p) => ({ ...p, descripcion: e.target.value }))} style={inputBase} />
              </div>
              <div>
                <Etiqueta>Monto</Etiqueta>
                <input type="number" step="0.01" value={mov.monto}
                  onChange={(e) => setMov((p) => ({ ...p, monto: e.target.value }))} style={inputBase} />
              </div>
              <div>
                <Etiqueta>Método</Etiqueta>
                <select value={mov.metodo} onChange={(e) => setMov((p) => ({ ...p, metodo: e.target.value }))} style={inputBase}>
                  {METODOS_PAGO.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <Btn onClick={agregarMov}>Registrar</Btn>
            </div>
          </Card>

          <Card style={{ padding: 0, overflow: "hidden", marginBottom: 16 }}>
            <Tabla
              vacio="Sin movimientos en esta sesión."
              columnas={[
                { name: "created_at",  label: "Hora", fmt: (v) => fechaHora(v as string) },
                { name: "tipo",        label: "Tipo", fmt: (v) => <Badge texto={String(v)} tono={v === "ingreso" ? "ok" : "err"} /> },
                { name: "descripcion", label: "Descripción" },
                { name: "metodo",      label: "Método" },
                { name: "monto",       label: "Monto", alinear: "right", fmt: (v) => RD(v as number) },
              ]}
              filas={movs as unknown as Record<string, unknown>[]}
            />
          </Card>

          <Card style={{ maxWidth: 560 }}>
            <strong style={{ display: "block", marginBottom: 12 }}>Cerrar caja</strong>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <Etiqueta>Efectivo contado</Etiqueta>
                <input type="number" step="0.01" value={cierre.contado}
                  onChange={(e) => setCierre((p) => ({ ...p, contado: e.target.value }))} style={inputBase} />
              </div>
              <div>
                <Etiqueta>Notas</Etiqueta>
                <input value={cierre.notas} onChange={(e) => setCierre((p) => ({ ...p, notas: e.target.value }))} style={inputBase} />
              </div>
            </div>
            {cierre.contado !== "" && (
              <div style={{ marginTop: 10, fontSize: 13.5, color: T.suave }}>
                Diferencia:{" "}
                <strong style={{ color: Number(cierre.contado) - Number(sesion.efectivo_esperado) < 0 ? T.err : T.ok }}>
                  {RD(Number(cierre.contado) - Number(sesion.efectivo_esperado))}
                </strong>
              </div>
            )}
            <Btn tono="err" onClick={cerrar} disabled={ocupado} style={{ marginTop: 16 }}>Cerrar caja</Btn>
          </Card>
        </>
      )}

      {historial.length > 0 && (
        <>
          <h2 style={{ fontSize: 17, margin: "26px 0 12px" }}>Sesiones anteriores</h2>
          <Card style={{ padding: 0, overflow: "hidden" }}>
            <Tabla
              columnas={[
                { name: "fecha_apertura",     label: "Apertura", fmt: (v) => fechaHora(v as string) },
                { name: "fecha_cierre",       label: "Cierre",   fmt: (v) => fechaHora(v as string) },
                { name: "monto_apertura",     label: "Inicio",   alinear: "right", fmt: (v) => RD(v as number) },
                { name: "efectivo_esperado",  label: "Esperado", alinear: "right", fmt: (v) => RD(v as number) },
                { name: "efectivo_declarado", label: "Contado",  alinear: "right", fmt: (v) => RD(v as number) },
                { name: "diferencia",         label: "Diferencia", alinear: "right",
                  fmt: (v) => <span style={{ color: Number(v) < 0 ? T.err : T.ok }}>{RD(v as number)}</span> },
              ]}
              filas={historial as unknown as Record<string, unknown>[]}
            />
          </Card>
        </>
      )}
    </div>
  );
}
