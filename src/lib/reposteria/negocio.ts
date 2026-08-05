/**
 * Datos de CROW EVENTS usados en pantallas, recibos y facturas.
 * Los valores por defecto se pueden sobreescribir desde .env o desde rep_config.
 */

export const CROW = {
  nombre:    process.env.NEXT_PUBLIC_CROW_NOMBRE    ?? "CROW EVENTS",
  slogan:    process.env.NEXT_PUBLIC_CROW_SLOGAN    ?? "Endulzando tu paladar",
  telefono:  process.env.NEXT_PUBLIC_CROW_TELEFONO  ?? "829-404-1644",
  rnc:       process.env.NEXT_PUBLIC_CROW_RNC       ?? "",
  direccion: process.env.NEXT_PUBLIC_CROW_DIRECCION ?? "",
  logo:      process.env.NEXT_PUBLIC_CROW_LOGO      ?? "/crow-events-logo.png",
} as const;

/** Mezcla los valores de rep_config con los de por defecto. */
export function negocioDesdeConfig(config: Record<string, string> | undefined) {
  return {
    nombre:    config?.nombre    || CROW.nombre,
    slogan:    config?.slogan    || CROW.slogan,
    telefono:  config?.telefono  || CROW.telefono,
    rnc:       config?.rnc       || CROW.rnc,
    direccion: config?.direccion || CROW.direccion,
    logo:      config?.logo_url  || CROW.logo,
  };
}

export type Negocio = ReturnType<typeof negocioDesdeConfig>;
