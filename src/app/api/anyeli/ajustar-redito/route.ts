import { NextRequest, NextResponse } from "next/server";
import { fail } from "@/lib/anyeli/crud";
import { ajustarRedito, type DatosAjusteRedito } from "@/lib/anyeli/motor";

/**
 * Cambia el rédito de una cuota que todavía se debe, sin cancelar el préstamo
 * ni tocar el capital. Se puede pasar el monto en pesos o la tasa a aplicar.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as DatosAjusteRedito;

    if (!body.cuota_id) {
      return NextResponse.json({ error: "Se requiere la cuota" }, { status: 400 });
    }
    const sinMonto = body.interes_nuevo === undefined || body.interes_nuevo === null;
    const sinTasa  = body.tasa_nueva === undefined || body.tasa_nueva === null;
    if (sinMonto && sinTasa) {
      return NextResponse.json(
        { error: "Indica el rédito en pesos o la tasa que se va a aplicar" },
        { status: 400 }
      );
    }
    if (!sinMonto && Number(body.interes_nuevo) < 0) {
      return NextResponse.json({ error: "El rédito no puede ser negativo" }, { status: 400 });
    }

    const data = await ajustarRedito(body);
    return NextResponse.json({ data });
  } catch (err) {
    return fail(err, "No se pudo ajustar el rédito");
  }
}
