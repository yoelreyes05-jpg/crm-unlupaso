import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

// GET /api/cafeteria/productos
// Query params: categoria, activo, search, page, limit
export async function GET(req: NextRequest) {
  try {
    const supabase = createAdminClient();
    const { searchParams } = req.nextUrl;

    const categoria = searchParams.get("categoria");
    const activo    = searchParams.get("activo");
    const search    = searchParams.get("search");
    const page      = parseInt(searchParams.get("page")  ?? "1");
    const limit     = parseInt(searchParams.get("limit") ?? "100");
    const offset    = (page - 1) * limit;

    let query = supabase
      .from("ul_productos")
      .select("*", { count: "exact" })
      .order("categoria", { ascending: true })
      .order("nombre",    { ascending: true })
      .range(offset, offset + limit - 1);

    if (categoria) query = query.eq("categoria", categoria);
    if (activo !== null && activo !== "") query = query.eq("activo", activo === "true");
    if (search)    query = query.ilike("nombre", `%${search}%`);

    const { data, error, count } = await query;

    if (error) throw error;

    return NextResponse.json({ data, count, page, limit });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error al obtener productos";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST /api/cafeteria/productos
export async function POST(req: NextRequest) {
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
      .insert({
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
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ data }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error al crear producto";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
