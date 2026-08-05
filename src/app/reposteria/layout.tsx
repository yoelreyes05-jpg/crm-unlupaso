import type { Metadata } from "next";
import SidebarCrowEvents from "@/components/reposteria/Sidebar";

export const metadata: Metadata = {
  title: "CROW EVENTS — Endulzando tu paladar",
  description: "Repostería, eventos y alquiler de equipos · Tel. 829-404-1644",
};

export default function CrowEventsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: "flex",
      minHeight: "100vh",
      background: "#f7f3ec",
      color: "#3a2c1c",
      fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
    }}>
      <SidebarCrowEvents />
      <main style={{ flex: 1, padding: "26px 30px", minWidth: 0 }}>{children}</main>
    </div>
  );
}
