import type { Metadata } from "next";
import SidebarTienda from "@/components/tienda/Sidebar";

export const metadata: Metadata = {
  title: "MAXMATT SHOP",
  description: "Tienda: ventas, inventario, contabilidad y caja",
};

export default function TiendaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: "flex",
      minHeight: "100vh",
      background: "#f1f0f9",
      color: "#1e1b34",
      fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
    }}>
      <SidebarTienda />
      <main style={{ flex: 1, padding: "26px 30px", minWidth: 0 }}>{children}</main>
    </div>
  );
}
