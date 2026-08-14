import { NextRequest, NextResponse } from "next/server";
import { listar, fail } from "@/lib/tienda/crud";
import { VENTAS_VISTA } from "@/lib/tienda/tablas";
import { crearVenta, type DatosVenta } from "@/lib/tienda/motor";

/**
 * GET  → facturas con su saldo y estado ya calculados
 * POST → crea la factura, descarga inventario y, si es de contado, la cobra
 */
export const GET = (req: NextRequest) => listar(req, VENTAS_VISTA);

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as DatosVenta;
    if (!body.items?.length) {
      return NextResponse.json({ error: "Agrega al menos un producto" }, { status: 400 });
    }
    if (body.condicion === "credito" && !body.cliente_id) {
      return NextResponse.json(
        { error: "Una venta a crédito necesita un cliente registrado" },
        { status: 400 }
      );
    }
    const data = await crearVenta(body);
    return NextResponse.json({ data }, { status: 201 });
  } catch (err) {
    return fail(err, "Error al registrar la venta");
  }
}
