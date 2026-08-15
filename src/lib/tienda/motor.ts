import { createAdminClient } from "@/lib/supabase/server";

/**
 * Lógica de negocio de MAXMATT SHOP.
 * Todo corre en el servidor con la service role key.
 *
 * Los totales de facturas y compras los recalculan los triggers de la base
 * (ti_tg_totales_venta / ti_tg_totales_compra), así que aquí solo se insertan
 * las líneas y luego se vuelve a leer el documento ya cuadrado.
 */

const r2 = (n: number) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/**
 * Sesión de caja abierta en este momento.
 * Un movimiento de caja sin sesión no aparece en el cuadre del día, así que
 * todo lo que se inserta a mano tiene que amarrarse a la caja abierta igual
 * que lo hace el trigger de los cobros.
 */
async function sesionCajaAbierta(): Promise<string | null> {
  const sb = createAdminClient();
  const { data } = await sb
    .from("ti_caja_sesiones")
    .select("id")
    .eq("estado", "abierta")
    .order("fecha_apertura", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

export interface LineaDocumento {
  producto_id: string;
  descripcion?: string;
  cantidad: number;
  precio?: number;      // ventas — SIN ITBIS
  costo?: number;       // compras (y costo histórico en ventas)
  itbis_pct?: number;
  descuento?: number;
}

/* ================================================================== */
/* VENTAS                                                              */
/* ================================================================== */

export interface DatosVenta {
  cliente_id?: string | null;
  fecha?: string;
  ncf?: string;
  condicion?: "contado" | "credito";
  fecha_vence?: string | null;
  descuento?: number;
  metodo_pago?: string;
  notas?: string;
  usuario?: string;
  items: LineaDocumento[];
}

export async function crearVenta(d: DatosVenta) {
  const sb = createAdminClient();
  if (!d.items?.length) throw new Error("La factura no tiene productos.");

  const condicion = d.condicion ?? "contado";
  const fecha = d.fecha ?? new Date().toISOString().slice(0, 10);

  // 1. Traer los productos para validar existencia y fijar costo/precio reales
  const ids = [...new Set(d.items.map((i) => i.producto_id))];
  const { data: productos, error: ep } = await sb
    .from("ti_productos")
    .select("id,nombre,codigo,precio,costo,itbis_pct,stock_actual")
    .in("id", ids);
  if (ep) throw ep;

  const mapa = new Map(
    ((productos ?? []) as Record<string, unknown>[]).map((p) => [String(p.id), p])
  );

  // 2. No dejar vender lo que no hay
  const faltantes: string[] = [];
  for (const id of ids) {
    const p = mapa.get(id);
    if (!p) throw new Error("Uno de los productos ya no existe.");
    const pedido = d.items
      .filter((i) => i.producto_id === id)
      .reduce((a, i) => a + Number(i.cantidad), 0);
    if (Number(p.stock_actual) < pedido) {
      faltantes.push(`${p.nombre}: hay ${Number(p.stock_actual)}, pides ${pedido}`);
    }
  }
  if (faltantes.length) {
    throw new Error(`No hay suficiente inventario. ${faltantes.join(" · ")}`);
  }

  // 3. Caja abierta (para que la venta quede amarrada al cuadre del día)
  const { data: sesion } = await sb
    .from("ti_caja_sesiones")
    .select("id")
    .eq("estado", "abierta")
    .order("fecha_apertura", { ascending: false })
    .limit(1)
    .maybeSingle();

  // 4. Cabecera
  const { data: venta, error: ev } = await sb
    .from("ti_ventas")
    .insert({
      cliente_id: d.cliente_id || null,
      fecha,
      ncf: d.ncf || null,
      condicion,
      fecha_vence: condicion === "credito" ? (d.fecha_vence ?? null) : null,
      descuento: r2(Number(d.descuento ?? 0)),
      metodo_pago: condicion === "credito" ? "credito" : (d.metodo_pago ?? "efectivo"),
      estado: "pendiente",
      caja_sesion_id: sesion?.id ?? null,
      notas: d.notas || null,
      usuario: d.usuario || null,
    })
    .select()
    .single();
  if (ev) throw ev;

  try {
    // 5. Líneas — los triggers recalculan subtotal, ITBIS, total y costo
    const lineas = d.items.map((i) => {
      const p = mapa.get(i.producto_id)!;
      const precio = Number(i.precio ?? p.precio ?? 0);
      const itbis = Number(i.itbis_pct ?? p.itbis_pct ?? 0);
      const desc = Number(i.descuento ?? 0);
      return {
        venta_id: venta.id,
        producto_id: i.producto_id,
        descripcion: i.descripcion || String(p.nombre ?? ""),
        // La línea guarda su propia identidad: si el artículo se borra del
        // catálogo, la factura sigue mostrando qué se vendió.
        codigo_articulo: String(p.codigo ?? ""),
        cantidad: Number(i.cantidad),
        precio,
        costo: Number(i.costo ?? p.costo ?? 0),
        itbis_pct: itbis,
        descuento: desc,
        importe: r2(Number(i.cantidad) * precio - desc),
      };
    });
    const { error: ei } = await sb.from("ti_venta_items").insert(lineas);
    if (ei) throw ei;

    // 6. Descargar el inventario
    const movs = lineas.map((l) => ({
      producto_id: l.producto_id,
      fecha,
      tipo: "salida",
      cantidad: l.cantidad,
      origen: "venta",
      origen_id: venta.id,
      referencia: venta.codigo,
      usuario: d.usuario || null,
    }));
    const { error: em } = await sb.from("ti_movimientos_inventario").insert(movs);
    if (em) throw em;

    // 7. Releer el total ya calculado por el trigger
    const { data: actualizada } = await sb
      .from("ti_ventas").select("*").eq("id", venta.id).single();
    const total = Number(actualizada?.total ?? 0);

    // 8. Si es de contado, se cobra completo (el trigger lo lleva a caja)
    if (condicion === "contado" && total > 0) {
      const { error: ec } = await sb.from("ti_cobros").insert({
        venta_id: venta.id,
        cliente_id: d.cliente_id || null,
        fecha,
        monto: total,
        metodo_pago: d.metodo_pago ?? "efectivo",
        notas: "Cobro automático de venta al contado",
        usuario: d.usuario || null,
      });
      if (ec) throw ec;
    }

    const { data: final } = await sb
      .from("ti_v_ventas").select("*").eq("id", venta.id).single();
    return final ?? actualizada;
  } catch (e) {
    // Si algo falló a mitad, no dejar una factura coja
    await sb.from("ti_ventas").delete().eq("id", venta.id);
    throw e;
  }
}

/** Anula una venta: devuelve el inventario y deja los cobros sin efecto. */
export async function anularVenta(id: string, usuario?: string) {
  const sb = createAdminClient();

  const { data: venta } = await sb.from("ti_ventas").select("*").eq("id", id).single();
  if (!venta) throw new Error("Factura no encontrada");
  if (venta.estado === "anulada") throw new Error("Esa factura ya está anulada");

  const { data: items } = await sb
    .from("ti_venta_items").select("producto_id,cantidad").eq("venta_id", id);

  // Devolver la mercancía (las líneas de artículos ya borrados se saltan)
  const vivos = ((items ?? []) as { producto_id: string | null; cantidad: number }[])
    .filter((it) => !!it.producto_id) as { producto_id: string; cantidad: number }[];
  for (const it of vivos) {
    await sb.from("ti_movimientos_inventario").insert({
      producto_id: it.producto_id,
      tipo: "devolucion",
      cantidad: it.cantidad,
      origen: "anulacion",
      origen_id: id,
      referencia: venta.codigo,
      notas: "Devolución por anulación de factura",
      usuario: usuario || null,
    });
  }

  // Revertir los cobros y su efecto en caja
  const { data: cobros } = await sb.from("ti_cobros").select("id,monto,recibo").eq("venta_id", id).eq("anulado", false);
  const sesionAnular = await sesionCajaAbierta();
  for (const c of (cobros ?? []) as { id: string; monto: number; recibo: string }[]) {
    await sb.from("ti_cobros").update({ anulado: true }).eq("id", c.id);
    await sb.from("ti_caja_movimientos").insert({
      sesion_id: sesionAnular,
      tipo: "egreso",
      categoria: "anulacion",
      concepto: `Reverso del cobro ${c.recibo} (factura ${venta.codigo} anulada)`,
      monto: c.monto,
      origen: "manual",
      origen_id: c.id,
      usuario: usuario || null,
    });
  }

  await sb.from("ti_ventas").update({ estado: "anulada", pagado: 0 }).eq("id", id);
  return { ok: true };
}

/* ================================================================== */
/* COMPRAS                                                             */
/* ================================================================== */

export interface DatosCompra {
  proveedor_id?: string | null;
  fecha?: string;
  ncf?: string;
  condicion?: "contado" | "credito";
  fecha_vence?: string | null;
  descuento?: number;
  metodo_pago?: string;
  notas?: string;
  usuario?: string;
  items: LineaDocumento[];
}

export async function crearCompra(d: DatosCompra) {
  const sb = createAdminClient();
  if (!d.items?.length) throw new Error("La compra no tiene productos.");

  const condicion = d.condicion ?? "contado";
  const fecha = d.fecha ?? new Date().toISOString().slice(0, 10);

  const { data: compra, error: ec } = await sb
    .from("ti_compras")
    .insert({
      proveedor_id: d.proveedor_id || null,
      fecha,
      ncf: d.ncf || null,
      condicion,
      fecha_vence: condicion === "credito" ? (d.fecha_vence ?? null) : null,
      descuento: r2(Number(d.descuento ?? 0)),
      estado: "pendiente",
      notas: d.notas || null,
      usuario: d.usuario || null,
    })
    .select()
    .single();
  if (ec) throw ec;

  try {
    // Traer nombre y código para dejarlos escritos en la línea: si el
    // artículo se borra después, la compra sigue diciendo qué se compró.
    const idsCompra = [...new Set(d.items.map((i) => i.producto_id))];
    const { data: prods } = await sb
      .from("ti_productos").select("id,codigo,nombre").in("id", idsCompra);
    const mapaCompra = new Map(
      ((prods ?? []) as Record<string, unknown>[]).map((p) => [String(p.id), p])
    );

    const lineas = d.items.map((i) => {
      const costo = Number(i.costo ?? 0);
      const p = mapaCompra.get(i.producto_id);
      return {
        compra_id: compra.id,
        producto_id: i.producto_id,
        descripcion: i.descripcion || String(p?.nombre ?? ""),
        codigo_articulo: String(p?.codigo ?? ""),
        cantidad: Number(i.cantidad),
        costo,
        itbis_pct: Number(i.itbis_pct ?? 0),
        importe: r2(Number(i.cantidad) * costo),
      };
    });
    const { error: ei } = await sb.from("ti_compra_items").insert(lineas);
    if (ei) throw ei;

    // Entrada al inventario: sube el stock y actualiza el costo del producto
    const movs = lineas.map((l) => ({
      producto_id: l.producto_id,
      fecha,
      tipo: "entrada",
      cantidad: l.cantidad,
      costo_unitario: l.costo,
      origen: "compra",
      origen_id: compra.id,
      referencia: compra.codigo,
      usuario: d.usuario || null,
    }));
    const { error: em } = await sb.from("ti_movimientos_inventario").insert(movs);
    if (em) throw em;

    const { data: actualizada } = await sb
      .from("ti_compras").select("*").eq("id", compra.id).single();
    const total = Number(actualizada?.total ?? 0);

    if (condicion === "contado" && total > 0) {
      const { error: ep } = await sb.from("ti_pagos_proveedor").insert({
        compra_id: compra.id,
        proveedor_id: d.proveedor_id || null,
        fecha,
        monto: total,
        metodo_pago: d.metodo_pago ?? "efectivo",
        notas: "Pago automático de compra al contado",
        usuario: d.usuario || null,
      });
      if (ep) throw ep;
    }

    const { data: final } = await sb
      .from("ti_v_compras").select("*").eq("id", compra.id).single();
    return final ?? actualizada;
  } catch (e) {
    await sb.from("ti_compras").delete().eq("id", compra.id);
    throw e;
  }
}

/* ================================================================== */
/* CAJA                                                                */
/* ================================================================== */

export async function abrirCaja(monto_inicial: number, usuario?: string) {
  const sb = createAdminClient();

  const { data: abierta } = await sb
    .from("ti_caja_sesiones").select("id").eq("estado", "abierta").maybeSingle();
  if (abierta) throw new Error("Ya hay una caja abierta. Ciérrala antes de abrir otra.");

  const { data, error } = await sb
    .from("ti_caja_sesiones")
    .insert({ monto_inicial: r2(Number(monto_inicial ?? 0)), abierta_por: usuario || null })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function cerrarCaja(sesion_id: string, monto_contado: number, notas?: string, usuario?: string) {
  const sb = createAdminClient();

  const { data: s } = await sb
    .from("ti_v_caja_actual").select("*").eq("id", sesion_id).single();
  if (!s) throw new Error("Sesión de caja no encontrada");
  if (s.estado === "cerrada") throw new Error("Esa caja ya está cerrada");

  const esperado = r2(Number(s.efectivo_esperado ?? 0));
  const contado = r2(Number(monto_contado ?? 0));

  const { data, error } = await sb
    .from("ti_caja_sesiones")
    .update({
      fecha_cierre: new Date().toISOString(),
      monto_contado: contado,
      esperado_cierre: esperado,
      diferencia: r2(contado - esperado),
      estado: "cerrada",
      notas: notas || null,
      cerrada_por: usuario || null,
    })
    .eq("id", sesion_id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/* ================================================================== */
/* EDITAR Y ELIMINAR FACTURAS                                          */
/* ================================================================== */

/** Devuelve al inventario todo lo que salió por una factura. */
async function devolverInventario(ventaId: string, codigo: string, usuario?: string) {
  const sb = createAdminClient();
  const { data: items } = await sb
    .from("ti_venta_items").select("producto_id,cantidad").eq("venta_id", ventaId);

  // Si el artículo ya se borró del catálogo no hay a dónde devolverle nada,
  // así que esa línea se salta y el resto de la factura sí se revierte.
  const vivos = ((items ?? []) as { producto_id: string | null; cantidad: number }[])
    .filter((it) => !!it.producto_id) as { producto_id: string; cantidad: number }[];

  for (const it of vivos) {
    await sb.from("ti_movimientos_inventario").insert({
      producto_id: it.producto_id,
      tipo: "devolucion",
      cantidad: it.cantidad,
      origen: "anulacion",
      origen_id: ventaId,
      referencia: codigo,
      notas: "Reverso por edición o borrado de la factura",
      usuario: usuario || null,
    });
  }
}

/**
 * Modifica una factura ya guardada: cambia sus líneas y sus datos.
 *
 * Como el inventario ya se movió, primero se devuelve todo lo que salió,
 * se borran las líneas viejas y se vuelve a aplicar con las nuevas. Los
 * cobros ya recibidos se respetan; solo se recalcula el estado.
 */
export async function editarVenta(id: string, d: DatosVenta) {
  const sb = createAdminClient();
  if (!d.items?.length) throw new Error("La factura no puede quedar sin productos.");

  const { data: venta, error: ev } = await sb.from("ti_ventas").select("*").eq("id", id).single();
  if (ev || !venta) throw new Error("Factura no encontrada");
  if (venta.estado === "anulada") throw new Error("No se puede editar una factura anulada");

  const fecha = d.fecha ?? venta.fecha;
  const condicion = d.condicion ?? venta.condicion;

  // 1. Qué salió con las líneas actuales: al editar eso vuelve al inventario,
  //    así que cuenta como disponible para las líneas nuevas.
  const { data: viejos } = await sb
    .from("ti_venta_items").select("producto_id,cantidad").eq("venta_id", id);
  const devuelto = new Map<string, number>();
  for (const it of (viejos ?? []) as { producto_id: string; cantidad: number }[]) {
    devuelto.set(it.producto_id, (devuelto.get(it.producto_id) ?? 0) + Number(it.cantidad));
  }

  // 2. Validar TODO antes de tocar nada: si algo falla, la factura queda intacta.
  const ids = [...new Set(d.items.map((i) => i.producto_id))];
  const { data: productos, error: ep } = await sb
    .from("ti_productos")
    .select("id,codigo,nombre,precio,costo,itbis_pct,stock_actual")
    .in("id", ids);
  if (ep) throw ep;

  const mapa = new Map(
    ((productos ?? []) as Record<string, unknown>[]).map((p) => [String(p.id), p])
  );

  const faltantes: string[] = [];
  for (const pid of ids) {
    const p = mapa.get(pid);
    if (!p) throw new Error("Uno de los productos de la factura ya no existe.");
    const pedido = d.items
      .filter((i) => i.producto_id === pid)
      .reduce((a, i) => a + Number(i.cantidad), 0);
    const disponible = Number(p.stock_actual) + (devuelto.get(pid) ?? 0);
    if (disponible < pedido) {
      faltantes.push(`${p.nombre}: quedan ${disponible}, pides ${pedido}`);
    }
  }
  if (faltantes.length) {
    throw new Error(`No hay suficiente inventario. ${faltantes.join(" · ")}`);
  }

  // 3. Ya validado: devolver la mercancía vieja y borrar sus líneas.
  await devolverInventario(id, venta.codigo, d.usuario);
  await sb.from("ti_venta_items").delete().eq("venta_id", id);

  // 4. Cabecera
  await sb
    .from("ti_ventas")
    .update({
      cliente_id: d.cliente_id === undefined ? venta.cliente_id : d.cliente_id || null,
      fecha,
      ncf: d.ncf ?? venta.ncf,
      condicion,
      fecha_vence: condicion === "credito" ? (d.fecha_vence ?? venta.fecha_vence) : null,
      descuento: r2(Number(d.descuento ?? venta.descuento ?? 0)),
      metodo_pago: condicion === "credito" ? "credito" : (d.metodo_pago ?? venta.metodo_pago),
      notas: d.notas ?? venta.notas,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  // 5. Líneas nuevas (los triggers recalculan los totales)
  const lineas = d.items.map((i) => {
    const p = mapa.get(i.producto_id)!;
    const precio = Number(i.precio ?? p.precio ?? 0);
    const desc = Number(i.descuento ?? 0);
    return {
      venta_id: id,
      producto_id: i.producto_id,
      descripcion: i.descripcion || String(p.nombre ?? ""),
      codigo_articulo: String(p.codigo ?? ""),
      cantidad: Number(i.cantidad),
      precio,
      costo: Number(i.costo ?? p.costo ?? 0),
      itbis_pct: Number(i.itbis_pct ?? p.itbis_pct ?? 0),
      descuento: desc,
      importe: r2(Number(i.cantidad) * precio - desc),
    };
  });
  const { error: ei } = await sb.from("ti_venta_items").insert(lineas);
  if (ei) throw ei;

  // 6. Volver a descargar el inventario
  const { error: em } = await sb.from("ti_movimientos_inventario").insert(
    lineas.map((l) => ({
      producto_id: l.producto_id,
      fecha,
      tipo: "salida",
      cantidad: l.cantidad,
      origen: "venta",
      origen_id: id,
      referencia: venta.codigo,
      usuario: d.usuario || null,
    }))
  );
  if (em) throw em;

  // 7. Cuadrar el dinero: en una venta de contado la caja tiene que reflejar
  //    el total nuevo, no el viejo.
  const { data: final } = await sb.from("ti_ventas").select("total,pagado").eq("id", id).single();
  const total = r2(Number(final?.total ?? 0));
  let pagado = r2(Number(final?.pagado ?? 0));

  if (condicion === "contado" && Math.abs(total - pagado) > 0.01) {
    const dif = r2(total - pagado);

    if (dif > 0) {
      // Subió el monto: entra la diferencia a la caja.
      await sb.from("ti_cobros").insert({
        venta_id: id,
        cliente_id: d.cliente_id === undefined ? venta.cliente_id : d.cliente_id || null,
        fecha,
        monto: dif,
        metodo_pago: d.metodo_pago ?? venta.metodo_pago ?? "efectivo",
        notas: `Diferencia por modificación de la factura ${venta.codigo}`,
        usuario: d.usuario || null,
      });
    } else {
      // Bajó el monto: hay que devolverle dinero al cliente. Se anulan los
      // cobros viejos, se saca de la caja lo que había entrado y se vuelve a
      // cobrar el total nuevo, para que quede el rastro completo.
      const { data: vivos } = await sb
        .from("ti_cobros").select("id,monto,recibo").eq("venta_id", id).eq("anulado", false);
      const cobrado = r2(
        ((vivos ?? []) as { monto: number }[]).reduce((a, c) => a + Number(c.monto), 0)
      );

      if (cobrado > 0) {
        await sb.from("ti_cobros").update({ anulado: true }).eq("venta_id", id).eq("anulado", false);
        await sb.from("ti_caja_movimientos").insert({
          sesion_id: await sesionCajaAbierta(),
          fecha,
          tipo: "egreso",
          categoria: "anulacion",
          concepto: `Reverso de cobros de la factura ${venta.codigo} (se modificó)`,
          monto: cobrado,
          origen: "manual",
          usuario: d.usuario || null,
        });
      }

      if (total > 0) {
        await sb.from("ti_cobros").insert({
          venta_id: id,
          cliente_id: d.cliente_id === undefined ? venta.cliente_id : d.cliente_id || null,
          fecha,
          monto: total,
          metodo_pago: d.metodo_pago ?? venta.metodo_pago ?? "efectivo",
          notas: `Cobro del nuevo total de la factura ${venta.codigo}`,
          usuario: d.usuario || null,
        });
      }
    }

    const { data: recontado } = await sb.from("ti_ventas").select("pagado").eq("id", id).single();
    pagado = r2(Number(recontado?.pagado ?? 0));
  }

  // 8. Estado final según lo que quedó cobrado
  await sb
    .from("ti_ventas")
    .update({
      estado: pagado >= total - 0.01 ? "pagada" : pagado > 0 ? "parcial" : "pendiente",
    })
    .eq("id", id);

  const { data: vista } = await sb.from("ti_v_ventas").select("*").eq("id", id).single();
  return vista;
}

/**
 * Borra una factura de forma definitiva.
 * Devuelve la mercancía, quita el dinero de la caja y elimina el registro.
 * Para conservar el historial usa anularVenta() en su lugar.
 */
export async function eliminarVenta(id: string, usuario?: string) {
  const sb = createAdminClient();

  const { data: venta } = await sb.from("ti_ventas").select("*").eq("id", id).single();
  if (!venta) throw new Error("Factura no encontrada");

  // 1. Devolver la mercancía (solo si no estaba ya anulada)
  if (venta.estado !== "anulada") {
    await devolverInventario(id, venta.codigo, usuario);
  }

  // 2. Sacar de la caja el dinero que había entrado por esta factura
  const { data: cobros } = await sb
    .from("ti_cobros").select("id,monto,recibo").eq("venta_id", id).eq("anulado", false);
  const sesionBorrar = await sesionCajaAbierta();
  for (const c of (cobros ?? []) as { id: string; monto: number; recibo: string }[]) {
    await sb.from("ti_caja_movimientos").insert({
      sesion_id: sesionBorrar,
      tipo: "egreso",
      categoria: "anulacion",
      concepto: `Reverso del cobro ${c.recibo} (factura ${venta.codigo} eliminada)`,
      monto: c.monto,
      origen: "manual",
      origen_id: c.id,
      usuario: usuario || null,
    });
  }

  // 3. Soltar las referencias en caja para no perder el rastro del movimiento
  await sb.from("ti_caja_movimientos").update({ origen_id: null }).eq("origen_id", id);

  // 4. Borrar: los items y los cobros se van en cascada
  const { error } = await sb.from("ti_ventas").delete().eq("id", id);
  if (error) throw error;

  return { ok: true, codigo: venta.codigo };
}
