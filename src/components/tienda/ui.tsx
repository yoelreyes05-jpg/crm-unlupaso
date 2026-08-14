"use client";

/**
 * Kit de UI de MAXMATT SHOP.
 * Mismo esqueleto que el kit de préstamos, con paleta propia índigo/violeta
 * para que se vea de un golpe en qué módulo estás trabajando.
 */

import {
  useCallback, useEffect, useMemo, useState,
  type CSSProperties, type ReactNode,
} from "react";

// ─── Tema ─────────────────────────────────────────────────────────────────────
export const T = {
  bg:      "#f1f0f9",
  panel:   "#ffffff",
  panel2:  "#f8f7fd",
  borde:   "#e2e0ef",
  texto:   "#1e1b34",
  suave:   "#6f6a8d",
  acento:  "#5b21b6",
  acento2: "#8b5cf6",
  oscuro:  "#241f45",
  ok:      "#15803d",
  warn:    "#b45309",
  err:     "#be123c",
  info:    "#1d4ed8",
  rojoBg:  "#fff1f2",
  rojoTx:  "#9f1239",
};

export const VERDE = "linear-gradient(135deg, #a78bfa 0%, #7c3aed 50%, #5b21b6 100%)";
export const VIOLETA = VERDE;

// ─── Formato ──────────────────────────────────────────────────────────────────
export const RD = (n: number | null | undefined, simbolo = "RD$") =>
  `${simbolo} ${Number(n ?? 0).toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const PCT = (n: number | null | undefined, dec = 0) => `${Number(n ?? 0).toFixed(dec)}%`;

export const fecha = (v: string | null | undefined) => {
  if (!v) return "—";
  const [y, m, d] = v.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
};

const MESES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];

export const fechaLarga = (v: string | null | undefined) => {
  if (!v) return "—";
  const [y, m, d] = v.slice(0, 10).split("-").map(Number);
  return `${d} de ${MESES[m - 1]} de ${y}`;
};

export const mesLargo = (v: string | null | undefined) => {
  if (!v) return "—";
  const [y, m] = v.slice(0, 10).split("-").map(Number);
  const n = MESES[m - 1];
  return `${n[0].toUpperCase()}${n.slice(1)} ${y}`;
};

export const hoyISO = () => {
  const f = new Date();
  return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}-${String(f.getDate()).padStart(2, "0")}`;
};



export const ETIQUETA_METODO_PAGO: Record<string, string> = {
  efectivo: "Efectivo", transferencia: "Transferencia", tarjeta: "Tarjeta",
  cheque: "Cheque", credito: "Crédito", mixto: "Mixto", otro: "Otro",
};

export const ETIQUETA_ESTADO_DOC: Record<string, string> = {
  pendiente: "Pendiente", parcial: "Parcial", pagada: "Pagada",
  vencida: "Vencida", anulada: "Anulada",
};

/** Color del estado de una factura o compra. */
export function tonoDoc(estado: string): string {
  if (estado === "pagada") return "ok";
  if (estado === "vencida") return "err";
  if (estado === "parcial") return "warn";
  if (estado === "anulada") return "neutro";
  return "info";
}

/** Color del estado de stock de un producto. */
export function tonoStock(estado: string): string {
  if (estado === "agotado") return "err";
  if (estado === "bajo") return "warn";
  return "ok";
}

// ─── API ──────────────────────────────────────────────────────────────────────
const BASE = "/api/tienda";

export async function api<T = unknown>(
  ruta: string,
  opciones: { metodo?: string; body?: unknown } = {}
): Promise<T> {
  const res = await fetch(`${BASE}${ruta}`, {
    method: opciones.metodo ?? "GET",
    headers: opciones.body ? { "Content-Type": "application/json" } : undefined,
    body: opciones.body ? JSON.stringify(opciones.body) : undefined,
    cache: "no-store",
  });

  const texto = await res.text();
  let json: { error?: string } = {};
  try { json = texto ? JSON.parse(texto) : {}; } catch { /* la respuesta no era JSON */ }

  if (!res.ok) {
    // Un 404 sin cuerpo JSON significa que el archivo de esa ruta no está
    // en el despliegue: es un problema de subida, no de datos.
    if (res.status === 404 && !json.error) {
      throw new Error(
        `No existe la ruta ${BASE}${ruta} en este despliegue. ` +
        `Falta subir el archivo src/app/api${BASE}${ruta.split("?")[0]}/route.ts y volver a desplegar.`
      );
    }
    throw new Error(json.error ?? `Error ${res.status}`);
  }
  return json as T;
}

// ─── Primitivas ───────────────────────────────────────────────────────────────
export function Card({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{
      background: T.panel, border: `1px solid ${T.borde}`, borderRadius: 14,
      padding: 18, boxShadow: "0 1px 3px rgba(15,36,48,0.06)", ...style,
    }}>{children}</div>
  );
}

export function Seccion({
  titulo, accion, children, style,
}: { titulo?: ReactNode; accion?: ReactNode; children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{
      background: T.panel, border: `1px solid ${T.borde}`, borderRadius: 14,
      boxShadow: "0 1px 3px rgba(15,36,48,0.06)", overflow: "hidden", ...style,
    }}>
      {(titulo || accion) && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
          padding: "13px 18px", borderBottom: `1px solid ${T.borde}`, background: T.panel2,
        }}>
          <div style={{ fontSize: 13.5, fontWeight: 800, color: T.texto }}>{titulo}</div>
          {accion}
        </div>
      )}
      <div style={{ padding: 18 }}>{children}</div>
    </div>
  );
}

export function Btn({
  children, onClick, tono = "acento", disabled, tipo = "button", style,
}: {
  children: ReactNode; onClick?: () => void;
  tono?: "acento" | "neutro" | "ok" | "err" | "warn";
  disabled?: boolean; tipo?: "button" | "submit"; style?: CSSProperties;
}) {
  const colores: Record<string, string> = {
    acento: VERDE, neutro: "#eaf0f5", ok: T.ok, err: T.err, warn: T.warn,
  };
  const fondo = colores[tono] ?? VERDE;
  return (
    <button
      type={tipo}
      onClick={onClick}
      disabled={disabled}
      style={{
        background: disabled ? "#dbe3ea" : fondo,
        color: disabled ? T.suave : tono === "neutro" ? T.texto : "#fff",
        border: tono === "neutro" ? `1px solid ${T.borde}` : "none",
        borderRadius: 10, padding: "10px 16px", fontWeight: 700, fontSize: 14,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.75 : 1, whiteSpace: "nowrap", ...style,
      }}
    >{children}</button>
  );
}

export const inputBase: CSSProperties = {
  width: "100%", background: T.panel2, color: T.texto,
  border: `1px solid ${T.borde}`, borderRadius: 9,
  padding: "9px 11px", fontSize: 14, outline: "none",
};

export function Etiqueta({ children }: { children: ReactNode }) {
  return (
    <div style={{
      fontSize: 11, color: T.suave, marginBottom: 5, fontWeight: 700,
      letterSpacing: 0.4, textTransform: "uppercase",
    }}>{children}</div>
  );
}

export function Badge({ texto, tono = "neutro" }: { texto: string; tono?: string }) {
  const map: Record<string, string> = {
    ok: T.ok, err: T.err, warn: T.warn, info: T.info, acento: T.acento, neutro: T.suave,
  };
  const c = map[tono] ?? map.neutro;
  return (
    <span style={{
      background: c + "1f", color: c, border: `1px solid ${c}55`,
      borderRadius: 999, padding: "3px 10px", fontSize: 11, fontWeight: 700,
      whiteSpace: "nowrap", display: "inline-block",
    }}>{texto}</span>
  );
}

export function Kpi({
  titulo, valor, detalle, tono = "neutro",
}: { titulo: string; valor: ReactNode; detalle?: ReactNode; tono?: "neutro" | "ok" | "err" | "warn" | "acento" }) {
  const colores: Record<string, string> = {
    neutro: T.texto, ok: T.ok, err: T.err, warn: T.warn, acento: T.acento,
  };
  return (
    <Card style={{ padding: 16 }}>
      <div style={{ fontSize: 11, color: T.suave, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4 }}>
        {titulo}
      </div>
      <div style={{ fontSize: 23, fontWeight: 800, color: colores[tono], marginTop: 5, fontVariantNumeric: "tabular-nums" }}>
        {valor}
      </div>
      {detalle && <div style={{ fontSize: 11.5, color: T.suave, marginTop: 3 }}>{detalle}</div>}
    </Card>
  );
}

export function Barra({ valor }: { valor: number }) {
  const v = Math.min(100, Math.max(0, Number(valor) || 0));
  return (
    <div style={{ height: 7, background: "#dde5ec", borderRadius: 99, overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${v}%`, background: v >= 100 ? T.ok : VERDE, borderRadius: 99 }} />
    </div>
  );
}

export function Aviso({ texto, tono = "err" }: { texto: ReactNode; tono?: "err" | "ok" | "info" | "warn" }) {
  const c = tono === "ok" ? T.ok : tono === "info" ? T.info : tono === "warn" ? T.warn : T.err;
  return (
    <div style={{
      background: c + "14", border: `1px solid ${c}55`, color: c,
      borderRadius: 9, padding: "10px 13px", fontSize: 13, marginBottom: 12, lineHeight: 1.45,
    }}>{texto}</div>
  );
}

export function Modal({
  abierto, titulo, onCerrar, children, pie, ancho = 640,
}: {
  abierto: boolean; titulo: string; onCerrar: () => void;
  children: ReactNode; pie?: ReactNode; ancho?: number;
}) {
  useEffect(() => {
    if (!abierto) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onCerrar(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [abierto, onCerrar]);

  if (!abierto) return null;
  return (
    <div
      onClick={onCerrar}
      style={{
        position: "fixed", inset: 0, background: "rgba(13,43,52,0.45)",
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        padding: 24, zIndex: 60, overflowY: "auto",
      }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{
        background: T.panel, border: `1px solid ${T.borde}`, borderRadius: 16,
        width: "100%", maxWidth: ancho, marginTop: 24,
        boxShadow: "0 12px 40px rgba(13,43,52,0.25)",
      }}>
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "15px 20px", borderBottom: `1px solid ${T.borde}`,
        }}>
          <div style={{ fontWeight: 800, fontSize: 15.5, color: T.texto }}>{titulo}</div>
          <button onClick={onCerrar} style={{
            background: "transparent", border: "none", color: T.suave,
            fontSize: 19, cursor: "pointer", lineHeight: 1,
          }}>✕</button>
        </div>
        <div style={{ padding: 20, maxHeight: "68vh", overflowY: "auto" }}>{children}</div>
        {pie && (
          <div style={{
            display: "flex", justifyContent: "flex-end", gap: 9,
            padding: "13px 20px", borderTop: `1px solid ${T.borde}`, background: T.panel2,
          }}>{pie}</div>
        )}
      </div>
    </div>
  );
}

export function Cargando({ texto = "Cargando…" }: { texto?: string }) {
  return <div style={{ padding: 40, textAlign: "center", color: T.suave, fontSize: 14 }}>{texto}</div>;
}

export function Vacio({ texto, accion }: { texto: string; accion?: ReactNode }) {
  return (
    <div style={{ padding: 34, textAlign: "center", color: T.suave, fontSize: 14 }}>
      <div>{texto}</div>
      {accion && <div style={{ marginTop: 12 }}>{accion}</div>}
    </div>
  );
}

export function Titulo({
  texto, sub, acciones,
}: { texto: string; sub?: ReactNode; acciones?: ReactNode }) {
  return (
    <div style={{
      display: "flex", flexWrap: "wrap", alignItems: "flex-start",
      justifyContent: "space-between", gap: 12, marginBottom: 18,
    }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 21, fontWeight: 800, color: T.texto }}>{texto}</h1>
        {sub && <div style={{ fontSize: 13, color: T.suave, marginTop: 3 }}>{sub}</div>}
      </div>
      {acciones && <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{acciones}</div>}
    </div>
  );
}

export const rejilla = (min = 220): CSSProperties => ({
  display: "grid", gap: 14,
  gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`,
});

// ─── Definición de campos y columnas ──────────────────────────────────────────
export type Opcion = { value: string; label: string };

export type Campo = {
  name: string;
  label: string;
  tipo?: "text" | "number" | "date" | "select" | "textarea" | "checkbox" | "email";
  opciones?: Opcion[];
  fuente?: { ruta: string; etiqueta: (row: Record<string, unknown>) => string };
  requerido?: boolean;
  paso?: string;
  defecto?: unknown;
  ancho?: 1 | 2;
  ayuda?: string;
  visible?: (valores: Record<string, unknown>) => boolean;
};

export type Columna = {
  name: string;
  label: string;
  fmt?: (valor: unknown, fila: Record<string, unknown>) => ReactNode;
  alinear?: "left" | "right" | "center";
};

// ─── Formulario dinámico ──────────────────────────────────────────────────────
export function Formulario({
  campos, valores, onCambio, opcionesRemotas,
}: {
  campos: Campo[];
  valores: Record<string, unknown>;
  onCambio: (name: string, valor: unknown) => void;
  opcionesRemotas: Record<string, Opcion[]>;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
      {campos.filter((c) => !c.visible || c.visible(valores)).map((c) => {
        const v = valores[c.name];
        const opciones = c.fuente ? opcionesRemotas[c.name] ?? [] : c.opciones ?? [];
        return (
          <div key={c.name} style={{ gridColumn: c.ancho === 2 || c.tipo === "textarea" ? "span 2" : undefined }}>
            <Etiqueta>{c.label}{c.requerido ? " *" : ""}</Etiqueta>
            {c.tipo === "select" ? (
              <select
                style={inputBase}
                value={String(v ?? "")}
                onChange={(e) => onCambio(c.name, e.target.value)}
              >
                <option value="">— Selecciona —</option>
                {opciones.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            ) : c.tipo === "textarea" ? (
              <textarea
                style={{ ...inputBase, minHeight: 66, resize: "vertical" }}
                value={String(v ?? "")}
                onChange={(e) => onCambio(c.name, e.target.value)}
              />
            ) : c.tipo === "checkbox" ? (
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: T.texto, paddingTop: 6 }}>
                <input
                  type="checkbox"
                  checked={!!v}
                  onChange={(e) => onCambio(c.name, e.target.checked)}
                />
                {c.ayuda ?? c.label}
              </label>
            ) : (
              <input
                type={c.tipo ?? "text"}
                step={c.paso}
                style={inputBase}
                value={v === null || v === undefined ? "" : String(v)}
                onChange={(e) =>
                  onCambio(c.name, c.tipo === "number" ? (e.target.value === "" ? null : Number(e.target.value)) : e.target.value)
                }
              />
            )}
            {c.ayuda && c.tipo !== "checkbox" && (
              <div style={{ fontSize: 11, color: T.suave, marginTop: 4 }}>{c.ayuda}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Tabla ────────────────────────────────────────────────────────────────────
export function Tabla({
  columnas, filas, onFila, acciones, vacio = "Sin registros", filaRoja,
}: {
  columnas: Columna[];
  filas: Record<string, unknown>[];
  onFila?: (fila: Record<string, unknown>) => void;
  acciones?: (fila: Record<string, unknown>) => ReactNode;
  vacio?: string;
  /** Marca la fila completa en rojo (clientes atrasados) */
  filaRoja?: (fila: Record<string, unknown>) => boolean;
}) {
  if (filas.length === 0) {
    return <div style={{ padding: 34, textAlign: "center", color: T.suave, fontSize: 14 }}>{vacio}</div>;
  }
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
        <thead>
          <tr>
            {columnas.map((c) => (
              <th key={c.name} style={{
                textAlign: c.alinear ?? "left", padding: "10px 12px",
                color: T.suave, fontSize: 11, textTransform: "uppercase",
                letterSpacing: 0.5, borderBottom: `1px solid ${T.borde}`, whiteSpace: "nowrap",
              }}>{c.label}</th>
            ))}
            {acciones && <th style={{ borderBottom: `1px solid ${T.borde}`, width: 120 }} />}
          </tr>
        </thead>
        <tbody>
          {filas.map((f, i) => {
            const roja = filaRoja?.(f) ?? false;
            return (
              <tr
                key={(f.id as string) ?? i}
                onClick={onFila ? () => onFila(f) : undefined}
                style={{
                  borderBottom: `1px solid ${T.borde}88`,
                  cursor: onFila ? "pointer" : "default",
                  background: roja ? T.rojoBg : undefined,
                  color: roja ? T.rojoTx : undefined,
                }}
              >
                {columnas.map((c) => (
                  <td key={c.name} style={{
                    padding: "11px 12px", textAlign: c.alinear ?? "left",
                    fontVariantNumeric: c.alinear === "right" ? "tabular-nums" : undefined,
                  }}>
                    {c.fmt ? c.fmt(f[c.name], f) : (f[c.name] === null || f[c.name] === undefined ? "—" : String(f[c.name]))}
                  </td>
                ))}
                {acciones && (
                  <td style={{ padding: "11px 12px", textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                    {acciones(f)}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Página CRUD genérica ─────────────────────────────────────────────────────
export function CrudPage({
  titulo, icono, ruta, campos, columnas, buscar = true,
  filtros, extraAcciones, onFila, textoNuevo, subtitulo, encabezado, filaRoja,
  encabezadoFormulario,
}: {
  titulo: string;
  icono: string;
  ruta: string;
  campos: Campo[];
  columnas: Columna[];
  buscar?: boolean;
  filtros?: { name: string; label: string; opciones: Opcion[] }[];
  extraAcciones?: (fila: Record<string, unknown>, recargar: () => void) => ReactNode;
  onFila?: (fila: Record<string, unknown>) => void;
  textoNuevo?: string;
  subtitulo?: ReactNode;
  encabezado?: (filas: Record<string, unknown>[]) => ReactNode;
  filaRoja?: (fila: Record<string, unknown>) => boolean;
  /** Bloque que se dibuja arriba del formulario. Recibe una función para
   *  rellenar campos — la usa el selector de contactos del teléfono. */
  encabezadoFormulario?: (llenar: (valores: Record<string, unknown>) => void) => ReactNode;
}) {
  const [filas, setFilas]         = useState<Record<string, unknown>[]>([]);
  const [cargando, setCargando]   = useState(true);
  const [error, setError]         = useState("");
  const [busqueda, setBusqueda]   = useState("");
  const [filtroVals, setFiltro]   = useState<Record<string, string>>({});
  const [modal, setModal]         = useState(false);
  const [editando, setEditando]   = useState<Record<string, unknown> | null>(null);
  const [valores, setValores]     = useState<Record<string, unknown>>({});
  const [remotas, setRemotas]     = useState<Record<string, Opcion[]>>({});
  const [guardando, setGuardando] = useState(false);

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (busqueda) p.set("search", busqueda);
    for (const [k, v] of Object.entries(filtroVals)) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `?${s}` : "";
  }, [busqueda, filtroVals]);

  const cargar = useCallback(async () => {
    setCargando(true); setError("");
    try {
      const r = await api<{ data: Record<string, unknown>[] }>(`${ruta}${query}`);
      setFilas(r.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar");
    } finally {
      setCargando(false);
    }
  }, [ruta, query]);

  useEffect(() => { void cargar(); }, [cargar]);

  useEffect(() => {
    (async () => {
      const conFuente = campos.filter((c) => c.fuente);
      if (conFuente.length === 0) return;
      const res: Record<string, Opcion[]> = {};
      for (const c of conFuente) {
        try {
          const r = await api<{ data: Record<string, unknown>[] }>(c.fuente!.ruta);
          res[c.name] = (r.data ?? []).map((row) => ({
            value: String(row.id), label: c.fuente!.etiqueta(row),
          }));
        } catch { res[c.name] = []; }
      }
      setRemotas(res);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function abrirNuevo() {
    const v: Record<string, unknown> = {};
    for (const c of campos) if (c.defecto !== undefined) v[c.name] = c.defecto;
    setValores(v); setEditando(null); setModal(true);
  }

  function abrirEditar(fila: Record<string, unknown>) {
    const v: Record<string, unknown> = {};
    for (const c of campos) v[c.name] = fila[c.name];
    setValores(v); setEditando(fila); setModal(true);
  }

  async function guardar() {
    setGuardando(true); setError("");
    try {
      if (editando) {
        await api(`${ruta}/${editando.id}`, { metodo: "PATCH", body: valores });
      } else {
        await api(ruta, { metodo: "POST", body: valores });
      }
      setModal(false);
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div>
      <Titulo
        texto={`${icono}  ${titulo}`}
        sub={subtitulo ?? `${filas.length} registro(s)`}
        acciones={<Btn onClick={abrirNuevo}>+ {textoNuevo ?? "Nuevo"}</Btn>}
      />

      {encabezado && <div style={{ marginBottom: 16 }}>{encabezado(filas)}</div>}

      <div style={{ display: "flex", gap: 9, flexWrap: "wrap", marginBottom: 14 }}>
        {buscar && (
          <input
            style={{ ...inputBase, maxWidth: 330, background: T.panel }}
            placeholder="Buscar…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        )}
        {(filtros ?? []).map((f) => (
          <select
            key={f.name}
            style={{ ...inputBase, width: "auto", background: T.panel }}
            value={filtroVals[f.name] ?? ""}
            onChange={(e) => setFiltro((s) => ({ ...s, [f.name]: e.target.value }))}
          >
            <option value="">{f.label}: todos</option>
            {f.opciones.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        ))}
      </div>

      {error && <Aviso texto={error} />}

      <Card style={{ padding: 0, overflow: "hidden" }}>
        {cargando ? <Cargando /> : (
          <Tabla
            columnas={columnas}
            filas={filas}
            filaRoja={filaRoja}
            onFila={onFila}
            acciones={(f) => (
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", alignItems: "center" }}>
                {extraAcciones?.(f, cargar)}
                <button
                  onClick={() => abrirEditar(f)}
                  style={{ background: "transparent", border: "none", color: T.acento, cursor: "pointer", fontSize: 12.5, fontWeight: 700 }}
                >Editar</button>
              </div>
            )}
          />
        )}
      </Card>

      <Modal
        abierto={modal}
        titulo={editando ? `Editar ${titulo.toLowerCase()}` : `Nuevo ${(textoNuevo ?? titulo).toLowerCase()}`}
        onCerrar={() => setModal(false)}
        ancho={720}
        pie={
          <>
            <Btn tono="neutro" onClick={() => setModal(false)}>Cancelar</Btn>
            <Btn onClick={guardar} disabled={guardando}>{guardando ? "Guardando…" : "Guardar"}</Btn>
          </>
        }
      >
        {error && <Aviso texto={error} />}
        {encabezadoFormulario?.((nuevos) =>
          setValores((s) => {
            const out = { ...s };
            // solo rellena lo que venga con valor; no pisa lo que ya escribiste
            for (const [k, v] of Object.entries(nuevos)) {
              if (v !== undefined && v !== null && v !== "") out[k] = v;
            }
            return out;
          })
        )}
        <Formulario
          campos={campos}
          valores={valores}
          opcionesRemotas={remotas}
          onCambio={(n, v) => setValores((s) => ({ ...s, [n]: v }))}
        />
      </Modal>
    </div>
  );
}
