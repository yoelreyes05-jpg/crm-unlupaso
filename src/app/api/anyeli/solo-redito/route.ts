import { NextRequest, NextResponse } from "next/server";
import { fail } from "@/lib/anyeli/crud";
import { registrarSoloRedito, type DatosSoloRedito } from "@/lib/anyeli/motor";

/**
 * El cliente paga únicamente el rédito del período.
 * El capital de esa cuota se traslada al final del cronograma y vuelve
 * a generar interés; la fecha de finalización se corre un período.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as DatosSoloRedito;

    if (!body.prestamo_id || !body.cuota_id) {
      return NextResponse.json({ error: "Se requiere prestamo_id y cuota_id" }, { status: 400 });
    }
    if (!body.monto || Number(body.monto) <= 0) {
      return NextResponse.json({ error: "El monto debe ser mayor que cero" }, { status: 400 });
    }
    if (!body.fecha) body.fecha = new Date().toISOString().slice(0, 10);

    const data = await registrarSoloRedito(body);
    return NextResponse.json({ data }, { status: 201 });
  } catch (err) {
    return fail(err, "Error al registrar el rédito");
  }
}
