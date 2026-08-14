"use client";

/**
 * Caja del inversionista: ver, corregir y borrar sus movimientos.
 *
 * Antes solo se podía AGREGAR: si escribías 1,000 en vez de 100, el error
 * quedaba sumado para siempre. Aquí cada movimiento se puede editar o
 * eliminar, y el total se recalcula al momento.
 */

import { useCallback, useEffect, useState } from "react";
import {
  Aviso, Badge, Btn, Cargando, Etiqueta, Modal, RD, T, Vacio,
  api, fecha, hoyISO, inputBase,
} from "./ui";
import type { PrInversionistaVista, PrMovimientoInversionista } from "@/types/prestamos";

const TIPOS: { valor: string; etiqueta: string; tono: string }[] = [
  { valor: "aporte",          etiqueta: "Aporte de capital",   tono: "ok" },
  { valor: "retiro",          etiqueta: "Retiro de capital",   tono: "warn" },
  { valor: "retiro_ganancia", etiqueta: "Retiro de ganancias", tono: "acento" },
  { valor: "ajuste",          etiqueta: "Ajuste",              tono: "neutro" },
];

const etiquetaTipo = (t: string) => TIPOS.find((x) => x.valor === t)?.etiqueta ?? t;
const tonoTipo     = (t: string) => TIPOS.find((x) => x.valor === t)?.tono ?? "neutro";

interface Formulario {
  id: string | null;
  tipo: string;
  monto: string;
  fecha: string;
  descripcion: string;
}

const VACIO: Formulario = { id: null, tipo: "aporte", monto: "", fecha: hoyISO(), descripcion: "" };

export function CajaInversionista({
  inversionista,
  simbolo = "RD$",
  onCerrar,
  onCambio,
}: {
  inversionista: PrInversionistaVista | null;
  simbolo?: string;
  onCerrar: () => void;
  /** Se llama tras guardar o borrar, para refrescar la lista de atrás. */
  onCambio: () => void;
}) {
  const id = inversionista?.id;

  const [movs, setMovs]         = useState<PrMovimientoInversionista[]>([]);
  const [resumen, setResumen]   = useState<PrInversionistaVista | null>(inversionista);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError]       = useState("");
  const [aviso, setAviso]       = useState("");
  const [f, setF]               = useState<Formulario>(VACIO);

  const cargar = useCallback(async () => {
    if (!id) return;
    setCargando(true);
    try {
      const [m, v] = await Promise.all([
        api<{ data: PrMovimientoInversionista[] }>(`/movimientos?inversionista_id=${id}`),
        api<{ data: PrInversionistaVista[] }>(`/vistas/pr_v_inversionistas?id=${id}`),
      ]);
      setMovs(m.data ?? []);
      if (v.data?.[0]) setResumen(v.data[0]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron cargar los movimientos");
    } finally {
      setCargando(false);
    }
  }, [id]);

  useEffect(() => {
    if (!inversionista) return;
    setF(VACIO); setError(""); setAviso(""); setResumen(inversionista);
    void cargar();
  }, [inversionista, cargar]);

  if (!inversionista) return null;

  const editando = f.id !== null;
  const monto = Number(f.monto);
  const montoValido = f.tipo === "ajuste" ? Number.isFinite(monto) && monto !== 0 : monto > 0;

  async function guardar() {
    if (!id || !montoValido) return;
    setGuardando(true); setError(""); setAviso("");
    try {
      const cuerpo = {
        inversionista_id: id,
        tipo: f.tipo,
        monto,
        fecha: f.fecha,
        descripcion: f.descripcion || null,
      };
      if (editando) {
        await api(`/movimientos/${f.id}`, { metodo: "PATCH", body: cuerpo });
        setAviso("Movimiento corregido.");
      } else {
        await api("/movimientos", { metodo: "POST", body: cuerpo });
        setAviso("Movimiento registrado.");
      }
      setF(VACIO);
      await cargar();
      onCambio();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar(m: PrMovimientoInversionista) {
    if (!confirm(`¿Eliminar este movimiento de ${RD(m.monto, simbolo)}?\n\nNo se puede deshacer.`)) return;
    setGuardando(true); setError(""); setAviso("");
    try {
      await api(`/movimientos/${m.id}`, { metodo: "DELETE" });
      setAviso("Movimiento eliminado.");
      if (f.id === m.id) setF(VACIO);
      await cargar();
      onCambio();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo eliminar");
    } finally {
      setGuardando(false);
    }
  }

  const th: React.CSSProperties = {
    textAlign: "left", padding: "8px 10px", fontSize: 10.5, textTransform: "uppercase",
    letterSpacing: 0.5, color: T.suave, borderBottom: `1px solid ${T.borde}`, whiteSpace: "nowrap",
  };
  const td: React.CSSProperties = { padding: "9px 10px", borderBottom: `1px solid ${T.borde}77` };

  return (
    <Modal
      abierto
      titulo={`Caja de ${inversionista.nombre}`}
      onCerrar={onCerrar}
      ancho={780}
      pie={<Btn tono="neutro" onClick={onCerrar}>Cerrar</Btn>}
    >
      {/* ── Resumen ── */}
      {resumen && (
        <div style={{
          display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          background: T.panel2, border: `1px solid ${T.borde}`, borderRadius: 11,
          padding: 13, marginBottom: 16,
        }}>
          <Dato titulo="Capital aportado" valor={RD(resumen.capital_aportado, simbolo)} />
          <Dato titulo="En la calle"      valor={RD(resumen.capital_en_calle, simbolo)} />
          <Dato titulo="Disponible"       valor={RD(resumen.capital_disponible, simbolo)}
                color={Number(resumen.capital_disponible) < 0 ? T.err : T.texto} />
          <Dato titulo="Ganancia por pagarle" valor={RD(resumen.ganancia_por_pagar, simbolo)} color={T.ok} />
        </div>
      )}

      {error && <Aviso texto={error} />}
      {aviso && <Aviso texto={aviso} tono="ok" />}

      {/* ── Formulario: registrar o corregir ── */}
      <div style={{
        border: `1px solid ${editando ? T.acento : T.borde}`,
        background: editando ? "#eefaf8" : T.panel,
        borderRadius: 11, padding: 14, marginBottom: 18,
      }}>
        <div style={{
          fontSize: 12.5, fontWeight: 800, marginBottom: 11,
          color: editando ? T.acento : T.texto,
        }}>
          {editando ? "✏️  Corrigiendo un movimiento" : "＋  Registrar movimiento"}
        </div>

        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
          <div>
            <Etiqueta>Tipo</Etiqueta>
            <select style={inputBase} value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}>
              {TIPOS.map((t) => <option key={t.valor} value={t.valor}>{t.etiqueta}</option>)}
            </select>
          </div>
          <div>
            <Etiqueta>Monto</Etiqueta>
            <input
              type="number" step="0.01" style={{ ...inputBase, fontWeight: 700 }}
              value={f.monto} onChange={(e) => setF({ ...f, monto: e.target.value })}
              placeholder="0.00"
            />
            {f.tipo === "ajuste" && (
              <div style={{ fontSize: 10.5, color: T.suave, marginTop: 4 }}>
                Puede ser negativo para restar.
              </div>
            )}
          </div>
          <div>
            <Etiqueta>Fecha</Etiqueta>
            <input type="date" style={inputBase} value={f.fecha}
                   onChange={(e) => setF({ ...f, fecha: e.target.value })} />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <Etiqueta>Descripción</Etiqueta>
            <input style={inputBase} value={f.descripcion}
                   placeholder="Ej.: capital inicial, entrega en efectivo…"
                   onChange={(e) => setF({ ...f, descripcion: e.target.value })} />
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 13, justifyContent: "flex-end" }}>
          {editando && (
            <Btn tono="neutro" onClick={() => { setF(VACIO); setAviso(""); }}>
              Cancelar corrección
            </Btn>
          )}
          <Btn onClick={guardar} disabled={guardando || !montoValido}>
            {guardando ? "Guardando…" : editando ? "Guardar cambios" : "Registrar"}
          </Btn>
        </div>
      </div>

      {/* ── Movimientos ── */}
      <div style={{ fontSize: 12.5, fontWeight: 800, marginBottom: 8 }}>
        Movimientos ({movs.length})
      </div>

      {cargando ? <Cargando /> : movs.length === 0 ? (
        <Vacio texto="Todavía no hay movimientos. Registra el capital que te entregó arriba." />
      ) : (
        <div style={{ border: `1px solid ${T.borde}`, borderRadius: 10, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                <th style={th}>Fecha</th>
                <th style={th}>Tipo</th>
                <th style={th}>Descripción</th>
                <th style={{ ...th, textAlign: "right" }}>Monto</th>
                <th style={{ ...th, width: 130 }} />
              </tr>
            </thead>
            <tbody>
              {movs.map((m) => {
                const enEdicion = f.id === m.id;
                return (
                  <tr key={m.id} style={{ background: enEdicion ? "#eefaf8" : undefined }}>
                    <td style={td}>{fecha(m.fecha)}</td>
                    <td style={td}><Badge texto={etiquetaTipo(m.tipo)} tono={tonoTipo(m.tipo)} /></td>
                    <td style={{ ...td, color: T.suave }}>{m.descripcion || "—"}</td>
                    <td style={{ ...td, textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                      {RD(m.monto, simbolo)}
                    </td>
                    <td style={{ ...td, textAlign: "right" }}>
                      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                        <button
                          onClick={() => {
                            setF({
                              id: m.id,
                              tipo: m.tipo,
                              monto: String(m.monto),
                              fecha: m.fecha.slice(0, 10),
                              descripcion: m.descripcion ?? "",
                            });
                            setAviso(""); setError("");
                          }}
                          style={{
                            background: "transparent", border: "none", cursor: "pointer",
                            color: T.acento, fontSize: 12.5, fontWeight: 700,
                          }}
                        >Corregir</button>
                        <button
                          onClick={() => eliminar(m)}
                          disabled={guardando}
                          style={{
                            background: "transparent", border: "none", cursor: "pointer",
                            color: T.err, fontSize: 12.5, fontWeight: 700,
                          }}
                        >Eliminar</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}

function Dato({ titulo, valor, color }: { titulo: string; valor: string; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.4, color: T.suave }}>
        {titulo}
      </div>
      <div style={{ fontSize: 15.5, fontWeight: 800, color: color ?? T.texto, fontVariantNumeric: "tabular-nums" }}>
        {valor}
      </div>
    </div>
  );
}
