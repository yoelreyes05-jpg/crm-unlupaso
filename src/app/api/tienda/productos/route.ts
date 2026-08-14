import { NextRequest } from "next/server";
import { coleccion, listar } from "@/lib/tienda/crud";
import { PRODUCTOS, PRODUCTOS_VISTA } from "@/lib/tienda/tablas";

/** GET lee de la vista (trae los totales calculados); POST escribe en la tabla. */
export const GET = (req: NextRequest) => listar(req, PRODUCTOS_VISTA);
export const { POST } = coleccion(PRODUCTOS);
