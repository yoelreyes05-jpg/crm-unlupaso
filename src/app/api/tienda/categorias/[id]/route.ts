import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { actualizar, eliminar, fail, obtener } from "@/lib/tienda/crud";
import { CATEGORIAS } from "@/lib/tienda/tablas";

type Ctx = { params: Promise<{ id: string }> };

export const GET   = async (_req: NextRequest, ctx: Ctx) => obtener((await ctx.params).id, CATEGORIAS);
export const PATCH = async (req: NextRequest, ctx: Ctx)  => actualizar(req, (await ctx.params).id, CATEGORIAS);
export const PUT   = PATCH;

/**
 * DELETE borra la categoría. Los productos que la tuvieran se quedan sin
 * categoría (la llave foránea es `on delete set null`), pero no se borra
 * ninguno. Con ?desactivar=1 solo se marca como inactiva.
 */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    if (req.nextUrl.searchParams.get("desactivar")) {
      return eliminar(id, CATEGORIAS, "activo");
    }

    const sb = createAdminClient();
    const { data: cat } = await sb.from("ti_categorias").select("nombre").eq("id", id).single();
    const { count } = await sb
      .from("ti_productos").select("id", { count: "exact", head: true }).eq("categoria_id", id);

    const { error } = await sb.from("ti_categorias").delete().eq("id", id);
    if (error) throw error;

    const sueltos = count ?? 0;
    return NextResponse.json({
      message: sueltos > 0
        ? `Categoría «${cat?.nombre ?? ""}» eliminada. ${sueltos} artículo(s) quedaron sin categoría.`
        : `Categoría «${cat?.nombre ?? ""}» eliminada.`,
    });
  } catch (err) {
    return fail(err, "No se pudo eliminar la categoría");
  }
}
