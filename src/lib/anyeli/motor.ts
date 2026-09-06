import { createAdminClient } from "@/lib/supabase/server";
import {
  calcularMora,
  calcularReenganche,
  calcularSoloInteres,
  diasDeFrecuencia,
  distribuirPago,
  generarCronograma,
  r2,
  reditoSugerido,
  repartirInteres,
  type CuotaEstado,
  type Frecuencia,
  type Metodo,
  type ModoReparto,
  type Prorrateo,
} from "./calculo";

/**
 * Lógica de negocio del módulo de préstamos.
 * Todo corre en el servidor con la service role key.
 */

const SALDADAS = ["pagada", "reemplazada", "condonada", "solo_interes"];

interface FilaCuota {
  id: string;
  prestamo_id: string;
  ciclo: number;
  numero: number;
  fecha_vencimiento: string;
  capital: number;
  interes: number;
  total: number;
  capital_pagado: number;
  interes_pagado: number;
  mora_generada: number;
  mora_pagada: number;
  estado: string;
  fecha_pago: string | null;
  activa?: boolean;
  notas?: string | null;
}

interface FilaPrestamo {
  id: string;
  codigo: string;
  cliente_id: string;
  inversionista_id: string | null;
  capital: number;
  tasa_interes: number;
  metodo: Metodo;
  frecuencia: Frecuencia;
  dias_periodo: number;
  num_cuotas: number;
  ciclo: number;
  estado: string;
  modo_reparto: ModoReparto;
  tasa_inversionista: number;
  porcentaje_inversionista: number;
  mora_activa: boolean;
  tasa_mora: number;
  dias_gracia: number;
  interes_programado: number;
  total_programado: number;
}

async function prorrateoConfigurado(): Promise<Prorrateo> {
  const sb = createAdminClient();
  const { data } = await sb.from("ia_config").select("metodo_prorrateo").eq("id", 1).single();
  return (data?.metodo_prorrateo as Prorrateo) ?? "divisor";
}

// ─── CREAR PRÉSTAMO CON SU CRONOGRAMA ────────────────────────────────────────
export interface DatosNuevoPrestamo {
  cliente_id: string;
  inversionista_id?: string | null;
  capital: number;
  tasa_interes: number;
  metodo?: Metodo;
  frecuencia?: Frecuencia;
  dias_periodo?: number;
  num_cuotas: number;
  fecha_inicio?: string;
  fecha_primer_pago: string;
  modo_reparto?: ModoReparto;
  tasa_inversionista?: number;
  porcentaje_inversionista?: number;
  mora_activa?: boolean;
  tasa_mora?: number;
  dias_gracia?: number;
  garantia?: string;
  notas?: string;
  usuario?: string;
}

export async function crearPrestamo(d: DatosNuevoPrestamo) {
  const sb = createAdminClient();
  const prorrateo = await prorrateoConfigurado();

  const frecuencia = d.frecuencia ?? "mensual";
  const dias = d.dias_periodo ?? diasDeFrecuencia(frecuencia);

  const cron = generarCronograma({
    capital: Number(d.capital),
    tasaInteres: Number(d.tasa_interes),
    numCuotas: Number(d.num_cuotas),
    frecuencia,
    diasPeriodo: dias,
    metodo: d.metodo ?? "interes_fijo",
    fechaPrimerPago: d.fecha_primer_pago,
    prorrateo,
  });

  const { data: prestamo, error } = await sb
    .from("ia_prestamos")
    .insert({
      cliente_id: d.cliente_id,
      inversionista_id: d.inversionista_id || null,
      capital: Number(d.capital),
      capital_original: Number(d.capital),
      tasa_interes: Number(d.tasa_interes),
      metodo: d.metodo ?? "interes_fijo",
      frecuencia,
      dias_periodo: dias,
      num_cuotas: Number(d.num_cuotas),
      fecha_inicio: d.fecha_inicio ?? new Date().toISOString().slice(0, 10),
      fecha_primer_pago: d.fecha_primer_pago,
      fecha_fin_estimada: cron.fechaFin,
      modo_reparto: d.modo_reparto ?? "tasa",
      tasa_inversionista: d.inversionista_id ? Number(d.tasa_inversionista ?? 0) : 0,
      porcentaje_inversionista: d.inversionista_id ? Number(d.porcentaje_inversionista ?? 0) : 0,
      mora_activa: d.mora_activa ?? false,
      tasa_mora: Number(d.tasa_mora ?? 0),
      dias_gracia: Number(d.dias_gracia ?? 3),
      monto_cuota: cron.montoCuota,
      interes_programado: cron.interesTotal,
      total_programado: cron.totalAPagar,
      garantia: d.garantia || null,
      notas: d.notas || null,
      usuario: d.usuario || null,
      ciclo: 1,
    })
    .select()
    .single();

  if (error) throw error;

  const filas = cron.cuotas.map((c) => ({
    prestamo_id: prestamo.id,
    ciclo: 1,
    numero: c.numero,
    fecha_vencimiento: c.fecha_vencimiento,
    capital: c.capital,
    interes: c.interes,
    total: c.total,
    saldo_despues: c.saldo_despues,
    origen: "cronograma",
  }));

  const { error: e2 } = await sb.from("ia_cuotas").insert(filas);
  if (e2) {
    await sb.from("ia_prestamos").delete().eq("id", prestamo.id);
    throw e2;
  }

  return prestamo;
}

// ─── MORA ────────────────────────────────────────────────────────────────────
export async function actualizarMoras(prestamoId: string): Promise<number> {
  const sb = createAdminClient();
  const { data: p } = await sb.from("ia_prestamos").select("*").eq("id", prestamoId).single();
  if (!p || !p.mora_activa) return 0;

  const { data: cuotas } = await sb
    .from("ia_cuotas")
    .select("*")
    .eq("prestamo_id", prestamoId)
    .eq("activa", true);

  const pendientes = ((cuotas ?? []) as FilaCuota[]).filter((c) => !SALDADAS.includes(c.estado));
  let total = 0;
  for (const c of pendientes) {
    const mora = calcularMora(c as unknown as CuotaEstado, p.tasa_mora, p.dias_gracia);
    if (r2(mora) !== r2(Number(c.mora_generada))) {
      await sb.from("ia_cuotas").update({ mora_generada: mora }).eq("id", c.id);
    }
    total += mora;
  }
  return r2(total);
}

// ─── DISTRIBUCIÓN CONTABLE ───────────────────────────────────────────────────
async function crearDistribucion(
  pagoId: string,
  p: FilaPrestamo,
  capital: number,
  interes: number,
  mora: number,
  fecha: string
) {
  const sb = createAdminClient();
  const rep = repartirInteres(interes, {
    modoReparto: p.modo_reparto,
    tasaInteres: Number(p.tasa_interes),
    tasaInversionista: Number(p.tasa_inversionista),
    porcentajeInversionista: Number(p.porcentaje_inversionista),
  });
  const sinInversionista = !p.inversionista_id;

  const { error } = await sb.from("ia_distribuciones").insert({
    pago_id: pagoId,
    prestamo_id: p.id,
    inversionista_id: p.inversionista_id,
    fecha,
    capital_devuelto: capital,
    interes_total: rep.interesTotal,
    interes_inversionista: sinInversionista ? 0 : rep.interesInversionista,
    interes_administrador: sinInversionista ? rep.interesTotal : rep.interesAdministrador,
    mora_administrador: mora,
  });
  if (error) throw error;
}

async function sincronizarEstado(prestamoId: string) {
  const sb = createAdminClient();
  const { data } = await sb
    .from("ia_cuotas")
    .select("estado")
    .eq("prestamo_id", prestamoId)
    .eq("activa", true);

  const pendientes = ((data ?? []) as { estado: string }[]).filter(
    (c) => !SALDADAS.includes(c.estado)
  ).length;

  const { data: p } = await sb.from("ia_prestamos").select("estado").eq("id", prestamoId).single();
  if (!p || p.estado === "cancelado") return;

  if (pendientes === 0 && p.estado === "activo") {
    await sb.from("ia_prestamos").update({ estado: "pagado" }).eq("id", prestamoId);
  } else if (pendientes > 0 && p.estado === "pagado") {
    await sb.from("ia_prestamos").update({ estado: "activo" }).eq("id", prestamoId);
  }
}

// ─── REGISTRAR PAGO ──────────────────────────────────────────────────────────
export interface DatosPago {
  prestamo_id: string;
  cuota_id?: string | null;
  fecha: string;
  monto: number;
  tipo?: "cuota" | "abono_capital" | "saldo_total" | "mora";
  metodo_pago?: "efectivo" | "transferencia" | "cheque" | "tarjeta" | "otro";
  referencia?: string;
  notas?: string;
  usuario?: string;
}

export async function registrarPago(d: DatosPago) {
  const sb = createAdminClient();
  const tipo = d.tipo ?? "cuota";

  const { data: prestamo, error: ep } = await sb
    .from("ia_prestamos")
    .select("*")
    .eq("id", d.prestamo_id)
    .single();
  if (ep) throw ep;
  const p = prestamo as FilaPrestamo;

  const { data: cuotasRaw, error: ec } = await sb
    .from("ia_cuotas")
    .select("*")
    .eq("prestamo_id", d.prestamo_id)
    .eq("activa", true)
    .order("numero");
  if (ec) throw ec;

  const cuotas = (cuotasRaw ?? []) as FilaCuota[];
  const pendientes = cuotas.filter((c) => !SALDADAS.includes(c.estado));
  if (pendientes.length === 0) throw new Error("Este préstamo no tiene cuotas pendientes.");

  let objetivo: FilaCuota[];
  if (tipo === "abono_capital") {
    objetivo = [...pendientes].reverse(); // reduce la cola: el préstamo termina antes
  } else if (d.cuota_id) {
    const i = pendientes.findIndex((c) => c.id === d.cuota_id);
    objetivo = i >= 0 ? pendientes.slice(i) : pendientes;
  } else {
    objetivo = pendientes;
  }

  let restante = r2(Number(d.monto));
  const aplicaciones: {
    cuota: FilaCuota;
    aMora: number;
    aInteres: number;
    aCapital: number;
    nuevoEstado: string;
  }[] = [];

  for (const cuota of objetivo) {
    if (restante <= 0.001) break;

    if (tipo === "abono_capital") {
      const capPend = Math.max(0, r2(Number(cuota.capital) - Number(cuota.capital_pagado)));
      const aCapital = Math.min(restante, capPend);
      if (aCapital <= 0) continue;
      restante = r2(restante - aCapital);
      const capTotal = r2(Number(cuota.capital_pagado) + aCapital);
      const saldado =
        capTotal >= Number(cuota.capital) - 0.01 &&
        Number(cuota.interes_pagado) >= Number(cuota.interes) - 0.01;
      aplicaciones.push({ cuota, aMora: 0, aInteres: 0, aCapital, nuevoEstado: saldado ? "pagada" : "parcial" });
    } else if (tipo === "mora") {
      const moraPend = Math.max(0, r2(Number(cuota.mora_generada) - Number(cuota.mora_pagada)));
      const aMora = Math.min(restante, moraPend);
      if (aMora <= 0) continue;
      restante = r2(restante - aMora);
      aplicaciones.push({ cuota, aMora, aInteres: 0, aCapital: 0, nuevoEstado: cuota.estado });
    } else {
      const res = distribuirPago(cuota as unknown as CuotaEstado, restante);
      if (res.aMora + res.aInteres + res.aCapital <= 0) continue;
      restante = res.sobrante;
      aplicaciones.push({
        cuota,
        aMora: res.aMora,
        aInteres: res.aInteres,
        aCapital: res.aCapital,
        nuevoEstado: res.nuevoEstado,
      });
    }
  }

  if (aplicaciones.length === 0) throw new Error("El pago no pudo imputarse a ninguna cuota.");

  const totalCapital = r2(aplicaciones.reduce((s, a) => s + a.aCapital, 0));
  const totalInteres = r2(aplicaciones.reduce((s, a) => s + a.aInteres, 0));
  const totalMora    = r2(aplicaciones.reduce((s, a) => s + a.aMora, 0));

  const { data: pago, error: epago } = await sb
    .from("ia_pagos")
    .insert({
      prestamo_id: d.prestamo_id,
      cuota_id: d.cuota_id ?? aplicaciones[0].cuota.id,
      fecha: d.fecha,
      monto: r2(totalCapital + totalInteres + totalMora),
      tipo,
      monto_capital: totalCapital,
      monto_interes: totalInteres,
      monto_mora: totalMora,
      metodo_pago: d.metodo_pago ?? "efectivo",
      referencia: d.referencia || null,
      notas:
        restante > 0.01
          ? `${d.notas ?? ""} (Sobrante no aplicado: ${restante})`.trim()
          : d.notas || null,
      usuario: d.usuario || null,
    })
    .select()
    .single();
  if (epago) throw epago;

  for (const a of aplicaciones) {
    await sb
      .from("ia_cuotas")
      .update({
        capital_pagado: r2(Number(a.cuota.capital_pagado) + a.aCapital),
        interes_pagado: r2(Number(a.cuota.interes_pagado) + a.aInteres),
        mora_pagada: r2(Number(a.cuota.mora_pagada) + a.aMora),
        estado: a.nuevoEstado,
        fecha_pago: a.nuevoEstado === "pagada" ? d.fecha : a.cuota.fecha_pago,
      })
      .eq("id", a.cuota.id);
  }

  await crearDistribucion(pago.id, p, totalCapital, totalInteres, totalMora, d.fecha);
  await sincronizarEstado(d.prestamo_id);

  return { pago, sobrante: restante };
}

// ─── PAGO DE SOLO RÉDITO ─────────────────────────────────────────────────────
export interface DatosSoloRedito {
  prestamo_id: string;
  cuota_id: string;
  fecha: string;
  monto: number;
  metodo_pago?: "efectivo" | "transferencia" | "cheque" | "tarjeta" | "otro";
  referencia?: string;
  notas?: string;
  usuario?: string;
  /** Tasa a aplicar de aquí en adelante sobre el capital que queda. */
  tasa_nueva?: number;
  /** Rédito en pesos escrito a mano; manda por encima de la tasa. */
  interes_nuevo?: number;
  /** Guardar la tasa nueva en el préstamo para los próximos períodos. */
  guardar_tasa?: boolean;
  /** Fecha en que vence el próximo rédito. */
  fecha_proximo_vencimiento?: string;
}

export async function registrarSoloRedito(d: DatosSoloRedito) {
  const sb = createAdminClient();
  const prorrateo = await prorrateoConfigurado();

  const { data: prestamo, error: ep } = await sb
    .from("ia_prestamos")
    .select("*")
    .eq("id", d.prestamo_id)
    .single();
  if (ep) throw ep;
  const p = prestamo as FilaPrestamo;

  const { data: cuotasRaw } = await sb
    .from("ia_cuotas")
    .select("*")
    .eq("prestamo_id", d.prestamo_id)
    .eq("activa", true)
    .order("numero");
  const cuotas = (cuotasRaw ?? []) as FilaCuota[];
  const cuota = cuotas.find((c) => c.id === d.cuota_id);
  if (!cuota) throw new Error("Cuota no encontrada");

  const moraPend = Math.max(0, r2(Number(cuota.mora_generada) - Number(cuota.mora_pagada)));
  const intPend  = Math.max(0, r2(Number(cuota.interes) - Number(cuota.interes_pagado)));

  let restante = r2(Number(d.monto));
  const aMora = Math.min(restante, moraPend);
  restante = r2(restante - aMora);
  const aInteres = Math.min(restante, intPend);

  const { data: pago, error: epago } = await sb
    .from("ia_pagos")
    .insert({
      prestamo_id: d.prestamo_id,
      cuota_id: cuota.id,
      fecha: d.fecha,
      monto: r2(aMora + aInteres),
      tipo: "solo_interes",
      monto_capital: 0,
      monto_interes: aInteres,
      monto_mora: aMora,
      metodo_pago: d.metodo_pago ?? "efectivo",
      referencia: d.referencia || null,
      notas: d.notas || "Pago de solo rédito: el capital se difiere al final del cronograma.",
      usuario: d.usuario || null,
    })
    .select()
    .single();
  if (epago) throw epago;

  const interesTotalPagado = r2(Number(cuota.interes_pagado) + aInteres);
  const cubrioTodoElInteres = interesTotalPagado >= Number(cuota.interes) - 0.01;

  const nueva = calcularSoloInteres({
    cuota: { ...(cuota as unknown as CuotaEstado), interes_pagado: interesTotalPagado },
    cuotas: cuotas as unknown as CuotaEstado[],
    tasaInteres: Number(p.tasa_interes),
    frecuencia: p.frecuencia,
    diasPeriodo: Number(p.dias_periodo),
    prorrateo,
    tasaNueva: d.tasa_nueva,
    interesManual: d.interes_nuevo,
    fechaProximoVencimiento: d.fecha_proximo_vencimiento,
  });

  if (nueva && cubrioTodoElInteres) {
    // 1) Nace la cuota diferida: capital pendiente + rédito del próximo período
    const tasaAplicada = d.tasa_nueva ?? Number(p.tasa_interes);
    const notaRedito =
      d.interes_nuevo !== undefined && d.interes_nuevo !== null
        ? `Rédito puesto a mano: ${nueva.interes} sobre un capital de ${nueva.capital}.`
        : `Rédito al ${tasaAplicada}% sobre un capital de ${nueva.capital}.`;

    await sb.from("ia_cuotas").insert({
      prestamo_id: p.id,
      ciclo: p.ciclo,
      numero: nueva.numero,
      fecha_vencimiento: nueva.fecha_vencimiento,
      capital: nueva.capital,
      interes: nueva.interes,
      total: nueva.total,
      saldo_despues: 0,
      origen: "solo_interes",
      notas: `Generada por el pago de solo rédito de la cuota #${cuota.numero}. ${notaRedito}`,
    });

    // 2) La cuota original queda saldada: su capital se trasladó
    await sb
      .from("ia_cuotas")
      .update({
        capital: Number(cuota.capital_pagado),
        interes: interesTotalPagado,
        total: r2(Number(cuota.capital_pagado) + interesTotalPagado),
        interes_pagado: interesTotalPagado,
        mora_pagada: r2(Number(cuota.mora_pagada) + aMora),
        estado: "solo_interes",
        fecha_pago: d.fecha,
        notas: "Cliente pagó únicamente el rédito. El capital se trasladó al final del cronograma.",
      })
      .eq("id", cuota.id);

    // 3) El préstamo se alarga un período. Si se pidió, la tasa nueva queda
    //    guardada para que los próximos réditos salgan con ella.
    const cambios: Record<string, unknown> = {
      fecha_fin_estimada: nueva.fecha_vencimiento,
      num_cuotas: Number(p.num_cuotas) + 1,
      interes_programado: r2(Number(p.interes_programado) + nueva.interes),
      total_programado: r2(Number(p.total_programado) + nueva.interes),
    };
    if (d.guardar_tasa && d.tasa_nueva !== undefined && d.tasa_nueva !== null) {
      cambios.tasa_interes = Number(d.tasa_nueva);
    }
    await sb.from("ia_prestamos").update(cambios).eq("id", p.id);
  } else {
    const capOk = Number(cuota.capital_pagado) >= Number(cuota.capital) - 0.01;
    await sb
      .from("ia_cuotas")
      .update({
        interes_pagado: interesTotalPagado,
        mora_pagada: r2(Number(cuota.mora_pagada) + aMora),
        estado: cubrioTodoElInteres && capOk ? "pagada" : "parcial",
        fecha_pago: cubrioTodoElInteres && capOk ? d.fecha : cuota.fecha_pago,
      })
      .eq("id", cuota.id);
  }

  await crearDistribucion(pago.id, p, 0, aInteres, aMora, d.fecha);
  await sincronizarEstado(p.id);

  return { pago, nuevaCuota: nueva && cubrioTodoElInteres ? nueva : null };
}

// ─── ELIMINAR UN INVERSIONISTA ───────────────────────────────────────────────
export interface DatosEliminarInversionista {
  id: string;
  /** Borrar aunque tenga préstamos ya terminados en el historial. */
  forzar?: boolean;
  usuario?: string;
}

/**
 * Saca un inversionista del sistema.
 *
 * La regla es simple y protege el dinero:
 *  · Sin préstamos            → se borra, junto con su caja de movimientos.
 *  · Solo préstamos terminados → se borra si se confirma. Los préstamos viejos
 *    conservan el nombre y el reparto de ganancias, solo pierden el enlace.
 *  · Con préstamos ACTIVOS     → no se borra. Ese capital todavía está en la
 *    calle y borrarlo dejaría sin dueño un dinero que se sigue cobrando.
 */
export async function eliminarInversionista(d: DatosEliminarInversionista) {
  const sb = createAdminClient();

  const { data: inv } = await sb
    .from("ia_inversionistas").select("id,nombre,codigo").eq("id", d.id).single();
  if (!inv) throw new Error("Ese inversionista ya no existe.");

  // ¿Qué préstamos financió y en qué estado están?
  const { data: prestamos } = await sb
    .from("ia_v_prestamos")
    .select("id,codigo,estado,saldo_capital,saldo_total,cliente_nombre")
    .eq("inversionista_id", d.id);

  const lista = (prestamos ?? []) as {
    id: string; codigo: string; estado: string;
    saldo_capital: number; saldo_total: number; cliente_nombre: string;
  }[];

  const activos = lista.filter((p) => p.estado === "activo");
  const enCalle = r2(activos.reduce((a, p) => a + Number(p.saldo_capital ?? 0), 0));

  if (activos.length > 0) {
    const cuales = activos
      .slice(0, 4)
      .map((p) => `${p.codigo} (${p.cliente_nombre})`)
      .join(", ");
    throw new Error(
      `${inv.nombre} tiene ${activos.length} préstamo(s) activo(s) con ` +
      `${enCalle.toLocaleString("es-DO", { minimumFractionDigits: 2 })} de capital en la calle: ` +
      `${cuales}${activos.length > 4 ? "…" : ""}. ` +
      "No se puede borrar mientras ese dinero se siga cobrando, porque quedaría sin dueño. " +
      "Cuando esos préstamos terminen, o si se los pasas a otro inversionista, ya se podrá."
    );
  }

  if (lista.length > 0 && !d.forzar) {
    throw new Error(
      `${inv.nombre} tiene ${lista.length} préstamo(s) terminados en el historial. ` +
      "Se puede borrar: esos préstamos conservan su nombre y el reparto de ganancias, " +
      "solo pierden el enlace a su ficha. Confirma para continuar."
    );
  }

  // Cuánto había en su caja, para poder decírselo después
  const { data: movs } = await sb
    .from("ia_movimientos_inversionista").select("id").eq("inversionista_id", d.id);
  const movimientos = (movs ?? []).length;

  // Los préstamos y las distribuciones se quedan con el nombre escrito
  // (lo puso el trigger); la llave se vuelve null sola al borrar.
  const { error } = await sb.from("ia_inversionistas").delete().eq("id", d.id);
  if (error) throw error;

  return {
    ok: true,
    nombre: inv.nombre,
    codigo: inv.codigo,
    prestamos_historicos: lista.length,
    movimientos_borrados: movimientos,
  };
}

// ─── AJUSTAR EL RÉDITO DE UNA CUOTA ──────────────────────────────────────────
export interface DatosAjusteRedito {
  cuota_id: string;
  /** Rédito en pesos que se le va a cobrar. Manda por encima de la tasa. */
  interes_nuevo?: number;
  /** O la tasa a aplicar sobre el capital pendiente de esa cuota. */
  tasa_nueva?: number;
  /** Guardar esa tasa en el préstamo para los próximos períodos. */
  guardar_tasa?: boolean;
  /** Correr también la fecha de vencimiento de la cuota. */
  fecha_vencimiento?: string;
  motivo?: string;
  usuario?: string;
}

/**
 * Cambia el rédito de una cuota que todavía no está saldada, sin tocar el
 * capital ni cancelar el préstamo.
 *
 * Para el caso típico: el cliente debía 7,700 y solo entrega el rédito, así
 * que quedan 5,000 de capital y de ahora en adelante se le cobra un 20 % —
 * o sea 1,000 de rédito. Con esto se le pone ese 1,000 directamente.
 */
export async function ajustarRedito(d: DatosAjusteRedito) {
  const sb = createAdminClient();
  const prorrateo = await prorrateoConfigurado();

  const { data: cuotaRaw, error: ec } = await sb
    .from("ia_cuotas").select("*").eq("id", d.cuota_id).single();
  if (ec || !cuotaRaw) throw new Error("Cuota no encontrada");
  const c = cuotaRaw as FilaCuota;

  if (c.activa === false) throw new Error("Esa cuota ya no está activa: la reemplazó un reenganche.");
  if (["pagada", "condonada", "reemplazada"].includes(c.estado)) {
    throw new Error(`No se puede cambiar el rédito de una cuota ${c.estado}.`);
  }

  const { data: prestamoRaw, error: ep } = await sb
    .from("ia_prestamos").select("*").eq("id", c.prestamo_id).single();
  if (ep || !prestamoRaw) throw new Error("Préstamo no encontrado");
  const p = prestamoRaw as FilaPrestamo;
  if (p.estado === "cancelado") throw new Error("El préstamo está cancelado.");

  const capitalPendiente = Math.max(0, r2(Number(c.capital) - Number(c.capital_pagado)));

  // Qué rédito queda: el escrito a mano, o el que sale de la tasa nueva.
  let interesNuevo: number;
  if (d.interes_nuevo !== undefined && d.interes_nuevo !== null) {
    interesNuevo = Math.max(0, r2(Number(d.interes_nuevo)));
  } else if (d.tasa_nueva !== undefined && d.tasa_nueva !== null) {
    interesNuevo = reditoSugerido({
      capitalPendiente,
      tasaInteres: Number(d.tasa_nueva),
      frecuencia: p.frecuencia,
      diasPeriodo: Number(p.dias_periodo),
      prorrateo,
    });
  } else {
    throw new Error("Indica el rédito en pesos o la tasa que se va a aplicar.");
  }

  // No se puede dejar el rédito por debajo de lo que el cliente ya pagó.
  const yaPagado = r2(Number(c.interes_pagado));
  if (interesNuevo < yaPagado - 0.01) {
    throw new Error(
      `El cliente ya pagó ${yaPagado} de rédito en esta cuota, ` +
      `así que el nuevo rédito no puede ser menor que eso.`
    );
  }

  const interesAnterior = r2(Number(c.interes));
  const diferencia = r2(interesNuevo - interesAnterior);
  const totalNuevo = r2(Number(c.capital) + interesNuevo);

  const capOk = Number(c.capital_pagado) >= Number(c.capital) - 0.01;
  const intOk = yaPagado >= interesNuevo - 0.01;

  const nota = [
    c.notas,
    `Rédito ajustado de ${interesAnterior} a ${interesNuevo}` +
      (d.tasa_nueva !== undefined && d.tasa_nueva !== null ? ` (${d.tasa_nueva}%)` : "") +
      (d.motivo ? ` — ${d.motivo}` : "."),
  ].filter(Boolean).join(" ");

  const cambiosCuota: Record<string, unknown> = {
    interes: interesNuevo,
    total: totalNuevo,
    estado: capOk && intOk ? "pagada" : (Number(c.capital_pagado) + yaPagado > 0 ? "parcial" : "pendiente"),
    notas: nota,
  };
  if (d.fecha_vencimiento) cambiosCuota.fecha_vencimiento = d.fecha_vencimiento;
  if (capOk && intOk && !c.fecha_pago) cambiosCuota.fecha_pago = new Date().toISOString().slice(0, 10);

  const { error: eu } = await sb.from("ia_cuotas").update(cambiosCuota).eq("id", c.id);
  if (eu) throw eu;

  // El préstamo cambia en la misma diferencia: ni un peso más ni menos.
  const cambiosPrestamo: Record<string, unknown> = {
    interes_programado: r2(Number(p.interes_programado) + diferencia),
    total_programado: r2(Number(p.total_programado) + diferencia),
  };
  if (d.guardar_tasa && d.tasa_nueva !== undefined && d.tasa_nueva !== null) {
    cambiosPrestamo.tasa_interes = Number(d.tasa_nueva);
  }
  if (d.fecha_vencimiento) {
    const { data: ultima } = await sb
      .from("ia_cuotas")
      .select("fecha_vencimiento")
      .eq("prestamo_id", p.id)
      .eq("activa", true)
      .order("fecha_vencimiento", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (ultima?.fecha_vencimiento) cambiosPrestamo.fecha_fin_estimada = ultima.fecha_vencimiento;
  }
  await sb.from("ia_prestamos").update(cambiosPrestamo).eq("id", p.id);

  await sincronizarEstado(p.id);

  const { data: cuotaFinal } = await sb.from("ia_cuotas").select("*").eq("id", c.id).single();
  return {
    cuota: cuotaFinal,
    interes_anterior: interesAnterior,
    interes_nuevo: interesNuevo,
    diferencia,
    capital_pendiente: capitalPendiente,
    tasa_guardada: !!cambiosPrestamo.tasa_interes,
  };
}

// ─── REENGANCHE ──────────────────────────────────────────────────────────────
export interface DatosReenganche {
  prestamo_id: string;
  fecha: string;
  monto_adicional: number;
  capitalizar_interes?: boolean;
  tasa_interes: number;
  num_cuotas: number;
  frecuencia?: Frecuencia;
  dias_periodo?: number;
  metodo?: Metodo;
  fecha_primer_pago: string;
  notas?: string;
  usuario?: string;
}

export async function aplicarReenganche(d: DatosReenganche) {
  const sb = createAdminClient();
  const prorrateo = await prorrateoConfigurado();

  const { data: prestamo, error: ep } = await sb
    .from("ia_prestamos")
    .select("*")
    .eq("id", d.prestamo_id)
    .single();
  if (ep) throw ep;
  const p = prestamo as FilaPrestamo;

  const { data: cuotasRaw } = await sb
    .from("ia_cuotas")
    .select("*")
    .eq("prestamo_id", d.prestamo_id)
    .eq("activa", true);
  const activas = (cuotasRaw ?? []) as FilaCuota[];

  const frecuencia = d.frecuencia ?? p.frecuencia;
  const dias = d.dias_periodo ?? diasDeFrecuencia(frecuencia);

  const calc = calcularReenganche({
    cuotasActivas: activas as unknown as CuotaEstado[],
    montoAdicional: Number(d.monto_adicional),
    capitalizarInteresPendiente: !!d.capitalizar_interes,
    tasaInteres: Number(d.tasa_interes),
    numCuotas: Number(d.num_cuotas),
    frecuencia,
    diasPeriodo: dias,
    metodo: d.metodo ?? p.metodo,
    fechaPrimerPago: d.fecha_primer_pago,
    prorrateo,
  });

  const cicloNuevo = Number(p.ciclo) + 1;

  // Cierra el ciclo anterior conservando todo lo ya pagado
  for (const c of activas) {
    const pagado = r2(Number(c.capital_pagado) + Number(c.interes_pagado));
    if (pagado > 0) {
      await sb
        .from("ia_cuotas")
        .update({
          capital: Number(c.capital_pagado),
          interes: Number(c.interes_pagado),
          total: pagado,
          estado: "pagada",
          notas: `Liquidada por el reenganche del ${d.fecha}.`,
        })
        .eq("id", c.id);
    } else {
      await sb
        .from("ia_cuotas")
        .update({
          activa: false,
          estado: "reemplazada",
          notas: `Reemplazada por el reenganche del ${d.fecha}.`,
        })
        .eq("id", c.id);
    }
  }

  const filas = calc.cronograma.cuotas.map((c) => ({
    prestamo_id: p.id,
    ciclo: cicloNuevo,
    numero: c.numero,
    fecha_vencimiento: c.fecha_vencimiento,
    capital: c.capital,
    interes: c.interes,
    total: c.total,
    saldo_despues: c.saldo_despues,
    origen: "reenganche",
  }));
  const { error: e2 } = await sb.from("ia_cuotas").insert(filas);
  if (e2) throw e2;

  await sb.from("ia_reenganches").insert({
    prestamo_id: p.id,
    fecha: d.fecha,
    monto_adicional: Number(d.monto_adicional),
    saldo_capital_previo: calc.saldoCapitalPrevio,
    interes_capitalizado: d.capitalizar_interes ? calc.interesPendiente : 0,
    capital_nuevo: calc.capitalNuevo,
    tasa_previa: Number(p.tasa_interes),
    tasa_nueva: Number(d.tasa_interes),
    num_cuotas_nuevas: Number(d.num_cuotas),
    frecuencia_nueva: frecuencia,
    ciclo_previo: Number(p.ciclo),
    ciclo_nuevo: cicloNuevo,
    notas: d.notas || null,
    usuario: d.usuario || null,
  });

  await sb
    .from("ia_prestamos")
    .update({
      capital: calc.capitalNuevo,
      tasa_interes: Number(d.tasa_interes),
      metodo: d.metodo ?? p.metodo,
      frecuencia,
      dias_periodo: dias,
      num_cuotas: Number(d.num_cuotas),
      fecha_primer_pago: d.fecha_primer_pago,
      fecha_fin_estimada: calc.cronograma.fechaFin,
      monto_cuota: calc.cronograma.montoCuota,
      interes_programado: calc.cronograma.interesTotal,
      total_programado: calc.cronograma.totalAPagar,
      estado: "activo",
      ciclo: cicloNuevo,
    })
    .eq("id", p.id);

  return calc;
}

// ─── ANULAR PAGO ─────────────────────────────────────────────────────────────
export async function anularPago(pagoId: string) {
  const sb = createAdminClient();

  const { data: pago, error } = await sb
    .from("ia_pagos")
    .select("*")
    .eq("id", pagoId)
    .eq("anulado", false)
    .single();
  if (error || !pago) throw new Error("Pago no encontrado o ya anulado");

  if (pago.cuota_id) {
    const { data: c } = await sb.from("ia_cuotas").select("*").eq("id", pago.cuota_id).single();
    if (c) {
      const capital = Math.max(0, r2(Number(c.capital_pagado) - Number(pago.monto_capital)));
      const interes = Math.max(0, r2(Number(c.interes_pagado) - Number(pago.monto_interes)));
      const mora    = Math.max(0, r2(Number(c.mora_pagada)    - Number(pago.monto_mora)));
      const saldada =
        capital >= Number(c.capital) - 0.01 && interes >= Number(c.interes) - 0.01;

      await sb
        .from("ia_cuotas")
        .update({
          capital_pagado: capital,
          interes_pagado: interes,
          mora_pagada: mora,
          estado: saldada ? "pagada" : capital + interes > 0 ? "parcial" : "pendiente",
          fecha_pago: saldada ? c.fecha_pago : null,
        })
        .eq("id", c.id);
    }
  }

  await sb.from("ia_distribuciones").delete().eq("pago_id", pagoId);
  await sb.from("ia_pagos").update({ anulado: true }).eq("id", pagoId);
  await sincronizarEstado(pago.prestamo_id);

  return { ok: true };
}

// ─── ELIMINAR UN PRÉSTAMO ────────────────────────────────────────────────────
export interface DatosEliminarPrestamo {
  id: string;
  /** Borrar aunque ya tenga pagos cobrados. */
  forzar?: boolean;
}

/**
 * Borra un préstamo con todo lo que cuelga de él.
 *
 * Las llaves foráneas de cuotas, pagos, distribuciones y reenganches son
 * `on delete cascade`, así que basta con borrar la fila del préstamo: la base
 * se lleva el resto sola, en una sola operación y sin dejar huérfanos.
 *
 * Si el préstamo ya tiene dinero cobrado hace falta confirmar, porque al
 * borrarlo desaparecen también las distribuciones y la ganancia que ya se le
 * había repartido al inversionista.
 */
export async function eliminarPrestamo(d: DatosEliminarPrestamo) {
  const sb = createAdminClient();

  const { data: p } = await sb
    .from("ia_v_prestamos")
    .select("id,codigo,cliente_nombre,inversionista_nombre,capital,total_cobrado")
    .eq("id", d.id)
    .single();
  if (!p) throw new Error("Ese préstamo ya no existe.");

  const [{ count: pagos }, { count: cuotas }, { count: distribuciones }] = await Promise.all([
    sb.from("ia_pagos").select("id", { count: "exact", head: true })
      .eq("prestamo_id", d.id).eq("anulado", false),
    sb.from("ia_cuotas").select("id", { count: "exact", head: true }).eq("prestamo_id", d.id),
    sb.from("ia_distribuciones").select("id", { count: "exact", head: true }).eq("prestamo_id", d.id),
  ]);

  const cobrado = r2(Number(p.total_cobrado ?? 0));

  if ((pagos ?? 0) > 0 && !d.forzar) {
    throw new Error(
      `El préstamo ${p.codigo} de ${p.cliente_nombre} tiene ${pagos} pago(s) cobrados por ` +
      `${cobrado.toLocaleString("es-DO", { minimumFractionDigits: 2 })}. ` +
      "Al borrarlo se van también esos pagos y la ganancia que ya se le repartió " +
      (p.inversionista_nombre ? `a ${p.inversionista_nombre}. ` : "al inversionista. ") +
      "Confirma para borrarlo de todos modos."
    );
  }

  const { error } = await sb.from("ia_prestamos").delete().eq("id", d.id);
  if (error) throw error;

  return {
    ok: true,
    codigo: p.codigo,
    cliente: p.cliente_nombre,
    cuotas_borradas: cuotas ?? 0,
    pagos_borrados: pagos ?? 0,
    distribuciones_borradas: distribuciones ?? 0,
  };
}

// ─── ELIMINAR UN CLIENTE ─────────────────────────────────────────────────────
export interface DatosEliminarCliente {
  id: string;
  /** Borrar aunque tenga préstamos o pagos en el historial. */
  forzar?: boolean;
}

/**
 * Saca un cliente del sistema con todo su historial.
 *
 * `ia_prestamos.cliente_id` es `on delete restrict`, así que primero se borran
 * sus préstamos —y con ellos, en cascada, cuotas, pagos, distribuciones y
 * reenganches— y al final la ficha del cliente.
 *
 * Con préstamos activos no se borra: ese dinero todavía está en la calle.
 */
export async function eliminarCliente(d: DatosEliminarCliente) {
  const sb = createAdminClient();

  const { data: cl } = await sb
    .from("ia_clientes").select("id,nombre,codigo").eq("id", d.id).single();
  if (!cl) throw new Error("Ese cliente ya no existe.");

  const { data: prestamosRaw } = await sb
    .from("ia_v_prestamos")
    .select("id,codigo,estado,saldo_total,total_cobrado")
    .eq("cliente_id", d.id);

  const lista = (prestamosRaw ?? []) as {
    id: string; codigo: string; estado: string;
    saldo_total: number; total_cobrado: number;
  }[];

  const activos = lista.filter((p) => p.estado === "activo");
  if (activos.length > 0) {
    const debe = r2(activos.reduce((a, p) => a + Number(p.saldo_total ?? 0), 0));
    throw new Error(
      `${cl.nombre} tiene ${activos.length} préstamo(s) activo(s) y todavía debe ` +
      `${debe.toLocaleString("es-DO", { minimumFractionDigits: 2 })} ` +
      `(${activos.slice(0, 4).map((p) => p.codigo).join(", ")}${activos.length > 4 ? "…" : ""}). ` +
      "No se puede borrar mientras ese dinero se siga cobrando. " +
      "Cancela o termina de cobrar esos préstamos y vuelve a intentarlo."
    );
  }

  const cobrado = r2(lista.reduce((a, p) => a + Number(p.total_cobrado ?? 0), 0));

  if (lista.length > 0 && !d.forzar) {
    throw new Error(
      `${cl.nombre} tiene ${lista.length} préstamo(s) en el historial con ` +
      `${cobrado.toLocaleString("es-DO", { minimumFractionDigits: 2 })} ya cobrados. ` +
      "Al borrarlo se van también sus cuotas, sus pagos, sus recibos y la ganancia " +
      "que esos préstamos le repartieron a los inversionistas. " +
      "Confirma para borrarlo todo."
    );
  }

  if (lista.length > 0) {
    const { error: ep } = await sb
      .from("ia_prestamos").delete().in("id", lista.map((p) => p.id));
    if (ep) throw ep;
  }

  const { error } = await sb.from("ia_clientes").delete().eq("id", d.id);
  if (error) throw error;

  return {
    ok: true,
    nombre: cl.nombre,
    codigo: cl.codigo,
    prestamos_borrados: lista.length,
  };
}
