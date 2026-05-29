import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

// POST /api/cafeteria/venta
// Body: { total, subtotal, itbis_total, descuento, metodo_pago, ncf_tipo, cliente_nombre, cliente_rnc, notas, cajero, items }
// items: Array<{ producto_id, nombre_producto, categoria, qty, precio_unitario, costo_unitario, itbis, descuento, subtotal }>
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
      cliente_nombre = null,
      cliente_rnc    = null,
      notas          = null,
      cajero         = null,
      items          = [],
    } = body;

    if (!total || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "Se requieren: total e items[]" },
        { status: 400 }
      );
    }

    // 1. Insertar venta (triggers generan numero + NCF automáticamente)
    const { data: venta, error: ventaError } = await supabase
      .from("ul_ventas")
      .insert({
        total:          Number(total),
        subtotal:       Number(subtotal),
        itbis_total:    Number(itbis_total),
        descuento:      Number(descuento),
        metodo_pago,
        ncf_tipo,
        cliente_nombre,
        cliente_rnc,
        notas,
        cajero,
      })
      .select()
      .single();

    if (ventaError) throw ventaError;

    // 2. Insertar detalles (trigger descuenta inventario por cada fila)
    const detalles = items.map((item: {
      producto_id?:    string;
      nombre_producto: string;
      categoria?:      string;
      qty:             number;
      precio_unitario: number;
      costo_unitario?: number;
      itbis?:          number;
      descuento?:      number;
      subtotal:        number;
    }) => ({
      venta_id:        venta.id,
      producto_id:     item.producto_id ?? null,
      nombre_producto: item.nombre_producto,
      categoria:       item.categoria ?? null,
      qty:             Number(item.qty),
      precio_unitario: Number(item.precio_unitario),
      costo_unitario:  Number(item.costo_unitario ?? 0),
      itbis:           Number(item.itbis ?? 0),
      descuento:       Number(item.descuento ?? 0),
      subtotal:        Number(item.subtotal),
    }));

    const { error: detalleError } = await supabase
      .from("ul_detalle_ventas")
      .insert(detalles);

    if (detalleError) throw detalleError;

    // 3. Retornar venta con detalles
    const { data: ventaCompleta, error: fetchError } = await supabase
      .from("ul_ventas")
      .select("*, ul_detalle_ventas(*)")
      .eq("id", venta.id)
      .single();

    if (fetchError) throw fetchError;

    return NextResponse.json({ data: ventaCompleta }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error al procesar venta";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
