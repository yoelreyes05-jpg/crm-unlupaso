import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * Diagnóstico del módulo: confirma variables de entorno y que las
 * tablas ia_* existan. Útil tras desplegar en Railway o Vercel.
 */
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
    "ia_config", "ia_clientes", "ia_inversionistas", "ia_prestamos",
    "ia_cuotas", "ia_pagos", "ia_distribuciones", "ia_reenganches",
    "ia_movimientos_inversionista",
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
      mensaje:
        faltantes.length === 0
          ? "Módulo de préstamos listo."
          : "Ejecuta supabase/anyeli_schema.sql en el SQL Editor de Supabase.",
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, entorno, error: err instanceof Error ? err.message : "Error desconocido" },
      { status: 500 }
    );
  }
}
