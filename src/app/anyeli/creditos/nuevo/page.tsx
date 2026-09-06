"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Aviso, Btn, Card, Cargando, ETIQUETA_FRECUENCIA, Etiqueta, PCT, RD, Seccion,
  Titulo, api, fecha, hoyISO, inputBase, T,
} from "@/components/anyeli/ui";
import {
  FRECUENCIAS, METODOS, TASAS_DISPONIBLES, diasDeFrecuencia,
  generarCronograma, previsualizarRentabilidad,
  type Frecuencia, type Metodo, type ModoReparto, type Prorrateo,
} from "@/lib/anyeli/calculo";
import type { PrCliente, PrConfig, PrInversionistaVista } from "@/types/anyeli";

export default function Pagina() {
  return (
    <Suspense fallback={<Cargando />}>
      <NuevoPrestamo />
    </Suspense>
  );
}

function NuevoPrestamo() {
  const router = useRouter();
  const params = useSearchParams();

  const [clientes, setClientes] = useState<PrCliente[]>([]);
  const [inversionistas, setInversionistas] = useState<PrInversionistaVista[]>([]);
  const [config, setConfig] = useState<PrConfig | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const [f, setF] = useState({
    cliente_id: params.get("cliente") ?? "",
    inversionista_id: "",
    capital: "",
    tasa_interes: 20,
    tasa_libre: "",
    metodo: "interes_fijo" as Metodo,
    frecuencia: "mensual" as Frecuencia,
    dias_periodo: 30,
    num_cuotas: 1,
    fecha_inicio: hoyISO(),
    fecha_primer_pago: "",
    modo_reparto: "tasa" as ModoReparto,
    tasa_inversionista: 12,
    porcentaje_inversionista: 60,
    mora_activa: false,
    tasa_mora: 5,
    dias_gracia: 3,
    garantia: "",
    notas: "",
  });

  useEffect(() => {
    (async () => {
      try {
        const [cs, is, cfg] = await Promise.all([
          api<{ data: PrCliente[] }>("/clientes?activo=true"),
          api<{ data: PrInversionistaVista[] }>("/vistas/ia_v_inversionistas?activo=true&orden=nombre"),
          api<{ data: PrConfig }>("/config"),
        ]);
        setClientes(cs.data ?? []);
        setInversionistas(is.data ?? []);
        setConfig(cfg.data);
        setF((x) => ({
          ...x,
          tasa_interes: Number(cfg.data.tasa_cliente_default) || 20,
          tasa_inversionista: Number(cfg.data.tasa_inv_default) || 12,
          tasa_mora: Number(cfg.data.tasa_mora) || 5,
          dias_gracia: Number(cfg.data.dias_gracia) || 3,
          mora_activa: !!cfg.data.mora_activa_default,
          fecha_primer_pago: primerPagoSugerido(hoyISO(), "mensual", 30),
        }));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al cargar");
      } finally {
        setCargando(false);
      }
    })();
  }, []);

  const set = (k: string, v: unknown) => setF((x) => ({ ...x, [k]: v }));

  useEffect(() => {
    setF((x) => ({ ...x, fecha_primer_pago: primerPagoSugerido(x.fecha_inicio, x.frecuencia, x.dias_periodo) }));
  }, [f.fecha_inicio, f.frecuencia, f.dias_periodo]);

  useEffect(() => {
    const inv = inversionistas.find((i) => i.id === f.inversionista_id);
    if (!inv) return;
    setF((x) => ({
      ...x,
      modo_reparto: inv.modo_reparto_default,
      tasa_inversionista: Number(inv.tasa_default),
      porcentaje_inversionista: Number(inv.porcentaje_default),
    }));
  }, [f.inversionista_id, inversionistas]);

  const capital = Number(f.capital) || 0;
  const tasa = f.tasa_libre !== "" ? Number(f.tasa_libre) : f.tasa_interes;
  const simbolo = config?.simbolo_moneda ?? "RD$";

  const cron = useMemo(() => {
    if (capital <= 0 || !f.fecha_primer_pago) return null;
    return generarCronograma({
      capital,
      tasaInteres: tasa,
      numCuotas: Math.max(1, f.num_cuotas),
      frecuencia: f.frecuencia,
      diasPeriodo: f.dias_periodo,
      metodo: f.metodo,
      fechaPrimerPago: f.fecha_primer_pago,
      prorrateo: config?.metodo_prorrateo as Prorrateo | undefined,
    });
  }, [capital, tasa, f.num_cuotas, f.frecuencia, f.dias_periodo, f.metodo, f.fecha_primer_pago, config]);

  const rent = useMemo(() => {
    if (!cron) return null;
    if (!f.inversionista_id) {
      return { interesTotal: cron.interesTotal, inversionista: 0, administrador: cron.interesTotal, proporcion: 0 };
    }
    return previsualizarRentabilidad(cron, {
      modoReparto: f.modo_reparto,
      tasaInteres: tasa,
      tasaInversionista: f.tasa_inversionista,
      porcentajeInversionista: f.porcentaje_inversionista,
    });
  }, [cron, f.inversionista_id, f.modo_reparto, f.tasa_inversionista, f.porcentaje_inversionista, tasa]);

  async function crear() {
    setError("");
    if (!f.cliente_id) return setError("Selecciona un cliente.");
    if (capital <= 0) return setError("El capital debe ser mayor que cero.");
    if (f.inversionista_id && f.modo_reparto === "tasa" && f.tasa_inversionista > tasa) {
      return setError(
        `La tasa del inversionista (${PCT(f.tasa_inversionista, 1)}) no puede superar la del cliente (${PCT(tasa, 1)}).`
      );
    }

    setGuardando(true);
    try {
      const r = await api<{ data: { id: string } }>("/creditos", {
        metodo: "POST",
        body: {
          cliente_id: f.cliente_id,
          inversionista_id: f.inversionista_id || null,
          capital,
          tasa_interes: tasa,
          metodo: f.metodo,
          frecuencia: f.frecuencia,
          dias_periodo: f.frecuencia === "personalizada" ? f.dias_periodo : diasDeFrecuencia(f.frecuencia),
          num_cuotas: Math.max(1, f.num_cuotas),
          fecha_inicio: f.fecha_inicio,
          fecha_primer_pago: f.fecha_primer_pago,
          modo_reparto: f.modo_reparto,
          tasa_inversionista: f.tasa_inversionista,
          porcentaje_inversionista: f.porcentaje_inversionista,
          mora_activa: f.mora_activa,
          tasa_mora: f.tasa_mora,
          dias_gracia: f.dias_gracia,
          garantia: f.garantia,
          notas: f.notas,
        },
      });
      router.push(`/anyeli/creditos/${r.data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear el préstamo");
      setGuardando(false);
    }
  }

  if (cargando) return <Cargando />;

  return (
    <div>
      <Link href="/anyeli/creditos" style={{ fontSize: 12, color: T.acento, textDecoration: "none" }}>
        ← Préstamos
      </Link>
      <div style={{ height: 8 }} />
      <Titulo
        texto="Nuevo préstamo"
        acciones={<Btn onClick={crear} disabled={guardando}>{guardando ? "Creando…" : "Crear préstamo"}</Btn>}
      />

      {error && <Aviso texto={error} />}

      <div style={{ display: "grid", gap: 18, gridTemplateColumns: "minmax(0, 1.7fr) minmax(320px, 1fr)" }}>
        {/* ─── Formulario ─── */}
        <div style={{ display: "grid", gap: 18 }}>
          <Seccion titulo="1 · Cliente e inversionista">
            <div style={{ display: "grid", gap: 14, gridTemplateColumns: "1fr 1fr" }}>
              <div>
                <Etiqueta>Cliente *</Etiqueta>
                <select style={inputBase} value={f.cliente_id} onChange={(e) => set("cliente_id", e.target.value)}>
                  <option value="">— Selecciona —</option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>{c.nombre}{c.cedula ? ` · ${c.cedula}` : ""}</option>
                  ))}
                </select>
                <div style={{ fontSize: 11, color: T.suave, marginTop: 4 }}>
                  ¿No está? <Link href="/anyeli/clientes" style={{ color: T.acento }}>Regístralo aquí</Link>
                </div>
              </div>
              <div>
                <Etiqueta>Inversionista que pone el capital</Etiqueta>
                <select style={inputBase} value={f.inversionista_id} onChange={(e) => set("inversionista_id", e.target.value)}>
                  <option value="">Capital propio (toda la ganancia es mía)</option>
                  {inversionistas.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.nombre} · disponible {RD(i.capital_disponible, simbolo)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </Seccion>

          <Seccion titulo="2 · Condiciones del préstamo">
            <div style={{ display: "grid", gap: 16 }}>
              <div style={{ display: "grid", gap: 14, gridTemplateColumns: "1fr 1fr" }}>
                <div>
                  <Etiqueta>Monto prestado (capital) *</Etiqueta>
                  <input type="number" step="0.01" min={1} placeholder="0.00"
                         style={{ ...inputBase, fontSize: 17, fontWeight: 700 }}
                         value={f.capital} onChange={(e) => set("capital", e.target.value)} />
                </div>
                <div>
                  <Etiqueta>Fecha de entrega</Etiqueta>
                  <input type="date" style={inputBase} value={f.fecha_inicio}
                         onChange={(e) => set("fecha_inicio", e.target.value)} />
                </div>
              </div>

              <div>
                <Etiqueta>Tasa de interés mensual</Etiqueta>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {TASAS_DISPONIBLES.map((t) => {
                    const activo = f.tasa_libre === "" && f.tasa_interes === t;
                    return (
                      <button key={t} type="button"
                        onClick={() => { set("tasa_interes", t); set("tasa_libre", ""); }}
                        style={{
                          border: activo ? "none" : `1px solid ${T.borde}`,
                          background: activo ? T.acento : T.panel,
                          color: activo ? "#fff" : T.texto,
                          borderRadius: 9, padding: "8px 13px", fontSize: 13.5, fontWeight: 700, cursor: "pointer",
                        }}
                      >{t}%</button>
                    );
                  })}
                  <input type="number" step="0.1" min={0} placeholder="Otra %"
                         style={{ ...inputBase, width: 100 }}
                         value={f.tasa_libre} onChange={(e) => set("tasa_libre", e.target.value)} />
                </div>
                <div style={{ fontSize: 11.5, color: T.suave, marginTop: 7 }}>
                  Tasa aplicada: <strong style={{ color: T.texto }}>{PCT(tasa, 2)} mensual</strong>
                  {cron && f.frecuencia !== "mensual" && (
                    <> · equivale a {PCT(cron.tasaPeriodoPct, 2)} por cuota {ETIQUETA_FRECUENCIA[f.frecuencia].toLowerCase()}</>
                  )}
                </div>
              </div>

              <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
                <div>
                  <Etiqueta>Frecuencia de pago</Etiqueta>
                  <select style={inputBase} value={f.frecuencia}
                          onChange={(e) => set("frecuencia", e.target.value as Frecuencia)}>
                    {FRECUENCIAS.map((x) => <option key={x.valor} value={x.valor}>{x.etiqueta}</option>)}
                  </select>
                </div>
                {f.frecuencia === "personalizada" && (
                  <div>
                    <Etiqueta>Cada cuántos días</Etiqueta>
                    <input type="number" min={1} style={inputBase} value={f.dias_periodo}
                           onChange={(e) => set("dias_periodo", Number(e.target.value))} />
                  </div>
                )}
                <div>
                  <Etiqueta>Cantidad de pagos</Etiqueta>
                  <input type="number" min={1} max={360} style={inputBase} value={f.num_cuotas}
                         onChange={(e) => set("num_cuotas", Number(e.target.value))} />
                </div>
                <div>
                  <Etiqueta>Fecha del primer pago</Etiqueta>
                  <input type="date" style={inputBase} value={f.fecha_primer_pago}
                         onChange={(e) => set("fecha_primer_pago", e.target.value)} />
                </div>
              </div>

              <div>
                <Etiqueta>Forma de cálculo</Etiqueta>
                <div style={{ display: "grid", gap: 9, gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))" }}>
                  {METODOS.map((m) => {
                    const activo = f.metodo === m.valor;
                    return (
                      <button key={m.valor} type="button" onClick={() => set("metodo", m.valor)}
                        style={{
                          textAlign: "left", cursor: "pointer", borderRadius: 11, padding: 13,
                          border: activo ? `1px solid ${T.acento}` : `1px solid ${T.borde}`,
                          background: activo ? "#e6f6f4" : T.panel,
                          boxShadow: activo ? `0 0 0 1px ${T.acento}55` : "none",
                        }}
                      >
                        <div style={{ fontSize: 13.5, fontWeight: 800, color: T.texto }}>{m.etiqueta}</div>
                        <div style={{ fontSize: 11.5, color: T.suave, marginTop: 4, lineHeight: 1.4 }}>{m.ayuda}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </Seccion>

          {f.inversionista_id && (
            <Seccion titulo="3 · Reparto de la ganancia">
              <div style={{ display: "grid", gap: 14, gridTemplateColumns: "1fr 1fr" }}>
                <div>
                  <Etiqueta>Modo de reparto</Etiqueta>
                  <select style={inputBase} value={f.modo_reparto}
                          onChange={(e) => set("modo_reparto", e.target.value as ModoReparto)}>
                    <option value="tasa">Tasa pactada al inversionista</option>
                    <option value="porcentaje">Porcentaje del interés</option>
                  </select>
                </div>
                {f.modo_reparto === "tasa" ? (
                  <div>
                    <Etiqueta>Tasa mensual del inversionista (%)</Etiqueta>
                    <input type="number" step="0.1" min={0} max={tasa} style={inputBase}
                           value={f.tasa_inversionista}
                           onChange={(e) => set("tasa_inversionista", Number(e.target.value))} />
                    <div style={{ fontSize: 11.5, color: T.suave, marginTop: 5 }}>
                      Cliente {PCT(tasa, 1)} − inversionista {PCT(f.tasa_inversionista, 1)} ={" "}
                      <strong style={{ color: T.ok }}>{PCT(Math.max(0, tasa - f.tasa_inversionista), 1)} para mí</strong>
                    </div>
                  </div>
                ) : (
                  <div>
                    <Etiqueta>% del interés para el inversionista</Etiqueta>
                    <input type="number" step="0.1" min={0} max={100} style={inputBase}
                           value={f.porcentaje_inversionista}
                           onChange={(e) => set("porcentaje_inversionista", Number(e.target.value))} />
                    <div style={{ fontSize: 11.5, color: T.suave, marginTop: 5 }}>
                      Me queda{" "}
                      <strong style={{ color: T.ok }}>{PCT(Math.max(0, 100 - f.porcentaje_inversionista), 1)}</strong>{" "}
                      del interés.
                    </div>
                  </div>
                )}
              </div>
            </Seccion>
          )}

          <Seccion titulo="4 · Mora y detalles">
            <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, paddingTop: 18 }}>
                <input type="checkbox" checked={f.mora_activa}
                       onChange={(e) => set("mora_activa", e.target.checked)} />
                Cobrar mora por atraso
              </label>
              <div>
                <Etiqueta>Tasa de mora (% de la cuota)</Etiqueta>
                <input type="number" step="0.1" style={inputBase} disabled={!f.mora_activa}
                       value={f.tasa_mora} onChange={(e) => set("tasa_mora", Number(e.target.value))} />
              </div>
              <div>
                <Etiqueta>Días de gracia</Etiqueta>
                <input type="number" min={0} style={inputBase} value={f.dias_gracia}
                       onChange={(e) => set("dias_gracia", Number(e.target.value))} />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <Etiqueta>Garantía / colateral</Etiqueta>
                <input style={inputBase} value={f.garantia}
                       placeholder="Ej.: matrícula de vehículo, electrodoméstico, pagaré…"
                       onChange={(e) => set("garantia", e.target.value)} />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <Etiqueta>Notas</Etiqueta>
                <textarea style={{ ...inputBase, minHeight: 60 }} value={f.notas}
                          onChange={(e) => set("notas", e.target.value)} />
              </div>
            </div>
          </Seccion>
        </div>

        {/* ─── Resumen en vivo ─── */}
        <div style={{ display: "grid", gap: 18, alignContent: "start", position: "sticky", top: 20 }}>
          <Seccion titulo="Resumen del préstamo">
            {!cron ? (
              <div style={{ padding: "18px 0", textAlign: "center", color: T.suave, fontSize: 13.5 }}>
                Escribe el monto para ver el cálculo.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 8, fontSize: 13.5 }}>
                <Linea t="Capital entregado" v={RD(capital, simbolo)} />
                <Linea t="Interés total" v={RD(cron.interesTotal, simbolo)} />
                <Linea t="Total a pagar" v={RD(cron.totalAPagar, simbolo)} fuerte />
                <div style={{ borderTop: `1px dashed ${T.borde}`, margin: "4px 0" }} />
                <Linea t={`Cuota ${ETIQUETA_FRECUENCIA[f.frecuencia].toLowerCase()}`} v={RD(cron.montoCuota, simbolo)} fuerte />
                <Linea t="Cantidad de pagos" v={String(cron.cuotas.length)} />
                <Linea t="Primer pago" v={fecha(f.fecha_primer_pago)} />
                <Linea t="Último pago" v={fecha(cron.fechaFin)} />
              </div>
            )}
          </Seccion>

          {rent && (
            <Seccion titulo="Reparto de la ganancia">
              <div style={{ display: "flex", height: 12, borderRadius: 99, overflow: "hidden", background: "#dde5ec", marginBottom: 12 }}>
                <div style={{ width: `${rent.interesTotal ? (rent.inversionista / rent.interesTotal) * 100 : 0}%`, background: T.acento2 }} />
                <div style={{ width: `${rent.interesTotal ? (rent.administrador / rent.interesTotal) * 100 : 100}%`, background: T.ok }} />
              </div>
              <div style={{ display: "grid", gap: 8, fontSize: 13.5 }}>
                <Linea t="● Inversionista" v={RD(rent.inversionista, simbolo)} color={T.acento2} />
                <Linea t="● Yo (administrador)" v={RD(rent.administrador, simbolo)} color={T.ok} fuerte />
              </div>
              {!f.inversionista_id && (
                <div style={{ fontSize: 11.5, color: T.suave, marginTop: 9 }}>
                  Capital propio: toda la ganancia queda para ti.
                </div>
              )}
            </Seccion>
          )}

          {cron && (
            <Card style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ padding: "13px 18px", borderBottom: `1px solid ${T.borde}`, background: T.panel2, fontSize: 13.5, fontWeight: 800 }}>
                Cronograma ({cron.cuotas.length} pagos)
              </div>
              <div style={{ maxHeight: 330, overflowY: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                  <thead>
                    <tr>
                      {["#", "Vence", "Capital", "Interés", "Cuota"].map((h, i) => (
                        <th key={h} style={{
                          textAlign: i > 1 ? "right" : "left", padding: "8px 10px", color: T.suave,
                          fontSize: 10.5, textTransform: "uppercase", borderBottom: `1px solid ${T.borde}`,
                          position: "sticky", top: 0, background: T.panel,
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {cron.cuotas.map((c) => (
                      <tr key={c.numero} style={{ borderBottom: `1px solid ${T.borde}66` }}>
                        <td style={{ padding: "7px 10px" }}>{c.numero}</td>
                        <td style={{ padding: "7px 10px", whiteSpace: "nowrap" }}>{fecha(c.fecha_vencimiento)}</td>
                        <td style={{ padding: "7px 10px", textAlign: "right" }}>{RD(c.capital, simbolo)}</td>
                        <td style={{ padding: "7px 10px", textAlign: "right" }}>{RD(c.interes, simbolo)}</td>
                        <td style={{ padding: "7px 10px", textAlign: "right", fontWeight: 700 }}>{RD(c.total, simbolo)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Linea({ t, v, fuerte, color }: { t: string; v: string; fuerte?: boolean; color?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
      <span style={{ color: color ?? T.suave }}>{t}</span>
      <span style={{
        fontVariantNumeric: "tabular-nums",
        fontWeight: fuerte ? 800 : 600,
        fontSize: fuerte ? 15 : undefined,
        color: color ?? T.texto,
      }}>{v}</span>
    </div>
  );
}

function primerPagoSugerido(inicio: string, frecuencia: Frecuencia, dias: number): string {
  const [y, m, d] = inicio.slice(0, 10).split("-").map(Number);
  const base = new Date(y, m - 1, d);
  if (frecuencia === "mensual") {
    const x = new Date(base.getFullYear(), base.getMonth() + 1, 1);
    const ult = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate();
    x.setDate(Math.min(base.getDate(), ult));
    return iso(x);
  }
  const salto = frecuencia === "quincenal" ? 15 : frecuencia === "semanal" ? 7 : dias || 30;
  base.setDate(base.getDate() + salto);
  return iso(base);
}

function iso(f: Date): string {
  return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}-${String(f.getDate()).padStart(2, "0")}`;
}
