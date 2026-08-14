"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Aviso, Badge, Btn, Card, Cargando, Etiqueta, Kpi, Modal, RD, Seccion, Tabla,
  Titulo, Vacio, api, fecha, hoyISO, inputBase, mesLargo, rejilla, tonoDoc, T,
} from "@/components/tienda/ui";
import { CATEGORIAS_GASTO, METODOS_PAGO } from "@/lib/tienda/negocio";

interface Cuenta {
  id: string; codigo: string; fecha: string; fecha_vence: string | null;
  cliente_nombre?: string; proveedor_nombre?: string;
  total: number; pagado: number; saldo: number; dias_vencida: number; estado_visual: string;
}
interface Gasto {
  id: string; fecha: string; categoria: string; concepto: string;
  monto: number; metodo_pago: string; referencia: string | null;
}
interface Mes {
  mes: string; ingresos: number; costo_mercancia: number;
  ganancia_bruta: number; gastos: number; ganancia_neta: number; facturas: number;
}
interface Datos {
  kpis: Record<string, number>;
  meses: Mes[];
  cxc: Cuenta[];
  cxp: Cuenta[];
  gastos: Gasto[];
  periodo: {
    desde: string; hasta: string; facturado: number; itbis: number; ingresos: number;
    costo: number; ganancia_bruta: number; gastos: number; ganancia_neta: number; facturas: number;
  };
}

const PESTANAS = [
  { id: "resumen", texto: "Resumen" },
  { id: "cxc",     texto: "Cuentas por cobrar" },
  { id: "cxp",     texto: "Cuentas por pagar" },
  { id: "gastos",  texto: "Gastos" },
];

export default function ContabilidadTienda() {
  const [d, setD] = useState<Datos | null>(null);
  const [simbolo, setSimbolo] = useState("RD$");
  const [desde, setDesde] = useState(`${new Date().getFullYear()}-01-01`);
  const [hasta, setHasta] = useState(hoyISO());
  const [pestana, setPestana] = useState("resumen");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [modalGasto, setModalGasto] = useState(false);
  const [procesando, setProcesando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const [r, cfg] = await Promise.all([
        api<{ data: Datos }>(`/contabilidad?desde=${desde}&hasta=${hasta}`),
        api<{ data: { simbolo_moneda: string } }>("/config").catch(() => null),
      ]);
      setD(r.data);
      if (cfg?.data?.simbolo_moneda) setSimbolo(cfg.data.simbolo_moneda);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar");
    } finally {
      setCargando(false);
    }
  }, [desde, hasta]);

  useEffect(() => { void cargar(); }, [cargar]);

  if (cargando && !d) return <Cargando />;
  if (error && !d) return <Aviso texto={error} />;
  if (!d) return null;

  const p = d.periodo;
  const totalCxc = d.cxc.reduce((a, c) => a + Number(c.saldo), 0);
  const totalCxp = d.cxp.reduce((a, c) => a + Number(c.saldo), 0);
  const vencidoCxc = d.cxc.filter((c) => c.dias_vencida > 0).reduce((a, c) => a + Number(c.saldo), 0);
  const vencidoCxp = d.cxp.filter((c) => c.dias_vencida > 0).reduce((a, c) => a + Number(c.saldo), 0);

  return (
    <div>
      <Titulo
        texto="💹  Contabilidad"
        sub="Resultados, cuentas por cobrar y por pagar, y gastos"
        acciones={
          <>
            <Btn tono="neutro" onClick={() => window.print()}>Imprimir</Btn>
            <Btn onClick={() => setModalGasto(true)}>+ Registrar gasto</Btn>
          </>
        }
      />

      {ok && <Aviso texto={ok} tono="ok" />}
      {error && <Aviso texto={error} />}

      <div style={{ ...rejilla(205), marginBottom: 16 }}>
        <Kpi titulo="Por cobrar" valor={RD(totalCxc, simbolo)}
             detalle={vencidoCxc > 0 ? `${RD(vencidoCxc, simbolo)} vencido` : `${d.cxc.length} factura(s)`}
             tono={vencidoCxc > 0 ? "err" : "neutro"} />
        <Kpi titulo="Por pagar" valor={RD(totalCxp, simbolo)}
             detalle={vencidoCxp > 0 ? `${RD(vencidoCxp, simbolo)} vencido` : `${d.cxp.length} compra(s)`}
             tono={vencidoCxp > 0 ? "warn" : "neutro"} />
        <Kpi titulo="Valor del inventario" valor={RD(d.kpis.valor_inventario, simbolo)} tono="acento" />
        <Kpi titulo="Efectivo en caja" valor={RD(d.kpis.efectivo_en_caja, simbolo)}
             detalle={d.kpis.caja_abierta ? "Caja abierta" : "Caja cerrada"} />
      </div>

      <div style={{ display: "flex", gap: 4, background: T.panel, border: `1px solid ${T.borde}`,
                    borderRadius: 10, padding: 3, marginBottom: 16, flexWrap: "wrap" }}>
        {PESTANAS.map((x) => (
          <button key={x.id} onClick={() => setPestana(x.id)}
            style={{
              border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer",
              fontSize: 13, fontWeight: 700,
              background: pestana === x.id ? T.acento : "transparent",
              color: pestana === x.id ? "#fff" : T.suave,
            }}>{x.texto}</button>
        ))}
      </div>

      {pestana === "resumen" && (
        <>
          <Seccion titulo="Estado de resultados del período" style={{ marginBottom: 18 }}>
            <div style={{ display: "grid", gap: 13, gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", marginBottom: 16 }}>
              <div>
                <Etiqueta>Desde</Etiqueta>
                <input type="date" style={inputBase} value={desde} onChange={(e) => setDesde(e.target.value)} />
              </div>
              <div>
                <Etiqueta>Hasta</Etiqueta>
                <input type="date" style={inputBase} value={hasta} onChange={(e) => setHasta(e.target.value)} />
              </div>
            </div>

            <div style={{ maxWidth: 520 }}>
              <FilaR t="Facturado (con ITBIS)" v={RD(p.facturado, simbolo)} />
              <FilaR t="− ITBIS cobrado (de la DGII)" v={RD(p.itbis, simbolo)} color={T.suave} />
              <FilaR t="= Ingresos" v={RD(p.ingresos, simbolo)} fuerte />
              <FilaR t="− Costo de la mercancía" v={RD(p.costo, simbolo)} color={T.suave} />
              <FilaR t="= Ganancia bruta" v={RD(p.ganancia_bruta, simbolo)} fuerte color={T.acento} />
              <FilaR t="− Gastos" v={RD(p.gastos, simbolo)} color={T.suave} />
              <div style={{ borderTop: `2px solid ${T.oscuro}`, marginTop: 8, paddingTop: 10 }}>
                <FilaR t="Ganancia neta" v={RD(p.ganancia_neta, simbolo)} grande
                       color={p.ganancia_neta >= 0 ? T.ok : T.err} />
              </div>
              <div style={{ fontSize: 11.5, color: T.suave, marginTop: 10 }}>
                {p.facturas} factura(s) entre {fecha(p.desde)} y {fecha(p.hasta)}
              </div>
            </div>
          </Seccion>

          <Seccion titulo="Resultados por mes" style={{ padding: 0 }}>
            {d.meses.length === 0 ? <Vacio texto="Sin movimientos todavía." /> : (
              <Tabla
                columnas={[
                  { name: "mes", label: "Mes", fmt: (v) => <strong>{mesLargo(v as string)}</strong> },
                  { name: "ingresos", label: "Ingresos", alinear: "right", fmt: (v) => RD(v as number, simbolo) },
                  { name: "costo_mercancia", label: "Costo", alinear: "right", fmt: (v) => RD(v as number, simbolo) },
                  { name: "ganancia_bruta", label: "Ganancia bruta", alinear: "right",
                    fmt: (v) => <span style={{ color: T.acento }}>{RD(v as number, simbolo)}</span> },
                  { name: "gastos", label: "Gastos", alinear: "right", fmt: (v) => RD(v as number, simbolo) },
                  { name: "ganancia_neta", label: "Ganancia neta", alinear: "right",
                    fmt: (v) => <strong style={{ color: Number(v) >= 0 ? T.ok : T.err }}>{RD(v as number, simbolo)}</strong> },
                  { name: "facturas", label: "Facturas", alinear: "right" },
                ]}
                filas={d.meses as unknown as Record<string, unknown>[]}
              />
            )}
          </Seccion>
        </>
      )}

      {pestana === "cxc" && (
        <Seccion titulo={`Cuentas por cobrar (${d.cxc.length})`} style={{ padding: 0 }}>
          {d.cxc.length === 0 ? <Vacio texto="Nadie te debe. Todo cobrado." /> : (
            <Tabla
              filaRoja={(f) => Number(f.dias_vencida) > 0}
              columnas={[
                { name: "codigo", label: "Factura", fmt: (v, f) => (
                  <Link href={`/tienda/ventas/${f.id}`} style={{ color: "inherit", fontWeight: 700, textDecoration: "none" }}>
                    {String(v)}
                  </Link>
                ) },
                { name: "cliente_nombre", label: "Cliente" },
                { name: "fecha", label: "Emitida", fmt: (v) => fecha(v as string) },
                { name: "fecha_vence", label: "Vence", fmt: (v) => v ? fecha(v as string) : "—" },
                { name: "dias_vencida", label: "Atraso", alinear: "right",
                  fmt: (v) => Number(v) > 0 ? <Badge texto={`${v} d`} tono="err" /> : "—" },
                { name: "total", label: "Total", alinear: "right", fmt: (v) => RD(v as number, simbolo) },
                { name: "pagado", label: "Abonado", alinear: "right", fmt: (v) => RD(v as number, simbolo) },
                { name: "saldo", label: "Saldo", alinear: "right",
                  fmt: (v) => <strong>{RD(v as number, simbolo)}</strong> },
                { name: "estado_visual", label: "Estado",
                  fmt: (v) => <Badge texto={String(v)} tono={tonoDoc(String(v))} /> },
              ]}
              filas={d.cxc as unknown as Record<string, unknown>[]}
              acciones={(f) => (
                <Link href={`/tienda/ventas/${f.id}`}
                      style={{ color: "inherit", fontSize: 12.5, fontWeight: 700, textDecoration: "none" }}>
                  Cobrar →
                </Link>
              )}
            />
          )}
        </Seccion>
      )}

      {pestana === "cxp" && (
        <Seccion titulo={`Cuentas por pagar (${d.cxp.length})`} style={{ padding: 0 }}>
          {d.cxp.length === 0 ? <Vacio texto="No le debes nada a nadie." /> : (
            <Tabla
              filaRoja={(f) => Number(f.dias_vencida) > 0}
              columnas={[
                { name: "codigo", label: "Compra", fmt: (v, f) => (
                  <Link href={`/tienda/compras/${f.id}`} style={{ color: "inherit", fontWeight: 700, textDecoration: "none" }}>
                    {String(v)}
                  </Link>
                ) },
                { name: "proveedor_nombre", label: "Proveedor" },
                { name: "fecha", label: "Fecha", fmt: (v) => fecha(v as string) },
                { name: "fecha_vence", label: "Vence", fmt: (v) => v ? fecha(v as string) : "—" },
                { name: "dias_vencida", label: "Atraso", alinear: "right",
                  fmt: (v) => Number(v) > 0 ? <Badge texto={`${v} d`} tono="err" /> : "—" },
                { name: "total", label: "Total", alinear: "right", fmt: (v) => RD(v as number, simbolo) },
                { name: "pagado", label: "Pagado", alinear: "right", fmt: (v) => RD(v as number, simbolo) },
                { name: "saldo", label: "Saldo", alinear: "right",
                  fmt: (v) => <strong>{RD(v as number, simbolo)}</strong> },
              ]}
              filas={d.cxp as unknown as Record<string, unknown>[]}
              acciones={(f) => (
                <Link href="/tienda/compras"
                      style={{ color: "inherit", fontSize: 12.5, fontWeight: 700, textDecoration: "none" }}>
                  Pagar →
                </Link>
              )}
            />
          )}
        </Seccion>
      )}

      {pestana === "gastos" && (
        <Seccion titulo={`Gastos del período (${d.gastos.length})`} style={{ padding: 0 }}>
          {d.gastos.length === 0 ? (
            <Vacio texto="Sin gastos registrados en este período."
                   accion={<Btn onClick={() => setModalGasto(true)}>Registrar gasto</Btn>} />
          ) : (
            <Tabla
              columnas={[
                { name: "fecha", label: "Fecha", fmt: (v) => fecha(v as string) },
                { name: "categoria", label: "Categoría", fmt: (v) => <Badge texto={String(v)} tono="neutro" /> },
                { name: "concepto", label: "Concepto", fmt: (v) => <strong>{String(v)}</strong> },
                { name: "metodo_pago", label: "Forma" },
                { name: "referencia", label: "Referencia" },
                { name: "monto", label: "Monto", alinear: "right",
                  fmt: (v) => <strong style={{ color: T.err }}>{RD(v as number, simbolo)}</strong> },
              ]}
              filas={d.gastos as unknown as Record<string, unknown>[]}
            />
          )}
        </Seccion>
      )}

      {modalGasto && (
        <ModalGasto
          simbolo={simbolo} procesando={procesando}
          onCerrar={() => setModalGasto(false)}
          onGuardar={async (body) => {
            setProcesando(true); setError("");
            try {
              await api("/gastos", { metodo: "POST", body });
              setOk("Gasto registrado. Salió de la caja abierta.");
              setModalGasto(false);
              await cargar();
            } catch (e) {
              setError(e instanceof Error ? e.message : "No se pudo registrar");
            } finally { setProcesando(false); }
          }}
        />
      )}
    </div>
  );
}

function ModalGasto({
  simbolo, procesando, onCerrar, onGuardar,
}: {
  simbolo: string; procesando: boolean;
  onCerrar: () => void; onGuardar: (b: Record<string, unknown>) => void;
}) {
  const [f, setF] = useState({
    fecha: hoyISO(), categoria: "general", concepto: "", monto: "",
    metodo_pago: "efectivo", referencia: "", notas: "",
  });
  const monto = Number(f.monto);

  return (
    <Modal
      abierto titulo="Registrar gasto" onCerrar={onCerrar} ancho={540}
      pie={
        <>
          <Btn tono="neutro" onClick={onCerrar}>Cancelar</Btn>
          <Btn disabled={procesando || !(monto > 0) || !f.concepto.trim()}
               onClick={() => onGuardar({ ...f, monto })}>
            {procesando ? "Guardando…" : `Registrar ${RD(monto || 0, simbolo)}`}
          </Btn>
        </>
      }
    >
      <div style={{ display: "grid", gap: 13, gridTemplateColumns: "1fr 1fr" }}>
        <div style={{ gridColumn: "span 2" }}>
          <Etiqueta>Concepto *</Etiqueta>
          <input style={inputBase} value={f.concepto} placeholder="Ej.: energía eléctrica de agosto"
                 onChange={(e) => setF({ ...f, concepto: e.target.value })} />
        </div>
        <div>
          <Etiqueta>Monto</Etiqueta>
          <input type="number" step="0.01" style={{ ...inputBase, fontSize: 16, fontWeight: 700 }}
                 value={f.monto} onChange={(e) => setF({ ...f, monto: e.target.value })} />
        </div>
        <div>
          <Etiqueta>Fecha</Etiqueta>
          <input type="date" style={inputBase} value={f.fecha}
                 onChange={(e) => setF({ ...f, fecha: e.target.value })} />
        </div>
        <div>
          <Etiqueta>Categoría</Etiqueta>
          <select style={inputBase} value={f.categoria}
                  onChange={(e) => setF({ ...f, categoria: e.target.value })}>
            {CATEGORIAS_GASTO.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <Etiqueta>Forma de pago</Etiqueta>
          <select style={inputBase} value={f.metodo_pago}
                  onChange={(e) => setF({ ...f, metodo_pago: e.target.value })}>
            {METODOS_PAGO.map((m) => <option key={m.valor} value={m.valor}>{m.etiqueta}</option>)}
          </select>
        </div>
        <div style={{ gridColumn: "span 2" }}>
          <Etiqueta>Referencia</Etiqueta>
          <input style={inputBase} value={f.referencia}
                 onChange={(e) => setF({ ...f, referencia: e.target.value })} />
        </div>
      </div>
      <div style={{ fontSize: 11.5, color: T.suave, marginTop: 12 }}>
        El gasto se descuenta de la caja abierta y entra al estado de resultados.
      </div>
    </Modal>
  );
}

function FilaR({
  t, v, fuerte, grande, color,
}: { t: string; v: string; fuerte?: boolean; grande?: boolean; color?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 14, padding: "6px 0" }}>
      <span style={{ fontSize: grande ? 14 : 13.5, color: color ?? T.suave, fontWeight: fuerte || grande ? 700 : 400 }}>
        {t}
      </span>
      <span style={{
        fontSize: grande ? 22 : 13.5, fontWeight: fuerte || grande ? 800 : 600,
        color: color ?? T.texto, fontVariantNumeric: "tabular-nums",
      }}>{v}</span>
    </div>
  );
}
