import { NextRequest, NextResponse } from "next/server";
import { fail } from "@/lib/prestamos/crud";
import { anularPago } from "@/lib/prestamos/motor";

/** Anula un pago y revierte su efecto en las cuotas y en la contabilidad. */
export async function POST(req: NextRequest) {
  try {
    const { pago_id } = await req.json();
    if (!pago_id) {
      return NextResponse.json({ error: "Campo requerido: pago_id" }, { status: 400 });
    }
    const data = await anularPago(pago_id);
    return NextResponse.json({ data });
  } catch (err) {
    return fail(err, "Error al anular el pago");
  }
}
