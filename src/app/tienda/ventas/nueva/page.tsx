"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Aviso, Btn, Cargando, Etiqueta, Seccion, Titulo,
  api, hoyISO, inputBase, T,
} from "@/components/tienda/ui";
import {
  EditorLineas, ResumenTotales, totalesDocumento,
  type Linea, type ProductoOpcion,
} from "@/components/tienda/EditorLineas";

interface ClienteOpcion {
  id: string; nombre: string; codigo: string;
  permite_credito: boolean; credito_disponible: number; dias_credito: number;
}

interface ItemGuardado {
  producto_id: string; descripcion: string; cantidad: number; precio: number;
  costo: number; itbis_pct: number; descuento: number;
}

export default function Pagina() {
  return (
    <Suspense fallback={<Cargando />}>
      <NuevaVenta />
    </Suspense>
  );
}

function NuevaVenta() {
  const router = useRouter();
  const params = useSearchParams();
  // Cuando viene ?editar=<id> la pantalla es la misma pero carga la factura
  // existente y al guardar la actualiza en vez de crear una nueva.
  const editarId = params.get("editar");
  const editando = !!editarId;

  const [productos, setProductos] = useState<ProductoOpcion[]>([]);
  const [clientes, setClientes] = useState<ClienteOpcion[]>([]);
  const [simbolo, setSimbolo] = useState("RD$");
  const [diasCredito, setDiasCredito] = useState(30);
  const [codigo, setCodigo] = useState("");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const [lineas, setLineas] = useState<Linea[]>([]);
  const [f, setF] = useState({
    cliente_id: params.get("cliente") ?? "",
    fecha: hoyISO(),
    condicion: "contado" as "contado" | "credito",
    metodo_pago: "efectivo",
    ncf: "",
    descuento: 0,
    notas: "",
    fecha_vence: "",
  });
  // Al editar no queremos que el efecto de "sugerir vencimiento" pise la
  // fecha que ya tenía la factura antes de que el usuario toque algo.
  const [listoParaSugerir, setListoParaSugerir] = useState(!editando);

  useEffect(() => {
    (async () => {
      try {
        const [p, c, cfg] = await Promise.all([
          api<{ data: ProductoOpcion[] }>("/productos?activo=true&limit=2000"),
          api<{ data: ClienteOpcion[] }>("/clientes?activo=true&limit=2000").catch(() => ({ data: [] })),
          api<{ data: { simbolo_moneda: string; dias_credito: number } }>("/config").catch(() => null),
        ]);
        const listaProductos = p.data ?? [];
        setProductos(listaProductos);
        setClientes(c.data ?? []);
        if (cfg?.data) {
          setSimbolo(cfg.data.simbolo_moneda ?? "RD$");
          setDiasCredito(Number(cfg.data.dias_credito ?? 30));
        }

        if (editarId) {
          const r = await api<{
            data: {
              venta: Record<string, unknown>;
              items: (ItemGuardado & { id: string })[];
            };
          }>(`/ventas/${editarId}`);
          const v = r.data.venta;
          if (String(v.estado) === "anulada") {
            setError("Esta factura está anulada: ya no se puede modificar.");
          }
          setCodigo(String(v.codigo ?? ""));
          setF({
            cliente_id: (v.cliente_id as string) ?? "",
            fecha: String(v.fecha ?? hoyISO()).slice(0, 10),
            condicion: (v.condicion as "contado" | "credito") ?? "contado",
            metodo_pago: (v.metodo_pago as string) ?? "efectivo",
            ncf: (v.ncf as string) ?? "",
            descuento: Number(v.descuento ?? 0),
            notas: (v.notas as string) ?? "",
            fecha_vence: v.fecha_vence ? String(v.fecha_vence).slice(0, 10) : "",
          });
          // El stock que muestra el editor debe contar lo que esta misma
          // factura ya descontó, porque al guardar se devuelve primero.
          setLineas(
            (r.data.items ?? []).map((it) => {
              const prod = listaProductos.find((x) => x.id === it.producto_id);
              return {
                producto_id: it.producto_id,
                descripcion: it.descripcion,
                cantidad: Number(it.cantidad),
                precio: Number(it.precio),
                costo: Number(it.costo),
                itbis_pct: Number(it.itbis_pct),
                descuento: Number(it.descuento ?? 0),
                unidad: prod?.unidad ?? "und",
                stock: Number(prod?.stock_actual ?? 0) + Number(it.cantidad),
              };
            })
          );
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al cargar");
      } finally {
        setCargando(false);
        setListoParaSugerir(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editarId]);

  // Al pasar a crédito, sugerir la fecha de vencimiento
  useEffect(() => {
    if (!listoParaSugerir) return;
    if (f.condicion !== "credito") return;
    if (editando && f.fecha_vence) return;
    const cli = clientes.find((c) => c.id === f.cliente_id);
    const dias = cli?.dias_credito ?? diasCredito;
    const d = new Date(f.fecha + "T12:00:00");
    d.setDate(d.getDate() + dias);
    setF((s) => ({ ...s, fecha_vence: d.toISOString().slice(0, 10) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.condicion, f.cliente_id, f.fecha, diasCredito, listoParaSugerir]);

  if (cargando) return <Cargando />;

  const cliente = clientes.find((c) => c.id === f.cliente_id);
  const t = totalesDocumento(lineas, f.descuento);
  const excedeStock = lineas.some((l) => l.cantidad > l.stock);
  const excedeCredito =
    f.condicion === "credito" && !!cliente && t.total > Number(cliente.credito_disponible);

  async function guardar() {
    setError("");
    if (!lineas.length) return setError("Agrega al menos un producto.");
    if (excedeStock) return setError("Hay líneas que superan la existencia disponible.");
    if (f.condicion === "credito" && !f.cliente_id) {
      return setError("Una venta a crédito necesita un cliente registrado.");
    }
    if (f.condicion === "credito" && cliente && !cliente.permite_credito) {
      return setError(`${cliente.nombre} no tiene crédito habilitado. Actívalo en su ficha.`);
    }

    setGuardando(true);
    const cuerpo = {
      cliente_id: f.cliente_id || null,
      fecha: f.fecha,
      ncf: f.ncf || null,
      condicion: f.condicion,
      fecha_vence: f.condicion === "credito" ? f.fecha_vence : null,
      descuento: f.descuento,
      metodo_pago: f.metodo_pago,
      notas: f.notas || null,
      items: lineas.map((l) => ({
        producto_id: l.producto_id,
        descripcion: l.descripcion,
        cantidad: l.cantidad,
        precio: l.precio,
        costo: l.costo,
        itbis_pct: l.itbis_pct,
        descuento: l.descuento,
      })),
    };

    try {
      if (editarId) {
        await api(`/ventas/${editarId}`, { metodo: "PUT", body: cuerpo });
        router.push(`/tienda/ventas/${editarId}`);
      } else {
        const r = await api<{ data: { id: string } }>("/ventas", { metodo: "POST", body: cuerpo });
        router.push(`/tienda/ventas/${r.data.id}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar la venta");
      setGuardando(false);
    }
  }

  const textoBoton = guardando
    ? "Guardando…"
    : editando ? "Guardar cambios" : "Registrar venta";

  return (
    <div>
      <Link
        href={editarId ? `/tienda/ventas/${editarId}` : "/tienda/ventas"}
        style={{ fontSize: 12, color: T.acento, textDecoration: "none" }}
      >
        ← {editarId ? "Volver a la factura" : "Ventas"}
      </Link>
      <div style={{ height: 8 }} />
      <Titulo
        texto={editando ? `Modificar ${codigo || "factura"}` : "Nueva venta"}
        sub={editando
          ? "Los cobros ya recibidos se conservan. El inventario se reajusta solo al guardar."
          : undefined}
        acciones={
          <Btn onClick={guardar} disabled={guardando || !lineas.length || excedeStock}>
            {textoBoton}
          </Btn>
        }
      />

      {error && <Aviso texto={error} />}
      {excedeCredito && (
        <Aviso tono="warn" texto={
          `Ojo: el total supera el crédito disponible de ${cliente?.nombre} ` +
          `(${new Intl.NumberFormat("es-DO").format(Number(cliente?.credito_disponible))}). ` +
          `Puedes continuar, pero quedará sobregirado.`
        } />
      )}

      <div style={{ display: "grid", gap: 18, gridTemplateColumns: "minmax(0, 1.8fr) minmax(300px, 1fr)" }}>
        <div style={{ display: "grid", gap: 18, alignContent: "start" }}>
          <Seccion titulo="1 · Datos de la factura">
            <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}>
              <div style={{ gridColumn: "span 2" }}>
                <Etiqueta>Cliente</Etiqueta>
                <select style={inputBase} value={f.cliente_id}
                        onChange={(e) => setF({ ...f, cliente_id: e.target.value })}>
                  <option value="">Consumidor final (sin registrar)</option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}{c.permite_credito ? ` · crédito disp. ${Number(c.credito_disponible).toLocaleString("es-DO")}` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Etiqueta>Fecha</Etiqueta>
                <input type="date" style={inputBase} value={f.fecha}
                       onChange={(e) => setF({ ...f, fecha: e.target.value })} />
              </div>
              <div>
                <Etiqueta>Condición</Etiqueta>
                <select style={inputBase} value={f.condicion}
                        onChange={(e) => setF({ ...f, condicion: e.target.value as "contado" | "credito" })}>
                  <option value="contado">Contado</option>
                  <option value="credito">Crédito</option>
                </select>
              </div>
              {f.condicion === "contado" ? (
                <div>
                  <Etiqueta>Forma de pago</Etiqueta>
                  <select style={inputBase} value={f.metodo_pago}
                          onChange={(e) => setF({ ...f, metodo_pago: e.target.value })}>
                    <option value="efectivo">Efectivo</option>
                    <option value="transferencia">Transferencia</option>
                    <option value="tarjeta">Tarjeta</option>
                    <option value="cheque">Cheque</option>
                  </select>
                </div>
              ) : (
                <div>
                  <Etiqueta>Vence el</Etiqueta>
                  <input type="date" style={inputBase} value={f.fecha_vence}
                         onChange={(e) => setF({ ...f, fecha_vence: e.target.value })} />
                </div>
              )}
              <div>
                <Etiqueta>NCF (opcional)</Etiqueta>
                <input style={inputBase} value={f.ncf}
                       onChange={(e) => setF({ ...f, ncf: e.target.value })} />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <Etiqueta>Notas</Etiqueta>
                <input style={inputBase} value={f.notas}
                       onChange={(e) => setF({ ...f, notas: e.target.value })} />
              </div>
            </div>
          </Seccion>

          <Seccion titulo="2 · Productos">
            <EditorLineas
              modo="venta"
              productos={productos}
              lineas={lineas}
              onCambio={setLineas}
              simbolo={simbolo}
            />
          </Seccion>
        </div>

        <div style={{ display: "grid", gap: 18, alignContent: "start", position: "sticky", top: 20 }}>
          <ResumenTotales
            lineas={lineas}
            descuento={f.descuento}
            simbolo={simbolo}
            onDescuento={(v) => setF({ ...f, descuento: v })}
          />
          <div style={{ fontSize: 12, color: T.suave, lineHeight: 1.5 }}>
            {editando ? (
              <>
                Al guardar se devuelve al inventario lo que tenía la factura y se
                vuelve a descontar con las líneas nuevas.
                <div style={{ marginTop: 6 }}>Lo que ya se cobró no se toca.</div>
              </>
            ) : (
              <>
                {f.condicion === "contado"
                  ? "Al registrarla, la venta se cobra completa y el dinero entra a la caja abierta."
                  : "Al registrarla, queda como cuenta por cobrar. Los abonos se registran desde la factura."}
                <div style={{ marginTop: 6 }}>El inventario se descuenta automáticamente.</div>
              </>
            )}
          </div>
          <Btn onClick={guardar} disabled={guardando || !lineas.length || excedeStock}>
            {textoBoton}
          </Btn>
        </div>
      </div>
    </div>
  );
}
