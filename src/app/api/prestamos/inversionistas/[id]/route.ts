import { NextRequest, NextResponse } from "next/server";
import { actualizar, eliminar, fail, obtener } from "@/lib/prestamos/crud";
import { eliminarInversionista } from "@/lib/prestamos/motor";
import { INVERSIONISTAS } from "@/lib/prestamos/tablas";

type Ctx = { params: Promise<{ id: string }> };

export const GET   = async (_req: NextRequest, ctx: Ctx) => obtener((await ctx.params).id, INVERSIONISTAS);
export const PATCH = async (req: NextRequest, ctx: Ctx)  => actualizar(req, (await ctx.params).id, INVERSIONISTAS);
export const PUT   = PATCH;

/**
 * DELETE desactiva al inversionista: deja de aparecer para nuevos préstamos
 * pero se conserva su historial completo.
 *
 * Con ?definitivo=1 se borra de verdad. No se permite si todavía tiene
 * préstamos activos: ese capital está en la calle. Si solo tiene préstamos
 * terminados, hay que confirmar con &forzar=1.
 */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const sp = req.nextUrl.searchParams;
    const definitivo = sp.get("definitivo");

    if (definitivo !== "1" && definitivo !== "true") {
      return eliminar(id, INVERSIONISTAS, "activo");
    }

    const data = await eliminarInversionista({
      id,
      forzar: sp.get("forzar") === "1" || sp.get("forzar") === "true",
      usuario: sp.get("usuario") ?? undefined,
    });
    return NextResponse.json({ data, message: `${data.nombre} se eliminó del sistema.` });
  } catch (err) {
    return fail(err, "No se pudo eliminar el inversionista", 409);
  }
}
