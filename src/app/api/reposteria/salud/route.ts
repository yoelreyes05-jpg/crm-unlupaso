import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

/**
 * GET /api/reposteria/salud
 * Diagnóstico de despliegue: dice qué variables faltan y si la base responde.
 * Nunca devuelve el valor de una clave, solo si existe y su prefijo.
 */
export async function GET() {
  const url    = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon   = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const pista = (v?: string) =>
    !v ? "FALTA" : `OK (${v.slice(0, 12)}…, ${v.length} caracteres)`;

  const variables = {
    NEXT_PUBLIC_SUPABASE_URL:      url ? `OK (${url})` : "FALTA",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: pista(anon),
    SUPABASE_SERVICE_ROLE_KEY:     pista(secret),
  };

  const faltantes = Object.entries(variables)
    .filter(([, v]) => v === "FALTA")
    .map(([k]) => k);

  if (faltantes.length > 0) {
    return NextResponse.json({
      ok: false,
      problema: "Faltan variables de entorno en el servidor",
      faltantes,
      variables,
      solucion:
        "Vercel → Project → Settings → Environment Variables (o Railway → Variables). " +
        "Agrégalas para Production, Preview y Development, y vuelve a desplegar. " +
        "Las NEXT_PUBLIC_* se incrustan en tiempo de build: sin redeploy no toman efecto.",
    }, { status: 503 });
  }

  // Prueba real contra la base de datos
  try {
    const supabase = createSupabaseClient(url!, secret!);
    const { error, count } = await supabase
      .from("rep_clientes")
      .select("id", { count: "exact", head: true });

    if (error) {
      return NextResponse.json({
        ok: false,
        problema: "Las variables están, pero Supabase rechazó la consulta",
        detalle: error.message,
        variables,
        solucion:
          "Verifica que ejecutaste supabase/reposteria_schema.sql y que la clave secreta " +
          "pertenece a este mismo proyecto de Supabase.",
      }, { status: 502 });
    }

    return NextResponse.json({
      ok: true,
      mensaje: "Conexión correcta con Supabase",
      tabla_prueba: "rep_clientes",
      registros: count ?? 0,
      variables,
    });
  } catch (err: unknown) {
    return NextResponse.json({
      ok: false,
      problema: "Error al conectar con Supabase",
      detalle: err instanceof Error ? err.message : String(err),
      variables,
    }, { status: 502 });
  }
}
