import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

/** Diagnóstico del módulo de tienda: variables de entorno y tablas ti_. */
export async function GET() {
  const entorno = {
    NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
  const faltan = Object.entries(entorno).filter(([, ok]) => !ok).map(([k]) => k);
  if (faltan.length > 0) {
    return NextResponse.json(
      { ok: false, entorno, error: `Faltan variables de entorno: ${faltan.join(", ")}` },
      { status: 500 }
    );
  }

  const tablas = [
    "ti_config", "ti_clientes", "ti_proveedores", "ti_productos",
    "ti_movimientos_inventario", "ti_compras", "ti_compra_items",
    "ti_ventas", "ti_venta_items", "ti_cobros", "ti_pagos_proveedor",
    "ti_caja_sesiones", "ti_caja_movimientos", "ti_gastos",
  ];

  try {
    const sb = createAdminClient();
    const resultado: Record<string, string> = {};
    for (const t of tablas) {
      const { error, count } = await sb.from(t).select("*", { count: "exact", head: true });
      resultado[t] = error ? `ERROR: ${error.message}` : `ok (${count ?? 0} filas)`;
    }
    const faltantes = Object.entries(resultado).filter(([, v]) => v.startsWith("ERROR"));
    return NextResponse.json({
      ok: faltantes.length === 0,
      entorno,
      tablas: resultado,
      mensaje: faltantes.length === 0
        ? "MAXMATT SHOP listo."
        : "Ejecuta supabase/tienda_schema.sql en el SQL Editor de Supabase.",
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, entorno, error: err instanceof Error ? err.message : "Error desconocido" },
      { status: 500 }
    );
  }
}
