import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Gelatilandia — Sistema POS",
  description: "Gelatilandia · Sistema de Punto de Venta",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body style={{ margin: 0, padding: 0, background: "#0f172a" }}>
        {children}
      </body>
    </html>
  );
}
