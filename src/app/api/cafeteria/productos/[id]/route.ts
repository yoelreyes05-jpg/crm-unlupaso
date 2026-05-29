import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

type Params = { params: { id: string } };

// GET /api/cafeteria/productos/:id
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("ul_productos")
      .select("*")
      .eq("id", params.id)
      .single();

    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });

    return NextResponse.json({ data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// PUT /api/cafeteria/productos/:id  — actualización completa
export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const supabase = createAdminClient();
    const body = await req.json();

    const {
      nombre, descripcion, precio, costo, categoria,
      stock, stock_minimo, imagen, activo, codigo, itbis,
    } = body;

    if (!nombre || precio == null || !categoria) {
      return NextResponse.json(
        { error: "Campos requeridos: nombre, precio, categoria" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("ul_productos")
      .update({
        nombre,
        descripcion: descripcion ?? null,
        precio: Number(precio),
        costo: Number(costo ?? 0),
        categoria,
        stock: Number(stock ?? 0),
        stock_minimo: Number(stock_minimo ?? 5),
        imagen: imagen ?? null,
        activo: activo ?? true,
        codigo: codigo ?? null,
        itbis: Number(itbis ?? 0),
      })
      .eq("id", params.id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error al actualizar producto";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// PATCH /api/cafeteria/productos/:id  — actualización parcial
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const supabase = createAdminClient();
    const body = await req.json();

    // Sanitizar: solo campos permitidos
    const allowed = [
      "nombre", "descripcion", "precio", "costo", "categoria",
      "stock", "stock_minimo", "imagen", "activo", "codigo", "itbis",
    ];
    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in body) updates[key] = body[key];
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No hay campos para actualizar" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("ul_productos")
      .update(updates)
      .eq("id", params.id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error al actualizar producto";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE /api/cafeteria/productos/:id  — archiva (activo = false)
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("ul_productos")
      .update({ activo: false })
      .eq("id", params.id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ data, message: "Producto archivado" });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error al archivar producto";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
