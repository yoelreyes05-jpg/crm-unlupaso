import { NextRequest, NextResponse } from "next/server";
import { listar, fail } from "@/lib/anyeli/crud";
import { PAGOS } from "@/lib/anyeli/tablas";
import { registrarPago, type DatosPago } from "@/lib/anyeli/motor";

/**
 * GET  → historial de pagos
 * POST → registra un cobro, lo imputa (mora → interés → capital) y genera
 *        la distribución contable inversionista / administrador.
 */

export const GET = (req: NextRequest) => listar(req, PAGOS);

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as DatosPago;

    if (!body.prestamo_id) {
      return NextResponse.json({ error: "Campo requerido: prestamo_id" }, { status: 400 });
    }
    if (!body.monto || Number(body.monto) <= 0) {
      return NextResponse.json({ error: "El monto debe ser mayor que cero" }, { status: 400 });
    }
    if (!body.fecha) body.fecha = new Date().toISOString().slice(0, 10);

    const data = await registrarPago(body);
    return NextResponse.json({ data }, { status: 201 });
  } catch (err) {
    return fail(err, "Error al registrar el pago");
  }
}
