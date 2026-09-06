import { NextRequest, NextResponse } from "next/server";
import { actualizar, eliminar, fail, obtener } from "@/lib/anyeli/crud";
import { eliminarCliente } from "@/lib/anyeli/motor";
import { CLIENTES } from "@/lib/anyeli/tablas";

type Ctx = { params: Promise<{ id: string }> };

export const GET   = async (_req: NextRequest, ctx: Ctx) => obtener((await ctx.params).id, CLIENTES);
export const PATCH = async (req: NextRequest, ctx: Ctx)  => actualizar(req, (await ctx.params).id, CLIENTES);
export const PUT   = PATCH;

/**
 * DELETE desactiva al cliente: deja de salir en los listados pero conserva
 * todo su historial.
 *
 * Con ?definitivo=1 se borra de verdad, junto con sus préstamos, cuotas,
 * pagos, recibos y distribuciones. No se permite si todavía tiene préstamos
 * activos. Si tiene historial ya cobrado, hay que confirmar con &forzar=1.
 */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const sp = req.nextUrl.searchParams;
    const definitivo = sp.get("definitivo");

    if (definitivo !== "1" && definitivo !== "true") {
      return eliminar(id, CLIENTES, "activo");
    }

    const data = await eliminarCliente({
      id,
      forzar: sp.get("forzar") === "1" || sp.get("forzar") === "true",
    });
    return NextResponse.json({
      data,
      message:
        `${data.nombre} se eliminó del sistema` +
        (data.prestamos_borrados > 0 ? ` junto con ${data.prestamos_borrados} préstamo(s).` : "."),
    });
  } catch (err) {
    return fail(err, "No se pudo eliminar el cliente", 409);
  }
}
