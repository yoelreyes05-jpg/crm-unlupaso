import type { Metadata } from "next";
import EstilosImpresion from "@/components/anyeli/EstilosImpresion";
import SidebarAnyeli from "@/components/anyeli/Sidebar";

export const metadata: Metadata = {
  title: "INVERSIONES ANYELI — Gestión de cartera",
  description: "INVERSIONES ANYELI · Préstamos personales, inversionistas, cobranza y contabilidad",
};

export default function AnyeliLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: "flex",
      minHeight: "100vh",
      background: "#eef2f6",
      color: "#0f2430",
      fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
    }}>
      <EstilosImpresion />
      <SidebarAnyeli />
      <main style={{ flex: 1, padding: "26px 30px", minWidth: 0 }}>{children}</main>
    </div>
  );
}
