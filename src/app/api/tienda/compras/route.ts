import { NextRequest, NextResponse } from "next/server";
import { listar, fail } from "@/lib/tienda/crud";
import { COMPRAS_VISTA } from "@/lib/tienda/tablas";
import { crearCompra, type DatosCompra } from "@/lib/tienda/motor";

/**
 * GET  → compras con su saldo y estado
 * POST → registra la compra, sube el inventario y, si es de contado, la paga
 */
export const GET = (req: NextRequest) => listar(req, COMPRAS_VISTA);

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as DatosCompra;
    if (!body.items?.length) {
      return NextResponse.json({ error: "Agrega al menos un producto" }, { status: 400 });
    }
    const data = await crearCompra(body);
    return NextResponse.json({ data }, { status: 201 });
  } catch (err) {
    return fail(err, "Error al registrar la compra");
  }
}
