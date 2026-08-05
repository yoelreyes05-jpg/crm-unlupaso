"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { T } from "./ui";

const GRUPOS: { titulo: string; items: { href: string; label: string; icono: string }[] }[] = [
  {
    titulo: "Operación",
    items: [
      { href: "/reposteria",           label: "Dashboard",  icono: "🏠" },
      { href: "/reposteria/pos",       label: "POS",        icono: "🧁" },
      { href: "/reposteria/eventos",   label: "Eventos",    icono: "🎉" },
      { href: "/reposteria/clientes",  label: "Clientes",   icono: "👥" },
    ],
  },
  {
    titulo: "Producción e inventario",
    items: [
      { href: "/reposteria/productos",    label: "Productos",    icono: "🎂" },
      { href: "/reposteria/recetas",      label: "Recetas",      icono: "📖" },
      { href: "/reposteria/lotes",        label: "Lotes",        icono: "⏱️" },
      { href: "/reposteria/ingredientes", label: "Ingredientes", icono: "🥣" },
      { href: "/reposteria/compras",      label: "Compras",      icono: "🛒" },
      { href: "/reposteria/equipos",      label: "Equipos",      icono: "🪑" },
      { href: "/reposteria/proveedores",  label: "Proveedores",  icono: "🚚" },
    ],
  },
  {
    titulo: "Finanzas",
    items: [
      { href: "/reposteria/cotizaciones",  label: "Cotizaciones",   icono: "💬" },
      { href: "/reposteria/facturas",      label: "Facturación",    icono: "🧾" },
      { href: "/reposteria/cuentas-pagar", label: "Cuentas x pagar",icono: "📤" },
      { href: "/reposteria/caja",          label: "Caja",           icono: "💵" },
      { href: "/reposteria/caja-chica",    label: "Caja chica",     icono: "🪙" },
    ],
  },
  {
    titulo: "Sistema",
    items: [
      { href: "/reposteria/configuracion", label: "Configuración", icono: "⚙️" },
      { href: "/pos",                      label: "POS Unlupaso",  icono: "↩️" },
    ],
  },
];

export default function SidebarReposteria() {
  const pathname = usePathname();
  const [abierto, setAbierto] = useState(true);

  return (
    <aside style={{
      width: abierto ? 232 : 62,
      background: T.panel,
      borderRight: `1px solid ${T.borde}`,
      display: "flex", flexDirection: "column",
      transition: "width .15s", flexShrink: 0,
      position: "sticky", top: 0, height: "100vh", overflowY: "auto",
    }}>
      <div style={{
        padding: "16px 14px", borderBottom: `1px solid ${T.borde}`,
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <div style={{
          width: 34, height: 34, borderRadius: 10, flexShrink: 0,
          background: `linear-gradient(135deg, ${T.acento}, #8b5cf6)`,
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
        }}>🧁</div>
        {abierto && (
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 14 }}>Repostería</div>
            <div style={{ fontSize: 10.5, color: T.suave }}>UNLUPASO · ERP</div>
          </div>
        )}
      </div>

      <nav style={{ flex: 1, padding: "10px 8px" }}>
        {GRUPOS.map((g) => (
          <div key={g.titulo} style={{ marginBottom: 14 }}>
            {abierto && (
              <div style={{
                fontSize: 10, color: T.suave, textTransform: "uppercase",
                letterSpacing: 0.6, padding: "6px 10px", fontWeight: 700,
              }}>{g.titulo}</div>
            )}
            {g.items.map((it) => {
              const activo = pathname === it.href;
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "8px 10px", borderRadius: 9, marginBottom: 2,
                    textDecoration: "none", fontSize: 13.5, fontWeight: activo ? 700 : 500,
                    color: activo ? "#fff" : T.suave,
                    background: activo ? T.acento + "33" : "transparent",
                    borderLeft: activo ? `3px solid ${T.acento}` : "3px solid transparent",
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
          background: "transparent", border: "none", borderTop: `1px solid ${T.borde}`,
          color: T.suave, padding: "11px", cursor: "pointer", fontSize: 13,
        }}
      >{abierto ? "◀ Contraer" : "▶"}</button>
    </aside>
  );
}
