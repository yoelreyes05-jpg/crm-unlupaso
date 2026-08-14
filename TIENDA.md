# MAXMATT SHOP — módulo de tienda dentro de UNLUPASO

Cuarto módulo del proyecto. Ventas, inventario, contabilidad y caja, con sus propios clientes.

**Cada módulo entra por su enlace y no ve a los otros:**

| Módulo | Enlace | Tablas |
|---|---|---|
| POS heladería | `/pos` | `ul_` |
| CROW EVENTS | `/reposteria` | `rep_` |
| Préstamos (CGSSOLUTIONS) | `/prestamos` | `pr_` |
| **MAXMATT SHOP** | **`/tienda`** | **`ti_`** |

Ninguna tabla `ti_` referencia una tabla `ul_`, `rep_` ni `pr_`. Los clientes de la tienda son suyos y no se mezclan con los del sistema de préstamos, aunque sea la misma persona.

Paleta índigo/violeta, distinta a propósito del verde de préstamos y del crema de Crow Events.

---

## 1. Instalar la base de datos

Supabase → **SQL Editor** → pegar y ejecutar completo:

```
supabase/tienda_schema.sql
```

Crea 14 tablas, 10 vistas y los triggers de negocio. Es idempotente. Después verifica en el navegador:

```
/api/tienda/salud
```

## 2. Variables de entorno

Las mismas que ya usa el proyecto. **No hace falta agregar ninguna.**

## 3. Entrar

```
/tienda
```

Sin login, igual que los otros módulos.

---

## Cómo funciona

### Inventario

Cada producto tiene costo, precio de venta y ITBIS propio. El **precio se guarda SIN ITBIS** y el impuesto se suma encima: un producto de RD$ 2,000 con 18 % factura RD$ 2,360. Si es exento, se pone ITBIS en 0.

Toda entrada y salida queda en el **kardex** con el stock antes y después, así que siempre se puede reconstruir por qué hay lo que hay. Desde el botón *Movimientos* de cada producto se registran entradas, salidas, devoluciones, mermas y ajustes por conteo.

El sistema avisa cuando un producto baja del mínimo y no deja facturar más de lo que hay.

### Ventas

Se busca el producto por nombre o código, se arma la factura y se elige contado o crédito.

- **Contado** — se cobra completa al registrarla y el dinero entra a la caja abierta.
- **Crédito** — queda como cuenta por cobrar con su fecha de vencimiento. Los abonos se registran desde la factura y cada uno entra a caja.

En ambos casos el inventario se descuenta solo. La factura se imprime desde su propia pantalla.

Anular una factura devuelve la mercancía al inventario y revierte los cobros en caja. No se borra: queda marcada como anulada.

### Compras

Al registrar una compra, cada producto **entra al inventario y su costo se actualiza** con el de esa compra. Si es a crédito queda como cuenta por pagar; si es de contado, el pago sale de la caja.

### Contabilidad

Cuatro pestañas:

- **Resumen** — estado de resultados del período que elijas:
  ```
  Facturado (con ITBIS)
  − ITBIS cobrado (es de la DGII, no tuyo)
  = Ingresos
  − Costo de la mercancía vendida
  = Ganancia bruta
  − Gastos
  = Ganancia neta
  ```
  Más la misma tabla desglosada mes por mes.
- **Cuentas por cobrar** — quién debe, cuánto y hace cuántos días. Lo vencido en rojo.
- **Cuentas por pagar** — lo mismo con los proveedores.
- **Gastos** — alquiler, servicios, nómina, transporte… Cada gasto sale de la caja abierta.

### Caja y cuadre

Se abre con el efectivo del cajón. Desde ahí, **cada venta de contado, cobro, pago a proveedor y gasto entra o sale solo**. Al cerrar, el sistema dice cuánto debería haber, tú escribes cuánto contaste y te muestra si sobró, faltó o cuadró exacto. Los cuadres quedan guardados con su diferencia.

Solo lo cobrado en efectivo afecta el cajón; transferencias y tarjetas se llevan aparte.

### Clientes

Ficha con cédula/RNC, contacto y **crédito**: si se le permite, cuánto es el límite y a cuántos días. La lista muestra cuánto ha comprado, cuánto debe y cuánto crédito le queda. Los que tienen deuda vencida salen en rojo.

---

## Tablas creadas

| Área | Tablas |
|---|---|
| Configuración | `ti_config` |
| Comercial | `ti_clientes`, `ti_proveedores` |
| Inventario | `ti_productos`, `ti_movimientos_inventario` |
| Compras | `ti_compras`, `ti_compra_items` |
| Ventas | `ti_ventas`, `ti_venta_items` |
| Cobros y pagos | `ti_cobros`, `ti_pagos_proveedor` |
| Caja | `ti_caja_sesiones`, `ti_caja_movimientos` |
| Gastos | `ti_gastos` |

Vistas: `ti_v_productos`, `ti_v_ventas`, `ti_v_cuentas_cobrar`, `ti_v_compras`, `ti_v_cuentas_pagar`, `ti_v_clientes`, `ti_v_caja_actual`, `ti_v_resultados_mensuales`, `ti_v_dashboard`, `ti_v_top_productos`.

## Automatismos en la base de datos

- El kardex mueve el stock del producto y actualiza su costo en las entradas.
- Los totales de facturas y compras se recalculan al cambiar sus líneas.
- Un cobro actualiza el saldo y el estado de la factura, y entra a la caja abierta.
- Un pago a proveedor actualiza la compra y sale de caja.
- Un gasto sale de caja.
- Numeración automática: facturas `FAC-000001`, compras `CMP-00001`, recibos `REC-000001`, clientes `TC-0001`, productos `ART-00001`.

## Estructura del código

```
src/app/tienda/                → pantallas del módulo
src/app/api/tienda/            → 17 recursos REST
src/components/tienda/         → sidebar, kit de UI y editor de líneas
src/lib/tienda/motor.ts        → ventas, compras y caja
src/lib/tienda/crud.ts         → helper CRUD (solo acepta tablas ti_*)
src/lib/tienda/tablas.ts       → definición de cada recurso
supabase/tienda_schema.sql     → migración completa
```

Para agregar un recurso: declararlo en `src/lib/tienda/tablas.ts` y crear un `route.ts` de tres líneas con `coleccion()` / `recurso()` — igual que en préstamos y repostería.

## Seguridad

RLS activo **sin políticas** en las 14 tablas: nadie las lee con la anon key desde el navegador. La app entra por `/api/tienda/*` con la service role key.
