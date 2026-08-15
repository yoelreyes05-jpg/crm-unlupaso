"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Aviso, Badge, Btn, Cargando, ETIQUETA_METODO_PAGO, Etiqueta, Kpi, Modal, RD,
  Seccion, Tabla, Titulo, Vacio, api, fecha, fechaLarga, hoyISO, inputBase,
  rejilla, tonoDoc, T,
} from "@/components/tienda/ui";
import { negocioTienda } from "@/lib/tienda/negocio";

interface Venta {
  id: string; codigo: string; fecha: string; ncf: string | null;
  cliente_id: string | null; cliente_nombre: string; cliente_documento: string | null;
  cliente_telefono: string | null; condicion: string; metodo_pago: string;
  fecha_vence: string | null; subtotal: number; itbis: number; descuento: number;
  total: number; pagado: number; saldo: number; ganancia: number;
  estado: string; estado_visual: string; dias_vencida: number; notas: string | null;
}
interface Item {
  id: string; descripcion: string; cantidad: number; precio: number;
  itbis_pct: number; descuento: number; importe: number;
  producto_id: string | null; codigo_articulo: string | null;
  ti_productos?: { codigo: string; nombre: string; unidad: string } | null;
}
interface Cobro {
  id: string; recibo: string; fecha: string; monto: number;
  metodo_pago: string; referencia: string | null; anulado: boolean;
}

export default function DetalleVenta() {
  const { id } = useParams<{ id: string }>();
  const [d, setD] = useState<{ venta: Venta; items: Item[]; cobros: Cobro[] } | null>(null);
  const [cfg, setCfg] = useState<Record<string, unknown> | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [procesando, setProcesando] = useState(false);
  const [modal, setModal] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const [r, c] = await Promise.all([
        api<{ data: { venta: Venta; items: Item[]; cobros: Cobro[] } }>(`/ventas/${id}`),
        api<{ data: Record<string, unknown> }>("/config").catch(() => null),
      ]);
      setD(r.data);
      if (c) setCfg(c.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar");
    } finally {
      setCargando(false);
    }
  }, [id]);

  useEffect(() => { void cargar(); }, [cargar]);

  if (cargando) return <Cargando />;
  if (!d) return <Vacio texto="Factura no encontrada." />;

  const v = d.venta;
  const n = negocioTienda(cfg ?? undefined);
  const s = n.simbolo;
  const cobrosVivos = d.cobros.filter((c) => !c.anulado);
  // Una factura con artículos que ya se sacaron del inventario se puede ver,
  // imprimir y cobrar, pero no rehacer: no habría de dónde sacar la mercancía.
  const hayBorrados = d.items.some((i) => !i.producto_id);

  const th: React.CSSProperties = {
    textAlign: "left", padding: "8px 10px", fontSize: 10.5, textTransform: "uppercase",
    letterSpacing: 0.5, color: T.suave, borderBottom: `1px solid ${T.borde}`,
  };
  const td: React.CSSProperties = { padding: "9px 10px", borderBottom: `1px solid ${T.borde}66` };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <div className="no-imprimir">
        <Link href="/tienda/ventas" style={{ fontSize: 12, color: T.acento, textDecoration: "none" }}>
          ← Ventas
        </Link>
        <div style={{ height: 8 }} />
        <Titulo
          texto={v.codigo}
          sub={
            <span style={{ display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap" }}>
              <Badge texto={v.estado_visual} tono={tonoDoc(v.estado_visual)} />
              <span>{v.cliente_nombre} · {fecha(v.fecha)}</span>
            </span>
          }
          acciones={
            <>
              <Btn tono="neutro" onClick={() => window.print()}>Imprimir factura</Btn>
              {v.estado !== "anulada" && !hayBorrados && (
                <Link href={`/tienda/ventas/nueva?editar=${id}`} style={{ textDecoration: "none" }}>
                  <Btn tono="neutro">Modificar</Btn>
                </Link>
              )}
              {v.estado !== "anulada" && Number(v.saldo) > 0.01 && (
                <Btn tono="ok" onClick={() => setModal(true)}>Registrar cobro</Btn>
              )}
              {v.estado !== "anulada" && (
                <Btn tono="err" disabled={procesando} onClick={async () => {
                  if (!confirm("¿Anular esta factura?\n\nSe devuelve la mercancía al inventario y se revierten los cobros.\nLa factura queda en el historial marcada como anulada.")) return;
                  setProcesando(true); setError("");
                  try {
                    await api(`/ventas/${id}`, { metodo: "DELETE" });
                    setOk("Factura anulada. La mercancía volvió al inventario.");
                    await cargar();
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "Error");
                  } finally { setProcesando(false); }
                }}>Anular</Btn>
              )}
              <Btn tono="err" disabled={procesando} onClick={async () => {
                if (!confirm(
                  `¿Borrar la factura ${v.codigo} definitivamente?\n\n` +
                  "Desaparece del historial y no se puede recuperar. " +
                  "La mercancía vuelve al inventario y el dinero sale de la caja.\n\n" +
                  "Si solo quieres dejar sin efecto la factura, usa Anular."
                )) return;
                setProcesando(true); setError("");
                try {
                  await api(`/ventas/${id}?definitivo=1`, { metodo: "DELETE" });
                  window.location.href = "/tienda/ventas";
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Error");
                  setProcesando(false);
                }
              }}>Eliminar</Btn>
            </>
          }
        />
        {ok && <Aviso texto={ok} tono="ok" />}
        {error && <Aviso texto={error} />}
        {hayBorrados && (
          <Aviso tono="info" texto={
            "Esta factura tiene artículos que ya se sacaron del inventario. Se puede ver, " +
            "imprimir y cobrar con normalidad; solo no se puede modificar."
          } />
        )}

        <div style={{ ...rejilla(190), marginBottom: 18 }}>
          <Kpi titulo="Total" valor={RD(v.total, s)} />
          <Kpi titulo="Cobrado" valor={RD(v.pagado, s)} tono="ok" />
          <Kpi titulo="Saldo" valor={RD(v.saldo, s)}
               tono={Number(v.saldo) > 0.01 ? (v.estado_visual === "vencida" ? "err" : "warn") : "neutro"} />
          <Kpi titulo="Ganancia" valor={RD(v.ganancia, s)} tono="acento" detalle="Sin ITBIS" />
        </div>
      </div>

      {/* ── Factura imprimible ── */}
      <div style={{ background: "#fff", border: `1px solid ${T.borde}`, borderRadius: 14, padding: 30 }}>
        <div style={{
          display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 16,
          borderBottom: `2px solid ${T.oscuro}`, paddingBottom: 14, marginBottom: 20,
        }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>{n.nombre}</div>
            {n.slogan && <div style={{ fontSize: 11.5, color: T.suave }}>{n.slogan}</div>}
            {n.rnc && <div style={{ fontSize: 11.5, color: T.suave }}>RNC: {n.rnc}</div>}
            {n.direccion && <div style={{ fontSize: 11.5, color: T.suave }}>{n.direccion}</div>}
            {n.telefono && <div style={{ fontSize: 11.5, color: T.suave }}>Tel.: {n.telefono}</div>}
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{
              display: "inline-block", background: T.acento, color: "#fff", borderRadius: 7,
              padding: "4px 12px", fontSize: 11.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.6,
            }}>
              Factura {v.condicion === "credito" ? "a crédito" : "de contado"}
            </div>
            <div style={{ fontSize: 21, fontWeight: 800, marginTop: 6 }}>{v.codigo}</div>
            <div style={{ fontSize: 11.5, color: T.suave }}>{fechaLarga(v.fecha)}</div>
            {v.ncf && <div style={{ fontSize: 11.5, color: T.suave }}>NCF: {v.ncf}</div>}
            {v.estado === "anulada" && (
              <div style={{ marginTop: 6, color: T.err, fontWeight: 800 }}>⚠ FACTURA ANULADA</div>
            )}
          </div>
        </div>

        <div style={{ display: "grid", gap: 22, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 800, textTransform: "uppercase", color: T.suave, marginBottom: 6 }}>
              Cliente
            </div>
            <div style={{ fontSize: 15, fontWeight: 800 }}>{v.cliente_nombre}</div>
            {v.cliente_documento && <div style={{ fontSize: 13 }}>Cédula / RNC: {v.cliente_documento}</div>}
            {v.cliente_telefono && <div style={{ fontSize: 13 }}>Tel.: {v.cliente_telefono}</div>}
          </div>
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 800, textTransform: "uppercase", color: T.suave, marginBottom: 6 }}>
              Condiciones
            </div>
            <div style={{ fontSize: 13 }}>Forma de pago: {ETIQUETA_METODO_PAGO[v.metodo_pago] ?? v.metodo_pago}</div>
            {v.fecha_vence && (
              <div style={{ fontSize: 13, color: Number(v.dias_vencida) > 0 ? T.err : T.texto }}>
                Vence el {fecha(v.fecha_vence)}
                {Number(v.dias_vencida) > 0 && ` · ${v.dias_vencida} días vencida`}
              </div>
            )}
          </div>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginBottom: 18 }}>
          <thead>
            <tr>
              <th style={th}>Descripción</th>
              <th style={{ ...th, textAlign: "right" }}>Cant.</th>
              <th style={{ ...th, textAlign: "right" }}>Precio</th>
              <th style={{ ...th, textAlign: "right" }}>ITBIS</th>
              <th style={{ ...th, textAlign: "right" }}>Importe</th>
            </tr>
          </thead>
          <tbody>
            {d.items.map((it) => (
              <tr key={it.id}>
                <td style={td}>
                  <strong>{it.descripcion || it.ti_productos?.nombre || "Artículo eliminado"}</strong>
                  {(it.ti_productos?.codigo || it.codigo_articulo) && (
                    <div style={{ fontSize: 10.5, color: T.suave }}>
                      {it.ti_productos?.codigo ?? it.codigo_articulo}
                    </div>
                  )}
                </td>
                <td style={{ ...td, textAlign: "right" }}>
                  {Number(it.cantidad).toLocaleString("es-DO")} {it.ti_productos?.unidad ?? ""}
                </td>
                <td style={{ ...td, textAlign: "right" }}>{RD(it.precio, s)}</td>
                <td style={{ ...td, textAlign: "right" }}>
                  {Number(it.itbis_pct) > 0 ? `${Number(it.itbis_pct)}%` : "exento"}
                </td>
                <td style={{ ...td, textAlign: "right", fontWeight: 700 }}>{RD(it.importe, s)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <div style={{ minWidth: 280 }}>
            <Fila t="Subtotal" v={RD(v.subtotal, s)} />
            <Fila t="ITBIS" v={RD(v.itbis, s)} />
            {Number(v.descuento) > 0 && <Fila t="Descuento" v={`− ${RD(v.descuento, s)}`} />}
            <div style={{ borderTop: `2px solid ${T.oscuro}`, marginTop: 6, paddingTop: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, fontWeight: 800, textTransform: "uppercase" }}>Total</span>
                <span style={{ fontSize: 24, fontWeight: 800, color: T.acento, fontVariantNumeric: "tabular-nums" }}>
                  {RD(v.total, s)}
                </span>
              </div>
            </div>
            {Number(v.pagado) > 0 && (
              <div style={{ marginTop: 8 }}>
                <Fila t="Cobrado" v={RD(v.pagado, s)} />
                <Fila t="Saldo pendiente" v={RD(v.saldo, s)} fuerte />
              </div>
            )}
          </div>
        </div>

        {n.pie && (
          <div style={{ marginTop: 24, fontSize: 11.5, color: T.suave, textAlign: "center" }}>{n.pie}</div>
        )}
        {v.notas && (
          <div style={{ marginTop: 14, fontSize: 12, color: T.suave }}><strong>Nota:</strong> {v.notas}</div>
        )}
      </div>

      <div className="no-imprimir" style={{ marginTop: 18 }}>
        <Seccion titulo={`Cobros recibidos (${cobrosVivos.length})`} style={{ padding: 0 }}>
          {d.cobros.length === 0 ? <Vacio texto="Todavía no se ha cobrado nada." /> : (
            <Tabla
              columnas={[
                { name: "recibo", label: "Recibo", fmt: (v2, f) => (
                  <span style={{ fontSize: 12, textDecoration: f.anulado ? "line-through" : undefined }}>{String(v2)}</span>
                ) },
                { name: "fecha", label: "Fecha", fmt: (v2) => fecha(v2 as string) },
                { name: "metodo_pago", label: "Forma",
                  fmt: (v2) => ETIQUETA_METODO_PAGO[String(v2)] ?? String(v2) },
                { name: "referencia", label: "Referencia" },
                { name: "monto", label: "Monto", alinear: "right",
                  fmt: (v2) => <strong>{RD(v2 as number, s)}</strong> },
                { name: "anulado", label: "", fmt: (v2) => v2 ? <Badge texto="anulado" tono="err" /> : null },
              ]}
              filas={d.cobros as unknown as Record<string, unknown>[]}
            />
          )}
        </Seccion>
      </div>

      {modal && (
        <ModalCobro
          venta={v} simbolo={s} procesando={procesando}
          onCerrar={() => setModal(false)}
          onGuardar={async (body) => {
            setProcesando(true); setError("");
            try {
              await api("/cobros", { metodo: "POST", body });
              setOk("Cobro registrado. El dinero entró a la caja abierta.");
              setModal(false);
              await cargar();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Error al registrar el cobro");
            } finally { setProcesando(false); }
          }}
        />
      )}
    </div>
  );
}

function ModalCobro({
  venta, simbolo, procesando, onCerrar, onGuardar,
}: {
  venta: Venta; simbolo: string; procesando: boolean;
  onCerrar: () => void; onGuardar: (b: Record<string, unknown>) => void;
}) {
  const [f, setF] = useState({
    monto: String(venta.saldo), fecha: hoyISO(), metodo_pago: "efectivo", referencia: "", notas: "",
  });
  const monto = Number(f.monto);

  return (
    <Modal
      abierto titulo={`Cobrar factura ${venta.codigo}`} onCerrar={onCerrar} ancho={520}
      pie={
        <>
          <Btn tono="neutro" onClick={onCerrar}>Cancelar</Btn>
          <Btn tono="ok" disabled={procesando || !(monto > 0)}
               onClick={() => onGuardar({
                 venta_id: venta.id, cliente_id: venta.cliente_id,
                 monto, fecha: f.fecha, metodo_pago: f.metodo_pago,
                 referencia: f.referencia || null, notas: f.notas || null,
               })}>
            {procesando ? "Guardando…" : "Registrar cobro"}
          </Btn>
        </>
      }
    >
      <div style={{ background: T.panel2, border: `1px solid ${T.borde}`, borderRadius: 10, padding: 13, marginBottom: 15 }}>
        <Fila t="Total de la factura" v={RD(venta.total, simbolo)} />
        <Fila t="Ya cobrado" v={RD(venta.pagado, simbolo)} />
        <Fila t="Saldo pendiente" v={RD(venta.saldo, simbolo)} fuerte />
      </div>
      <div style={{ display: "grid", gap: 13, gridTemplateColumns: "1fr 1fr" }}>
        <div>
          <Etiqueta>Monto recibido</Etiqueta>
          <input type="number" step="0.01" style={{ ...inputBase, fontSize: 16, fontWeight: 700 }}
                 value={f.monto} onChange={(e) => setF({ ...f, monto: e.target.value })} />
        </div>
        <div>
          <Etiqueta>Fecha</Etiqueta>
          <input type="date" style={inputBase} value={f.fecha}
                 onChange={(e) => setF({ ...f, fecha: e.target.value })} />
        </div>
        <div>
          <Etiqueta>Forma de pago</Etiqueta>
          <select style={inputBase} value={f.metodo_pago}
                  onChange={(e) => setF({ ...f, metodo_pago: e.target.value })}>
            <option value="efectivo">Efectivo</option>
            <option value="transferencia">Transferencia</option>
            <option value="tarjeta">Tarjeta</option>
            <option value="cheque">Cheque</option>
            <option value="otro">Otro</option>
          </select>
        </div>
        <div>
          <Etiqueta>Referencia</Etiqueta>
          <input style={inputBase} value={f.referencia}
                 onChange={(e) => setF({ ...f, referencia: e.target.value })} />
        </div>
      </div>
      {monto > Number(venta.saldo) + 0.01 && (
        <div style={{ marginTop: 12 }}>
          <Aviso tono="warn" texto="El monto es mayor que el saldo. Se registrará tal cual." />
        </div>
      )}
    </Modal>
  );
}

function Fila({ t, v, fuerte }: { t: string; v: string; fuerte?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "4px 0", fontSize: 13.5 }}>
      <span style={{ color: T.suave }}>{t}</span>
      <span style={{ fontWeight: fuerte ? 800 : 600, fontVariantNumeric: "tabular-nums" }}>{v}</span>
    </div>
  );
}
