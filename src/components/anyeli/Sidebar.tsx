"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { VERDE } from "./ui";
import { ANYELI_NEGOCIO } from "@/lib/anyeli/negocio";

/**
 * Barra lateral del módulo INVERSIONES ANYELI.
 * No enlaza a ningún otro módulo: quien entra por /anyeli solo ve este sistema.
 */

const GRUPOS: { titulo: string; items: { href: string; label: string; icono: string }[] }[] = [
  {
    titulo: "Operación",
    items: [
      { href: "/anyeli",           label: "Tablero",    icono: "📊" },
      { href: "/anyeli/creditos",  label: "Préstamos",  icono: "📄" },
      { href: "/anyeli/cobranza",  label: "Cobranza",   icono: "⏰" },
      { href: "/anyeli/pagos",     label: "Pagos",      icono: "✅" },
    ],
  },
  {
    titulo: "Cartera",
    items: [
      { href: "/anyeli/clientes",       label: "Clientes",       icono: "👤" },
      { href: "/anyeli/inversionistas", label: "Inversionistas", icono: "⭐" },
    ],
  },
  {
    titulo: "Administración",
    items: [
      { href: "/anyeli/contabilidad",  label: "Contabilidad",  icono: "💹" },
      { href: "/anyeli/configuracion", label: "Configuración", icono: "⚙️" },
    ],
  },
];

const FONDO = "#0d2b34";
const BORDE = "#1b4450";
const SUAVE = "#8fb0b9";

export default function SidebarAnyeli() {
  const pathname = usePathname();
  const [abierto, setAbierto] = useState(true);

  return (
    <aside style={{
      width: abierto ? 232 : 62,
      background: FONDO,
      borderRight: `1px solid ${BORDE}`,
      display: "flex", flexDirection: "column",
      transition: "width .15s", flexShrink: 0,
      position: "sticky", top: 0, height: "100vh", overflowY: "auto",
    }}>
      <div style={{
        padding: abierto ? "16px 14px" : "14px 8px",
        borderBottom: `1px solid ${BORDE}`,
        display: "flex", alignItems: "center", gap: 10,
        justifyContent: abierto ? "flex-start" : "center",
      }}>
        <div style={{
          width: 34, height: 34, borderRadius: 10, background: VERDE,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#fff", fontWeight: 900, fontSize: 16, flexShrink: 0,
        }}>$</div>
        {abierto && (
          <div style={{ minWidth: 0 }}>
            <div style={{ color: "#fff", fontWeight: 800, fontSize: 13.5, whiteSpace: "nowrap" }}>
              {ANYELI_NEGOCIO.nombre}
            </div>
            <div style={{ color: SUAVE, fontSize: 10.5, whiteSpace: "nowrap" }}>
              {ANYELI_NEGOCIO.slogan}
            </div>
          </div>
        )}
      </div>

      <nav style={{ flex: 1, padding: "10px 8px" }}>
        {GRUPOS.map((g) => (
          <div key={g.titulo} style={{ marginBottom: 14 }}>
            {abierto && (
              <div style={{
                fontSize: 10, color: SUAVE, textTransform: "uppercase",
                letterSpacing: 0.7, padding: "6px 10px", fontWeight: 700, opacity: 0.75,
              }}>{g.titulo}</div>
            )}
            {g.items.map((it) => {
              const activo = it.href === "/anyeli"
                ? pathname === "/anyeli"
                : pathname.startsWith(it.href);
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "8px 10px", borderRadius: 9, marginBottom: 2,
                    textDecoration: "none", fontSize: 13.5, fontWeight: activo ? 700 : 500,
                    color: activo ? "#fff" : SUAVE,
                    background: activo ? "#12414d" : "transparent",
                    borderLeft: activo ? "3px solid #2dd4bf" : "3px solid transparent",
                  }}
                >
                  <span style={{ fontSize: 15 }}>{it.icono}</span>
                  {abierto && <span style={{ whiteSpace: "nowrap" }}>{it.label}</span>}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <button
        onClick={() => setAbierto((v) => !v)}
        style={{
          background: "transparent", border: "none", borderTop: `1px solid ${BORDE}`,
          color: SUAVE, padding: "11px", cursor: "pointer", fontSize: 13,
        }}
      >{abierto ? "◀ Contraer" : "▶"}</button>
    </aside>
  );
}
