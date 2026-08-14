import { NextRequest, NextResponse } from "next/server";
import { fail } from "@/lib/prestamos/crud";
import { aplicarReenganche, type DatosReenganche } from "@/lib/prestamos/motor";

/**
 * Reenganche: al saldo de capital pendiente se le suma el dinero adicional
 * y sobre ese nuevo capital se vuelve a aplicar el porcentaje pactado.
 * El cronograma anterior se cierra conservando todo lo ya pagado.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as DatosReenganche;

    if (!body.prestamo_id) {
      return NextResponse.json({ error: "Campo requerido: prestamo_id" }, { status: 400 });
    }
    if (!body.monto_adicional || Number(body.monto_adicional) <= 0) {
      return NextResponse.json({ error: "El monto adicional debe ser mayor que cero" }, { status: 400 });
    }
    if (!body.num_cuotas || Number(body.num_cuotas) < 1) {
      return NextResponse.json({ error: "Indica la cantidad de pagos del nuevo cronograma" }, { status: 400 });
    }
    if (!body.fecha) body.fecha = new Date().toISOString().slice(0, 10);

    const data = await aplicarReenganche(body);
    return NextResponse.json({ data }, { status: 201 });
  } catch (err) {
    return fail(err, "Error al aplicar el reenganche");
  }
}
