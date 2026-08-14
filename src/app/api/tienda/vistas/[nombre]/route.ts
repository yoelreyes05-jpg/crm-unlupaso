import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { fail } from "@/lib/tienda/crud";
import { VISTAS_PERMITIDAS } from "@/lib/tienda/tablas";

/** Lectura genérica de las vistas ti_v_* (solo las de la lista blanca). */
export async function GET(req: NextRequest, ctx: { params: Promise<{ nombre: string }> }) {
  try {
    const { nombre } = await ctx.params;
    const vista = nombre.startsWith("ti_v_") ? nombre : `ti_v_${nombre}`;
    if (!(VISTAS_PERMITIDAS as readonly string[]).includes(vista)) {
      return NextResponse.json({ error: `Vista no permitida: ${vista}` }, { status: 400 });
    }

    const sb = createAdminClient();
    const sp = req.nextUrl.searchParams;
    let q = sb.from(vista).select("*").limit(Math.min(parseInt(sp.get("limit") ?? "500"), 2000));

    sp.forEach((valor, clave) => {
      if (["limit", "orden", "asc"].includes(clave) || valor === "") return;
      q = q.eq(clave, valor === "true" ? true : valor === "false" ? false : valor);
    });

    const orden = sp.get("orden");
    if (orden) q = q.order(orden, { ascending: sp.get("asc") !== "false" });

    const { data, error } = await q;
    if (error) throw error;
    return NextResponse.json({ data });
  } catch (err) {
    return fail(err, "Error al leer la vista");
  }
}
