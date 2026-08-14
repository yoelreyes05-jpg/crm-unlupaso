/**
 * Datos de MAXMATT SHOP usados en pantallas, facturas y recibos.
 * Los valores por defecto se pueden sobreescribir desde .env o desde ti_config.
 */

export const TIENDA = {
  nombre:    process.env.NEXT_PUBLIC_TIENDA_NOMBRE    ?? "MAXMATT SHOP",
  slogan:    process.env.NEXT_PUBLIC_TIENDA_SLOGAN    ?? "Tienda",
  telefono:  process.env.NEXT_PUBLIC_TIENDA_TELEFONO  ?? "",
  rnc:       process.env.NEXT_PUBLIC_TIENDA_RNC       ?? "",
  direccion: process.env.NEXT_PUBLIC_TIENDA_DIRECCION ?? "",
  logo:      process.env.NEXT_PUBLIC_TIENDA_LOGO      ?? "",
} as const;

/** Mezcla lo guardado en ti_config con los valores por defecto. */
export function negocioTienda(config: Record<string, unknown> | undefined) {
  return {
    nombre:    (config?.nombre_empresa as string) || TIENDA.nombre,
    slogan:    (config?.slogan as string)         || TIENDA.slogan,
    telefono:  (config?.telefono as string)       || TIENDA.telefono,
    telefono2: (config?.telefono2 as string)      || "",
    rnc:       (config?.rnc as string)            || TIENDA.rnc,
    direccion: (config?.direccion as string)      || TIENDA.direccion,
    email:     (config?.email as string)          || "",
    logo:      (config?.logo_url as string)       || TIENDA.logo,
    simbolo:   (config?.simbolo_moneda as string) || "RD$",
    pie:       (config?.pie_factura as string)    || "",
  };
}

export type NegocioTienda = ReturnType<typeof negocioTienda>;

export const CATEGORIAS_GASTO = [
  "general", "alquiler", "servicios", "nomina", "transporte",
  "publicidad", "mantenimiento", "impuestos", "otro",
] as const;

export const METODOS_PAGO = [
  { valor: "efectivo",      etiqueta: "Efectivo" },
  { valor: "transferencia", etiqueta: "Transferencia" },
  { valor: "tarjeta",       etiqueta: "Tarjeta" },
  { valor: "cheque",        etiqueta: "Cheque" },
  { valor: "otro",          etiqueta: "Otro" },
] as const;
