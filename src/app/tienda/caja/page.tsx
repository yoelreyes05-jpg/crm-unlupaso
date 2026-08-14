"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Aviso, Badge, Btn, Cargando, Etiqueta, Kpi, Modal, RD, Seccion, Tabla, Titulo,
  Vacio, api, fecha, hoyISO, inputBase, rejilla, T,
} from "@/components/tienda/ui";
import { METODOS_PAGO } from "@/lib/tienda/negocio";

interface Sesion {
  id: string; fecha_apertura: string; fecha_cierre: string | null;
  monto_inicial: number; monto_contado: number | null; esperado_cierre: number | null;
  diferencia: number | null; estado: string; notas: string | null;
  abierta_por: string | null; cerrada_por: string | null;
  ingresos_efectivo: number; egresos_efectivo: number;
  ingresos_otros: number; egresos_otros: number;
  movimientos: number; efectivo_esperado: number;
}
interface Movimiento {
  id: string; fecha: string; tipo: string; categoria: string; concepto: string;
  monto: number; metodo_pago: string; referencia: string | null; origen: string;
}

export default function CajaPage() {
  const [abierta, setAbierta] = useState<Sesion | null>(null);
  const [historial, setHistorial] = useState<Sesion[]>([]);
  const [movs, setMovs] = useState<Movimiento[]>([]);
  const [simbolo, setSimbolo] = useState("RD$");
  const [fondo, setFondo] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [modal, setModal] = useState<"abrir" | "cerrar" | "movimiento" | null>(null);

  const cargar = useCallback(async () => {
    try {
      const [r, cfg] = await Promise.all([
        api<{ data: { abierta: Sesion | null; historial: Sesion[]; movimientos: Movimiento[] } }>("/caja"),
        api<{ data: { simbolo_moneda: string; fondo_caja: number } }>("/config").catch(() => null),
      ]);
      setAbierta(r.data.abierta);
      setHistorial(r.data.historial ?? []);
      setMovs(r.data.movimientos ?? []);
      if (cfg?.data) {
        setSimbolo(cfg.data.simbolo_moneda ?? "RD$");
        setFondo(Number(cfg.data.fondo_caja ?? 0));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar la caja");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { void cargar(); }, [cargar]);

  async function accion(body: Record<string, unknown>, mensaje: string) {
    setProcesando(true); setError(""); setOk("");
    try {
      await api("/caja", { metodo: "POST", body });
      setOk(mensaje);
      setModal(null);
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally { setProcesando(false); }
  }

  if (cargando) return <Cargando />;

  return (
    <div>
      <Titulo
        texto="💵  Caja"
        sub={abierta ? "Hay una caja abierta" : "No hay caja abierta"}
        acciones={
          abierta ? (
            <>
              <Btn tono="neutro" onClick={() => setModal("movimiento")}>+ Movimiento</Btn>
              <Btn tono="warn" onClick={() => setModal("cerrar")}>Cerrar y cuadrar</Btn>
            </>
          ) : (
            <Btn onClick={() => setModal("abrir")}>Abrir caja</Btn>
          )
        }
      />

      {ok && <Aviso texto={ok} tono="ok" />}
      {error && <Aviso texto={error} />}

      {abierta ? (
        <>
          <div style={{ ...rejilla(190), marginBottom: 18 }}>
            <Kpi titulo="Fondo de apertura" valor={RD(abierta.monto_inicial, simbolo)}
                 detalle={`Abierta ${fecha(abierta.fecha_apertura)}`} />
            <Kpi titulo="Entradas en efectivo" valor={RD(abierta.ingresos_efectivo, simbolo)} tono="ok" />
            <Kpi titulo="Salidas en efectivo" valor={RD(abierta.egresos_efectivo, simbolo)} tono="warn" />
            <Kpi titulo="Debe haber en caja" valor={RD(abierta.efectivo_esperado, simbolo)} tono="acento"
                 detalle="Fondo + entradas − salidas" />
          </div>

          {(Number(abierta.ingresos_otros) > 0 || Number(abierta.egresos_otros) > 0) && (
            <div style={{ ...rejilla(220), marginBottom: 18 }}>
              <Kpi titulo="Entradas por otros medios" valor={RD(abierta.ingresos_otros, simbolo)}
                   detalle="Transferencia, tarjeta, cheque — no están en el cajón" />
              <Kpi titulo="Salidas por otros medios" valor={RD(abierta.egresos_otros, simbolo)} />
            </div>
          )}

          <Seccion titulo={`Movimientos de la sesión (${movs.length})`} style={{ marginBottom: 18, padding: 0 }}>
            {movs.length === 0 ? (
              <Vacio texto="Sin movimientos todavía. Las ventas, cobros y gastos entran solos." />
            ) : (
              <Tabla
                columnas={[
                  { name: "fecha", label: "Fecha", fmt: (v) => fecha(v as string) },
                  { name: "tipo", label: "Tipo",
                    fmt: (v) => <Badge texto={String(v)} tono={v === "ingreso" ? "ok" : "warn"} /> },
                  { name: "categoria", label: "Categoría" },
                  { name: "concepto", label: "Concepto", fmt: (v) => <strong>{String(v)}</strong> },
                  { name: "metodo_pago", label: "Forma" },
                  { name: "origen", label: "Origen",
                    fmt: (v) => <span style={{ fontSize: 11.5, color: T.suave }}>{String(v)}</span> },
                  { name: "monto", label: "Monto", alinear: "right",
                    fmt: (v, f) => (
                      <strong style={{ color: f.tipo === "ingreso" ? T.ok : T.err }}>
                        {f.tipo === "ingreso" ? "+" : "−"} {RD(v as number, simbolo)}
                      </strong>
                    ) },
                ]}
                filas={movs as unknown as Record<string, unknown>[]}
              />
            )}
          </Seccion>
        </>
      ) : (
        <div style={{
          background: T.panel, border: `1px dashed ${T.borde}`, borderRadius: 14,
          padding: 40, textAlign: "center", marginBottom: 18,
        }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>La caja está cerrada</div>
          <div style={{ fontSize: 13, color: T.suave, marginBottom: 16 }}>
            Ábrela con el efectivo del cajón para que las ventas y los gastos del día queden registrados.
          </div>
          <Btn onClick={() => setModal("abrir")}>Abrir caja</Btn>
        </div>
      )}

      <Seccion titulo="Cuadres anteriores" style={{ padding: 0 }}>
        {historial.filter((h) => h.estado === "cerrada").length === 0 ? (
          <Vacio texto="Todavía no has cerrado ninguna caja." />
        ) : (
          <Tabla
            filaRoja={(f) => Math.abs(Number(f.diferencia ?? 0)) > 0.01}
            columnas={[
              { name: "fecha_apertura", label: "Abierta", fmt: (v) => fecha(v as string) },
              { name: "fecha_cierre", label: "Cerrada", fmt: (v) => v ? fecha(v as string) : "—" },
              { name: "monto_inicial", label: "Fondo", alinear: "right", fmt: (v) => RD(v as number, simbolo) },
              { name: "ingresos_efectivo", label: "Entradas", alinear: "right", fmt: (v) => RD(v as number, simbolo) },
              { name: "egresos_efectivo", label: "Salidas", alinear: "right", fmt: (v) => RD(v as number, simbolo) },
              { name: "esperado_cierre", label: "Esperado", alinear: "right",
                fmt: (v) => v !== null ? RD(v as number, simbolo) : "—" },
              { name: "monto_contado", label: "Contado", alinear: "right",
                fmt: (v) => v !== null ? <strong>{RD(v as number, simbolo)}</strong> : "—" },
              { name: "diferencia", label: "Diferencia", alinear: "right",
                fmt: (v) => {
                  const n = Number(v ?? 0);
                  if (Math.abs(n) <= 0.01) return <Badge texto="cuadró" tono="ok" />;
                  return (
                    <strong style={{ color: n > 0 ? T.info : T.err }}>
                      {n > 0 ? "sobró " : "faltó "}{RD(Math.abs(n), simbolo)}
                    </strong>
                  );
                } },
            ]}
            filas={historial.filter((h) => h.estado === "cerrada") as unknown as Record<string, unknown>[]}
          />
        )}
      </Seccion>

      {modal === "abrir" && (
        <ModalAbrir fondo={fondo} simbolo={simbolo} procesando={procesando}
                    onCerrar={() => setModal(null)}
                    onGuardar={(monto) => accion({ accion: "abrir", monto_inicial: monto }, "Caja abierta.")} />
      )}
      {modal === "cerrar" && abierta && (
        <ModalCerrar sesion={abierta} simbolo={simbolo} procesando={procesando}
                     onCerrar={() => setModal(null)}
                     onGuardar={(contado, notas) =>
                       accion({ accion: "cerrar", sesion_id: abierta.id, monto_contado: contado, notas },
                              "Caja cerrada y cuadrada.")} />
      )}
      {modal === "movimiento" && abierta && (
        <ModalMovimiento sesion={abierta} simbolo={simbolo} procesando={procesando}
                         onCerrar={() => setModal(null)}
                         onGuardado={async (msg) => { setOk(msg); setModal(null); await cargar(); }}
                         onError={setError} />
      )}
    </div>
  );
}

function ModalAbrir({
  fondo, simbolo, procesando, onCerrar, onGuardar,
}: { fondo: number; simbolo: string; procesando: boolean; onCerrar: () => void; onGuardar: (m: number) => void }) {
  const [monto, setMonto] = useState(String(fondo || ""));
  return (
    <Modal abierto titulo="Abrir caja" onCerrar={onCerrar} ancho={440}
      pie={
        <>
          <Btn tono="neutro" onClick={onCerrar}>Cancelar</Btn>
          <Btn disabled={procesando} onClick={() => onGuardar(Number(monto) || 0)}>
            {procesando ? "Abriendo…" : "Abrir caja"}
          </Btn>
        </>
      }>
      <Etiqueta>Efectivo con que abres</Etiqueta>
      <input type="number" step="0.01" style={{ ...inputBase, fontSize: 18, fontWeight: 700 }}
             value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="0.00" />
      <div style={{ fontSize: 12, color: T.suave, marginTop: 10, lineHeight: 1.5 }}>
        Cuenta el dinero que hay en el cajón antes de empezar. Desde ese momento, cada venta de contado,
        cobro y gasto se suma o resta aquí solo, y al cerrar el sistema te dice cuánto debería haber.
      </div>
    </Modal>
  );
}

function ModalCerrar({
  sesion, simbolo, procesando, onCerrar, onGuardar,
}: {
  sesion: Sesion; simbolo: string; procesando: boolean;
  onCerrar: () => void; onGuardar: (contado: number, notas: string) => void;
}) {
  const [contado, setContado] = useState("");
  const [notas, setNotas] = useState("");
  const esperado = Number(sesion.efectivo_esperado);
  const n = Number(contado);
  const dif = contado === "" ? null : Math.round((n - esperado) * 100) / 100;

  return (
    <Modal abierto titulo="Cerrar y cuadrar la caja" onCerrar={onCerrar} ancho={520}
      pie={
        <>
          <Btn tono="neutro" onClick={onCerrar}>Cancelar</Btn>
          <Btn tono="warn" disabled={procesando || contado === ""}
               onClick={() => onGuardar(n, notas)}>
            {procesando ? "Cerrando…" : "Cerrar caja"}
          </Btn>
        </>
      }>
      <div style={{ background: T.panel2, border: `1px solid ${T.borde}`, borderRadius: 10, padding: 14, marginBottom: 16, fontSize: 13.5 }}>
        <F t="Fondo de apertura" v={RD(sesion.monto_inicial, simbolo)} />
        <F t="+ Entradas en efectivo" v={RD(sesion.ingresos_efectivo, simbolo)} />
        <F t="− Salidas en efectivo" v={RD(sesion.egresos_efectivo, simbolo)} />
        <div style={{ borderTop: `1px solid ${T.borde}`, marginTop: 7, paddingTop: 8 }}>
          <F t="Debe haber en el cajón" v={RD(esperado, simbolo)} fuerte />
        </div>
      </div>

      <Etiqueta>¿Cuánto contaste?</Etiqueta>
      <input type="number" step="0.01" style={{ ...inputBase, fontSize: 18, fontWeight: 700 }}
             value={contado} onChange={(e) => setContado(e.target.value)} placeholder="0.00" />

      {dif !== null && (
        <div style={{
          marginTop: 13, borderRadius: 10, padding: 13, fontSize: 14, fontWeight: 700,
          background: Math.abs(dif) <= 0.01 ? "#eefaf3" : dif > 0 ? "#eef4ff" : T.rojoBg,
          color: Math.abs(dif) <= 0.01 ? T.ok : dif > 0 ? T.info : T.err,
          border: `1px solid ${Math.abs(dif) <= 0.01 ? T.ok : dif > 0 ? T.info : T.err}44`,
        }}>
          {Math.abs(dif) <= 0.01
            ? "✓ La caja cuadra exacto."
            : dif > 0
              ? `Sobran ${RD(dif, simbolo)} — hay más efectivo del esperado.`
              : `Faltan ${RD(Math.abs(dif), simbolo)} — revisa antes de cerrar.`}
        </div>
      )}

      <div style={{ marginTop: 13 }}>
        <Etiqueta>Notas del cuadre</Etiqueta>
        <input style={inputBase} value={notas} onChange={(e) => setNotas(e.target.value)}
               placeholder="Ej.: faltante por vuelto mal dado" />
      </div>
    </Modal>
  );
}

function ModalMovimiento({
  sesion, simbolo, procesando, onCerrar, onGuardado, onError,
}: {
  sesion: Sesion; simbolo: string; procesando: boolean;
  onCerrar: () => void; onGuardado: (msg: string) => void; onError: (e: string) => void;
}) {
  const [f, setF] = useState({
    tipo: "ingreso", categoria: "otro", concepto: "", monto: "",
    metodo_pago: "efectivo", referencia: "", fecha: hoyISO(),
  });
  const [guardando, setGuardando] = useState(false);
  const monto = Number(f.monto);

  return (
    <Modal abierto titulo="Movimiento de caja" onCerrar={onCerrar} ancho={520}
      pie={
        <>
          <Btn tono="neutro" onClick={onCerrar}>Cancelar</Btn>
          <Btn disabled={guardando || procesando || !(monto > 0) || !f.concepto.trim()}
               onClick={async () => {
                 setGuardando(true);
                 try {
                   await api("/caja-movimientos", {
                     metodo: "POST",
                     body: { ...f, monto, sesion_id: sesion.id, origen: "manual" },
                   });
                   onGuardado("Movimiento registrado.");
                 } catch (e) {
                   onError(e instanceof Error ? e.message : "Error");
                 } finally { setGuardando(false); }
               }}>
            {guardando ? "Guardando…" : "Registrar"}
          </Btn>
        </>
      }>
      <div style={{ display: "grid", gap: 13, gridTemplateColumns: "1fr 1fr" }}>
        <div>
          <Etiqueta>Tipo</Etiqueta>
          <select style={inputBase} value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}>
            <option value="ingreso">Entrada de dinero</option>
            <option value="egreso">Salida de dinero</option>
          </select>
        </div>
        <div>
          <Etiqueta>Categoría</Etiqueta>
          <input style={inputBase} value={f.categoria}
                 onChange={(e) => setF({ ...f, categoria: e.target.value })}
                 placeholder="retiro, depósito, ajuste…" />
        </div>
        <div style={{ gridColumn: "span 2" }}>
          <Etiqueta>Concepto *</Etiqueta>
          <input style={inputBase} value={f.concepto}
                 onChange={(e) => setF({ ...f, concepto: e.target.value })} />
        </div>
        <div>
          <Etiqueta>Monto</Etiqueta>
          <input type="number" step="0.01" style={{ ...inputBase, fontSize: 16, fontWeight: 700 }}
                 value={f.monto} onChange={(e) => setF({ ...f, monto: e.target.value })} />
        </div>
        <div>
          <Etiqueta>Forma</Etiqueta>
          <select style={inputBase} value={f.metodo_pago}
                  onChange={(e) => setF({ ...f, metodo_pago: e.target.value })}>
            {METODOS_PAGO.map((m) => <option key={m.valor} value={m.valor}>{m.etiqueta}</option>)}
          </select>
        </div>
      </div>
      <div style={{ fontSize: 11.5, color: T.suave, marginTop: 12 }}>
        Solo los movimientos en efectivo afectan lo que debe haber en el cajón.
      </div>
    </Modal>
  );
}

function F({ t, v, fuerte }: { t: string; v: string; fuerte?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "3px 0" }}>
      <span style={{ color: T.suave }}>{t}</span>
      <span style={{ fontWeight: fuerte ? 800 : 600, fontVariantNumeric: "tabular-nums" }}>{v}</span>
    </div>
  );
}
