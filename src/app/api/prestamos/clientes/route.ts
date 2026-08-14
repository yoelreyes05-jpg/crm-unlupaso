import { coleccion } from "@/lib/prestamos/crud";
import { CLIENTES } from "@/lib/prestamos/tablas";

export const { GET, POST } = coleccion(CLIENTES);
