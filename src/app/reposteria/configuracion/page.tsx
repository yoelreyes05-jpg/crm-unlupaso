"use client";

import { useEffect, useState } from "react";
import { api, Aviso, Btn, Card, Etiqueta, inputBase, T } from "@/components/reposteria/ui";
import { NCF_TIPOS } from "@/types/reposteria";

const CAMPOS: { clave: string; label: string; tipo?: string; ayuda?: string }[] = [
  { clave: "nombre",       label: "Nombre del negocio" },
  { clave: "slogan",       label: "Slogan" },
  { clave: "telefono",     label: "Teléfono" },
  { clave: "rnc",          label: "RNC" },
  { clave: "direccion",    label: "Dirección" },
  { clave: "moneda",       label: "Moneda", ayuda: "Código ISO, ej. DOP" },
  { clave: "itbis_pct",    label: "ITBIS %", tipo: "number", ayuda: "Se aplica a eventos, cotizaciones y facturas" },
  { clave: "deposito_pct", label: "Depósito sugerido %", tipo: "number" },
  { clave: "logo_url",     label: "URL del logo" },
];

export default function ConfiguracionPage() {
  const [valores, setValores] = useState<Record<string, string>>({});
  const [error, setError]     = useState("");
  const [ok, setOk]           = useState("");
  const [guardando, setG]     = useState(false);

  useEffect(() => {
    void api<{ data: Record<string, string> }>("/config")
      .then((r) => setValores(r.data ?? {}))
      .catch((e) => setError(e instanceof Error ? e.message : "Error al cargar la configuración"));
  }, []);

  async function guardar() {
    setG(true); setError(""); setOk("");
    try {
      await api("/config", { metodo: "PUT", body: valores });
      setOk("Configuración guardada");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar");
    } finally { setG(false); }
  }

  return (
    <div style={{ maxWidth: 720 }}>
      <h1 style={{ fontSize: 24, margin: "0 0 18px" }}>⚙️ Configuración de repostería</h1>

      {error && <Aviso texto={error} />}
      {ok && <Aviso texto={ok} tono="ok" />}

      <Card>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {CAMPOS.map((c) => (
            <div key={c.clave}>
              <Etiqueta>{c.label}</Etiqueta>
              <input
                type={c.tipo ?? "text"}
                value={valores[c.clave] ?? ""}
                onChange={(e) => setValores((p) => ({ ...p, [c.clave]: e.target.value }))}
                style={inputBase}
              />
              {c.ayuda && <div style={{ fontSize: 11, color: T.suave, marginTop: 4 }}>{c.ayuda}</div>}
            </div>
          ))}

          <div>
            <Etiqueta>NCF por defecto</Etiqueta>
            <select
              value={valores.ncf_default ?? "B02"}
              onChange={(e) => setValores((p) => ({ ...p, ncf_default: e.target.value }))}
              style={inputBase}
            >
              {NCF_TIPOS.map((n) => <option key={n.key} value={n.key}>{n.key} — {n.desc}</option>)}
            </select>
          </div>
        </div>

        <Btn onClick={guardar} disabled={guardando} style={{ marginTop: 20 }}>
          {guardando ? "Guardando…" : "Guardar configuración"}
        </Btn>
      </Card>

      <Card style={{ marginTop: 18 }}>
        <strong style={{ display: "block", marginBottom: 10 }}>Aislamiento de datos</strong>
        <p style={{ fontSize: 13.5, color: T.suave, lineHeight: 1.65, margin: 0 }}>
          Todas las tablas de este módulo usan el prefijo <code style={{ color: T.acento2 }}>rep_</code> y
          viven en el mismo proyecto Supabase que el POS de UNLUPASO, pero sin ninguna relación con las
          tablas <code style={{ color: T.acento2 }}>ul_</code>. Las ventas, el inventario, la caja y la
          facturación de repostería son completamente independientes de las de la heladería.
        </p>
      </Card>
    </div>
  );
}
