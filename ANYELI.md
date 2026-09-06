# INVERSIONES ANYELI — módulo de préstamos dentro de UNLUPASO

Gestión de préstamos personales con **inversionistas independientes** y un **administrador** que coloca el dinero y comparte el interés.

Copia independiente del módulo CGSSOLUTIONS: misma lógica y mismas pantallas, pero con su propia dirección (`/anyeli`), su propio prefijo de tablas (`ia_`) y su propia marca. **No comparte un solo registro con el módulo de préstamos original ni con ningún otro módulo del proyecto** (`ul_`, `rep_`, `pr_`, `ti_`): clientes, inversionistas, préstamos, cuotas, pagos y contabilidad son exclusivos de INVERSIONES ANYELI.

**Cada módulo entra por su propio enlace y no ve al otro:**

| Módulo | Enlace | Tablas |
|---|---|---|
| POS heladería | `/pos` | `ul_` |
| CROW EVENTS | `/reposteria` | `rep_` |
| Préstamos (CGSSOLUTIONS) | `/prestamos` | `pr_` |
| **Préstamos (INVERSIONES ANYELI)** | **`/anyeli`** | **`ia_`** |
| MAXMATT SHOP | `/tienda` | `ti_` |

La barra lateral de INVERSIONES ANYELI no enlaza a ningún otro módulo, y ningún otro módulo enlaza a `/anyeli`.

## Identidad visual

Paleta verde teal sobre pizarra (`#0d2b34` / `#0f766e` / `#2dd4bf`), distinta a propósito del crema dorado de Crow Events, para que nadie confunda en qué sistema está trabajando.

---

## 1. Instalar la base de datos

Supabase → **SQL Editor** → pegar y ejecutar completo:

```
supabase/anyeli_schema.sql
```

Crea 9 tablas, 7 vistas, las secuencias de código y los triggers. Es idempotente: se puede volver a ejecutar sin duplicar nada.

Después, verifica en el navegador:

```
/api/anyeli/salud
```

Debe responder `ok: true` con las 9 tablas listadas.

## 2. Variables de entorno

Las mismas que ya usa el proyecto — **no hace falta agregar ninguna**:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

Opcionales, para personalizar el encabezado del módulo:

```
NEXT_PUBLIC_ANYELI_NOMBRE
NEXT_PUBLIC_ANYELI_SLOGAN
NEXT_PUBLIC_ANYELI_TELEFONO
```

(También se pueden cambiar desde **Configuración**, dentro del módulo.)

## 3. Entrar

```
npm run dev
```

Abre `http://localhost:3000/prestamos`. Sin login, igual que los otros módulos.

---

## El modelo de negocio

### Los tres actores

| Rol | Qué hace |
|---|---|
| **Cliente** | Recibe el dinero y paga cuotas |
| **Inversionista** | Pone el capital y cobra su parte del interés |
| **Administrador** | Coloca el dinero, cobra, y se queda con la diferencia |

### El reparto del interés — dos formas, se elige por préstamo

**A · Tasa pactada (la más común)**

Al cliente se le cobra 20 % mensual y al inversionista se le pactó 12 %. Los 8 puntos restantes son del administrador.

```
Capital 100,000 al 20 % mensual  →  interés del mes = 20,000
   Inversionista (12 %) ............ 12,000
   Administrador (8 %) .............  8,000
```

La tasa del inversionista es libre: 8 %, 10 %, 12 %, 15 %… la que se acuerde con cada uno, y puede ser distinta en cada préstamo.

**B · Porcentaje del interés**

El inversionista se lleva un % del interés generado (por ejemplo 70 %) y el administrador el resto.

**Capital propio:** si no se selecciona inversionista, todo el interés queda para el administrador.

### Tasas disponibles

5 %, 10 %, 15 %, 20 %, 25 %, 30 %, 35 %, 40 %, 45 %, 50 % mensual — más un campo libre para cualquier otro valor.

### Frecuencias de pago

Mensual, quincenal, semanal o personalizada (cada N días). La tasa se guarda siempre como **mensual** y el sistema la prorratea:

| Frecuencia | Tasa por cuota (20 % mensual) |
|---|---|
| Mensual | 20 % |
| Quincenal | 10 % |
| Semanal | 5 % |
| Cada 10 días | 6.67 % |

En **Configuración** se puede cambiar el prorrateo a "por días reales" (tasa × días ÷ 30).

### Tres formas de calcular la cuota

1. **Interés fijo sobre el capital** *(el tradicional)* — el capital se divide en partes iguales y cada cuota lleva el mismo interés.
   `100,000 al 20 %, 4 cuotas mensuales → 25,000 capital + 20,000 interés = 45,000 por cuota`
2. **Saldo insoluto** — cuota fija tipo bancario; el interés baja cuota a cuota.
3. **Solo interés + capital al final** — el cliente paga solo el rédito y liquida el capital en la última cuota.

### Pago de solo rédito

Cuando el cliente solo puede pagar el interés:

```
Debe 100,000 al 20 %.  Paga 20,000 de rédito.
→ El capital NO baja
→ El sistema crea automáticamente una cuota al mes siguiente:
     capital diferido  100,000
   + rédito nuevo       20,000
   = a pagar           120,000
→ La fecha de finalización del préstamo se corre un período
```

**El rédito del próximo período se puede cambiar en ese mismo momento.** En el modal de solo rédito hay dos campos: la **tasa a aplicar** de aquí en adelante y el **rédito en pesos**, que se puede escribir a mano. Lo que se escriba a mano manda por encima de la tasa. También se puede elegir la fecha del próximo vencimiento y dejar la tasa nueva fija en el préstamo.

Ejemplo real:

```
Mañana el cliente tiene que entregar 7,700 (5,000 de capital + 2,700 de rédito).
Solo entrega los 2,700.
→ Se queda debiendo los 5,000 de capital.
→ Se le pone la tasa en 20 %  →  el rédito pasa a ser 1,000
→ La cuota del próximo período queda en 6,000 (5,000 + 1,000)
```

Sin ese ajuste, el sistema le habría vuelto a cobrar 2,700 de rédito sobre los mismos 5,000.

### Cambiar el rédito sin que haya pago

En el botón **Cambiar rédito** (o en la fila de cada cuota) se le puede poner otro rédito a una cuota que todavía se debe, sin registrar ningún pago, sin tocar el capital y **sin cancelar el préstamo**.

- Se elige la tasa y el sistema calcula el monto sobre el capital de esa cuota, o se escribe el monto directo.
- El total del préstamo se ajusta exactamente por la diferencia — ni un peso más ni menos.
- Se puede correr también la fecha de vencimiento y dejar la tasa nueva guardada.
- Queda anotado en la cuota de cuánto a cuánto se cambió y el motivo.
- No se permite dejar el rédito por debajo de lo que el cliente ya pagó en esa cuota, ni tocar cuotas pagadas, condonadas o reemplazadas por un reenganche.

### Eliminar un inversionista

En la lista de inversionistas cada fila tiene **Eliminar**. La regla protege el dinero que está en la calle:

| Situación | Qué pasa |
|---|---|
| No ha financiado ningún préstamo | Se borra completo, junto con su caja de movimientos |
| Solo tiene préstamos **terminados** | Se borra, pidiendo una segunda confirmación |
| Tiene préstamos **activos** | **No se borra.** El sistema dice cuántos son, cuánto capital tiene en la calle y de qué clientes |

Cuando se borra a alguien con historial, los préstamos viejos y el reparto de ganancias **conservan su nombre y todos sus montos** — solo pierden el enlace a la ficha. El estado de cuenta, la contabilidad y los totales del mes no cambian.

Si lo que se quiere es que deje de aparecer al crear préstamos nuevos pero sin perder nada, no hace falta borrarlo: basta con quitarle la marca de **Activo** desde *Editar*.

> Requiere ejecutar `supabase/prestamos_borrar_inversionista.sql`.

### Reenganche

El cliente todavía debe y necesita más dinero:

```
Saldo de capital pendiente ....  60,000
+ Dinero adicional ............  40,000
= Capital nuevo ............... 100,000  →  se le aplica otra vez la tasa
```

Se cierra el cronograma anterior (conservando todo lo ya pagado, cuota por cuota) y se genera uno nuevo. En el momento del reenganche se puede cambiar tasa, frecuencia y cantidad de cuotas, y decidir si se capitaliza el interés pendiente o se descarta.

### Atrasos

Toda cuota vencida más allá de los días de gracia aparece **en rojo** en el cronograma, en la lista de préstamos, en cobranza, en el tablero y en el estado de cuenta, con los días de atraso. Si se activa la mora, se calcula automáticamente sobre la cuota vencida.

---

## Pantallas

| Ruta | Contenido |
|---|---|
| `/anyeli` | Tablero: capital colocado, cartera por cobrar, ganancia del administrador, monto en atraso, cuotas atrasadas, próximos vencimientos y gráfico de ganancias por mes |
| `/anyeli/creditos` | Lista con filtros y barra de avance; los atrasados en rojo |
| `/anyeli/creditos/nuevo` | Calculadora en vivo: cronograma completo y reparto de ganancia antes de guardar |
| `/anyeli/creditos/[id]` | Cronograma, pagos, solo rédito, reenganche, anulación de pagos |
| `/anyeli/creditos/[id]/estado` | Estado de cuenta imprimible: monto adeudado, cuánto ha pagado, cuántos pagos le quedan y fecha de finalización |
| `/anyeli/creditos/[id]/recibo/[pago]` | Recibo imprimible de un pago: desglose capital / interés / mora y cómo queda el préstamo |
| `/anyeli/cobranza` | Atrasadas, vencen hoy y próximos 15 días |
| `/anyeli/clientes` | Ficha completa con referencias |
| `/anyeli/inversionistas` | Aportes, retiros, capital en la calle, disponible y ganancias |
| `/anyeli/inversionistas/[id]` | Estado de cuenta individual del inversionista |
| `/anyeli/pagos` | Historial global con filtros y exportación a CSV |
| `/anyeli/contabilidad` | Ganancias por mes, por inversionista y por préstamo |
| `/anyeli/configuracion` | Datos del negocio, tasas por defecto, mora y prorrateo |

## Tablas creadas

| Área | Tablas |
|---|---|
| Configuración | `ia_config` |
| Cartera | `ia_clientes`, `ia_inversionistas`, `ia_movimientos_inversionista` |
| Préstamos | `ia_prestamos`, `ia_cuotas`, `ia_reenganches` |
| Cobros | `ia_pagos` |
| Contabilidad | `ia_distribuciones` |

Vistas: `ia_v_prestamos`, `ia_v_cuotas`, `ia_v_inversionistas`, `ia_v_ganancias_mensuales`, `ia_v_ganancias_inversionista`, `ia_v_dashboard`, `ia_v_cobranza`.

Las vistas calculan al vuelo los saldos, el avance, los días de atraso y el estado visual de cada cuota, así que nunca hay totales desincronizados.

## API

```
GET/POST        /api/anyeli/clientes            · /clientes/[id]
GET/POST        /api/anyeli/inversionistas      · /inversionistas/[id]
GET/POST        /api/anyeli/movimientos         · /movimientos/[id]
GET/POST        /api/anyeli/creditos            · /creditos/[id]   (POST crea préstamo + cronograma)
GET             /api/anyeli/cuotas              · /cuotas/[id]
GET/POST        /api/anyeli/pagos               · /pagos/[id]      (POST imputa mora → interés → capital)
POST            /api/anyeli/solo-redito
POST            /api/anyeli/ajustar-redito     · cambia el rédito de una cuota sin pago
DELETE          /api/anyeli/inversionistas/[id]?definitivo=1[&forzar=1]
POST            /api/anyeli/reenganche
POST            /api/anyeli/anular-pago
GET             /api/anyeli/dashboard
GET             /api/anyeli/cobranza
GET             /api/anyeli/contabilidad
GET/PATCH       /api/anyeli/config
GET             /api/anyeli/vistas/[nombre]
GET             /api/anyeli/salud
```

Todas usan la service role key (igual que `/api/reposteria/*`), así que RLS no interfiere. Las tablas `ia_` tienen RLS activo **sin políticas**: nadie puede leerlas con la anon key desde el navegador.

## Estructura del código

```
src/app/anyeli/             → pantallas del módulo
src/app/api/anyeli/         → 15 recursos REST
src/components/anyeli/      → sidebar y kit de UI propios
src/lib/anyeli/calculo.ts   → motor de cálculo puro (cuotas, rédito, reenganche, reparto)
src/lib/anyeli/motor.ts     → lógica de negocio del servidor
src/lib/anyeli/crud.ts      → helper CRUD (solo acepta tablas ia_*)
src/lib/anyeli/tablas.ts    → definición de cada recurso
src/types/prestamos.ts         → tipos de todas las tablas ia_
supabase/anyeli_schema.sql  → migración completa
```

Para agregar un recurso nuevo: declararlo en `src/lib/anyeli/tablas.ts` y crear un `route.ts` de tres líneas que use `coleccion()` / `recurso()` — exactamente igual que en el módulo de repostería.

## Verificar los cálculos

El motor (`src/lib/anyeli/calculo.ts`) está probado con 10 escenarios: cuotas mensuales/quincenales/semanales, saldo insoluto, bullet, solo rédito, reenganche, reparto de ganancias, imputación de pagos parciales y la tabla de tasas del 5 % al 50 %.
