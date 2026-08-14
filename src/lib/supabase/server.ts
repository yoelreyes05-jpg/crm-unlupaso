import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";

/**
 * Cliente Supabase para uso en Server Components / Server Actions.
 * Usa la anon key con cookies para sesión del usuario.
 */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll:    () => cookieStore.getAll(),
        setAll: (cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );
}

/**
 * Cliente admin con service role para API Routes.
 * Usa createClient directo de @supabase/supabase-js (sin cookies, sin RLS).
 * Typed with `any` internamente para evitar conflictos de inferencia con el
 * Database type manual — en runtime funciona perfectamente.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createAdminClient(): any {
  const url   = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Mensaje explícito en vez del críptico "supabaseUrl is required"
  const faltan: string[] = [];
  if (!url)   faltan.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!clave) faltan.push("SUPABASE_SERVICE_ROLE_KEY");

  if (faltan.length > 0) {
    throw new Error(
      `Faltan variables de entorno en el servidor: ${faltan.join(", ")}. ` +
      `Agrégalas en el panel de tu hosting (Vercel → Settings → Environment Variables, ` +
      `o Railway → Variables) y vuelve a desplegar. Revisa /api/reposteria/salud para ver el estado.`
    );
  }

  return createSupabaseClient<Database>(url!, clave!);
}
