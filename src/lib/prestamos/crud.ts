import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * Helper CRUD para las tablas pr_* del módulo de Préstamos.
 * Mismo patrón que el ERP de repostería: las rutas usan la service role key,
 * así que RLS no aplica y ningún módulo puede tocar las tablas del otro.
 */

export interface CrudOptions {
  /** Nombre exacto de la tabla, siempre con prefijo pr_ */
  table: string;
  /** Campos aceptados en POST/PATCH (whitelist) */
  fields: string[];
  /** Campos obligatorios al crear */
  required?: string[];
  /** Columnas donde se busca con ?search= */
  searchFields?: string[];
  /** Columnas filtrables por igualdad con query params */
  filters?: string[];
  /** Ordenamiento por defecto */
  orderBy?: string;
  ascending?: boolean;
  /** select() personalizado */
  select?: string;
}

const PREFIJO = "pr_";

function assertTabla(table: string) {
  if (!table.startsWith(PREFIJO)) {
    throw new Error(`Tabla no permitida: ${table}. El módulo de préstamos solo usa tablas ${PREFIJO}*`);
  }
}

export function pick(body: Record<string, unknown>, fields: string[]) {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    if (body[f] !== undefined) out[f] = body[f] === "" ? null : body[f];
  }
  return out;
}

export function fail(err: unknown, fallback: string, status = 500) {
  const msg = err instanceof Error ? err.message : fallback;
  return NextResponse.json({ error: msg }, { status });
}

// ─── LISTAR ───────────────────────────────────────────────────────────────────
export async function listar(req: NextRequest, o: CrudOptions) {
  try {
    assertTabla(o.table);
    const supabase = createAdminClient();
    const sp = req.nextUrl.searchParams;

    const page   = Math.max(parseInt(sp.get("page")  ?? "1"), 1);
    const limit  = Math.min(parseInt(sp.get("limit") ?? "300"), 2000);
    const offset = (page - 1) * limit;

    let q = supabase
      .from(o.table)
      .select(o.select ?? "*", { count: "exact" })
      .order(o.orderBy ?? "created_at", { ascending: o.ascending ?? false })
      .range(offset, offset + limit - 1);

    for (const f of o.filters ?? []) {
      const v = sp.get(f);
      if (v !== null && v !== "") {
        if (v === "true" || v === "false") q = q.eq(f, v === "true");
        else if (v === "null") q = q.is(f, null);
        else q = q.eq(f, v);
      }
    }

    const desde = sp.get("desde");
    const hasta = sp.get("hasta");
    const campoFecha = sp.get("campo_fecha") ?? "created_at";
    if (desde) q = q.gte(campoFecha, desde);
    if (hasta) q = q.lte(campoFecha, hasta);

    const search = sp.get("search");
    if (search && (o.searchFields ?? []).length > 0) {
      q = q.or((o.searchFields ?? []).map((f) => `${f}.ilike.%${search}%`).join(","));
    }

    const { data, error, count } = await q;
    if (error) throw error;

    return NextResponse.json({ data, count, page, limit });
  } catch (err) {
    return fail(err, `Error al listar ${o.table}`);
  }
}

// ─── CREAR ────────────────────────────────────────────────────────────────────
export async function crear(req: NextRequest, o: CrudOptions) {
  try {
    assertTabla(o.table);
    const supabase = createAdminClient();
    const body = await req.json();

    for (const r of o.required ?? []) {
      if (body[r] === undefined || body[r] === null || body[r] === "") {
        return NextResponse.json({ error: `Campo requerido: ${r}` }, { status: 400 });
      }
    }

    const { data, error } = await supabase
      .from(o.table)
      .insert(pick(body, o.fields))
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ data }, { status: 201 });
  } catch (err) {
    return fail(err, `Error al crear en ${o.table}`);
  }
}

// ─── OBTENER UNO ──────────────────────────────────────────────────────────────
export async function obtener(id: string, o: CrudOptions) {
  try {
    assertTabla(o.table);
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from(o.table)
      .select(o.select ?? "*")
      .eq("id", id)
      .single();

    if (error) throw error;
    return NextResponse.json({ data });
  } catch (err) {
    return fail(err, "Registro no encontrado", 404);
  }
}

// ─── ACTUALIZAR ───────────────────────────────────────────────────────────────
export async function actualizar(req: NextRequest, id: string, o: CrudOptions) {
  try {
    assertTabla(o.table);
    const supabase = createAdminClient();
    const body = await req.json();
    const cambios = pick(body, o.fields);

    if (Object.keys(cambios).length === 0) {
      return NextResponse.json({ error: "No hay campos válidos para actualizar" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from(o.table)
      .update(cambios)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ data });
  } catch (err) {
    return fail(err, `Error al actualizar ${o.table}`);
  }
}

// ─── ELIMINAR ─────────────────────────────────────────────────────────────────
export async function eliminar(id: string, o: CrudOptions, softField?: string) {
  try {
    assertTabla(o.table);
    const supabase = createAdminClient();

    if (softField) {
      const { error } = await supabase.from(o.table).update({ [softField]: false }).eq("id", id);
      if (error) throw error;
      return NextResponse.json({ message: "Registro desactivado" });
    }

    const { error } = await supabase.from(o.table).delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ message: "Registro eliminado" });
  } catch (err) {
    return fail(err, `Error al eliminar en ${o.table}`);
  }
}

/** Atajo: handlers GET/POST de una colección. */
export function coleccion(o: CrudOptions) {
  return {
    GET:  (req: NextRequest) => listar(req, o),
    POST: (req: NextRequest) => crear(req, o),
  };
}

/** Atajo: handlers GET/PATCH/PUT/DELETE de un recurso individual. */
export function recurso(o: CrudOptions, softField?: string) {
  type Ctx = { params: Promise<{ id: string }> };
  return {
    GET:    async (_req: NextRequest, ctx: Ctx) => obtener((await ctx.params).id, o),
    PATCH:  async (req: NextRequest, ctx: Ctx)  => actualizar(req, (await ctx.params).id, o),
    PUT:    async (req: NextRequest, ctx: Ctx)  => actualizar(req, (await ctx.params).id, o),
    DELETE: async (_req: NextRequest, ctx: Ctx) => eliminar((await ctx.params).id, o, softField),
  };
}
