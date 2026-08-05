# Variables de entorno en Railway

El error **`supabaseUrl is required`** aparece porque Railway no tiene las variables de Supabase: el archivo `.env.local` vive solo en tu computadora, no se sube al deploy.

## Qué pegar en Railway

Railway → tu servicio `crm-unlupaso` → pestaña **Variables** → *Raw Editor* → pegar esto tal cual:

```
NEXT_PUBLIC_SUPABASE_URL=https://axzdtgcouczgdxjopikn.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_5l7HQ20jqodbowaI9RAJ4A_7Vqnu7tA
SUPABASE_SERVICE_ROLE_KEY=PEGA_AQUI_TU_SECRET_KEY
NEXT_PUBLIC_API_URL=https://crm-unlupaso-production.up.railway.app/api
NEXT_PUBLIC_APP_URL=https://crm-unlupaso-production.up.railway.app
NEXT_PUBLIC_APP_NAME=UNLUPASO
NEXT_PUBLIC_CROW_NOMBRE=CROW EVENTS
NEXT_PUBLIC_CROW_SLOGAN=Endulzando tu paladar
NEXT_PUBLIC_CROW_TELEFONO=829-404-1644
NEXT_PUBLIC_CROW_RNC=
NEXT_PUBLIC_CROW_DIRECCION=
NEXT_PUBLIC_CROW_LOGO=/crow-events-logo.png
```

Después de guardar, Railway redespliega solo.

## La única que falta llenar

`SUPABASE_SERVICE_ROLE_KEY` — no la tengo, hay que sacarla de Supabase:

1. Entra a tu proyecto en supabase.com
2. **Project Settings → API Keys**
3. En **Secret keys**, revela y copia la que empieza con `sb_secret_...`
4. Pégala en Railway y en tu `.env.local`

Sin esa clave, todas las rutas `/api/...` fallan: son las que escriben en la base de datos saltándose RLS.

## Por qué fallaba antes

El `.env.local` que tenías decía `NEXT_PUBLIC_SUPABASE_ANON_SUPABASE_KEY` — con `SUPABASE` repetido. El código busca `NEXT_PUBLIC_SUPABASE_ANON_KEY`, así que leía `undefined`. Ya quedó corregido en el archivo.

## Importante

- Las variables `NEXT_PUBLIC_*` se incrustan en el bundle **en tiempo de build**. Si las cambias en Railway, hay que redesplegar (Railway lo hace solo al guardar variables).
- `SUPABASE_SERVICE_ROLE_KEY` **no** lleva el prefijo `NEXT_PUBLIC_`. Si se lo pones, la clave secreta queda expuesta en el navegador.
- El archivo `.env.local` no debe subirse a Git. Verifica que `.gitignore` incluya `.env*.local`.
