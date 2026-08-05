"use client";

/**
 * Kit de UI de CROW EVENTS.
 * Paleta tomada del logo: mármol crema, dorado y marrón (sin Tailwind).
 */

import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";

// ─── Tema — colores del logo CROW EVENTS ──────────────────────────────────────
export const T = {
  bg:      "#f7f3ec",  // mármol crema
  panel:   "#ffffff",
  panel2:  "#faf6ef",  // crema suave para inputs
  borde:   "#e6dcc8",
  texto:   "#3a2c1c",  // marrón oscuro del texto del logo
  suave:   "#8a7758",  // marrón claro
  acento:  "#a9812a",  // dorado profundo
  acento2: "#c9a227",  // dorado brillante
  bronce:  "#7a5c2e",
  ok:      "#2f7d5c",
  warn:    "#c07d13",
  err:     "#b03a34",
  info:    "#4a6b96",
};

/** Degradado dorado del logo, para acentos y cabeceras. */
export const ORO = "linear-gradient(135deg, #d9b451 0%, #a9812a 45%, #7a5c2e 100%)";

export const RD = (n: number | null | undefined) =>
  "RD$ " + Number(n ?? 0).toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fecha = (v: string | null | undefined) =>
  v ? new Date(v.length <= 10 ? v + "T12:00:00" : v).toLocaleDateString("es-DO", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

export const fechaHora = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleString("es-DO", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

// ─── API ──────────────────────────────────────────────────────────────────────
const BASE = "/api/reposteria";

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
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error ?? `Error ${res.status}`);
  return json as T;
}

// ─── Primitivas ───────────────────────────────────────────────────────────────
export function Card({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{
      background: T.panel, border: `1px solid ${T.borde}`, borderRadius: 14,
      padding: 18, boxShadow: "0 1px 3px rgba(58,44,28,0.06)", ...style,
    }}>{children}</div>
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
    acento: ORO, neutro: "#efe7d8", ok: T.ok, err: T.err, warn: T.warn,
  };
  const fondo = colores[tono] ?? ORO;
  return (
    <button
      type={tipo}
      onClick={onClick}
      disabled={disabled}
      style={{
        background: disabled ? "#e0d7c6" : fondo,
        color: disabled ? T.suave : tono === "neutro" ? T.texto : "#fff",
        border: tono === "neutro" ? `1px solid ${T.borde}` : "none",
        borderRadius: 10,
        padding: "10px 16px", fontWeight: 700, fontSize: 14,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.75 : 1, ...style,
      }}
    >{children}</button>
  );
}

const inputBase: CSSProperties = {
  width: "100%", background: T.panel2, color: T.texto,
  border: `1px solid ${T.borde}`, borderRadius: 9,
  padding: "9px 11px", fontSize: 14, outline: "none",
};

export function Etiqueta({ children }: { children: ReactNode }) {
  return <div style={{ fontSize: 11, color: T.suave, marginBottom: 5, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase" }}>{children}</div>;
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
      whiteSpace: "nowrap", textTransform: "capitalize",
    }}>{texto}</span>
  );
}

export function Modal({
  abierto, titulo, onCerrar, children, ancho = 620,
}: { abierto: boolean; titulo: string; onCerrar: () => void; children: ReactNode; ancho?: number }) {
  if (!abierto) return null;
  return (
    <div
      onClick={onCerrar}
      style={{
        position: "fixed", inset: 0, background: "rgba(58,44,28,0.45)",
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        padding: 24, zIndex: 60, overflowY: "auto",
      }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{
        background: T.panel, border: `1px solid ${T.borde}`, borderRadius: 16,
        width: "100%", maxWidth: ancho, marginTop: 30,
        boxShadow: "0 12px 40px rgba(58,44,28,0.22)",
      }}>
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "16px 20px", borderBottom: `1px solid ${T.borde}`,
        }}>
          <strong style={{ fontSize: 17 }}>{titulo}</strong>
          <button onClick={onCerrar} style={{
            background: "transparent", border: "none", color: T.suave,
            fontSize: 24, cursor: "pointer", lineHeight: 1,
          }}>×</button>
        </div>
        <div style={{ padding: 20 }}>{children}</div>
      </div>
    </div>
  );
}

export function Aviso({ texto, tono = "err" }: { texto: string; tono?: "err" | "ok" }) {
  const c = tono === "ok" ? T.ok : T.err;
  return (
    <div style={{
      background: c + "18", border: `1px solid ${c}55`, color: c,
      borderRadius: 9, padding: "9px 12px", fontSize: 13, marginBottom: 12,
    }}>{texto}</div>
  );
}

// ─── Definición de campos ─────────────────────────────────────────────────────
export type Opcion = { value: string; label: string };

export type Campo = {
  name: string;
  label: string;
  tipo?: "text" | "number" | "date" | "time" | "select" | "textarea" | "checkbox" | "email";
  opciones?: Opcion[];
  /** Carga las opciones desde otro recurso del ERP */
  fuente?: { ruta: string; etiqueta: (row: Record<string, unknown>) => string };
  requerido?: boolean;
  paso?: string;
  defecto?: unknown;
  ancho?: 1 | 2;   // columnas del grid
  ayuda?: string;
};

export type Columna = {
  name: string;
  label: string;
  fmt?: (valor: unknown, fila: Record<string, unknown>) => ReactNode;
  alinear?: "left" | "right" | "center";
  ancho?: number;
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
      {campos.map((c) => {
        const opciones = c.fuente ? (opcionesRemotas[c.name] ?? []) : (c.opciones ?? []);
        const v = valores[c.name];
        const span = c.ancho === 2 || c.tipo === "textarea" ? "1 / -1" : undefined;

        return (
          <div key={c.name} style={{ gridColumn: span }}>
            <Etiqueta>{c.label}{c.requerido ? " *" : ""}</Etiqueta>

            {c.tipo === "select" ? (
              <select
                value={(v as string) ?? ""}
                onChange={(e) => onCambio(c.name, e.target.value)}
                style={inputBase}
              >
                <option value="">— seleccionar —</option>
                {opciones.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            ) : c.tipo === "textarea" ? (
              <textarea
                value={(v as string) ?? ""}
                onChange={(e) => onCambio(c.name, e.target.value)}
                rows={3}
                style={{ ...inputBase, resize: "vertical" }}
              />
            ) : c.tipo === "checkbox" ? (
              <label style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 14, cursor: "pointer", padding: "9px 0" }}>
                <input
                  type="checkbox"
                  checked={Boolean(v)}
                  onChange={(e) => onCambio(c.name, e.target.checked)}
                  style={{ width: 17, height: 17, accentColor: T.acento }}
                />
                {c.ayuda ?? "Sí"}
              </label>
            ) : (
              <input
                type={c.tipo ?? "text"}
                step={c.paso}
                value={(v as string | number) ?? ""}
                onChange={(e) => onCambio(c.name, c.tipo === "number" ? e.target.value : e.target.value)}
                style={inputBase}
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
  columnas, filas, onFila, acciones, vacio = "Sin registros",
}: {
  columnas: Columna[];
  filas: Record<string, unknown>[];
  onFila?: (fila: Record<string, unknown>) => void;
  acciones?: (fila: Record<string, unknown>) => ReactNode;
  vacio?: string;
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
            {acciones && <th style={{ borderBottom: `1px solid ${T.borde}`, width: 110 }} />}
          </tr>
        </thead>
        <tbody>
          {filas.map((f, i) => (
            <tr
              key={(f.id as string) ?? i}
              onClick={onFila ? () => onFila(f) : undefined}
              style={{
                borderBottom: `1px solid ${T.borde}55`,
                cursor: onFila ? "pointer" : "default",
              }}
            >
              {columnas.map((c) => (
                <td key={c.name} style={{ padding: "11px 12px", textAlign: c.alinear ?? "left" }}>
                  {c.fmt ? c.fmt(f[c.name], f) : String(f[c.name] ?? "—")}
                </td>
              ))}
              {acciones && (
                <td style={{ padding: "11px 12px", textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                  {acciones(f)}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Página CRUD genérica ─────────────────────────────────────────────────────
export function CrudPage({
  titulo, icono, ruta, campos, columnas, buscar = true,
  filtros, extraAcciones, onFila, textoNuevo,
}: {
  titulo: string;
  icono: string;
  ruta: string;                 // p.ej. "/clientes"
  campos: Campo[];
  columnas: Columna[];
  buscar?: boolean;
  filtros?: { name: string; label: string; opciones: Opcion[] }[];
  extraAcciones?: (fila: Record<string, unknown>, recargar: () => void) => ReactNode;
  onFila?: (fila: Record<string, unknown>) => void;
  textoNuevo?: string;
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

  // Carga de selects remotos
  useEffect(() => {
    const conFuente = campos.filter((c) => c.fuente);
    if (conFuente.length === 0) return;
    void (async () => {
      const acc: Record<string, Opcion[]> = {};
      await Promise.all(conFuente.map(async (c) => {
        try {
          const r = await api<{ data: Record<string, unknown>[] }>(`${c.fuente!.ruta}?limit=500`);
          acc[c.name] = (r.data ?? []).map((row) => ({
            value: String(row.id), label: c.fuente!.etiqueta(row),
          }));
        } catch { acc[c.name] = []; }
      }));
      setRemotas(acc);
    })();
  }, [campos]);

  function abrirNuevo() {
    const init: Record<string, unknown> = {};
    for (const c of campos) if (c.defecto !== undefined) init[c.name] = c.defecto;
    setValores(init); setEditando(null); setModal(true); setError("");
  }

  function abrirEditar(fila: Record<string, unknown>) {
    const init: Record<string, unknown> = {};
    for (const c of campos) init[c.name] = fila[c.name] ?? "";
    setValores(init); setEditando(fila); setModal(true); setError("");
  }

  async function guardar() {
    setGuardando(true); setError("");
    try {
      const payload: Record<string, unknown> = {};
      for (const c of campos) {
        let v = valores[c.name];
        if (c.tipo === "number" && v !== "" && v !== null && v !== undefined) v = Number(v);
        if (c.tipo === "checkbox") v = Boolean(v);
        payload[c.name] = v === "" ? null : v;
      }
      if (editando) {
        await api(`${ruta}/${editando.id}`, { metodo: "PATCH", body: payload });
      } else {
        await api(ruta, { metodo: "POST", body: payload });
      }
      setModal(false);
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setGuardando(false);
    }
  }

  async function borrar(fila: Record<string, unknown>) {
    if (!confirm("¿Eliminar este registro?")) return;
    try {
      await api(`${ruta}/${fila.id}`, { metodo: "DELETE" });
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al eliminar");
    }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 18 }}>
        <h1 style={{ fontSize: 24, margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
          <span>{icono}</span>{titulo}
        </h1>
        <Btn onClick={abrirNuevo}>+ {textoNuevo ?? "Nuevo"}</Btn>
      </div>

      {(buscar || filtros) && (
        <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
          {buscar && (
            <input
              placeholder="Buscar…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              style={{ ...inputBase, maxWidth: 280 }}
            />
          )}
          {(filtros ?? []).map((f) => (
            <select
              key={f.name}
              value={filtroVals[f.name] ?? ""}
              onChange={(e) => setFiltro((p) => ({ ...p, [f.name]: e.target.value }))}
              style={{ ...inputBase, maxWidth: 200 }}
            >
              <option value="">{f.label}: todos</option>
              {f.opciones.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          ))}
        </div>
      )}

      {error && <Aviso texto={error} />}

      <Card style={{ padding: 0, overflow: "hidden" }}>
        {cargando
          ? <div style={{ padding: 34, textAlign: "center", color: T.suave }}>Cargando…</div>
          : (
            <Tabla
              columnas={columnas}
              filas={filas}
              onFila={onFila}
              acciones={(f) => (
                <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                  {extraAcciones?.(f, cargar)}
                  <button onClick={() => abrirEditar(f)} title="Editar" style={iconBtn}>✏️</button>
                  <button onClick={() => borrar(f)} title="Eliminar" style={iconBtn}>🗑️</button>
                </div>
              )}
            />
          )}
      </Card>

      <Modal abierto={modal} titulo={editando ? `Editar ${titulo.toLowerCase()}` : `Nuevo — ${titulo}`} onCerrar={() => setModal(false)}>
        {error && <Aviso texto={error} />}
        <Formulario
          campos={campos}
          valores={valores}
          onCambio={(n, v) => setValores((p) => ({ ...p, [n]: v }))}
          opcionesRemotas={remotas}
        />
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
          <Btn tono="neutro" onClick={() => setModal(false)}>Cancelar</Btn>
          <Btn onClick={guardar} disabled={guardando}>{guardando ? "Guardando…" : "Guardar"}</Btn>
        </div>
      </Modal>
    </div>
  );
}

export const iconBtn: CSSProperties = {
  background: T.panel2, border: `1px solid ${T.borde}`, borderRadius: 8,
  padding: "5px 9px", cursor: "pointer", fontSize: 13, lineHeight: 1,
  color: T.texto,
};

export { inputBase };
