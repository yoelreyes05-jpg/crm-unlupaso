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

  const [productos, setProductos] = useState<ProductoOpcion[]>([]);
  const [clientes, setClientes] = useState<ClienteOpcion[]>([]);
  const [simbolo, setSimbolo] = useState("RD$");
  const [diasCredito, setDiasCredito] = useState(30);
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

  useEffect(() => {
    (async () => {
      try {
        const [p, c, cfg] = await Promise.all([
          api<{ data: ProductoOpcion[] }>("/productos?activo=true&limit=2000"),
          api<{ data: ClienteOpcion[] }>("/clientes?activo=true&limit=2000").catch(() => ({ data: [] })),
          api<{ data: { simbolo_moneda: string; dias_credito: number } }>("/config").catch(() => null),
        ]);
        setProductos(p.data ?? []);
        setClientes(c.data ?? []);
        if (cfg?.data) {
          setSimbolo(cfg.data.simbolo_moneda ?? "RD$");
          setDiasCredito(Number(cfg.data.dias_credito ?? 30));
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al cargar");
      } finally {
        setCargando(false);
      }
    })();
  }, []);

  // Al pasar a crédito, sugerir la fecha de vencimiento
  useEffect(() => {
    if (f.condicion !== "credito") return;
    const cli = clientes.find((c) => c.id === f.cliente_id);
    const dias = cli?.dias_credito ?? diasCredito;
    const d = new Date(f.fecha + "T12:00:00");
    d.setDate(d.getDate() + dias);
    setF((s) => ({ ...s, fecha_vence: d.toISOString().slice(0, 10) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.condicion, f.cliente_id, f.fecha, diasCredito]);

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
    try {
      const r = await api<{ data: { id: string } }>("/ventas", {
        metodo: "POST",
        body: {
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
        },
      });
      router.push(`/tienda/ventas/${r.data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo registrar la venta");
      setGuardando(false);
    }
  }

  return (
    <div>
      <Link href="/tienda/ventas" style={{ fontSize: 12, color: T.acento, textDecoration: "none" }}>
        ← Ventas
      </Link>
      <div style={{ height: 8 }} />
      <Titulo
        texto="Nueva venta"
        acciones={
          <Btn onClick={guardar} disabled={guardando || !lineas.length || excedeStock}>
            {guardando ? "Registrando…" : "Registrar venta"}
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
            {f.condicion === "contado"
              ? "Al registrarla, la venta se cobra completa y el dinero entra a la caja abierta."
              : "Al registrarla, queda como cuenta por cobrar. Los abonos se registran desde la factura."}
            <div style={{ marginTop: 6 }}>El inventario se descuenta automáticamente.</div>
          </div>
          <Btn onClick={guardar} disabled={guardando || !lineas.length || excedeStock}>
            {guardando ? "Registrando…" : "Registrar venta"}
          </Btn>
        </div>
      </div>
    </div>
  );
}
