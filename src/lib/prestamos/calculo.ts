/* =====================================================================
 * MOTOR DE CÁLCULO DE PRÉSTAMOS
 * ---------------------------------------------------------------------
 * Todo el dinero se maneja en números con 2 decimales.
 * La tasa que se guarda es SIEMPRE la tasa MENSUAL (%), y se prorratea
 * a la frecuencia de pago del préstamo.
 * ===================================================================== */

export type Frecuencia = 'semanal' | 'quincenal' | 'mensual' | 'personalizada'
export type Metodo = 'interes_fijo' | 'saldo_insoluto' | 'solo_interes'
export type ModoReparto = 'tasa' | 'porcentaje'
export type Prorrateo = 'divisor' | 'dias'

/** Tasas preseleccionadas que se ofrecen en el formulario. */
export const TASAS_DISPONIBLES = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50] as const

export const FRECUENCIAS: { valor: Frecuencia; etiqueta: string; dias: number }[] = [
  { valor: 'semanal', etiqueta: 'Semanal', dias: 7 },
  { valor: 'quincenal', etiqueta: 'Quincenal', dias: 15 },
  { valor: 'mensual', etiqueta: 'Mensual', dias: 30 },
  { valor: 'personalizada', etiqueta: 'Personalizada (cada N días)', dias: 10 },
]

export const METODOS: { valor: Metodo; etiqueta: string; ayuda: string }[] = [
  {
    valor: 'interes_fijo',
    etiqueta: 'Interés fijo sobre el capital',
    ayuda:
      'Cada cuota lleva la misma porción de capital y el mismo interés (capital × tasa). Es el modelo tradicional de préstamo personal.',
  },
  {
    valor: 'saldo_insoluto',
    etiqueta: 'Saldo insoluto (amortización)',
    ayuda:
      'Cuota fija; el interés se calcula sobre el saldo pendiente, por lo que baja cuota a cuota. Modelo bancario.',
  },
  {
    valor: 'solo_interes',
    etiqueta: 'Solo interés + capital al final',
    ayuda:
      'El cliente paga únicamente el rédito cada período y el capital completo en la última cuota.',
  },
]

/* ------------------------------------------------------------------ */
/* Utilidades numéricas                                                */
/* ------------------------------------------------------------------ */

export const r2 = (n: number): number => Math.round((Number(n) + Number.EPSILON) * 100) / 100
export const num = (v: unknown): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/* ------------------------------------------------------------------ */
/* Fechas                                                              */
/* ------------------------------------------------------------------ */

/** Convierte 'YYYY-MM-DD' en Date local (sin corrimiento por zona horaria). */
export function aFecha(iso: string | Date): Date {
  if (iso instanceof Date) return new Date(iso.getFullYear(), iso.getMonth(), iso.getDate())
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

export function aISO(f: Date): string {
  const y = f.getFullYear()
  const m = String(f.getMonth() + 1).padStart(2, '0')
  const d = String(f.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function sumarDias(f: Date, dias: number): Date {
  const x = new Date(f)
  x.setDate(x.getDate() + dias)
  return x
}

/** Suma meses conservando el día; si el mes destino es más corto, usa el último día. */
export function sumarMeses(f: Date, meses: number): Date {
  const dia = f.getDate()
  const x = new Date(f.getFullYear(), f.getMonth() + meses, 1)
  const ultimoDia = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate()
  x.setDate(Math.min(dia, ultimoDia))
  return x
}

/** Avanza n períodos desde una fecha, según la frecuencia del préstamo. */
export function sumarPeriodos(
  base: Date,
  n: number,
  frecuencia: Frecuencia,
  diasPeriodo = 30
): Date {
  if (n === 0) return new Date(base)
  switch (frecuencia) {
    case 'mensual':
      return sumarMeses(base, n)
    case 'quincenal':
      return sumarDias(base, 15 * n)
    case 'semanal':
      return sumarDias(base, 7 * n)
    default:
      return sumarDias(base, (diasPeriodo || 30) * n)
  }
}

export function diasEntre(a: Date, b: Date): number {
  return Math.round((aFecha(b).getTime() - aFecha(a).getTime()) / 86400000)
}

/* ------------------------------------------------------------------ */
/* Tasa por período                                                    */
/* ------------------------------------------------------------------ */

/**
 * Convierte la tasa MENSUAL en la tasa del período de pago.
 *  - 'divisor': mensual = tasa, quincenal = tasa/2, semanal = tasa/4  (práctica común)
 *  - 'dias'   : tasa × (díasDelPeríodo / 30)
 * Devuelve la tasa en DECIMAL (0.20 = 20 %).
 */
export function tasaPeriodo(
  tasaMensual: number,
  frecuencia: Frecuencia,
  diasPeriodo = 30,
  prorrateo: Prorrateo = 'divisor'
): number {
  const t = num(tasaMensual) / 100
  if (prorrateo === 'dias') {
    const d = frecuencia === 'mensual' ? 30 : frecuencia === 'quincenal' ? 15 : frecuencia === 'semanal' ? 7 : diasPeriodo || 30
    return t * (d / 30)
  }
  switch (frecuencia) {
    case 'mensual':
      return t
    case 'quincenal':
      return t / 2
    case 'semanal':
      return t / 4
    default:
      return t * ((diasPeriodo || 30) / 30)
  }
}

export function diasDeFrecuencia(frecuencia: Frecuencia, diasPersonalizados = 30): number {
  switch (frecuencia) {
    case 'semanal':
      return 7
    case 'quincenal':
      return 15
    case 'mensual':
      return 30
    default:
      return diasPersonalizados || 30
  }
}

/* ------------------------------------------------------------------ */
/* Generación del cronograma                                           */
/* ------------------------------------------------------------------ */

export interface ParamsCronograma {
  capital: number
  tasaInteres: number // % mensual
  numCuotas: number
  frecuencia: Frecuencia
  diasPeriodo?: number
  metodo: Metodo
  fechaPrimerPago: string | Date
  prorrateo?: Prorrateo
}

export interface CuotaCalculada {
  numero: number
  fecha_vencimiento: string
  capital: number
  interes: number
  total: number
  saldo_despues: number
}

export interface Cronograma {
  cuotas: CuotaCalculada[]
  montoCuota: number
  interesTotal: number
  totalAPagar: number
  fechaFin: string
  tasaPeriodoPct: number
}

export function generarCronograma(p: ParamsCronograma): Cronograma {
  const capital = r2(num(p.capital))
  const n = Math.max(1, Math.floor(num(p.numCuotas)))
  const dias = p.diasPeriodo ?? diasDeFrecuencia(p.frecuencia)
  const i = tasaPeriodo(p.tasaInteres, p.frecuencia, dias, p.prorrateo ?? 'divisor')
  const base = aFecha(p.fechaPrimerPago)
  const cuotas: CuotaCalculada[] = []

  let saldo = capital

  if (p.metodo === 'saldo_insoluto') {
    // Cuota fija tipo francés
    const cuota = i > 0 ? (capital * i) / (1 - Math.pow(1 + i, -n)) : capital / n
    for (let k = 1; k <= n; k++) {
      let interes = r2(saldo * i)
      let cap = r2(cuota - interes)
      if (k === n) cap = r2(saldo) // la última liquida el saldo
      if (cap > saldo) cap = r2(saldo)
      saldo = r2(saldo - cap)
      cuotas.push({
        numero: k,
        fecha_vencimiento: aISO(sumarPeriodos(base, k - 1, p.frecuencia, dias)),
        capital: cap,
        interes,
        total: r2(cap + interes),
        saldo_despues: saldo,
      })
    }
  } else if (p.metodo === 'solo_interes') {
    // Solo rédito cada período; capital completo en la última cuota
    const interes = r2(capital * i)
    for (let k = 1; k <= n; k++) {
      const esUltima = k === n
      const cap = esUltima ? capital : 0
      saldo = esUltima ? 0 : capital
      cuotas.push({
        numero: k,
        fecha_vencimiento: aISO(sumarPeriodos(base, k - 1, p.frecuencia, dias)),
        capital: cap,
        interes,
        total: r2(cap + interes),
        saldo_despues: saldo,
      })
    }
  } else {
    // interes_fijo: capital dividido en partes iguales + interés fijo sobre el capital
    const interes = r2(capital * i)
    const capCuota = r2(capital / n)
    let acumulado = 0
    for (let k = 1; k <= n; k++) {
      const cap = k === n ? r2(capital - acumulado) : capCuota
      acumulado = r2(acumulado + cap)
      saldo = r2(capital - acumulado)
      cuotas.push({
        numero: k,
        fecha_vencimiento: aISO(sumarPeriodos(base, k - 1, p.frecuencia, dias)),
        capital: cap,
        interes,
        total: r2(cap + interes),
        saldo_despues: saldo,
      })
    }
  }

  const interesTotal = r2(cuotas.reduce((s, c) => s + c.interes, 0))
  const totalAPagar = r2(cuotas.reduce((s, c) => s + c.total, 0))

  return {
    cuotas,
    montoCuota: cuotas.length ? cuotas[0].total : 0,
    interesTotal,
    totalAPagar,
    fechaFin: cuotas.length ? cuotas[cuotas.length - 1].fecha_vencimiento : aISO(base),
    tasaPeriodoPct: r2(i * 100),
  }
}

/* ------------------------------------------------------------------ */
/* Reparto de ganancias: inversionista vs administrador                */
/* ------------------------------------------------------------------ */

export interface ParamsReparto {
  modoReparto: ModoReparto
  tasaInteres: number // % mensual cobrado al cliente
  tasaInversionista: number // % mensual pactado con el inversionista
  porcentajeInversionista: number // % del interés para el inversionista
}

/** Proporción (0..1) del interés que le corresponde al inversionista. */
export function proporcionInversionista(p: ParamsReparto): number {
  if (p.modoReparto === 'porcentaje') {
    return Math.min(1, Math.max(0, num(p.porcentajeInversionista) / 100))
  }
  const tc = num(p.tasaInteres)
  if (tc <= 0) return 0
  return Math.min(1, Math.max(0, num(p.tasaInversionista) / tc))
}

export interface Reparto {
  interesTotal: number
  interesInversionista: number
  interesAdministrador: number
  proporcion: number
}

export function repartirInteres(interes: number, p: ParamsReparto): Reparto {
  const prop = proporcionInversionista(p)
  const inv = r2(num(interes) * prop)
  return {
    interesTotal: r2(interes),
    interesInversionista: inv,
    interesAdministrador: r2(num(interes) - inv),
    proporcion: prop,
  }
}

/** Vista previa de la rentabilidad de un préstamo antes de crearlo. */
export function previsualizarRentabilidad(
  cron: Cronograma,
  p: ParamsReparto
): { interesTotal: number; inversionista: number; administrador: number; proporcion: number } {
  const rep = repartirInteres(cron.interesTotal, p)
  return {
    interesTotal: rep.interesTotal,
    inversionista: rep.interesInversionista,
    administrador: rep.interesAdministrador,
    proporcion: rep.proporcion,
  }
}

/* ------------------------------------------------------------------ */
/* Aplicación de un pago sobre una cuota                               */
/* ------------------------------------------------------------------ */

export interface CuotaEstado {
  id: string
  numero: number
  fecha_vencimiento: string
  capital: number
  interes: number
  total: number
  capital_pagado: number
  interes_pagado: number
  mora_generada: number
  mora_pagada: number
  estado: string
}

export interface ResultadoPago {
  aMora: number
  aInteres: number
  aCapital: number
  sobrante: number
  nuevoEstado: 'pendiente' | 'parcial' | 'pagada'
}

/**
 * Distribuye un monto recibido sobre una cuota.
 * Orden de imputación: mora → interés → capital.
 */
export function distribuirPago(cuota: CuotaEstado, monto: number): ResultadoPago {
  let restante = r2(num(monto))
  const moraPend = Math.max(0, r2(num(cuota.mora_generada) - num(cuota.mora_pagada)))
  const intPend = Math.max(0, r2(num(cuota.interes) - num(cuota.interes_pagado)))
  const capPend = Math.max(0, r2(num(cuota.capital) - num(cuota.capital_pagado)))

  const aMora = Math.min(restante, moraPend)
  restante = r2(restante - aMora)
  const aInteres = Math.min(restante, intPend)
  restante = r2(restante - aInteres)
  const aCapital = Math.min(restante, capPend)
  restante = r2(restante - aCapital)

  const capTotal = r2(num(cuota.capital_pagado) + aCapital)
  const intTotal = r2(num(cuota.interes_pagado) + aInteres)
  const saldado = capTotal >= num(cuota.capital) - 0.01 && intTotal >= num(cuota.interes) - 0.01

  return {
    aMora,
    aInteres,
    aCapital,
    sobrante: restante,
    nuevoEstado: saldado ? 'pagada' : capTotal + intTotal > 0 ? 'parcial' : 'pendiente',
  }
}

/* ------------------------------------------------------------------ */
/* Pago de SOLO RÉDITO (solo interés)                                  */
/* ------------------------------------------------------------------ */

export interface ParamsSoloInteres {
  cuota: CuotaEstado
  cuotas: CuotaEstado[] // todas las cuotas activas del ciclo
  tasaInteres: number
  frecuencia: Frecuencia
  diasPeriodo?: number
  prorrateo?: Prorrateo
  /** Tasa distinta a aplicar de aquí en adelante (ej. bajar de 25 % a 20 %). */
  tasaNueva?: number
  /** Rédito en pesos puesto a mano; manda por encima de cualquier tasa. */
  interesManual?: number
  /** Fecha del próximo vencimiento si no se quiere la que sale por defecto. */
  fechaProximoVencimiento?: string
}

export interface NuevaCuotaDiferida {
  numero: number
  fecha_vencimiento: string
  capital: number
  interes: number
  total: number
  saldo_despues: number
}

/**
 * El cliente paga únicamente el rédito del período.
 * El capital de esa cuota se difiere y se genera una cuota adicional al
 * final del cronograma, con ese capital MÁS el rédito del nuevo período.
 * Devuelve null cuando la cuota no tenía capital (ya era solo interés).
 */
export function calcularSoloInteres(p: ParamsSoloInteres): NuevaCuotaDiferida | null {
  const capitalDiferido = Math.max(0, r2(num(p.cuota.capital) - num(p.cuota.capital_pagado)))
  if (capitalDiferido <= 0.01) return null

  const dias = p.diasPeriodo ?? diasDeFrecuencia(p.frecuencia)
  // La tasa nueva (si viene) es la que manda de aquí en adelante.
  const tasa = p.tasaNueva !== undefined && p.tasaNueva !== null
    ? num(p.tasaNueva)
    : num(p.tasaInteres)
  const i = tasaPeriodo(tasa, p.frecuencia, dias, p.prorrateo ?? 'divisor')

  const ultimaFecha = p.cuotas.reduce(
    (max, c) => (c.fecha_vencimiento > max ? c.fecha_vencimiento : max),
    p.cuota.fecha_vencimiento
  )
  const ultimoNumero = p.cuotas.reduce((max, c) => Math.max(max, c.numero), p.cuota.numero)

  // Si el prestamista escribe el rédito a mano, ese vale; si no, se calcula.
  const interes = p.interesManual !== undefined && p.interesManual !== null
    ? Math.max(0, r2(num(p.interesManual)))
    : r2(capitalDiferido * i)

  const vence = p.fechaProximoVencimiento
    ? aISO(aFecha(p.fechaProximoVencimiento))
    : aISO(sumarPeriodos(aFecha(ultimaFecha), 1, p.frecuencia, dias))

  return {
    numero: ultimoNumero + 1,
    fecha_vencimiento: vence,
    capital: capitalDiferido,
    interes,
    total: r2(capitalDiferido + interes),
    saldo_despues: 0,
  }
}

/**
 * Rédito sugerido para el próximo período sobre el capital que quedará
 * pendiente. Sirve para llenar el campo antes de que el usuario lo cambie.
 */
export function reditoSugerido(p: {
  capitalPendiente: number
  tasaInteres: number
  frecuencia: Frecuencia
  diasPeriodo?: number
  prorrateo?: Prorrateo
}): number {
  const dias = p.diasPeriodo ?? diasDeFrecuencia(p.frecuencia)
  const i = tasaPeriodo(num(p.tasaInteres), p.frecuencia, dias, p.prorrateo ?? 'divisor')
  return r2(Math.max(0, num(p.capitalPendiente)) * i)
}

/** Monto exacto que debe entregar el cliente para cubrir solo el rédito. */
export function montoSoloRedito(cuota: CuotaEstado): number {
  const moraPend = Math.max(0, r2(num(cuota.mora_generada) - num(cuota.mora_pagada)))
  const intPend = Math.max(0, r2(num(cuota.interes) - num(cuota.interes_pagado)))
  return r2(moraPend + intPend)
}

/* ------------------------------------------------------------------ */
/* REENGANCHE                                                          */
/* ------------------------------------------------------------------ */

export interface ParamsReenganche {
  cuotasActivas: CuotaEstado[]
  montoAdicional: number
  capitalizarInteresPendiente?: boolean
  tasaInteres: number
  numCuotas: number
  frecuencia: Frecuencia
  diasPeriodo?: number
  metodo: Metodo
  fechaPrimerPago: string | Date
  prorrateo?: Prorrateo
}

export interface ResultadoReenganche {
  saldoCapitalPrevio: number
  interesPendiente: number
  capitalNuevo: number
  cronograma: Cronograma
}

/**
 * Reenganche: el cliente aún debe y necesita dinero adicional.
 *   capital nuevo = saldo de capital pendiente + monto adicional
 *                   (+ interés pendiente si se decide capitalizar)
 * Sobre ese capital se vuelve a aplicar la tasa pactada y se genera un
 * cronograma completamente nuevo.
 */
export function calcularReenganche(p: ParamsReenganche): ResultadoReenganche {
  const saldoCapital = r2(
    p.cuotasActivas.reduce(
      (s, c) => s + Math.max(0, num(c.capital) - num(c.capital_pagado)),
      0
    )
  )
  const interesPendiente = r2(
    p.cuotasActivas.reduce(
      (s, c) => s + Math.max(0, num(c.interes) - num(c.interes_pagado)),
      0
    )
  )
  const capitalNuevo = r2(
    saldoCapital + num(p.montoAdicional) + (p.capitalizarInteresPendiente ? interesPendiente : 0)
  )

  const cronograma = generarCronograma({
    capital: capitalNuevo,
    tasaInteres: p.tasaInteres,
    numCuotas: p.numCuotas,
    frecuencia: p.frecuencia,
    diasPeriodo: p.diasPeriodo,
    metodo: p.metodo,
    fechaPrimerPago: p.fechaPrimerPago,
    prorrateo: p.prorrateo,
  })

  return { saldoCapitalPrevio: saldoCapital, interesPendiente, capitalNuevo, cronograma }
}

/* ------------------------------------------------------------------ */
/* MORA                                                                */
/* ------------------------------------------------------------------ */

/** Mora sobre la cuota vencida: total × tasaMora %, una sola vez pasado el período de gracia. */
export function calcularMora(
  cuota: CuotaEstado,
  tasaMora: number,
  diasGracia: number,
  hoy = new Date()
): number {
  const atraso = diasEntre(aFecha(cuota.fecha_vencimiento), hoy)
  if (atraso <= num(diasGracia)) return 0
  const pendiente = Math.max(
    0,
    r2(num(cuota.total) - num(cuota.capital_pagado) - num(cuota.interes_pagado))
  )
  if (pendiente <= 0) return 0
  return r2(pendiente * (num(tasaMora) / 100))
}

export function diasAtraso(fechaVencimiento: string, estado: string, hoy = new Date()): number {
  if (estado === 'pagada' || estado === 'reemplazada' || estado === 'condonada') return 0
  return Math.max(0, diasEntre(aFecha(fechaVencimiento), hoy))
}
