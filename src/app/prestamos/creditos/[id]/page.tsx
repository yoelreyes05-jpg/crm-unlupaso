"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Aviso, Badge, Barra, Btn, Card, Cargando, ETIQUETA_ESTADO_CUOTA, ETIQUETA_FRECUENCIA,
  ETIQUETA_METODO, ETIQUETA_TIPO_PAGO, Etiqueta, Kpi, Modal, PCT, RD, Seccion, Tabla,
  Titulo, Vacio, api, fecha, hoyISO, inputBase, rejilla, tonoCuota, tonoPrestamo, T,
} from "@/components/prestamos/ui";
import {
  FRECUENCIAS, METODOS, TASAS_DISPONIBLES, calcularReenganche, diasDeFrecuencia,
  montoSoloRedito, r2, tasaPeriodo,
  type CuotaEstado, type Frecuencia, type Metodo,
} from "@/lib/prestamos/calculo";
import type { PrConfig, PrCuotaVista, PrPago, PrPrestamoVista, PrReenganche } from "@/types/prestamos";

interface Detalle {
  prestamo: PrPrestamoVista;
  cuotas: PrCuotaVista[];
  pagos: PrPago[];
  reenganches: PrReenganche[];
}

export default function DetallePrestamo() {
  const { id } = useParams<{ id: string }>();
  const [d, setD] = useState<Detalle | null>(null);
  const [cfg, setCfg] = useState<PrConfig | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [ok, setOk] = useState<React.ReactNode>("");
  const [procesando, setProcesando] = useState(false);

  const [modalPago, setModalPago] = useState<PrCuotaVista | null>(null);
  const [modalRedito, setModalRedito] = useState<PrCuotaVista | null>(null);
  const [modalReenganche, setModalReenganche] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const [r, c] = await Promise.all([
        api<{ data: Detalle }>(`/creditos/${id}`),
        api<{ data: PrConfig }>("/config").catch(() => null),
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

  const activas = useMemo(() => (d?.cuotas ?? []).filter((c) => c.activa), [d]);
  const historicas = useMemo(() => (d?.cuotas ?? []).filter((c) => !c.activa), [d]);
  const proxima = useMemo(
    () => activas.find((c) => !["pagada", "condonada", "solo_interes"].includes(c.estado)),
    [activas]
  );

  if (cargando) return <Cargando />;
  if (error && !d) return <Aviso texto={error} />;
  if (!d) return <Vacio texto="Préstamo no encontrado." />;

  const p = d.prestamo;
  const s = cfg?.simbolo_moneda ?? "RD$";
  const miParte = p.modo_reparto === "tasa"
    ? Math.max(0, Number(p.tasa_interes) - Number(p.tasa_inversionista))
    : Math.max(0, 100 - Number(p.porcentaje_inversionista));

  return (
    <div>
      <Link href="/prestamos/creditos" style={{ fontSize: 12, color: T.acento, textDecoration: "none" }}>
        ← Préstamos
      </Link>
      <div style={{ height: 8 }} />

      <Titulo
        texto={p.codigo}
        sub={
          <div>
            <div style={{ display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap", marginBottom: 5 }}>
              <Badge texto={p.estado_visual === "al_dia" ? "al día" : p.estado_visual} tono={tonoPrestamo(p.estado_visual)} />
              {p.ciclo > 1 && <Badge texto={`${p.ciclo - 1} reenganche(s)`} tono="acento" />}
            </div>
            <strong style={{ color: T.texto, fontSize: 14 }}>{p.cliente_nombre}</strong>
            {p.cliente_cedula ? ` · ${p.cliente_cedula}` : ""}
            {p.cliente_telefono ? ` · ${p.cliente_telefono}` : ""}
            <div style={{ marginTop: 2 }}>
              Financia:{" "}
              {p.inversionista_nombre
                ? <Link href={`/prestamos/inversionistas/${p.inversionista_id}`} style={{ color: T.acento }}>{p.inversionista_nombre}</Link>
                : "capital propio"}
              {" · "}{PCT(p.tasa_interes, 1)} mensual · {ETIQUETA_METODO[p.metodo]} · {ETIQUETA_FRECUENCIA[p.frecuencia]}
            </div>
          </div>
        }
        acciones={
          <>
            <Link href={`/prestamos/creditos/${id}/estado`} style={{ textDecoration: "none" }}>
              <Btn tono="neutro">Estado de cuenta</Btn>
            </Link>
            {p.estado === "activo" && proxima && (
              <>
                <Btn tono="neutro" onClick={() => setModalRedito(proxima)}>Pagar solo rédito</Btn>
                <Btn tono="neutro" onClick={() => setModalReenganche(true)}>Reenganche</Btn>
                <Btn tono="ok" onClick={() => setModalPago(proxima)}>Registrar pago</Btn>
              </>
            )}
          </>
        }
      />

      {ok && <Aviso texto={ok} tono="ok" />}
      {error && <Aviso texto={error} />}

      <div style={{ ...rejilla(215), marginBottom: 16 }}>
        <Kpi titulo="Capital prestado" valor={RD(p.capital, s)}
             detalle={Number(p.capital) !== Number(p.capital_original) ? `Original: ${RD(p.capital_original, s)}` : undefined} />
        <Kpi titulo="Monto adeudado" valor={RD(p.saldo_total, s)}
             detalle={`Capital ${RD(p.saldo_capital, s)} + interés ${RD(p.saldo_interes, s)}`}
             tono={p.estado_visual === "atrasado" ? "err" : "neutro"} />
        <Kpi titulo="Ha pagado" valor={RD(p.total_cobrado, s)}
             detalle={`${p.cuotas_pagadas} de ${p.cuotas_totales} cuotas`} tono="ok" />
        <Kpi titulo="Pagos que le quedan" valor={p.cuotas_pendientes}
             detalle={`Termina el ${fecha(p.fecha_fin_real ?? p.fecha_fin_estimada)}`}
             tono={p.cuotas_atrasadas > 0 ? "err" : "neutro"} />
      </div>

      <Card style={{ marginBottom: 18 }}>
        <div style={{ display: "grid", gap: 18, gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" }}>
          <div style={{ gridColumn: "span 2", minWidth: 0 }}>
            <Etiqueta>Avance del préstamo</Etiqueta>
            <Barra valor={Number(p.avance_pct)} />
            <div style={{ fontSize: 11.5, color: T.suave, marginTop: 5 }}>{PCT(p.avance_pct, 1)} cobrado</div>
          </div>
          <div>
            <Etiqueta>Cuota</Etiqueta>
            <div style={{ fontSize: 18, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{RD(p.monto_cuota, s)}</div>
          </div>
          <div>
            <Etiqueta>Mi participación</Etiqueta>
            <div style={{ fontSize: 18, fontWeight: 800, color: T.ok }}>
              {p.modo_reparto === "tasa" ? `${PCT(miParte, 1)} mensual` : `${PCT(miParte, 1)} del interés`}
            </div>
            <div style={{ fontSize: 11.5, color: T.suave }}>
              {p.inversionista_nombre
                ? p.modo_reparto === "tasa"
                  ? `Inversionista: ${PCT(p.tasa_inversionista, 1)}`
                  : `Inversionista: ${PCT(p.porcentaje_inversionista, 1)}`
                : "Capital propio"}
            </div>
          </div>
        </div>
      </Card>

      <Seccion titulo={`Cronograma de pagos · ciclo ${p.ciclo}`} style={{ marginBottom: 18, padding: 0 }}>
        <Tabla
          filaRoja={(f) => f.estado_visual === "atrasada"}
          columnas={[
            { name: "numero", label: "#", fmt: (v) => <strong>{String(v)}</strong> },
            { name: "fecha_vencimiento", label: "Vence",
              fmt: (v, f) => (
                <div style={{ whiteSpace: "nowrap" }}>
                  {fecha(v as string)}
                  {Number(f.dias_atraso) > 0 && (
                    <div style={{ fontSize: 11, fontWeight: 800 }}>{String(f.dias_atraso)} días de atraso</div>
                  )}
                </div>
              ) },
            { name: "capital", label: "Capital", alinear: "right", fmt: (v) => RD(v as number, s) },
            { name: "interes", label: "Interés", alinear: "right", fmt: (v) => RD(v as number, s) },
            { name: "total", label: "Cuota", alinear: "right", fmt: (v) => <strong>{RD(v as number, s)}</strong> },
            { name: "capital_pagado", label: "Pagado", alinear: "right",
              fmt: (v, f) => RD(Number(v) + Number(f.interes_pagado), s) },
            { name: "mora_pendiente", label: "Mora", alinear: "right",
              fmt: (v, f) => Number(f.mora_generada) > 0 ? RD(v as number, s) : "—" },
            { name: "pendiente", label: "Pendiente", alinear: "right",
              fmt: (v, f) => <strong>{RD(Number(v) + Number(f.mora_pendiente), s)}</strong> },
            { name: "estado_visual", label: "Estado",
              fmt: (v, f) => (
                <div>
                  <Badge texto={ETIQUETA_ESTADO_CUOTA[String(v)] ?? String(v)} tono={tonoCuota(String(v))} />
                  {f.origen === "solo_interes" && (
                    <div style={{ marginTop: 3 }}><Badge texto="capital diferido" tono="acento" /></div>
                  )}
                </div>
              ) },
          ]}
          filas={activas as unknown as Record<string, unknown>[]}
          acciones={(f) =>
            p.estado === "activo" && !["pagada", "condonada", "solo_interes"].includes(String(f.estado)) ? (
              <div style={{ display: "flex", gap: 9 }}>
                <button onClick={() => setModalPago(f as unknown as PrCuotaVista)}
                        style={{ background: "transparent", border: "none", color: T.ok, cursor: "pointer", fontSize: 12.5, fontWeight: 700 }}>
                  Pagar
                </button>
                <button onClick={() => setModalRedito(f as unknown as PrCuotaVista)}
                        style={{ background: "transparent", border: "none", color: T.acento, cursor: "pointer", fontSize: 12.5, fontWeight: 700 }}>
                  Rédito
                </button>
              </div>
            ) : null
          }
        />
        {historicas.length > 0 && (
          <details style={{ padding: "12px 18px", borderTop: `1px solid ${T.borde}` }}>
            <summary style={{ cursor: "pointer", fontSize: 12, color: T.suave, fontWeight: 700 }}>
              Ver {historicas.length} cuota(s) de ciclos anteriores (reemplazadas por reenganche)
            </summary>
            <div style={{ marginTop: 10, opacity: 0.7 }}>
              <Tabla
                columnas={[
                  { name: "ciclo", label: "Ciclo" },
                  { name: "numero", label: "#" },
                  { name: "fecha_vencimiento", label: "Vencía", fmt: (v) => fecha(v as string) },
                  { name: "total", label: "Cuota", alinear: "right", fmt: (v) => RD(v as number, s) },
                  { name: "estado", label: "Estado", fmt: (v) => ETIQUETA_ESTADO_CUOTA[String(v)] ?? String(v) },
                ]}
                filas={historicas as unknown as Record<string, unknown>[]}
              />
            </div>
          </details>
        )}
      </Seccion>

      <div style={{ display: "grid", gap: 18, gridTemplateColumns: "repeat(auto-fit, minmax(430px, 1fr))", marginBottom: 18 }}>
        <Seccion titulo={`Pagos registrados (${d.pagos.filter((x) => !x.anulado).length})`} style={{ padding: 0 }}>
          {d.pagos.length === 0 ? <Vacio texto="Aún no hay pagos." /> : (
            <Tabla
              columnas={[
                { name: "recibo", label: "Recibo", fmt: (v, f) => (
                  <span style={{ fontSize: 12, textDecoration: f.anulado ? "line-through" : undefined }}>{String(v)}</span>
                ) },
                { name: "fecha", label: "Fecha", fmt: (v) => fecha(v as string) },
                { name: "tipo", label: "Tipo",
                  fmt: (v) => <Badge texto={ETIQUETA_TIPO_PAGO[String(v)] ?? String(v)} tono={v === "solo_interes" ? "acento" : "neutro"} /> },
                { name: "monto_capital", label: "Capital", alinear: "right", fmt: (v) => RD(v as number, s) },
                { name: "monto_interes", label: "Interés", alinear: "right", fmt: (v) => RD(v as number, s) },
                { name: "monto", label: "Total", alinear: "right", fmt: (v) => <strong>{RD(v as number, s)}</strong> },
              ]}
              filas={d.pagos as unknown as Record<string, unknown>[]}
              acciones={(f) => (
                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", alignItems: "center" }}>
                  <Link
                    href={`/prestamos/creditos/${id}/recibo/${f.id}`}
                    style={{ color: T.acento, fontSize: 12.5, fontWeight: 700, textDecoration: "none" }}
                  >
                    Recibo
                  </Link>
                  {f.anulado ? <Badge texto="anulado" tono="err" /> : (
                  <button
                    onClick={async () => {
                      if (!confirm("¿Anular este pago? Se revertirá en las cuotas y en la contabilidad.")) return;
                      setProcesando(true); setError("");
                      try {
                        await api("/anular-pago", { metodo: "POST", body: { pago_id: f.id } });
                        setOk("Pago anulado.");
                        await cargar();
                      } catch (e) {
                        setError(e instanceof Error ? e.message : "Error");
                      } finally { setProcesando(false); }
                    }}
                    disabled={procesando}
                    style={{ background: "transparent", border: "none", color: T.err, cursor: "pointer", fontSize: 12.5, fontWeight: 700 }}
                  >Anular</button>
                  )}
                </div>
              )}
            />
          )}
        </Seccion>

        <Seccion titulo={`Reenganches (${d.reenganches.length})`} style={{ padding: 0 }}>
          {d.reenganches.length === 0 ? <Vacio texto="Este préstamo no tiene reenganches." /> : (
            <Tabla
              columnas={[
                { name: "fecha", label: "Fecha", fmt: (v) => fecha(v as string) },
                { name: "saldo_capital_previo", label: "Saldo previo", alinear: "right", fmt: (v) => RD(v as number, s) },
                { name: "monto_adicional", label: "Adicional", alinear: "right",
                  fmt: (v) => <strong style={{ color: T.acento }}>+ {RD(v as number, s)}</strong> },
                { name: "capital_nuevo", label: "Capital nuevo", alinear: "right", fmt: (v) => <strong>{RD(v as number, s)}</strong> },
                { name: "tasa_nueva", label: "Tasa", alinear: "right", fmt: (v) => PCT(v as number, 1) },
                { name: "num_cuotas_nuevas", label: "Cuotas", alinear: "right" },
              ]}
              filas={d.reenganches as unknown as Record<string, unknown>[]}
            />
          )}
        </Seccion>
      </div>

      {p.garantia && (
        <Seccion titulo="Garantía"><div style={{ fontSize: 13.5 }}>{p.garantia}</div></Seccion>
      )}

      {/* ═══ MODALES ═══ */}
      {modalPago && (
        <ModalPago
          cuota={modalPago} prestamo={p} simbolo={s} procesando={procesando}
          onCerrar={() => setModalPago(null)}
          onGuardar={async (body) => {
            setProcesando(true); setError("");
            try {
              const r = await api<{ data: { pago: { id: string; recibo: string } } }>(
                "/pagos", { metodo: "POST", body }
              );
              const nuevo = r.data?.pago;
              setOk(
                <>
                  Pago registrado correctamente.{" "}
                  {nuevo && (
                    <Link
                      href={`/prestamos/creditos/${id}/recibo/${nuevo.id}`}
                      style={{ color: "inherit", fontWeight: 800, textDecoration: "underline" }}
                    >
                      Imprimir recibo {nuevo.recibo} →
                    </Link>
                  )}
                </>
              );
              setModalPago(null);
              await cargar();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Error al registrar el pago");
            } finally { setProcesando(false); }
          }}
        />
      )}

      {modalRedito && (
        <ModalRedito
          cuota={modalRedito} prestamo={p} simbolo={s} config={cfg} procesando={procesando}
          onCerrar={() => setModalRedito(null)}
          onGuardar={async (body) => {
            setProcesando(true); setError("");
            try {
              const r = await api<{ data: { pago: { id: string; recibo: string } } }>(
                "/solo-redito", { metodo: "POST", body }
              );
              const nuevo = r.data?.pago;
              setOk(
                <>
                  Rédito registrado. El capital se trasladó al final del cronograma con su nuevo interés.{" "}
                  {nuevo && (
                    <Link
                      href={`/prestamos/creditos/${id}/recibo/${nuevo.id}`}
                      style={{ color: "inherit", fontWeight: 800, textDecoration: "underline" }}
                    >
                      Imprimir recibo {nuevo.recibo} →
                    </Link>
                  )}
                </>
              );
              setModalRedito(null);
              await cargar();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Error");
            } finally { setProcesando(false); }
          }}
        />
      )}

      {modalReenganche && (
        <ModalReenganche
          prestamo={p} cuotas={activas} simbolo={s} procesando={procesando}
          onCerrar={() => setModalReenganche(false)}
          onGuardar={async (body) => {
            setProcesando(true); setError("");
            try {
              await api("/reenganche", { metodo: "POST", body });
              setOk("Reenganche aplicado. Se generó un cronograma nuevo.");
              setModalReenganche(false);
              await cargar();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Error");
            } finally { setProcesando(false); }
          }}
        />
      )}
    </div>
  );
}

/* ═══════════════════ MODAL: registrar pago ═══════════════════ */
function ModalPago({
  cuota, prestamo, simbolo, procesando, onCerrar, onGuardar,
}: {
  cuota: PrCuotaVista;
  prestamo: PrPrestamoVista;
  simbolo: string;
  procesando: boolean;
  onCerrar: () => void;
  onGuardar: (body: Record<string, unknown>) => void;
}) {
  const pendienteCuota = r2(Number(cuota.pendiente) + Number(cuota.mora_pendiente));
  const [tipo, setTipo] = useState<"cuota" | "abono_capital" | "saldo_total" | "mora">("cuota");
  const [monto, setMonto] = useState(String(pendienteCuota));
  const [f, setF] = useState({ fecha: hoyISO(), metodo_pago: "efectivo", referencia: "", notas: "" });

  useEffect(() => {
    if (tipo === "saldo_total") setMonto(String(Number(prestamo.saldo_total)));
    else if (tipo === "cuota") setMonto(String(pendienteCuota));
    else if (tipo === "mora") setMonto(String(Number(cuota.mora_pendiente)));
    else setMonto("");
  }, [tipo, pendienteCuota, prestamo.saldo_total, cuota.mora_pendiente]);

  return (
    <Modal
      abierto titulo={`Registrar pago · cuota #${cuota.numero}`} onCerrar={onCerrar} ancho={540}
      pie={
        <>
          <Btn tono="neutro" onClick={onCerrar}>Cancelar</Btn>
          <Btn tono="ok" disabled={procesando || !Number(monto)}
               onClick={() => onGuardar({
                 prestamo_id: prestamo.id,
                 cuota_id: tipo === "abono_capital" ? null : cuota.id,
                 fecha: f.fecha, monto: Number(monto), tipo,
                 metodo_pago: f.metodo_pago, referencia: f.referencia, notas: f.notas,
               })}>
            {procesando ? "Guardando…" : "Registrar pago"}
          </Btn>
        </>
      }
    >
      <div style={{ background: T.panel2, border: `1px solid ${T.borde}`, borderRadius: 10, padding: 13, marginBottom: 15, fontSize: 13.5 }}>
        <Fila t={`Cuota #${cuota.numero} vence`} v={fecha(cuota.fecha_vencimiento)} />
        <Fila t="Pendiente de esta cuota" v={RD(pendienteCuota, simbolo)} fuerte />
        <Fila t="Saldo total del préstamo" v={RD(prestamo.saldo_total, simbolo)} />
        {cuota.dias_atraso > 0 && (
          <div style={{ marginTop: 6, color: T.err, fontWeight: 800 }}>{cuota.dias_atraso} días de atraso</div>
        )}
      </div>

      <div style={{ display: "grid", gap: 13 }}>
        <div>
          <Etiqueta>Tipo de pago</Etiqueta>
          <select style={inputBase} value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)}>
            <option value="cuota">Pago de cuota (mora → interés → capital)</option>
            <option value="abono_capital">Abono extraordinario a capital</option>
            <option value="saldo_total">Saldar el préstamo completo</option>
            <option value="mora">Pago de mora únicamente</option>
          </select>
        </div>
        <div style={{ display: "grid", gap: 13, gridTemplateColumns: "1fr 1fr" }}>
          <div>
            <Etiqueta>Monto recibido</Etiqueta>
            <input type="number" step="0.01" style={{ ...inputBase, fontSize: 16, fontWeight: 700 }}
                   value={monto} onChange={(e) => setMonto(e.target.value)} />
          </div>
          <div>
            <Etiqueta>Fecha del pago</Etiqueta>
            <input type="date" style={inputBase} value={f.fecha} onChange={(e) => setF({ ...f, fecha: e.target.value })} />
          </div>
          <div>
            <Etiqueta>Método</Etiqueta>
            <select style={inputBase} value={f.metodo_pago} onChange={(e) => setF({ ...f, metodo_pago: e.target.value })}>
              <option value="efectivo">Efectivo</option>
              <option value="transferencia">Transferencia</option>
              <option value="cheque">Cheque</option>
              <option value="tarjeta">Tarjeta</option>
              <option value="otro">Otro</option>
            </select>
          </div>
          <div>
            <Etiqueta>Referencia</Etiqueta>
            <input style={inputBase} value={f.referencia} onChange={(e) => setF({ ...f, referencia: e.target.value })} />
          </div>
        </div>
        <div>
          <Etiqueta>Notas</Etiqueta>
          <input style={inputBase} value={f.notas} onChange={(e) => setF({ ...f, notas: e.target.value })} />
        </div>
      </div>

      {Number(monto) > pendienteCuota && tipo === "cuota" && (
        <div style={{ marginTop: 13 }}>
          <Aviso tono="info" texto="El excedente se aplicará automáticamente a las cuotas siguientes." />
        </div>
      )}
    </Modal>
  );
}

/* ═══════════════════ MODAL: solo rédito ═══════════════════ */
function ModalRedito({
  cuota, prestamo, simbolo, config, procesando, onCerrar, onGuardar,
}: {
  cuota: PrCuotaVista;
  prestamo: PrPrestamoVista;
  simbolo: string;
  config: PrConfig | null;
  procesando: boolean;
  onCerrar: () => void;
  onGuardar: (body: Record<string, unknown>) => void;
}) {
  const sugerido = montoSoloRedito(cuota as unknown as CuotaEstado);
  const [monto, setMonto] = useState(String(sugerido));
  const [f, setF] = useState({ fecha: hoyISO(), metodo_pago: "efectivo", referencia: "" });

  const capitalDiferido = r2(Number(cuota.capital) - Number(cuota.capital_pagado));
  const iPer = tasaPeriodo(
    Number(prestamo.tasa_interes),
    prestamo.frecuencia,
    Number(prestamo.dias_periodo),
    config?.metodo_prorrateo
  );
  const nuevoInteres = r2(capitalDiferido * iPer);

  return (
    <Modal
      abierto titulo={`Pago de solo rédito · cuota #${cuota.numero}`} onCerrar={onCerrar} ancho={540}
      pie={
        <>
          <Btn tono="neutro" onClick={onCerrar}>Cancelar</Btn>
          <Btn disabled={procesando || !Number(monto)}
               onClick={() => onGuardar({
                 prestamo_id: prestamo.id, cuota_id: cuota.id,
                 fecha: f.fecha, monto: Number(monto),
                 metodo_pago: f.metodo_pago, referencia: f.referencia,
               })}>
            {procesando ? "Guardando…" : "Registrar rédito"}
          </Btn>
        </>
      }
    >
      <Aviso tono="info" texto="El cliente paga únicamente el interés del período. El capital de esta cuota se traslada al final del cronograma y vuelve a generar rédito." />

      <div style={{ background: T.panel2, border: `1px solid ${T.borde}`, borderRadius: 10, padding: 13, marginBottom: 15, fontSize: 13.5 }}>
        <Fila t="Rédito de esta cuota" v={RD(Number(cuota.interes) - Number(cuota.interes_pagado), simbolo)} fuerte />
        {Number(cuota.mora_pendiente) > 0 && (
          <Fila t="Mora pendiente" v={RD(cuota.mora_pendiente, simbolo)} color={T.err} />
        )}
        <div style={{ borderTop: `1px dashed ${T.borde}`, margin: "10px 0 8px" }} />
        <Etiqueta>Lo que quedará para el próximo período</Etiqueta>
        <Fila t="Capital diferido" v={RD(capitalDiferido, simbolo)} />
        <Fila t={`+ Rédito (${PCT(iPer * 100, 2)})`} v={RD(nuevoInteres, simbolo)} />
        <div style={{ borderTop: `1px solid ${T.borde}`, marginTop: 8, paddingTop: 8 }}>
          <Fila t="Nueva cuota" v={RD(capitalDiferido + nuevoInteres, simbolo)} fuerte color={T.acento} />
        </div>
      </div>

      <div style={{ display: "grid", gap: 13, gridTemplateColumns: "1fr 1fr" }}>
        <div>
          <Etiqueta>Monto recibido</Etiqueta>
          <input type="number" step="0.01" style={{ ...inputBase, fontSize: 16, fontWeight: 700 }}
                 value={monto} onChange={(e) => setMonto(e.target.value)} />
        </div>
        <div>
          <Etiqueta>Fecha</Etiqueta>
          <input type="date" style={inputBase} value={f.fecha} onChange={(e) => setF({ ...f, fecha: e.target.value })} />
        </div>
        <div>
          <Etiqueta>Método</Etiqueta>
          <select style={inputBase} value={f.metodo_pago} onChange={(e) => setF({ ...f, metodo_pago: e.target.value })}>
            <option value="efectivo">Efectivo</option>
            <option value="transferencia">Transferencia</option>
            <option value="cheque">Cheque</option>
            <option value="tarjeta">Tarjeta</option>
            <option value="otro">Otro</option>
          </select>
        </div>
        <div>
          <Etiqueta>Referencia</Etiqueta>
          <input style={inputBase} value={f.referencia} onChange={(e) => setF({ ...f, referencia: e.target.value })} />
        </div>
      </div>
    </Modal>
  );
}

/* ═══════════════════ MODAL: reenganche ═══════════════════ */
function ModalReenganche({
  prestamo, cuotas, simbolo, procesando, onCerrar, onGuardar,
}: {
  prestamo: PrPrestamoVista;
  cuotas: PrCuotaVista[];
  simbolo: string;
  procesando: boolean;
  onCerrar: () => void;
  onGuardar: (body: Record<string, unknown>) => void;
}) {
  const [f, setF] = useState({
    fecha: hoyISO(),
    monto_adicional: "",
    capitalizar_interes: false,
    tasa_interes: Number(prestamo.tasa_interes),
    num_cuotas: Number(prestamo.num_cuotas),
    frecuencia: prestamo.frecuencia as Frecuencia,
    dias_periodo: Number(prestamo.dias_periodo),
    metodo: prestamo.metodo as Metodo,
    fecha_primer_pago: "",
    notas: "",
  });

  useEffect(() => {
    const base = new Date();
    const x = f.frecuencia === "mensual"
      ? new Date(base.getFullYear(), base.getMonth() + 1, base.getDate())
      : new Date(base.getTime() +
          (f.frecuencia === "quincenal" ? 15 : f.frecuencia === "semanal" ? 7 : f.dias_periodo) * 86400000);
    setF((s) => ({
      ...s,
      fecha_primer_pago: `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`,
    }));
  }, [f.frecuencia, f.dias_periodo]);

  const preview = useMemo(() => {
    if (!f.fecha_primer_pago) return null;
    return calcularReenganche({
      cuotasActivas: cuotas as unknown as CuotaEstado[],
      montoAdicional: Number(f.monto_adicional) || 0,
      capitalizarInteresPendiente: f.capitalizar_interes,
      tasaInteres: f.tasa_interes,
      numCuotas: Math.max(1, f.num_cuotas),
      frecuencia: f.frecuencia,
      diasPeriodo: f.dias_periodo,
      metodo: f.metodo,
      fechaPrimerPago: f.fecha_primer_pago,
    });
  }, [cuotas, f]);

  return (
    <Modal
      abierto titulo="Reenganche" onCerrar={onCerrar} ancho={900}
      pie={
        <>
          <Btn tono="neutro" onClick={onCerrar}>Cancelar</Btn>
          <Btn disabled={procesando || !Number(f.monto_adicional)}
               onClick={() => onGuardar({
                 prestamo_id: prestamo.id,
                 fecha: f.fecha,
                 monto_adicional: Number(f.monto_adicional),
                 capitalizar_interes: f.capitalizar_interes,
                 tasa_interes: f.tasa_interes,
                 num_cuotas: Math.max(1, f.num_cuotas),
                 frecuencia: f.frecuencia,
                 dias_periodo: f.frecuencia === "personalizada" ? f.dias_periodo : diasDeFrecuencia(f.frecuencia),
                 metodo: f.metodo,
                 fecha_primer_pago: f.fecha_primer_pago,
                 notas: f.notas,
               })}>
            {procesando ? "Aplicando…" : "Aplicar reenganche"}
          </Btn>
        </>
      }
    >
      <div style={{ display: "grid", gap: 20, gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
        <div style={{ display: "grid", gap: 13, alignContent: "start" }}>
          <Aviso tono="warn" texto="El saldo de capital pendiente se suma al dinero adicional y sobre ese nuevo capital se aplica otra vez el porcentaje. El cronograma anterior se cierra." />

          <div>
            <Etiqueta>Dinero adicional que se le entrega *</Etiqueta>
            <input type="number" step="0.01" min={1} placeholder="0.00"
                   style={{ ...inputBase, fontSize: 17, fontWeight: 700 }}
                   value={f.monto_adicional} onChange={(e) => setF({ ...f, monto_adicional: e.target.value })} />
          </div>

          <label style={{ display: "flex", gap: 9, alignItems: "flex-start", fontSize: 13.5 }}>
            <input type="checkbox" checked={f.capitalizar_interes} style={{ marginTop: 3 }}
                   onChange={(e) => setF({ ...f, capitalizar_interes: e.target.checked })} />
            <span>
              Capitalizar el interés pendiente
              <span style={{ display: "block", fontSize: 11.5, color: T.suave }}>
                Si no lo marcas, el interés no cobrado del cronograma anterior se descarta y se empieza limpio.
              </span>
            </span>
          </label>

          <div>
            <Etiqueta>Tasa mensual del nuevo préstamo</Etiqueta>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {TASAS_DISPONIBLES.map((t) => {
                const activo = f.tasa_interes === t;
                return (
                  <button key={t} type="button" onClick={() => setF({ ...f, tasa_interes: t })}
                    style={{
                      border: activo ? "none" : `1px solid ${T.borde}`,
                      background: activo ? T.acento : T.panel,
                      color: activo ? "#fff" : T.texto,
                      borderRadius: 8, padding: "6px 11px", fontSize: 12.5, fontWeight: 700, cursor: "pointer",
                    }}
                  >{t}%</button>
                );
              })}
            </div>
          </div>

          <div style={{ display: "grid", gap: 13, gridTemplateColumns: "1fr 1fr" }}>
            <div>
              <Etiqueta>Frecuencia</Etiqueta>
              <select style={inputBase} value={f.frecuencia}
                      onChange={(e) => setF({ ...f, frecuencia: e.target.value as Frecuencia })}>
                {FRECUENCIAS.map((x) => <option key={x.valor} value={x.valor}>{x.etiqueta}</option>)}
              </select>
            </div>
            {f.frecuencia === "personalizada" && (
              <div>
                <Etiqueta>Cada N días</Etiqueta>
                <input type="number" min={1} style={inputBase} value={f.dias_periodo}
                       onChange={(e) => setF({ ...f, dias_periodo: Number(e.target.value) })} />
              </div>
            )}
            <div>
              <Etiqueta>Cantidad de pagos</Etiqueta>
              <input type="number" min={1} style={inputBase} value={f.num_cuotas}
                     onChange={(e) => setF({ ...f, num_cuotas: Number(e.target.value) })} />
            </div>
            <div>
              <Etiqueta>Fecha del reenganche</Etiqueta>
              <input type="date" style={inputBase} value={f.fecha}
                     onChange={(e) => setF({ ...f, fecha: e.target.value })} />
            </div>
            <div>
              <Etiqueta>Primer pago nuevo</Etiqueta>
              <input type="date" style={inputBase} value={f.fecha_primer_pago}
                     onChange={(e) => setF({ ...f, fecha_primer_pago: e.target.value })} />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <Etiqueta>Forma de cálculo</Etiqueta>
              <select style={inputBase} value={f.metodo}
                      onChange={(e) => setF({ ...f, metodo: e.target.value as Metodo })}>
                {METODOS.map((m) => <option key={m.valor} value={m.valor}>{m.etiqueta}</option>)}
              </select>
            </div>
          </div>
        </div>

        {preview && (
          <div style={{ background: T.panel2, border: `1px solid ${T.borde}`, borderRadius: 12, padding: 16, alignSelf: "start" }}>
            <Etiqueta>Cómo queda el préstamo</Etiqueta>
            <div style={{ display: "grid", gap: 7, fontSize: 13.5, marginBottom: 13 }}>
              <Fila t="Saldo de capital pendiente" v={RD(preview.saldoCapitalPrevio, simbolo)} />
              {f.capitalizar_interes && <Fila t="+ Interés capitalizado" v={RD(preview.interesPendiente, simbolo)} />}
              <Fila t="+ Dinero adicional" v={RD(Number(f.monto_adicional) || 0, simbolo)} color={T.acento} />
              <div style={{ borderTop: `1px solid ${T.borde}`, paddingTop: 7 }}>
                <Fila t="= Capital nuevo" v={RD(preview.capitalNuevo, simbolo)} fuerte />
              </div>
              <Fila t="Interés total" v={RD(preview.cronograma.interesTotal, simbolo)} />
              <Fila t="Total a pagar" v={RD(preview.cronograma.totalAPagar, simbolo)} fuerte />
              <Fila t="Nueva cuota" v={RD(preview.cronograma.montoCuota, simbolo)} fuerte color={T.ok} />
              <Fila t="Termina el" v={fecha(preview.cronograma.fechaFin)} />
            </div>
            <div style={{ maxHeight: 230, overflowY: "auto", background: T.panel, border: `1px solid ${T.borde}`, borderRadius: 9 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                <thead>
                  <tr>
                    {["#", "Vence", "Cuota"].map((h, i) => (
                      <th key={h} style={{
                        textAlign: i === 2 ? "right" : "left", padding: "7px 10px", color: T.suave,
                        fontSize: 10.5, textTransform: "uppercase", borderBottom: `1px solid ${T.borde}`,
                        position: "sticky", top: 0, background: T.panel,
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.cronograma.cuotas.map((c) => (
                    <tr key={c.numero} style={{ borderBottom: `1px solid ${T.borde}66` }}>
                      <td style={{ padding: "6px 10px" }}>{c.numero}</td>
                      <td style={{ padding: "6px 10px" }}>{fecha(c.fecha_vencimiento)}</td>
                      <td style={{ padding: "6px 10px", textAlign: "right", fontWeight: 700 }}>{RD(c.total, simbolo)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function Fila({ t, v, fuerte, color }: { t: string; v: string; fuerte?: boolean; color?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "2px 0" }}>
      <span style={{ color: color ?? T.suave }}>{t}</span>
      <span style={{
        fontVariantNumeric: "tabular-nums",
        fontWeight: fuerte ? 800 : 600,
        color: color ?? T.texto,
      }}>{v}</span>
    </div>
  );
}
