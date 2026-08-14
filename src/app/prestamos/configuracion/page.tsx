"use client";

import { useEffect, useState } from "react";
import {
  Aviso, Btn, Cargando, Etiqueta, PCT, Seccion, Titulo, api, inputBase, T,
} from "@/components/prestamos/ui";
import { TASAS_DISPONIBLES, tasaPeriodo, type Frecuencia } from "@/lib/prestamos/calculo";
import type { PrConfig } from "@/types/prestamos";

const FILAS: { f: Frecuencia; etiqueta: string }[] = [
  { f: "mensual",   etiqueta: "Mensual" },
  { f: "quincenal", etiqueta: "Quincenal" },
  { f: "semanal",   etiqueta: "Semanal" },
];

export default function ConfiguracionPrestamos() {
  const [c, setC] = useState<PrConfig | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ data: PrConfig }>("/config")
      .then((r) => setC(r.data))
      .catch((e) => setError(e instanceof Error ? e.message : "Error"))
      .finally(() => setCargando(false));
  }, []);

  if (cargando) return <Cargando />;
  if (!c) return <Aviso texto={error || "No se pudo cargar la configuración."} />;

  const set = (k: keyof PrConfig, v: unknown) => setC({ ...c, [k]: v } as PrConfig);

  async function guardar() {
    if (!c) return;
    setGuardando(true); setMsg(""); setError("");
    try {
      await api("/config", { metodo: "PATCH", body: c });
      setMsg("Configuración guardada.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div style={{ maxWidth: 900 }}>
      <Titulo
        texto="⚙️  Configuración"
        sub="Datos del negocio y valores por defecto de los préstamos"
        acciones={<Btn onClick={guardar} disabled={guardando}>{guardando ? "Guardando…" : "Guardar cambios"}</Btn>}
      />

      {msg && <Aviso texto={msg} tono="ok" />}
      {error && <Aviso texto={error} />}

      <Seccion titulo="Datos del negocio" style={{ marginBottom: 18 }}>
        <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          <div style={{ gridColumn: "1 / -1" }}>
            <Etiqueta>Nombre que aparece en los estados de cuenta</Etiqueta>
            <input style={inputBase} value={c.nombre_empresa ?? ""} onChange={(e) => set("nombre_empresa", e.target.value)} />
          </div>
          <div>
            <Etiqueta>RNC / Cédula</Etiqueta>
            <input style={inputBase} value={c.rnc ?? ""} onChange={(e) => set("rnc", e.target.value)} />
          </div>
          <div>
            <Etiqueta>Teléfono</Etiqueta>
            <input style={inputBase} value={c.telefono ?? ""} onChange={(e) => set("telefono", e.target.value)} />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <Etiqueta>Dirección</Etiqueta>
            <input style={inputBase} value={c.direccion ?? ""} onChange={(e) => set("direccion", e.target.value)} />
          </div>
          <div>
            <Etiqueta>Moneda</Etiqueta>
            <input style={inputBase} value={c.moneda ?? ""} onChange={(e) => set("moneda", e.target.value)} />
          </div>
          <div>
            <Etiqueta>Símbolo</Etiqueta>
            <input style={inputBase} value={c.simbolo_moneda ?? ""} onChange={(e) => set("simbolo_moneda", e.target.value)} />
          </div>
        </div>
      </Seccion>

      <Seccion titulo="Valores por defecto de los préstamos" style={{ marginBottom: 18 }}>
        <div style={{ display: "grid", gap: 16 }}>
          <div>
            <Etiqueta>Tasa que le cobras al cliente</Etiqueta>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {TASAS_DISPONIBLES.map((t) => {
                const activo = Number(c.tasa_cliente_default) === t;
                return (
                  <button key={t} type="button" onClick={() => set("tasa_cliente_default", t)}
                    style={{
                      border: activo ? "none" : `1px solid ${T.borde}`,
                      background: activo ? T.acento : T.panel,
                      color: activo ? "#fff" : T.texto,
                      borderRadius: 9, padding: "8px 13px", fontSize: 13.5, fontWeight: 700, cursor: "pointer",
                    }}
                  >{t}%</button>
                );
              })}
            </div>
          </div>

          <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
            <div>
              <Etiqueta>Tasa por defecto del inversionista (%)</Etiqueta>
              <input type="number" step="0.1" style={inputBase} value={c.tasa_inv_default ?? 0}
                     onChange={(e) => set("tasa_inv_default", Number(e.target.value))} />
              <div style={{ fontSize: 11.5, color: T.ok, marginTop: 5, fontWeight: 700 }}>
                Me quedaría {PCT(Math.max(0, Number(c.tasa_cliente_default) - Number(c.tasa_inv_default)), 1)} mensual
              </div>
            </div>
            <div>
              <Etiqueta>Días de gracia antes de marcar atraso</Etiqueta>
              <input type="number" min={0} style={inputBase} value={c.dias_gracia ?? 0}
                     onChange={(e) => set("dias_gracia", Number(e.target.value))} />
            </div>
            <div>
              <Etiqueta>Tasa de mora (% de la cuota)</Etiqueta>
              <input type="number" step="0.1" style={inputBase} value={c.tasa_mora ?? 0}
                     onChange={(e) => set("tasa_mora", Number(e.target.value))} />
            </div>
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 14 }}>
            <input type="checkbox" checked={!!c.mora_activa_default}
                   onChange={(e) => set("mora_activa_default", e.target.checked)} />
            Activar mora por defecto en los préstamos nuevos
          </label>
        </div>
      </Seccion>

      <Seccion titulo="Cómo se prorratea la tasa mensual">
        <div style={{ display: "grid", gap: 9, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", marginBottom: 16 }}>
          {[
            { v: "divisor", t: "División simple (recomendado)", d: "Mensual = la tasa · Quincenal = la mitad · Semanal = la cuarta parte. Es como se calcula en la calle." },
            { v: "dias", t: "Por días reales", d: "Tasa × (días del período ÷ 30). Semanal sale 7/30 en vez de un cuarto." },
          ].map((o) => {
            const activo = c.metodo_prorrateo === o.v;
            return (
              <button key={o.v} type="button" onClick={() => set("metodo_prorrateo", o.v)}
                style={{
                  textAlign: "left", cursor: "pointer", borderRadius: 11, padding: 14,
                  border: activo ? `1px solid ${T.acento}` : `1px solid ${T.borde}`,
                  background: activo ? "#e6f6f4" : T.panel,
                }}
              >
                <div style={{ fontSize: 13.5, fontWeight: 800 }}>{o.t}</div>
                <div style={{ fontSize: 11.5, color: T.suave, marginTop: 4, lineHeight: 1.45 }}>{o.d}</div>
              </button>
            );
          })}
        </div>

        <div style={{ border: `1px solid ${T.borde}`, borderRadius: 10, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                {["Frecuencia", "Tasa por cuota", `Interés por cuota sobre ${c.simbolo_moneda} 100,000`].map((h, i) => (
                  <th key={h} style={{
                    textAlign: i === 0 ? "left" : "right", padding: "9px 12px", color: T.suave,
                    fontSize: 10.5, textTransform: "uppercase", borderBottom: `1px solid ${T.borde}`, background: T.panel2,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FILAS.map((r) => {
                const t = tasaPeriodo(Number(c.tasa_cliente_default), r.f, 30, c.metodo_prorrateo);
                return (
                  <tr key={r.f} style={{ borderBottom: `1px solid ${T.borde}66` }}>
                    <td style={{ padding: "9px 12px" }}>{r.etiqueta}</td>
                    <td style={{ padding: "9px 12px", textAlign: "right" }}>{PCT(t * 100, 3)}</td>
                    <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: 700 }}>
                      {c.simbolo_moneda} {(100000 * t).toLocaleString("es-DO", { maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Seccion>
    </div>
  );
}
