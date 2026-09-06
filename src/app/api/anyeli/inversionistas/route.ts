import { NextRequest } from "next/server";
import { coleccion, listar } from "@/lib/anyeli/crud";
import { INVERSIONISTAS, INVERSIONISTAS_VISTA } from "@/lib/anyeli/tablas";

/**
 * GET  → lee de la VISTA ia_v_inversionistas, que ya trae calculados los
 *        aportes, el capital en la calle, el disponible y el interés ganado.
 *
 *        Antes leía de la tabla ia_inversionistas, que no tiene esas
 *        columnas: llegaban como undefined y la pantalla pintaba RD$ 0.00
 *        aunque los movimientos estuvieran bien guardados.
 *
 * POST → escribe en la tabla ia_inversionistas (una vista no admite insert).
 */
export const GET = (req: NextRequest) => listar(req, INVERSIONISTAS_VISTA);

export const { POST } = coleccion(INVERSIONISTAS);
