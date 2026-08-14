import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { fail } from "@/lib/prestamos/crud";

/** Agenda de cobros: lo atrasado, lo que vence hoy y lo que viene. */
export async function GET(req: Request) {
  try {
    const sp = new URL(req.url).searchParams;
    const dias = Math.min(parseInt(sp.get("dias") ?? "15"), 120);

    const hoy = new Date();
    const hasta = new Date(hoy.getTime() + dias * 86400000).toISOString().slice(0, 10);

    const sb = createAdminClient();
    const { data, error } = await sb
      .from("pr_v_cobranza")
      .select("*")
      .lte("fecha_vencimiento", hasta)
      .order("fecha_vencimiento");

    if (error) throw error;

    const filas = data ?? [];
    return NextResponse.json({
      data: {
        atrasadas: filas.filter((c: Record<string, unknown>) => c.estado_visual === "atrasada"),
        hoy:       filas.filter((c: Record<string, unknown>) => c.estado_visual === "vence_hoy"),
        proximas:  filas.filter((c: Record<string, unknown>) =>
                     c.estado_visual !== "atrasada" && c.estado_visual !== "vence_hoy"),
      },
    });
  } catch (err) {
    return fail(err, "Error al cargar la cobranza");
  }
}
