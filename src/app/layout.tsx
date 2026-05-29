import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "UNLUPASO — Sistema POS",
  description: "Un lugar para soñar · Sistema de Punto de Venta",
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
