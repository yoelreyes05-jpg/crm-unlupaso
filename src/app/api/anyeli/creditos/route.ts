import { NextRequest, NextResponse } from "next/server";
import { listar, fail } from "@/lib/anyeli/crud";
import { PRESTAMOS_VISTA } from "@/lib/anyeli/tablas";
import { crearPrestamo, type DatosNuevoPrestamo } from "@/lib/anyeli/motor";

/**
 * GET  → lista desde la vista ia_v_prestamos (con saldos y estado calculado)
 * POST → crea el préstamo Y su cronograma completo de cuotas
 */

export const GET = (req: NextRequest) => listar(req, PRESTAMOS_VISTA);

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as DatosNuevoPrestamo;

    for (const campo of ["cliente_id", "capital", "tasa_interes", "num_cuotas", "fecha_primer_pago"] as const) {
      if (body[campo] === undefined || body[campo] === null || body[campo] === "") {
        return NextResponse.json({ error: `Campo requerido: ${campo}` }, { status: 400 });
      }
    }
    if (Number(body.capital) <= 0) {
      return NextResponse.json({ error: "El capital debe ser mayor que cero" }, { status: 400 });
    }
    if (
      body.inversionista_id &&
      (body.modo_reparto ?? "tasa") === "tasa" &&
      Number(body.tasa_inversionista ?? 0) > Number(body.tasa_interes)
    ) {
      return NextResponse.json(
        { error: "La tasa del inversionista no puede superar la que se le cobra al cliente" },
        { status: 400 }
      );
    }

    const data = await crearPrestamo(body);
    return NextResponse.json({ data }, { status: 201 });
  } catch (err) {
    return fail(err, "Error al crear el préstamo");
  }
}
