// ─── Configuración central UNLUPASO ──────────────────────────────────────────
// Este archivo es el único lugar donde se define la URL de la API

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL          // Railway o cualquier backend externo
  ?? (process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL}/api`
    : "/api");

export const NEGOCIO = {
  nombre:    "UNLUPASO",
  slogan:    "Un lugar para soñar",
  telefono:  "829-644-7991",
  rnc:       "",
  direccion: "",
  moneda:    "DOP",
} as const;
