"use client";

import { useEffect, useState } from "react";
import {
  Aviso, Btn, Cargando, Etiqueta, Seccion, Titulo, api, inputBase, T,
} from "@/components/tienda/ui";

interface Config {
  id: number;
  nombre_empresa: string;
  slogan: string | null;
  rnc: string | null;
  telefono: string | null;
  telefono2: string | null;
  email: string | null;
  direccion: string | null;
  moneda: string;
  simbolo_moneda: string;
  itbis_pct: number;
  dias_credito: number;
  fondo_caja: number;
  logo_url: string | null;
  pie_factura: string | null;
}

export default function ConfiguracionTienda() {
  const [c, setC] = useState<Config | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ data: Config }>("/config")
      .then((r) => setC(r.data))
      .catch((e) => setError(e instanceof Error ? e.message : "Error"))
      .finally(() => setCargando(false));
  }, []);

  if (cargando) return <Cargando />;
  if (!c) return <Aviso texto={error || "No se pudo cargar la configuración."} />;

  const set = (k: keyof Config, v: unknown) => setC({ ...c, [k]: v } as Config);

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
    <div style={{ maxWidth: 880 }}>
      <Titulo
        texto="⚙️  Configuración"
        sub="Datos de la empresa y valores por defecto de la tienda"
        acciones={<Btn onClick={guardar} disabled={guardando}>{guardando ? "Guardando…" : "Guardar cambios"}</Btn>}
      />

      {msg && <Aviso texto={msg} tono="ok" />}
      {error && <Aviso texto={error} />}

      <Seccion titulo="Datos de la empresa" style={{ marginBottom: 18 }}>
        <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          <div style={{ gridColumn: "1 / -1" }}>
            <Etiqueta>Nombre que aparece en las facturas</Etiqueta>
            <input style={{ ...inputBase, fontSize: 16, fontWeight: 700 }}
                   value={c.nombre_empresa ?? ""}
                   onChange={(e) => set("nombre_empresa", e.target.value)} />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <Etiqueta>Eslogan</Etiqueta>
            <input style={inputBase} value={c.slogan ?? ""}
                   onChange={(e) => set("slogan", e.target.value)} />
          </div>
          <div>
            <Etiqueta>RNC</Etiqueta>
            <input style={inputBase} value={c.rnc ?? ""} onChange={(e) => set("rnc", e.target.value)} />
          </div>
          <div>
            <Etiqueta>Teléfono</Etiqueta>
            <input style={inputBase} value={c.telefono ?? ""} onChange={(e) => set("telefono", e.target.value)} />
          </div>
          <div>
            <Etiqueta>Teléfono alterno</Etiqueta>
            <input style={inputBase} value={c.telefono2 ?? ""} onChange={(e) => set("telefono2", e.target.value)} />
          </div>
          <div>
            <Etiqueta>Correo</Etiqueta>
            <input type="email" style={inputBase} value={c.email ?? ""} onChange={(e) => set("email", e.target.value)} />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <Etiqueta>Dirección</Etiqueta>
            <input style={inputBase} value={c.direccion ?? ""} onChange={(e) => set("direccion", e.target.value)} />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <Etiqueta>Logo (URL de la imagen)</Etiqueta>
            <input style={inputBase} value={c.logo_url ?? ""} onChange={(e) => set("logo_url", e.target.value)}
                   placeholder="https://…" />
          </div>
        </div>
      </Seccion>

      <Seccion titulo="Valores por defecto" style={{ marginBottom: 18 }}>
        <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" }}>
          <div>
            <Etiqueta>Moneda</Etiqueta>
            <input style={inputBase} value={c.moneda ?? ""} onChange={(e) => set("moneda", e.target.value)} />
          </div>
          <div>
            <Etiqueta>Símbolo</Etiqueta>
            <input style={inputBase} value={c.simbolo_moneda ?? ""}
                   onChange={(e) => set("simbolo_moneda", e.target.value)} />
          </div>
          <div>
            <Etiqueta>ITBIS por defecto (%)</Etiqueta>
            <input type="number" step="0.01" style={inputBase} value={c.itbis_pct ?? 0}
                   onChange={(e) => set("itbis_pct", Number(e.target.value))} />
            <div style={{ fontSize: 11, color: T.suave, marginTop: 4 }}>
              Se sugiere al crear productos nuevos. Cada producto puede tener el suyo o quedar exento.
            </div>
          </div>
          <div>
            <Etiqueta>Días de crédito por defecto</Etiqueta>
            <input type="number" style={inputBase} value={c.dias_credito ?? 30}
                   onChange={(e) => set("dias_credito", Number(e.target.value))} />
          </div>
          <div>
            <Etiqueta>Fondo de caja habitual</Etiqueta>
            <input type="number" step="0.01" style={inputBase} value={c.fondo_caja ?? 0}
                   onChange={(e) => set("fondo_caja", Number(e.target.value))} />
            <div style={{ fontSize: 11, color: T.suave, marginTop: 4 }}>
              Se propone al abrir la caja cada día.
            </div>
          </div>
        </div>
      </Seccion>

      <Seccion titulo="Pie de la factura">
        <Etiqueta>Texto que sale al final de cada factura impresa</Etiqueta>
        <textarea style={{ ...inputBase, minHeight: 80 }} value={c.pie_factura ?? ""}
                  onChange={(e) => set("pie_factura", e.target.value)}
                  placeholder="Ej.: Gracias por su compra. No se aceptan devoluciones después de 7 días." />
      </Seccion>
    </div>
  );
}
