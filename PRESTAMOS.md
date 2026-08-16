# CGSSOLUTIONS — módulo de préstamos dentro de UNLUPASO

Gestión de préstamos personales con **inversionistas independientes** y un **administrador** que coloca el dinero y comparte el interés.

Montado dentro de este proyecto igual que CROW EVENTS: mismo Supabase, mismo despliegue, pero con prefijo `pr_`. Ninguna tabla de este módulo referencia una tabla `ul_` ni `rep_`, así que los datos de la heladería, los de Crow Events y los de préstamos nunca se mezclan.

**Cada módulo entra por su propio enlace y no ve al otro:**

| Módulo | Enlace | Tablas |
|---|---|---|
| POS heladería | `/pos` | `ul_` |
| CROW EVENTS | `/reposteria` | `rep_` |
| **Préstamos (CGSSOLUTIONS)** | **`/prestamos`** | **`pr_`** |
| MAXMATT SHOP | `/tienda` | `ti_` |

La barra lateral de préstamos no enlaza a ningún otro módulo, y la de los otros módulos no enlaza a préstamos.

## Identidad visual

Paleta verde teal sobre pizarra (`#0d2b34` / `#0f766e` / `#2dd4bf`), distinta a propósito del crema dorado de Crow Events, para que nadie confunda en qué sistema está trabajando.

---

## 1. Instalar la base de datos

Supabase → **SQL Editor** → pegar y ejecutar completo:

```
supabase/prestamos_schema.sql
```

Crea 9 tablas, 7 vistas, las secuencias de código y los triggers. Es idempotente: se puede volver a ejecutar sin duplicar nada.

Después, verifica en el navegador:

```
/api/prestamos/salud
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
NEXT_PUBLIC_PRESTAMOS_NOMBRE
NEXT_PUBLIC_PRESTAMOS_SLOGAN
NEXT_PUBLIC_PRESTAMOS_TELEFONO
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
| `/prestamos` | Tablero: capital colocado, cartera por cobrar, ganancia del administrador, monto en atraso, cuotas atrasadas, próximos vencimientos y gráfico de ganancias por mes |
| `/prestamos/creditos` | Lista con filtros y barra de avance; los atrasados en rojo |
| `/prestamos/creditos/nuevo` | Calculadora en vivo: cronograma completo y reparto de ganancia antes de guardar |
| `/prestamos/creditos/[id]` | Cronograma, pagos, solo rédito, reenganche, anulación de pagos |
| `/prestamos/creditos/[id]/estado` | Estado de cuenta imprimible: monto adeudado, cuánto ha pagado, cuántos pagos le quedan y fecha de finalización |
| `/prestamos/creditos/[id]/recibo/[pago]` | Recibo imprimible de un pago: desglose capital / interés / mora y cómo queda el préstamo |
| `/prestamos/cobranza` | Atrasadas, vencen hoy y próximos 15 días |
| `/prestamos/clientes` | Ficha completa con referencias |
| `/prestamos/inversionistas` | Aportes, retiros, capital en la calle, disponible y ganancias |
| `/prestamos/inversionistas/[id]` | Estado de cuenta individual del inversionista |
| `/prestamos/pagos` | Historial global con filtros y exportación a CSV |
| `/prestamos/contabilidad` | Ganancias por mes, por inversionista y por préstamo |
| `/prestamos/configuracion` | Datos del negocio, tasas por defecto, mora y prorrateo |

## Tablas creadas

| Área | Tablas |
|---|---|
| Configuración | `pr_config` |
| Cartera | `pr_clientes`, `pr_inversionistas`, `pr_movimientos_inversionista` |
| Préstamos | `pr_prestamos`, `pr_cuotas`, `pr_reenganches` |
| Cobros | `pr_pagos` |
| Contabilidad | `pr_distribuciones` |

Vistas: `pr_v_prestamos`, `pr_v_cuotas`, `pr_v_inversionistas`, `pr_v_ganancias_mensuales`, `pr_v_ganancias_inversionista`, `pr_v_dashboard`, `pr_v_cobranza`.

Las vistas calculan al vuelo los saldos, el avance, los días de atraso y el estado visual de cada cuota, así que nunca hay totales desincronizados.

## API

```
GET/POST        /api/prestamos/clientes            · /clientes/[id]
GET/POST        /api/prestamos/inversionistas      · /inversionistas/[id]
GET/POST        /api/prestamos/movimientos         · /movimientos/[id]
GET/POST        /api/prestamos/creditos            · /creditos/[id]   (POST crea préstamo + cronograma)
GET             /api/prestamos/cuotas              · /cuotas/[id]
GET/POST        /api/prestamos/pagos               · /pagos/[id]      (POST imputa mora → interés → capital)
POST            /api/prestamos/solo-redito
POST            /api/prestamos/ajustar-redito     · cambia el rédito de una cuota sin pago
POST            /api/prestamos/reenganche
POST            /api/prestamos/anular-pago
GET             /api/prestamos/dashboard
GET             /api/prestamos/cobranza
GET             /api/prestamos/contabilidad
GET/PATCH       /api/prestamos/config
GET             /api/prestamos/vistas/[nombre]
GET             /api/prestamos/salud
```

Todas usan la service role key (igual que `/api/reposteria/*`), así que RLS no interfiere. Las tablas `pr_` tienen RLS activo **sin políticas**: nadie puede leerlas con la anon key desde el navegador.

## Estructura del código

```
src/app/prestamos/             → pantallas del módulo
src/app/api/prestamos/         → 15 recursos REST
src/components/prestamos/      → sidebar y kit de UI propios
src/lib/prestamos/calculo.ts   → motor de cálculo puro (cuotas, rédito, reenganche, reparto)
src/lib/prestamos/motor.ts     → lógica de negocio del servidor
src/lib/prestamos/crud.ts      → helper CRUD (solo acepta tablas pr_*)
src/lib/prestamos/tablas.ts    → definición de cada recurso
src/types/prestamos.ts         → tipos de todas las tablas pr_
supabase/prestamos_schema.sql  → migración completa
```

Para agregar un recurso nuevo: declararlo en `src/lib/prestamos/tablas.ts` y crear un `route.ts` de tres líneas que use `coleccion()` / `recurso()` — exactamente igual que en el módulo de repostería.

## Verificar los cálculos

El motor (`src/lib/prestamos/calculo.ts`) está probado con 10 escenarios: cuotas mensuales/quincenales/semanales, saldo insoluto, bullet, solo rédito, reenganche, reparto de ganancias, imputación de pagos parciales y la tabla de tasas del 5 % al 50 %.
