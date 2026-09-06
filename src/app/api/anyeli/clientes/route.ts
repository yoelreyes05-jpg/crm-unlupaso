import { coleccion } from "@/lib/anyeli/crud";
import { CLIENTES } from "@/lib/anyeli/tablas";

export const { GET, POST } = coleccion(CLIENTES);
