import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * GET /api/reposteria/vistas/[nombre]
 * Acceso de solo lectura a las vistas del ERP repostería.
 * Whitelist estricta: solo vistas rep_*.
 */
const VISTAS: Record<string, { orden: string; asc: boolean }> = {
  "ingredientes-status": { orden: "nombre",            asc: true  },
  "lotes-alerta":        { orden: "fecha_vencimiento", asc: true  },
  "ventas-diarias":      { orden: "fecha",             asc: false },
  "cuadre-auto":         { orden: "fecha",             asc: false },
  "top-productos":       { orden: "unidades_vendidas", asc: false },
  "cxc-abiertas":        { orden: "fecha_vencimiento", asc: true  },
  "cxp-abiertas":        { orden: "fecha_vencimiento", asc: true  },
  "agenda-eventos":      { orden: "fecha_evento",      asc: true  },
};

export async function GET(req: NextRequest, ctx: { params: Promise<{ nombre: string }> }) {
  try {
    const { nombre } = await ctx.params;
    const cfg = VISTAS[nombre];
    if (!cfg) return NextResponse.json({ error: `Vista no permitida: ${nombre}` }, { status: 404 });

    const supabase = createAdminClient();
    const sp = req.nextUrl.searchParams;
    const tabla = `rep_${nombre.replace(/-/g, "_")}`;

    let q = supabase
      .from(tabla)
      .select("*")
      .order(cfg.orden, { ascending: cfg.asc })
      .limit(Math.min(parseInt(sp.get("limit") ?? "500"), 2000));

    const nivel = sp.get("nivel_alerta");
    if (nivel) q = q.eq("nivel_alerta", nivel);

    const fecha = sp.get("fecha");
    if (fecha) q = q.eq("fecha", fecha);

    const { data, error } = await q;
    if (error) throw error;

    return NextResponse.json({ data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error al consultar la vista";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
