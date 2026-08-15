import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { fail, listar, pick } from "@/lib/tienda/crud";
import { LOTES_VISTA, PRODUCTOS } from "@/lib/tienda/tablas";

/** GET lee la vista de pacas con la recuperación ya calculada. */
export const GET = (req: NextRequest) => listar(req, LOTES_VISTA);

/**
 * POST crea una paca completa de un solo golpe:
 * el producto de tipo lote y la entrada de inventario con todas sus piezas.
 * Así no hay que registrar la ropa una por una.
 */
export async function POST(req: NextRequest) {
  try {
    const sb = createAdminClient();
    const body = await req.json();

    if (!body.nombre) {
      return NextResponse.json({ error: "Ponle un nombre a la paca" }, { status: 400 });
    }
    const piezas = Number(body.piezas_lote ?? 0);
    if (!(piezas > 0)) {
      return NextResponse.json(
        { error: "Indica cuántas piezas trae la paca" },
        { status: 400 }
      );
    }
    const costoLote = Number(body.costo_lote ?? 0);
    if (costoLote < 0) {
      return NextResponse.json({ error: "El costo de la paca no puede ser negativo" }, { status: 400 });
    }

    const datos = {
      ...pick(body, PRODUCTOS.fields, PRODUCTOS.conDefecto),
      tipo_inventario: "lote",
      costo_lote: costoLote,
      piezas_lote: piezas,
      unidad: body.unidad || "pieza",
      fecha_lote: body.fecha_lote || new Date().toISOString().slice(0, 10),
    };

    const { data: producto, error } = await sb
      .from("ti_productos")
      .insert(datos)
      .select()
      .single();
    if (error) throw error;

    // Cargar el inventario de golpe: una sola entrada por todas las piezas.
    const { error: em } = await sb.from("ti_movimientos_inventario").insert({
      producto_id: producto.id,
      fecha: datos.fecha_lote,
      tipo: "entrada",
      cantidad: piezas,
      // El costo por pieza lo prorratea la base de datos; no lo pisamos aquí.
      costo_unitario: 0,
      origen: "manual",
      referencia: producto.lote_codigo || producto.codigo,
      notas: `Entrada de la paca completa (${piezas} piezas por ${costoLote})`,
      usuario: body.usuario || null,
    });
    if (em) throw em;

    const { data: vista } = await sb
      .from("ti_v_lotes").select("*").eq("id", producto.id).single();

    return NextResponse.json({ data: vista ?? producto }, { status: 201 });
  } catch (err) {
    return fail(err, "No se pudo crear la paca");
  }
}
