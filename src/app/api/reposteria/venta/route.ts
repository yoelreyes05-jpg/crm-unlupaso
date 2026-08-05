import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * POST /api/reposteria/venta — registra una venta del POS de repostería.
 * Los triggers de la BD generan número + NCF y descuentan los lotes.
 * Si hay una sesión de caja abierta, el cobro se registra en ella.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = createAdminClient();
    const body = await req.json();

    const {
      total,
      subtotal       = 0,
      itbis_total    = 0,
      descuento      = 0,
      metodo_pago    = "EFECTIVO",
      ncf_tipo       = "B02",
      cliente_id     = null,
      cliente_nombre = null,
      cliente_rnc    = null,
      cajero         = null,
      notas          = null,
      items          = [],
    } = body;

    if (!total || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Se requieren: total e items[]" }, { status: 400 });
    }

    // Sesión de caja abierta (opcional)
    const { data: sesion } = await supabase
      .from("rep_caja_sesiones")
      .select("id")
      .eq("estado", "abierta")
      .order("fecha_apertura", { ascending: false })
      .limit(1)
      .maybeSingle();

    // 1. Cabecera de la venta
    const { data: venta, error: ventaError } = await supabase
      .from("rep_ventas")
      .insert({
        total:       Number(total),
        subtotal:    Number(subtotal),
        itbis_total: Number(itbis_total),
        descuento:   Number(descuento),
        metodo_pago,
        ncf_tipo,
        cliente_id,
        cliente_nombre,
        cliente_rnc,
        cajero,
        notas,
        caja_sesion_id: sesion?.id ?? null,
      })
      .select()
      .single();

    if (ventaError) throw ventaError;

    // 2. Detalle (los triggers descuentan el lote asociado)
    const detalles = items.map((i: Record<string, unknown>) => ({
      venta_id:        venta.id,
      producto_id:     (i.producto_id as string) ?? null,
      lote_id:         (i.lote_id as string) ?? null,
      nombre_producto: String(i.nombre_producto),
      categoria:       (i.categoria as string) ?? null,
      qty:             Number(i.qty),
      precio_unitario: Number(i.precio_unitario),
      costo_unitario:  Number(i.costo_unitario ?? 0),
      itbis:           Number(i.itbis ?? 0),
      descuento:       Number(i.descuento ?? 0),
      subtotal:        Number(i.subtotal),
    }));

    const { error: detalleError } = await supabase.from("rep_detalle_ventas").insert(detalles);
    if (detalleError) throw detalleError;

    // 3. Movimiento de caja
    if (sesion?.id) {
      await supabase.from("rep_caja_movimientos").insert({
        sesion_id:   sesion.id,
        tipo:        "ingreso",
        descripcion: `Venta POS ${venta.numero ?? ""}`.trim(),
        monto:       Number(total),
        metodo:      metodo_pago,
        venta_id:    venta.id,
        usuario:     cajero,
      });
    }

    const { data: completa } = await supabase
      .from("rep_ventas")
      .select("*, rep_detalle_ventas(*)")
      .eq("id", venta.id)
      .single();

    return NextResponse.json({ data: completa ?? venta }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error al procesar la venta";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
