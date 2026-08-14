import { NextRequest } from "next/server";
import { coleccion, listar } from "@/lib/prestamos/crud";
import { INVERSIONISTAS, INVERSIONISTAS_VISTA } from "@/lib/prestamos/tablas";

/**
 * GET  → lee de la VISTA pr_v_inversionistas, que ya trae calculados los
 *        aportes, el capital en la calle, el disponible y el interés ganado.
 *
 *        Antes leía de la tabla pr_inversionistas, que no tiene esas
 *        columnas: llegaban como undefined y la pantalla pintaba RD$ 0.00
 *        aunque los movimientos estuvieran bien guardados.
 *
 * POST → escribe en la tabla pr_inversionistas (una vista no admite insert).
 */
export const GET = (req: NextRequest) => listar(req, INVERSIONISTAS_VISTA);

export const { POST } = coleccion(INVERSIONISTAS);
