import { coleccion } from "@/lib/prestamos/crud";
import { INVERSIONISTAS } from "@/lib/prestamos/tablas";

export const { GET, POST } = coleccion(INVERSIONISTAS);
