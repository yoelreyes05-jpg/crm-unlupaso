# Deploy — UNLUPASO + CROW EVENTS

Tu app está publicada en **Vercel** (`crm-unlupaso.vercel.app`). El error `supabaseUrl is required` sale porque **Vercel no tiene las variables de entorno**: el archivo `.env.local` está en `.gitignore` y nunca llega al servidor. Poner las variables en Railway no sirve si el sitio que usas es el de Vercel.

---

## Paso 1 · Ejecutar el schema en Supabase

Supabase → **SQL Editor** → New query → pegar completo y **Run**:

```
supabase/reposteria_schema.sql
```

Se puede volver a ejecutar sin duplicar nada. Al terminar debes ver las tablas `rep_*` en Table Editor.

---

## Paso 2 · Variables de entorno en Vercel

Vercel → proyecto `crm-unlupaso` → **Settings → Environment Variables**.

Marca los tres entornos: **Production**, **Preview** y **Development**.

| Nombre | Valor |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://axzdtgcouczgdxjopikn.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | tu clave publicable (`sb_publishable_…`) |
| `SUPABASE_SERVICE_ROLE_KEY` | tu clave secreta (`sb_secret_…` o el JWT `service_role`) |
| `NEXT_PUBLIC_API_URL` | `/api` |
| `NEXT_PUBLIC_APP_NAME` | `UNLUPASO` |
| `NEXT_PUBLIC_CROW_NOMBRE` | `CROW EVENTS` |
| `NEXT_PUBLIC_CROW_SLOGAN` | `Endulzando tu paladar` |
| `NEXT_PUBLIC_CROW_TELEFONO` | `829-404-1644` |
| `NEXT_PUBLIC_CROW_LOGO` | `/crow-events-logo.png` |

Los valores exactos están en tu `.env.local`. Cópialos de ahí, no los escribas a mano.

### Tres errores que hacen fallar esto

1. **`SUPABASE_SERVICE_ROLE_KEY` con prefijo `NEXT_PUBLIC_`.** No lo lleva. Si se lo pones, la clave secreta queda visible en el navegador y cualquiera puede borrar tu base de datos.
2. **Guardar las variables y no redesplegar.** Las `NEXT_PUBLIC_*` se incrustan en el código durante el build. Guardar la variable no reconstruye nada.
3. **Ponerlas solo en Production.** Si las previews también se usan, van en los tres entornos.

---

## Paso 3 · Redesplegar

Vercel → pestaña **Deployments** → último deploy → menú `···` → **Redeploy** → **desmarcar "Use existing build cache"** → Redeploy.

Sin desmarcar el caché, Vercel reutiliza el build viejo que ya tenía las variables vacías.

---

## Paso 4 · Verificar

Abre en el navegador:

```
https://crm-unlupaso.vercel.app/api/reposteria/salud
```

**Todo bien:**

```json
{ "ok": true, "mensaje": "Conexión correcta con Supabase", "registros": 0 }
```

**Faltan variables:** te dice exactamente cuáles.

```json
{ "ok": false, "faltantes": ["SUPABASE_SERVICE_ROLE_KEY"] }
```

**Variables puestas pero Supabase rechaza:** normalmente es que falta correr el schema, o que la clave es de otro proyecto de Supabase.

Cuando `salud` responda `ok: true`, guarda un cliente en `/reposteria/clientes` y ya debe funcionar.

---

## Si prefieres Railway en vez de Vercel

Mismas variables, distinta pantalla: Railway → servicio → **Variables** → *Raw Editor* → pegar el bloque completo → Deploy. Railway redespliega solo al guardar.

Elige **uno de los dos** como sitio oficial. Tener los dos apuntando a la misma base de datos funciona, pero confunde a la hora de depurar.

---

## Checklist rápido

- [ ] `reposteria_schema.sql` ejecutado en Supabase
- [ ] Las 9 variables en Vercel, en los 3 entornos
- [ ] `SUPABASE_SERVICE_ROLE_KEY` **sin** `NEXT_PUBLIC_`
- [ ] Redeploy sin caché
- [ ] `/api/reposteria/salud` devuelve `ok: true`
- [ ] Guardar un cliente de prueba en `/reposteria/clientes`

---

## Seguridad

La clave `service_role` da acceso total a la base de datos saltándose RLS. Si en algún momento quedó pegada en un chat, un correo o un commit, rótala: Supabase → Project Settings → API Keys → *Rotate*, y actualiza el valor en Vercel y en `.env.local`.

Confirma también que `.gitignore` incluye `.env.local` (ya lo tiene).
