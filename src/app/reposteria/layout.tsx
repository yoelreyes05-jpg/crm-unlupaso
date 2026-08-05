import type { Metadata } from "next";
import SidebarReposteria from "@/components/reposteria/Sidebar";

export const metadata: Metadata = {
  title: "Repostería — UNLUPASO",
  description: "ERP de repostería, eventos y alquiler de equipos",
};

export default function ReposteriaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#0f172a", color: "#e2e8f0" }}>
      <SidebarReposteria />
      <main style={{ flex: 1, padding: "26px 30px", minWidth: 0 }}>{children}</main>
    </div>
  );
}
