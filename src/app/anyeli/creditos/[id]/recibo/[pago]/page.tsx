"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Btn, Cargando, ETIQUETA_FRECUENCIA, ETIQUETA_METODO, ETIQUETA_TIPO_PAGO,
  PCT, RD, Vacio, api, fecha, fechaLarga, hoyISO, T,
} from "@/components/anyeli/ui";
import { negocioDesdeConfig } from "@/lib/anyeli/negocio";
import type { PrConfig, PrCuotaVista, PrPago, PrPrestamoVista } from "@/types/anyeli";

interface Detalle {
  prestamo: PrPrestamoVista;
  cuotas: PrCuotaVista[];
  pagos: PrPago[];
}

/**
 * Recibo de un pago concreto, listo para imprimir o guardar en PDF.
 * Detalla al cliente, el desglose del dinero recibido y cómo queda el
 * préstamo después de ese pago.
 */
export default function ReciboDePago() {
  const { id, pago: pagoId } = useParams<{ id: string; pago: string }>();
  const [d, setD] = useState<Detalle | null>(null);
  const [cfg, setCfg] = useState<PrConfig | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [r, c] = await Promise.all([
          api<{ data: Detalle }>(`/creditos/${id}`),
          api<{ data: PrConfig }>("/config").catch(() => null),
        ]);
        setD(r.data);
        if (c) setCfg(c.data);
      } finally {
        setCargando(false);
      }
    })();
  }, [id]);

  if (cargando) return <Cargando />;
  if (!d) return <Vacio texto="Préstamo no encontrado." />;

  const pago = d.pagos.find((p) => p.id === pagoId);
  if (!pago) return <Vacio texto="Recibo no encontrado." />;

  const p = d.prestamo;
  const n = negocioDesdeConfig(cfg as unknown as Record<string, unknown>);
  const s = n.simbolo;
  const activas = d.cuotas.filter((c) => c.activa);
  const cuota = pago.cuota_id ? activas.find((c) => c.id === pago.cuota_id) : undefined;
  const moraPendiente = activas.reduce((a, c) => a + Number(c.mora_pendiente), 0);
  const proxima = activas.find((c) => !["pagada", "condonada", "solo_interes"].includes(c.estado));

  const linea: React.CSSProperties = {
    display: "flex", justifyContent: "space-between", gap: 14,
    padding: "7px 0", borderBottom: `1px solid ${T.borde}77`, fontSize: 13.5,
  };

  return (
    <div style={{ maxWidth: 760, margin: "0 auto" }}>
      <div className="no-imprimir" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <Link href={`/anyeli/creditos/${id}`} style={{ fontSize: 12, color: T.acento, textDecoration: "none" }}>
          ← Volver al préstamo
        </Link>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href={`/anyeli/creditos/${id}/estado`} style={{ textDecoration: "none" }}>
            <Btn tono="neutro">Estado de cuenta</Btn>
          </Link>
          <Btn onClick={() => window.print()}>Imprimir / Guardar PDF</Btn>
        </div>
      </div>

      <div style={{ background: "#fff", border: `1px solid ${T.borde}`, borderRadius: 14, padding: 30 }}>
        {/* Encabezado */}
        <div style={{
          display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 16,
          borderBottom: `2px solid ${T.oscuro}`, paddingBottom: 14, marginBottom: 20,
        }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: 0.3 }}>{n.nombre}</div>
            {n.rnc && <div style={{ fontSize: 11.5, color: T.suave }}>RNC: {n.rnc}</div>}
            {n.direccion && <div style={{ fontSize: 11.5, color: T.suave }}>{n.direccion}</div>}
            {n.telefono && <div style={{ fontSize: 11.5, color: T.suave }}>Tel.: {n.telefono}</div>}
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{
              display: "inline-block", background: T.acento, color: "#fff",
              borderRadius: 7, padding: "4px 12px", fontSize: 12, fontWeight: 800,
              textTransform: "uppercase", letterSpacing: 0.7,
            }}>
              Recibo de pago
            </div>
            <div style={{ fontSize: 21, fontWeight: 800, marginTop: 6 }}>{pago.recibo}</div>
            <div style={{ fontSize: 11.5, color: T.suave }}>{fechaLarga(pago.fecha)}</div>
            {pago.anulado && (
              <div style={{ marginTop: 6, color: T.err, fontWeight: 800, fontSize: 13 }}>
                ⚠ RECIBO ANULADO
              </div>
            )}
          </div>
        </div>

        {/* Cliente y préstamo */}
        <div style={{ display: "grid", gap: 22, gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", marginBottom: 20 }}>
          <div>
            <Titulito>Recibido de</Titulito>
            <div style={{ fontSize: 15.5, fontWeight: 800 }}>{p.cliente_nombre}</div>
            {p.cliente_cedula && <div style={{ fontSize: 13 }}>Cédula: {p.cliente_cedula}</div>}
            {p.cliente_telefono && <div style={{ fontSize: 13 }}>Tel.: {p.cliente_telefono}</div>}
            {p.cliente_direccion && <div style={{ fontSize: 13, color: T.suave }}>{p.cliente_direccion}</div>}
            <div style={{ fontSize: 13, color: T.suave }}>Código: {p.cliente_codigo}</div>
          </div>
          <div>
            <Titulito>Préstamo</Titulito>
            <div style={{ fontSize: 15.5, fontWeight: 800 }}>{p.codigo}</div>
            <div style={{ fontSize: 13 }}>
              Capital {RD(p.capital, s)} · {PCT(p.tasa_interes, 2)} mensual
            </div>
            <div style={{ fontSize: 13 }}>
              {ETIQUETA_METODO[p.metodo]} · {p.cuotas_totales} pagos {ETIQUETA_FRECUENCIA[p.frecuencia].toLowerCase()}
            </div>
            {cuota && (
              <div style={{ fontSize: 13 }}>
                Aplicado a la cuota #{cuota.numero}, vence {fecha(cuota.fecha_vencimiento)}
              </div>
            )}
          </div>
        </div>

        {/* Desglose del pago */}
        <Titulito>Detalle del pago</Titulito>
        <div style={{ border: `1px solid ${T.borde}`, borderRadius: 11, padding: "6px 16px", marginBottom: 20 }}>
          <div style={linea}>
            <span style={{ color: T.suave }}>Concepto</span>
            <strong>{ETIQUETA_TIPO_PAGO[pago.tipo] ?? pago.tipo}</strong>
          </div>
          <div style={linea}>
            <span style={{ color: T.suave }}>Abono a capital</span>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>{RD(pago.monto_capital, s)}</span>
          </div>
          <div style={linea}>
            <span style={{ color: T.suave }}>Interés (rédito)</span>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>{RD(pago.monto_interes, s)}</span>
          </div>
          {Number(pago.monto_mora) > 0 && (
            <div style={linea}>
              <span style={{ color: T.suave }}>Mora por atraso</span>
              <span style={{ fontVariantNumeric: "tabular-nums" }}>{RD(pago.monto_mora, s)}</span>
            </div>
          )}
          <div style={linea}>
            <span style={{ color: T.suave }}>Forma de pago</span>
            <span style={{ textTransform: "capitalize" }}>
              {pago.metodo_pago}{pago.referencia ? ` · ref. ${pago.referencia}` : ""}
            </span>
          </div>
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "14px 0 10px", marginTop: 4, borderTop: `2px solid ${T.oscuro}`,
          }}>
            <span style={{ fontSize: 14, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5 }}>
              Total recibido
            </span>
            <span style={{ fontSize: 26, fontWeight: 800, color: T.ok, fontVariantNumeric: "tabular-nums" }}>
              {RD(pago.monto, s)}
            </span>
          </div>
        </div>

        {/* Cómo queda el préstamo */}
        <Titulito>Cómo queda el préstamo</Titulito>
        <div style={{
          display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(155px, 1fr))",
          background: T.panel2, border: `1px solid ${T.borde}`, borderRadius: 11,
          padding: 16, marginBottom: 18,
        }}>
          <Bloque titulo="Monto adeudado" valor={RD(Number(p.saldo_total) + moraPendiente, s)}
                  detalle={`Capital ${RD(p.saldo_capital, s)}`}
                  color={p.cuotas_atrasadas > 0 ? T.err : T.texto} />
          <Bloque titulo="Ha pagado" valor={RD(p.total_cobrado, s)}
                  detalle={`${p.cuotas_pagadas} de ${p.cuotas_totales} pagos`} color={T.ok} />
          <Bloque titulo="Pagos que le quedan" valor={String(p.cuotas_pendientes)}
                  detalle={p.cuotas_atrasadas > 0 ? `${p.cuotas_atrasadas} atrasado(s)` : "al día"}
                  color={p.cuotas_atrasadas > 0 ? T.err : T.texto} />
          <Bloque titulo="Debe finalizar el" valor={fecha(p.fecha_fin_real ?? p.fecha_fin_estimada)} />
        </div>

        {proxima && (
          <div style={{
            background: "#f0fbf9", border: `1px dashed ${T.acento}66`, borderRadius: 10,
            padding: 13, fontSize: 13.5, marginBottom: 22,
          }}>
            <strong>Próximo pago:</strong> cuota #{proxima.numero} el {fecha(proxima.fecha_vencimiento)} por{" "}
            <strong>{RD(Number(proxima.pendiente) + Number(proxima.mora_pendiente), s)}</strong>.
          </div>
        )}

        {pago.notas && (
          <div style={{ fontSize: 12.5, color: T.suave, marginBottom: 18 }}>
            <strong>Nota:</strong> {pago.notas}
          </div>
        )}

        <div style={{
          display: "grid", gap: 40, gridTemplateColumns: "1fr 1fr",
          borderTop: `1px solid ${T.borde}`, paddingTop: 40, textAlign: "center",
          fontSize: 11.5, color: T.suave,
        }}>
          <div>
            <div style={{ width: 180, borderTop: `1px solid ${T.suave}`, margin: "0 auto 5px" }} />
            Recibí conforme (cliente)
          </div>
          <div>
            <div style={{ width: 180, borderTop: `1px solid ${T.suave}`, margin: "0 auto 5px" }} />
            {n.nombre}
          </div>
        </div>

        <div style={{ textAlign: "center", fontSize: 10.5, color: T.suave, marginTop: 22 }}>
          Recibo generado el {fechaLarga(hoyISO())} · Conserve este comprobante
        </div>
      </div>
    </div>
  );
}

function Titulito({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 10.5, fontWeight: 800, textTransform: "uppercase",
      letterSpacing: 0.6, color: T.suave, marginBottom: 7,
    }}>{children}</div>
  );
}

function Bloque({ titulo, valor, detalle, color }: { titulo: string; valor: string; detalle?: string; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5, color: T.suave }}>
        {titulo}
      </div>
      <div style={{ fontSize: 16.5, fontWeight: 800, color: color ?? T.texto, fontVariantNumeric: "tabular-nums" }}>
        {valor}
      </div>
      {detalle && <div style={{ fontSize: 11, color: T.suave }}>{detalle}</div>}
    </div>
  );
}
