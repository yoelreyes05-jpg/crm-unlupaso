"use client";

/**
 * Traer datos desde la agenda del teléfono.
 *
 * Dos caminos, según lo que soporte el equipo:
 *
 *  1. Contact Picker API  (navigator.contacts.select)
 *     Abre la agenda nativa. Funciona en Chrome de Android y Samsung Internet.
 *     Requiere HTTPS y que lo dispare un toque del usuario — las dos cosas se
 *     cumplen aquí. El permiso NO queda guardado: lo pide cada vez, que es
 *     justo lo que uno quiere para una agenda.
 *
 *  2. Tarjeta de contacto .vcf  (respaldo universal)
 *     En iPhone la API no existe y no hay forma de abrir la agenda desde el
 *     navegador. Pero desde Contactos → Compartir contacto se puede guardar
 *     un .vcf y elegirlo aquí. También sirve en computadora.
 *
 * Nunca se sube nada: el .vcf se lee en el navegador y solo se copian los
 * campos al formulario.
 */

import { useRef, useState } from "react";
import { Aviso, Modal, T } from "./ui";  // kit de UI de la tienda

export interface ContactoElegido {
  nombre?: string;
  telefono?: string;
  telefono2?: string;
  email?: string;
  direccion?: string;
}

/* ── Tipos de la Contact Picker API (aún no vienen en TypeScript) ────────── */
interface DireccionContacto {
  addressLine?: string[];
  city?: string;
  region?: string;
  postalCode?: string;
  country?: string;
}
interface ContactoNativo {
  name?: string[];
  tel?: string[];
  email?: string[];
  address?: DireccionContacto[];
}
interface GestorContactos {
  select: (props: string[], opts?: { multiple?: boolean }) => Promise<ContactoNativo[]>;
  getProperties: () => Promise<string[]>;
}

function gestor(): GestorContactos | null {
  if (typeof navigator === "undefined") return null;
  const n = navigator as Navigator & { contacts?: GestorContactos };
  return n.contacts && typeof n.contacts.select === "function" ? n.contacts : null;
}

/** ¿El equipo puede abrir la agenda nativa? */
export function hayAgendaNativa(): boolean {
  return gestor() !== null && typeof window !== "undefined" && window.isSecureContext;
}

/* ── Teléfonos dominicanos ───────────────────────────────────────────────── */
/** 18095550101 · +1 (809) 555-0101 · 8095550101  →  809-555-0101 */
export function normalizarTelefono(valor: string | undefined): string {
  if (!valor) return "";
  let d = valor.replace(/[^\d]/g, "");
  if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return valor.trim();
}

/* ── Lector de tarjetas .vcf ─────────────────────────────────────────────── */
function desescapar(v: string): string {
  return v.replace(/\\n/gi, " ").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\").trim();
}

function decodificarQP(v: string): string {
  try {
    const bytes = v.replace(/=\r?\n/g, "").replace(/=([0-9A-Fa-f]{2})/g, (_m, h) =>
      String.fromCharCode(parseInt(h, 16))
    );
    return decodeURIComponent(escape(bytes));
  } catch {
    return v;
  }
}

/** Extrae los contactos de un archivo .vcf (soporta varios en el mismo archivo). */
export function leerVCard(texto: string): ContactoElegido[] {
  // Desplegar líneas partidas (RFC 6350: continúan con espacio o tabulador)
  const lineas = texto.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "").split("\n");

  const contactos: ContactoElegido[] = [];
  let actual: ContactoElegido | null = null;
  let telefonos: string[] = [];

  for (const linea of lineas) {
    const L = linea.trim();
    if (!L) continue;

    if (/^BEGIN:VCARD/i.test(L)) { actual = {}; telefonos = []; continue; }

    if (/^END:VCARD/i.test(L)) {
      if (actual) {
        if (telefonos[0]) actual.telefono = telefonos[0];
        if (telefonos[1]) actual.telefono2 = telefonos[1];
        if (actual.nombre || actual.telefono || actual.email) contactos.push(actual);
      }
      actual = null;
      continue;
    }

    if (!actual) continue;

    const corte = L.indexOf(":");
    if (corte < 0) continue;
    const izquierda = L.slice(0, corte);
    let valor = L.slice(corte + 1);

    const partes = izquierda.split(";");
    const campo = partes[0].split(".").pop()!.toUpperCase(); // quita prefijos tipo "item1."
    const params = partes.slice(1).join(";").toUpperCase();

    if (params.includes("QUOTED-PRINTABLE")) valor = decodificarQP(valor);
    valor = desescapar(valor);
    if (!valor) continue;

    if (campo === "FN") {
      actual.nombre = valor;
    } else if (campo === "N" && !actual.nombre) {
      const [apellido, nombre] = valor.split(";");
      actual.nombre = [nombre, apellido].filter(Boolean).join(" ").trim();
    } else if (campo === "TEL") {
      const tel = normalizarTelefono(valor);
      // el celular primero
      if (/CELL|MOBILE/.test(params)) telefonos.unshift(tel);
      else telefonos.push(tel);
    } else if (campo === "EMAIL" && !actual.email) {
      actual.email = valor;
    } else if (campo === "ADR" && !actual.direccion) {
      // ADR: apartado;interior;calle;ciudad;provincia;código postal;país
      // Hay que cortar los dos primeros ANTES de descartar los vacíos,
      // si no se pierden la calle y la ciudad.
      const p = valor.split(";").slice(2).map((x) => desescapar(x)).filter(Boolean);
      actual.direccion = p.join(", ");
    }
  }

  return contactos;
}

/* ── Botón ───────────────────────────────────────────────────────────────── */
export function BotonContacto({
  etiqueta = "Traer de mis contactos",
  onElegir,
  compacto,
}: {
  etiqueta?: string;
  onElegir: (c: ContactoElegido) => void;
  compacto?: boolean;
}) {
  const archivo = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [varios, setVarios] = useState<ContactoElegido[] | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function abrirAgenda() {
    const g = gestor();
    setError("");

    // Camino 1: agenda nativa (Android)
    if (g && window.isSecureContext) {
      setOcupado(true);
      try {
        const disponibles = await g.getProperties();
        const pedir = ["name", "tel", "email", "address"].filter((p) => disponibles.includes(p));
        const res = await g.select(pedir, { multiple: false });
        if (res && res.length > 0) onElegir(desdeNativo(res[0]));
        return;
      } catch (e) {
        // El usuario canceló: no es un error que valga la pena mostrar
        const msg = e instanceof Error ? e.message : "";
        if (!/abort|cancel/i.test(msg)) {
          setError("No se pudo abrir la agenda. Usa una tarjeta de contacto (.vcf).");
        }
        return;
      } finally {
        setOcupado(false);
      }
    }

    // Camino 2: tarjeta .vcf (iPhone, computadora)
    archivo.current?.click();
  }

  async function leerArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setError("");
    try {
      const contactos = leerVCard(await f.text());
      if (contactos.length === 0) setError("No se encontró ningún contacto en ese archivo.");
      else if (contactos.length === 1) onElegir(contactos[0]);
      else setVarios(contactos);
    } catch {
      setError("No se pudo leer la tarjeta de contacto.");
    }
  }

  const nativa = hayAgendaNativa();

  return (
    <>
      <button
        type="button"
        onClick={abrirAgenda}
        disabled={ocupado}
        title={nativa ? "Abre la agenda del teléfono" : "Elige una tarjeta de contacto (.vcf)"}
        style={{
          display: "inline-flex", alignItems: "center", gap: 7,
          background: T.panel, border: `1px solid ${T.acento}66`, color: T.acento,
          borderRadius: 9, padding: compacto ? "6px 11px" : "9px 14px",
          fontSize: compacto ? 12.5 : 13.5, fontWeight: 700,
          cursor: ocupado ? "wait" : "pointer", whiteSpace: "nowrap",
        }}
      >
        <span style={{ fontSize: compacto ? 14 : 15 }}>📇</span>
        {ocupado ? "Abriendo…" : etiqueta}
      </button>

      <input
        ref={archivo}
        type="file"
        accept=".vcf,text/vcard,text/x-vcard"
        onChange={leerArchivo}
        style={{ display: "none" }}
      />

      {error && <div style={{ marginTop: 7 }}><Aviso texto={error} /></div>}

      <Modal
        abierto={!!varios}
        titulo="¿Cuál contacto?"
        onCerrar={() => setVarios(null)}
        ancho={430}
      >
        <div style={{ display: "grid", gap: 7 }}>
          {(varios ?? []).map((c, i) => (
            <button
              key={i}
              type="button"
              onClick={() => { onElegir(c); setVarios(null); }}
              style={{
                textAlign: "left", cursor: "pointer", borderRadius: 10, padding: 12,
                border: `1px solid ${T.borde}`, background: T.panel,
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 14 }}>{c.nombre || "Sin nombre"}</div>
              <div style={{ fontSize: 12, color: T.suave }}>
                {[c.telefono, c.email].filter(Boolean).join(" · ") || "sin teléfono ni correo"}
              </div>
            </button>
          ))}
        </div>
      </Modal>
    </>
  );
}

function desdeNativo(c: ContactoNativo): ContactoElegido {
  const tels = (c.tel ?? []).map(normalizarTelefono).filter(Boolean);
  const dir = c.address?.[0];
  return {
    nombre: c.name?.[0]?.trim() || undefined,
    telefono: tels[0] || undefined,
    telefono2: tels[1] || undefined,
    email: c.email?.[0]?.trim() || undefined,
    direccion: dir
      ? [dir.addressLine?.join(" "), dir.city, dir.region, dir.country].filter(Boolean).join(", ")
      : undefined,
  };
}

/* ── Barra con varios botones (cliente + referencias) ────────────────────── */
export function BarraContactos({
  botones,
}: {
  botones: { etiqueta: string; onElegir: (c: ContactoElegido) => void }[];
}) {
  const nativa = hayAgendaNativa();
  return (
    <div style={{
      border: `1px dashed ${T.acento}55`, background: "#f5f2fe",
      borderRadius: 11, padding: 12, marginBottom: 16,
    }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <span style={{ fontSize: 11.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.4, color: T.suave }}>
          Desde el teléfono
        </span>
        {botones.map((b) => (
          <BotonContacto key={b.etiqueta} etiqueta={b.etiqueta} onElegir={b.onElegir} compacto />
        ))}
      </div>
      <div style={{ fontSize: 11, color: T.suave, marginTop: 8, lineHeight: 1.45 }}>
        {nativa
          ? "Se abre la agenda del teléfono y solo se copian los datos que elijas."
          : "Este equipo no permite abrir la agenda desde el navegador. En iPhone: Contactos → Compartir contacto → Guardar en Archivos, y elige ese .vcf aquí."}
      </div>
    </div>
  );
}
