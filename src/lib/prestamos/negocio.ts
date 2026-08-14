/**
 * Datos del negocio de préstamos usados en pantallas y estados de cuenta.
 * Los valores por defecto se pueden sobreescribir desde .env o desde pr_config.
 */

export const PRESTAMOS_NEGOCIO = {
  nombre:    process.env.NEXT_PUBLIC_PRESTAMOS_NOMBRE    ?? "CGSSOLUTIONS",
  slogan:    process.env.NEXT_PUBLIC_PRESTAMOS_SLOGAN    ?? "Préstamos y gestión de cartera",
  telefono:  process.env.NEXT_PUBLIC_PRESTAMOS_TELEFONO  ?? "",
  rnc:       process.env.NEXT_PUBLIC_PRESTAMOS_RNC       ?? "",
  direccion: process.env.NEXT_PUBLIC_PRESTAMOS_DIRECCION ?? "",
  logo:      process.env.NEXT_PUBLIC_PRESTAMOS_LOGO      ?? "",
} as const;

/** Mezcla lo guardado en pr_config con los valores por defecto. */
export function negocioDesdeConfig(config: Record<string, unknown> | undefined) {
  return {
    nombre:    (config?.nombre_empresa as string) || PRESTAMOS_NEGOCIO.nombre,
    slogan:    PRESTAMOS_NEGOCIO.slogan,
    telefono:  (config?.telefono as string)  || PRESTAMOS_NEGOCIO.telefono,
    rnc:       (config?.rnc as string)       || PRESTAMOS_NEGOCIO.rnc,
    direccion: (config?.direccion as string) || PRESTAMOS_NEGOCIO.direccion,
    logo:      (config?.logo_url as string)  || PRESTAMOS_NEGOCIO.logo,
    simbolo:   (config?.simbolo_moneda as string) || "RD$",
  };
}

export type NegocioPrestamos = ReturnType<typeof negocioDesdeConfig>;
