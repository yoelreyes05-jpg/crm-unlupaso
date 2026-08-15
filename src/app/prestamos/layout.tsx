import type { Metadata } from "next";
import EstilosImpresion from "@/components/prestamos/EstilosImpresion";
import SidebarPrestamos from "@/components/prestamos/Sidebar";

export const metadata: Metadata = {
  title: "Préstamos — Gestión de cartera",
  description: "Préstamos personales, inversionistas, cobranza y contabilidad",
};

export default function PrestamosLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: "flex",
      minHeight: "100vh",
      background: "#eef2f6",
      color: "#0f2430",
      fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
    }}>
      <EstilosImpresion />
      <SidebarPrestamos />
      <main style={{ flex: 1, padding: "26px 30px", minWidth: 0 }}>{children}</main>
    </div>
  );
}
