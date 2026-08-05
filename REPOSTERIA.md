# Módulo ERP Repostería dentro de UNLUPASO

Réplica completa del ERP de `erp-reposteria`, montado dentro de este proyecto igual que el POS de cafetería vive dentro del CRM automotriz.

Todo vive en el **mismo proyecto Supabase de UNLUPASO**, pero con prefijo `rep_`: ninguna tabla del módulo referencia una tabla `ul_`, así que los datos de la heladería y los de repostería nunca se mezclan.

## 1. Instalar la base de datos

Supabase → **SQL Editor** → pegar y ejecutar completo:

```
supabase/reposteria_schema.sql
```

Crea 31 tablas, 8 vistas, 7 enums, los triggers de negocio y datos de arranque (ingredientes, productos y equipos de ejemplo). El script es idempotente: se puede volver a ejecutar sin duplicar datos.

## 2. Variables de entorno

Las rutas de API usan la *service role key*. Verifica que `.env.local` tenga:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

> ⚠️ El `.env.local` actual tiene la variable escrita como `NEXT_PUBLIC_SUPABASE_ANON_SUPABASE_KEY` y **no** incluye `SUPABASE_SERVICE_ROLE_KEY`. Hay que corregirlo o ni el POS de cafetería ni el de repostería podrán escribir en la base de datos.

## 3. Entrar al módulo

```
npm run dev
```

- POS heladería (existente): `/pos`
- ERP Repostería: `/reposteria`

Sin login, tal como se pidió. Cuando quieras activarlo, basta con proteger el grupo `/reposteria` en un middleware.

## Tablas creadas

| Área | Tablas |
|---|---|
| Configuración | `rep_config` |
| Comercial | `rep_clientes`, `rep_proveedores` |
| Inventario | `rep_ingredientes`, `rep_compras_ingredientes`, `rep_movimientos_inventario` |
| Producción | `rep_productos`, `rep_recetas`, `rep_receta_ingredientes`, `rep_lotes`, `rep_lote_movimientos` |
| Alquiler | `rep_equipos`, `rep_equipos_log` |
| Eventos | `rep_eventos`, `rep_evento_items` |
| Ventas | `rep_cotizaciones`, `rep_cotizacion_items`, `rep_facturas`, `rep_factura_items`, `rep_pagos`, `rep_secuencias_ncf` |
| POS | `rep_ventas`, `rep_detalle_ventas`, `rep_cuadre` |
| Finanzas | `rep_cuentas_pagar`, `rep_cuentas_pagar_pagos`, `rep_caja_sesiones`, `rep_caja_movimientos`, `rep_caja_chica`, `rep_caja_chica_gastos`, `rep_caja_chica_reposiciones` |

Vistas: `rep_ingredientes_status`, `rep_lotes_alerta`, `rep_ventas_diarias`, `rep_cuadre_auto`, `rep_top_productos`, `rep_cxc_abiertas`, `rep_cxp_abiertas`, `rep_agenda_eventos`.

## Automatismos en la base de datos

- Numeración automática: eventos `EV-2026-0001`, cotizaciones `COT-00001`, facturas `FAC-00001`, ventas `REP-20260804-0001`.
- NCF automático desde `rep_secuencias_ncf` (B01/B02/B14/B15), independiente de las secuencias de `ul_`.
- Costo de recetas recalculado al agregar o quitar ingredientes.
- Totales de eventos, cotizaciones y facturas recalculados al cambiar sus líneas.
- Compras de ingredientes suben stock y quedan registradas para FEFO.
- Venta de un lote descuenta el lote; anular la venta lo devuelve.
- Pagos actualizan el balance y el estado de la factura o de la cuenta por pagar.
- Caja chica recalcula el saldo con cada gasto o reposición.
- Caja mantiene el efectivo esperado de la sesión abierta.

## Estructura del código

```
src/app/reposteria/            → pantallas del módulo
src/app/api/reposteria/        → 29 recursos REST (58 route handlers)
src/components/reposteria/     → sidebar, kit de UI, editor de líneas
src/lib/reposteria/            → helper CRUD y definición de cada recurso
src/types/reposteria.ts        → tipos de todas las tablas rep_
supabase/reposteria_schema.sql → migración completa
```

Para agregar un recurso nuevo: declararlo en `src/lib/reposteria/tablas.ts` y crear un `route.ts` de tres líneas que use `coleccion()` / `recurso()`.
