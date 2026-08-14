"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { VERDE } from "./ui";
import { TIENDA } from "@/lib/tienda/negocio";

/**
 * Barra lateral de MAXMATT SHOP.
 * No enlaza a ningún otro módulo: quien entra por /tienda solo ve la tienda.
 */

const GRUPOS: { titulo: string; items: { href: string; label: string; icono: string }[] }[] = [
  {
    titulo: "Operación",
    items: [
      { href: "/tienda",           label: "Tablero",   icono: "🏠" },
      { href: "/tienda/ventas",    label: "Ventas",    icono: "🧾" },
      { href: "/tienda/clientes",  label: "Clientes",  icono: "👤" },
    ],
  },
  {
    titulo: "Mercancía",
    items: [
      { href: "/tienda/inventario",  label: "Inventario",  icono: "📦" },
      { href: "/tienda/compras",     label: "Compras",     icono: "🛒" },
      { href: "/tienda/proveedores", label: "Proveedores", icono: "🚚" },
    ],
  },
  {
    titulo: "Administración",
    items: [
      { href: "/tienda/contabilidad", label: "Contabilidad",  icono: "💹" },
      { href: "/tienda/caja",         label: "Caja",          icono: "💵" },
      { href: "/tienda/configuracion",label: "Configuración", icono: "⚙️" },
    ],
  },
];

const FONDO = "#241f45";
const BORDE = "#3b3466";
const SUAVE = "#a9a2cf";

export default function SidebarTienda() {
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
          color: "#fff", fontWeight: 900, fontSize: 14, flexShrink: 0,
        }}>MX</div>
        {abierto && (
          <div style={{ minWidth: 0 }}>
            <div style={{ color: "#fff", fontWeight: 800, fontSize: 13.5, whiteSpace: "nowrap" }}>
              {TIENDA.nombre}
            </div>
            <div style={{ color: SUAVE, fontSize: 10.5, whiteSpace: "nowrap" }}>
              {TIENDA.slogan}
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
              const activo = it.href === "/tienda"
                ? pathname === "/tienda"
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
                    background: activo ? "#3a3170" : "transparent",
                    borderLeft: activo ? "3px solid #a78bfa" : "3px solid transparent",
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
