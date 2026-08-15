"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Btn, Cargando, ETIQUETA_ESTADO_CUOTA, ETIQUETA_FRECUENCIA, ETIQUETA_METODO,
  ETIQUETA_TIPO_PAGO, PCT, RD, Vacio, api, fecha, fechaLarga, hoyISO, T,
} from "@/components/prestamos/ui";
import { negocioDesdeConfig } from "@/lib/prestamos/negocio";
import type { PrConfig, PrCuotaVista, PrPago, PrPrestamoVista } from "@/types/prestamos";

interface Detalle {
  prestamo: PrPrestamoVista;
  cuotas: PrCuotaVista[];
  pagos: PrPago[];
}

/**
 * Estado de cuenta / factura del cliente.
 * Muestra el monto adeudado, cuánto ha pagado, cuántos pagos le quedan
 * y la fecha en la que debe finalizar.
 */
export default function EstadoDeCuenta() {
  const { id } = useParams<{ id: string }>();
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
  if (!d) return <Vacio texto="No encontrado." />;

  const p = d.prestamo;
  const n = negocioDesdeConfig(cfg as unknown as Record<string, unknown>);
  const s = n.simbolo;
  const cuotas = d.cuotas.filter((c) => c.activa);
  const pagos = d.pagos.filter((x) => !x.anulado);
  const atrasadas = cuotas.filter((c) => c.estado_visual === "atrasada");
  const moraPendiente = cuotas.reduce((a, c) => a + Number(c.mora_pendiente), 0);

  const th: React.CSSProperties = {
    textAlign: "left", padding: "8px 10px", fontSize: 10.5, textTransform: "uppercase",
    letterSpacing: 0.5, color: T.suave, borderBottom: `1px solid ${T.borde}`, whiteSpace: "nowrap",
  };
  const td: React.CSSProperties = { padding: "8px 10px", borderBottom: `1px solid ${T.borde}66` };
  const tdN: React.CSSProperties = { ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" };

  return (
    <div style={{ maxWidth: 940, margin: "0 auto" }}>
      <div className="no-imprimir" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <Link href={`/prestamos/creditos/${id}`} style={{ fontSize: 12, color: T.acento, textDecoration: "none" }}>
          ← Volver al préstamo
        </Link>
        <Btn onClick={() => window.print()}>Imprimir / Guardar PDF</Btn>
      </div>

      <div style={{ background: "#fff", border: `1px solid ${T.borde}`, borderRadius: 14, padding: 32 }}>
        {/* Encabezado */}
        <div style={{
          display: "flex", flexWrap: "wrap", justifyContent: "space-between",
          gap: 16, borderBottom: `2px solid ${T.oscuro}`, paddingBottom: 15, marginBottom: 22,
        }}>
          <div>
            <div style={{ fontSize: 19, fontWeight: 800, color: T.texto }}>{n.nombre}</div>
            {n.rnc && <div style={{ fontSize: 11.5, color: T.suave }}>RNC: {n.rnc}</div>}
            {n.direccion && <div style={{ fontSize: 11.5, color: T.suave }}>{n.direccion}</div>}
            {n.telefono && <div style={{ fontSize: 11.5, color: T.suave }}>Tel.: {n.telefono}</div>}
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.6, color: T.suave }}>
              Estado de cuenta
            </div>
            <div style={{ fontSize: 19, fontWeight: 800, color: T.texto }}>{p.codigo}</div>
            <div style={{ fontSize: 11.5, color: T.suave }}>Emitido el {fechaLarga(hoyISO())}</div>
          </div>
        </div>

        {/* Cliente y condiciones */}
        <div style={{ display: "grid", gap: 24, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", marginBottom: 22 }}>
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 800, textTransform: "uppercase", color: T.suave, marginBottom: 6 }}>Cliente</div>
            <div style={{ fontSize: 15.5, fontWeight: 800 }}>{p.cliente_nombre}</div>
            {p.cliente_cedula && <div style={{ fontSize: 13 }}>Cédula: {p.cliente_cedula}</div>}
            {p.cliente_telefono && <div style={{ fontSize: 13 }}>Tel.: {p.cliente_telefono}</div>}
            {p.cliente_direccion && <div style={{ fontSize: 13 }}>{p.cliente_direccion}</div>}
            <div style={{ fontSize: 13 }}>Código: {p.cliente_codigo}</div>
          </div>
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 800, textTransform: "uppercase", color: T.suave, marginBottom: 6 }}>Condiciones</div>
            <table style={{ width: "100%", fontSize: 13 }}>
              <tbody>
                <FilaCond t="Capital prestado" v={RD(p.capital, s)} />
                <FilaCond t="Tasa de interés" v={`${PCT(p.tasa_interes, 2)} mensual`} />
                <FilaCond t="Forma de cálculo" v={ETIQUETA_METODO[p.metodo]} />
                <FilaCond t="Plan de pagos" v={`${p.cuotas_totales} pagos ${ETIQUETA_FRECUENCIA[p.frecuencia].toLowerCase()}`} />
                <FilaCond t="Cuota" v={RD(p.monto_cuota, s)} />
                <FilaCond t="Fecha de entrega" v={fecha(p.fecha_inicio)} />
              </tbody>
            </table>
          </div>
        </div>

        {/* Resumen exigido */}
        <div style={{
          display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
          background: T.panel2, border: `1px solid ${T.borde}`, borderRadius: 11, padding: 16, marginBottom: 20,
        }}>
          <Bloque titulo="Monto adeudado" valor={RD(Number(p.saldo_total) + moraPendiente, s)}
                  detalle={`Capital ${RD(p.saldo_capital, s)}`}
                  color={atrasadas.length ? T.err : T.texto} />
          <Bloque titulo="Ha pagado" valor={RD(p.total_cobrado, s)}
                  detalle={`${p.cuotas_pagadas} de ${p.cuotas_totales} pagos`} color={T.ok} />
          <Bloque titulo="Pagos que le quedan" valor={String(p.cuotas_pendientes)}
                  detalle={atrasadas.length ? `${atrasadas.length} atrasado(s)` : "al día"}
                  color={atrasadas.length ? T.err : T.texto} />
          <Bloque titulo="Debe finalizar el" valor={fecha(p.fecha_fin_real ?? p.fecha_fin_estimada)}
                  detalle={`Próximo: ${fecha(p.proximo_vencimiento)}`} />
        </div>

        {atrasadas.length > 0 && (
          <div style={{
            background: T.rojoBg, border: `2px solid ${T.err}55`, color: T.rojoTx,
            borderRadius: 10, padding: 13, fontSize: 13, marginBottom: 20,
          }}>
            <strong>Atención:</strong> tiene {atrasadas.length} cuota(s) vencida(s) por un total de{" "}
            <strong>
              {RD(atrasadas.reduce((a, c) => a + Number(c.pendiente) + Number(c.mora_pendiente), 0), s)}
            </strong>. La más antigua venció el {fecha(atrasadas[0].fecha_vencimiento)} ({atrasadas[0].dias_atraso} días).
          </div>
        )}

        {/* Cronograma */}
        <div style={{ fontSize: 12.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
          Detalle de pagos
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, marginBottom: 24 }}>
          <thead>
            <tr>
              <th style={th}>#</th>
              <th style={th}>Vencimiento</th>
              <th style={{ ...th, textAlign: "right" }}>Capital</th>
              <th style={{ ...th, textAlign: "right" }}>Interés</th>
              <th style={{ ...th, textAlign: "right" }}>Cuota</th>
              <th style={{ ...th, textAlign: "right" }}>Pagado</th>
              <th style={{ ...th, textAlign: "right" }}>Pendiente</th>
              <th style={th}>Estado</th>
            </tr>
          </thead>
          <tbody>
            {cuotas.map((c) => {
              const roja = c.estado_visual === "atrasada";
              return (
                <tr key={c.id} style={roja ? { background: T.rojoBg, color: T.rojoTx } : undefined}>
                  <td style={{ ...td, fontWeight: 700 }}>{c.numero}</td>
                  <td style={td}>{fecha(c.fecha_vencimiento)}</td>
                  <td style={tdN}>{RD(c.capital, s)}</td>
                  <td style={tdN}>{RD(c.interes, s)}</td>
                  <td style={{ ...tdN, fontWeight: 700 }}>{RD(c.total, s)}</td>
                  <td style={tdN}>{RD(Number(c.capital_pagado) + Number(c.interes_pagado), s)}</td>
                  <td style={{ ...tdN, fontWeight: 700 }}>{RD(Number(c.pendiente) + Number(c.mora_pendiente), s)}</td>
                  <td style={{ ...td, fontSize: 11.5 }}>
                    {ETIQUETA_ESTADO_CUOTA[c.estado_visual] ?? c.estado_visual}
                    {roja && ` (${c.dias_atraso}d)`}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ background: T.panel2, fontWeight: 800 }}>
              <td style={{ ...td, textTransform: "uppercase", fontSize: 11 }} colSpan={4}>Totales</td>
              <td style={tdN}>{RD(cuotas.reduce((a, c) => a + Number(c.total), 0), s)}</td>
              <td style={tdN}>{RD(cuotas.reduce((a, c) => a + Number(c.capital_pagado) + Number(c.interes_pagado), 0), s)}</td>
              <td style={tdN}>{RD(cuotas.reduce((a, c) => a + Number(c.pendiente) + Number(c.mora_pendiente), 0), s)}</td>
              <td style={td} />
            </tr>
          </tfoot>
        </table>

        {/* Pagos recibidos */}
        {pagos.length > 0 && (
          <>
            <div style={{ fontSize: 12.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
              Pagos recibidos
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, marginBottom: 28 }}>
              <thead>
                <tr>
                  <th style={th}>Recibo</th>
                  <th style={th}>Fecha</th>
                  <th style={th}>Concepto</th>
                  <th style={th}>Forma</th>
                  <th style={{ ...th, textAlign: "right" }}>Capital</th>
                  <th style={{ ...th, textAlign: "right" }}>Interés</th>
                  <th style={{ ...th, textAlign: "right" }}>Mora</th>
                  <th style={{ ...th, textAlign: "right" }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {[...pagos].reverse().map((g) => (
                  <tr key={g.id}>
                    <td style={td}>{g.recibo}</td>
                    <td style={td}>{fecha(g.fecha)}</td>
                    <td style={td}>{ETIQUETA_TIPO_PAGO[g.tipo] ?? g.tipo}</td>
                    <td style={{ ...td, textTransform: "capitalize" }}>{g.metodo_pago}</td>
                    <td style={tdN}>{RD(g.monto_capital, s)}</td>
                    <td style={tdN}>{RD(g.monto_interes, s)}</td>
                    <td style={tdN}>{RD(g.monto_mora, s)}</td>
                    <td style={{ ...tdN, fontWeight: 700 }}>{RD(g.monto, s)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        <div style={{
          display: "grid", gap: 40, gridTemplateColumns: "1fr 1fr",
          borderTop: `1px solid ${T.borde}`, paddingTop: 40, textAlign: "center",
          fontSize: 11.5, color: T.suave,
        }}>
          <div>
            <div style={{ width: 190, borderTop: `1px solid ${T.suave}`, margin: "0 auto 5px" }} />
            Firma del cliente
          </div>
          <div>
            <div style={{ width: 190, borderTop: `1px solid ${T.suave}`, margin: "0 auto 5px" }} />
            Firma del administrador
          </div>
        </div>
      </div>
    </div>
  );
}

function FilaCond({ t, v }: { t: string; v: string }) {
  return (
    <tr>
      <td style={{ padding: "2px 8px 2px 0", color: T.suave }}>{t}</td>
      <td style={{ padding: "2px 0", textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{v}</td>
    </tr>
  );
}

function Bloque({ titulo, valor, detalle, color }: { titulo: string; valor: string; detalle?: string; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5, color: T.suave }}>{titulo}</div>
      <div style={{ fontSize: 17.5, fontWeight: 800, color: color ?? T.texto, fontVariantNumeric: "tabular-nums" }}>{valor}</div>
      {detalle && <div style={{ fontSize: 11, color: T.suave }}>{detalle}</div>}
    </div>
  );
}
