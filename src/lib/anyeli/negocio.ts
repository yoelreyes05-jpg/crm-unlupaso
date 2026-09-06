/**
 * Datos del negocio de préstamos usados en pantallas y estados de cuenta.
 * Los valores por defecto se pueden sobreescribir desde .env o desde ia_config.
 */

export const ANYELI_NEGOCIO = {
  nombre:    process.env.NEXT_PUBLIC_ANYELI_NOMBRE    ?? "INVERSIONES ANYELI",
  slogan:    process.env.NEXT_PUBLIC_ANYELI_SLOGAN    ?? "Préstamos y gestión de cartera",
  telefono:  process.env.NEXT_PUBLIC_ANYELI_TELEFONO  ?? "",
  rnc:       process.env.NEXT_PUBLIC_ANYELI_RNC       ?? "",
  direccion: process.env.NEXT_PUBLIC_ANYELI_DIRECCION ?? "",
  logo:      process.env.NEXT_PUBLIC_ANYELI_LOGO      ?? "",
} as const;

/** Mezcla lo guardado en ia_config con los valores por defecto. */
export function negocioDesdeConfig(config: Record<string, unknown> | undefined) {
  return {
    nombre:    (config?.nombre_empresa as string) || ANYELI_NEGOCIO.nombre,
    slogan:    ANYELI_NEGOCIO.slogan,
    telefono:  (config?.telefono as string)  || ANYELI_NEGOCIO.telefono,
    rnc:       (config?.rnc as string)       || ANYELI_NEGOCIO.rnc,
    direccion: (config?.direccion as string) || ANYELI_NEGOCIO.direccion,
    logo:      (config?.logo_url as string)  || ANYELI_NEGOCIO.logo,
    simbolo:   (config?.simbolo_moneda as string) || "RD$",
  };
}

export type NegocioAnyeli = ReturnType<typeof negocioDesdeConfig>;
