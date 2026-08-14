"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Aviso, Badge, Btn, Card, Cargando, ETIQUETA_METODO_PAGO, Etiqueta, Kpi, Modal, RD,
  Tabla, Titulo, Vacio, api, fecha, hoyISO, inputBase, rejilla, tonoDoc, T,
} from "@/components/tienda/ui";
import {
  EditorLineas, ResumenTotales, totalesDocumento,
  type Linea, type ProductoOpcion,
} from "@/components/tienda/EditorLineas";

interface Compra {
  id: string; codigo: string; fecha: string; proveedor_id: string | null;
  proveedor_nombre: string; condicion: string; ncf: string | null;
  fecha_vence: string | null; subtotal: number; itbis: number; total: number;
  pagado: number; saldo: number; estado: string; estado_visual: string; dias_vencida: number;
}
interface Proveedor { id: string; nombre: string; dias_credito: number }

export default function ComprasPage() {
  const [lista, setLista] = useState<Compra[]>([]);
  const [productos, setProductos] = useState<ProductoOpcion[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [simbolo, setSimbolo] = useState("RD$");
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [nueva, setNueva] = useState(false);
  const [pagar, setPagar] = useState<Compra | null>(null);
  const [procesando, setProcesando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      // Los catálogos son secundarios: si uno falla, la lista de compras
      // igual se ve. Antes un solo fallo tumbaba toda la pantalla.
      const [c, p, pr, cfg] = await Promise.all([
        api<{ data: Compra[] }>("/compras?limit=500"),
        api<{ data: ProductoOpcion[] }>("/productos?activo=true&limit=2000").catch(() => ({ data: [] })),
        api<{ data: Proveedor[] }>("/proveedores?activo=true&limit=500").catch(() => ({ data: [] })),
        api<{ data: { simbolo_moneda: string } }>("/config").catch(() => null),
      ]);
      setLista(c.data ?? []);
      setProductos(p.data ?? []);
      setProveedores(pr.data ?? []);
      if (cfg?.data?.simbolo_moneda) setSimbolo(cfg.data.simbolo_moneda);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { void cargar(); }, [cargar]);

  const filtradas = useMemo(() => {
    const b = busqueda.trim().toLowerCase();
    if (!b) return lista;
    return lista.filter(
      (c) => c.codigo.toLowerCase().includes(b) ||
             (c.proveedor_nombre ?? "").toLowerCase().includes(b) ||
             (c.ncf ?? "").toLowerCase().includes(b)
    );
  }, [lista, busqueda]);

  const t = filtradas.reduce(
    (a, c) => c.estado === "anulada" ? a : ({
      comprado: a.comprado + Number(c.total),
      pagado: a.pagado + Number(c.pagado),
      saldo: a.saldo + Number(c.saldo),
    }),
    { comprado: 0, pagado: 0, saldo: 0 }
  );

  if (cargando) return <Cargando />;

  return (
    <div>
      <Titulo
        texto="🛒  Compras"
        sub={`${filtradas.length} compra(s) · suben el inventario`}
        acciones={<Btn onClick={() => setNueva(true)}>+ Nueva compra</Btn>}
      />

      {ok && <Aviso texto={ok} tono="ok" />}
      {error && <Aviso texto={error} />}

      <div style={{ ...rejilla(205), marginBottom: 16 }}>
        <Kpi titulo="Total comprado" valor={RD(t.comprado, simbolo)} />
        <Kpi titulo="Pagado" valor={RD(t.pagado, simbolo)} tono="ok" />
        <Kpi titulo="Por pagar" valor={RD(t.saldo, simbolo)} tono={t.saldo > 0 ? "warn" : "neutro"} />
      </div>

      <input style={{ ...inputBase, maxWidth: 340, background: T.panel, marginBottom: 14 }}
             placeholder="Buscar compra, proveedor o NCF…"
             value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />

      <Card style={{ padding: 0, overflow: "hidden" }}>
        {filtradas.length === 0 ? (
          <Vacio texto="Todavía no has registrado compras."
                 accion={<Btn onClick={() => setNueva(true)}>Registrar la primera</Btn>} />
        ) : (
          <Tabla
            filaRoja={(f) => f.estado_visual === "vencida"}
            columnas={[
              { name: "codigo", label: "Compra", fmt: (v, f) => (
                <Link href={`/tienda/compras/${f.id}`} style={{ color: "inherit", fontWeight: 700, textDecoration: "none" }}>
                  {String(v)}
                  {f.ncf ? <div style={{ fontSize: 10.5, opacity: 0.7 }}>NCF {String(f.ncf)}</div> : null}
                </Link>
              ) },
              { name: "fecha", label: "Fecha", fmt: (v) => fecha(v as string) },
              { name: "proveedor_nombre", label: "Proveedor" },
              { name: "condicion", label: "Condición",
                fmt: (v) => <Badge texto={String(v)} tono={v === "credito" ? "info" : "neutro"} /> },
              { name: "total",  label: "Total",  alinear: "right", fmt: (v) => <strong>{RD(v as number, simbolo)}</strong> },
              { name: "pagado", label: "Pagado", alinear: "right", fmt: (v) => RD(v as number, simbolo) },
              { name: "saldo",  label: "Saldo",  alinear: "right",
                fmt: (v) => Number(v) > 0.01 ? <strong>{RD(v as number, simbolo)}</strong> : "—" },
              { name: "fecha_vence", label: "Vence",
                fmt: (v, f) => v ? (
                  <div style={{ whiteSpace: "nowrap" }}>
                    {fecha(v as string)}
                    {Number(f.dias_vencida) > 0 && (
                      <div style={{ fontSize: 10.5, fontWeight: 800 }}>{String(f.dias_vencida)} días</div>
                    )}
                  </div>
                ) : "—" },
              { name: "estado_visual", label: "Estado",
                fmt: (v) => <Badge texto={String(v)} tono={tonoDoc(String(v))} /> },
            ]}
            filas={filtradas as unknown as Record<string, unknown>[]}
            acciones={(f) =>
              Number(f.saldo) > 0.01 && f.estado !== "anulada" ? (
                <button onClick={() => setPagar(f as unknown as Compra)}
                        style={{ background: "transparent", border: "none", color: T.acento, cursor: "pointer", fontSize: 12.5, fontWeight: 700 }}>
                  Pagar
                </button>
              ) : null
            }
          />
        )}
      </Card>

      {nueva && (
        <ModalNuevaCompra
          productos={productos} proveedores={proveedores} simbolo={simbolo} procesando={procesando}
          onCerrar={() => setNueva(false)}
          onGuardar={async (body) => {
            setProcesando(true); setError("");
            try {
              await api("/compras", { metodo: "POST", body });
              setOk("Compra registrada. El inventario ya subió.");
              setNueva(false);
              await cargar();
            } catch (e) {
              setError(e instanceof Error ? e.message : "No se pudo registrar la compra");
            } finally { setProcesando(false); }
          }}
        />
      )}

      {pagar && (
        <ModalPago
          compra={pagar} simbolo={simbolo} procesando={procesando}
          onCerrar={() => setPagar(null)}
          onGuardar={async (body) => {
            setProcesando(true); setError("");
            try {
              await api("/pagos-proveedor", { metodo: "POST", body });
              setOk("Pago registrado. Salió de la caja abierta.");
              setPagar(null);
              await cargar();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Error al pagar");
            } finally { setProcesando(false); }
          }}
        />
      )}
    </div>
  );
}

/* ── Nueva compra ─────────────────────────────────────────────────── */
function ModalNuevaCompra({
  productos, proveedores, simbolo, procesando, onCerrar, onGuardar,
}: {
  productos: ProductoOpcion[]; proveedores: Proveedor[]; simbolo: string; procesando: boolean;
  onCerrar: () => void; onGuardar: (b: Record<string, unknown>) => void;
}) {
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [f, setF] = useState({
    proveedor_id: "", fecha: hoyISO(), condicion: "contado" as "contado" | "credito",
    metodo_pago: "efectivo", ncf: "", fecha_vence: "", notas: "",
  });

  useEffect(() => {
    if (f.condicion !== "credito") return;
    const prov = proveedores.find((p) => p.id === f.proveedor_id);
    const d = new Date(f.fecha + "T12:00:00");
    d.setDate(d.getDate() + (prov?.dias_credito ?? 30));
    setF((s) => ({ ...s, fecha_vence: d.toISOString().slice(0, 10) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.condicion, f.proveedor_id, f.fecha]);

  const t = totalesDocumento(lineas, 0);

  return (
    <Modal
      abierto titulo="Nueva compra" onCerrar={onCerrar} ancho={980}
      pie={
        <>
          <Btn tono="neutro" onClick={onCerrar}>Cancelar</Btn>
          <Btn disabled={procesando || !lineas.length}
               onClick={() => onGuardar({
                 proveedor_id: f.proveedor_id || null,
                 fecha: f.fecha, ncf: f.ncf || null, condicion: f.condicion,
                 fecha_vence: f.condicion === "credito" ? f.fecha_vence : null,
                 metodo_pago: f.metodo_pago, notas: f.notas || null,
                 items: lineas.map((l) => ({
                   producto_id: l.producto_id, cantidad: l.cantidad,
                   costo: l.precio, itbis_pct: l.itbis_pct,
                 })),
               })}>
            {procesando ? "Registrando…" : `Registrar compra · ${RD(t.total, simbolo)}`}
          </Btn>
        </>
      }
    >
      <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", marginBottom: 18 }}>
        <div style={{ gridColumn: "span 2" }}>
          <Etiqueta>Proveedor</Etiqueta>
          <select style={inputBase} value={f.proveedor_id}
                  onChange={(e) => setF({ ...f, proveedor_id: e.target.value })}>
            <option value="">Sin proveedor registrado</option>
            {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
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
          <Etiqueta>NCF</Etiqueta>
          <input style={inputBase} value={f.ncf} onChange={(e) => setF({ ...f, ncf: e.target.value })} />
        </div>
      </div>

      <EditorLineas modo="compra" productos={productos} lineas={lineas}
                    onCambio={setLineas} simbolo={simbolo} />

      <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
        <div style={{ minWidth: 300 }}>
          <ResumenTotales lineas={lineas} descuento={0} simbolo={simbolo} />
        </div>
      </div>

      <div style={{ fontSize: 12, color: T.suave, marginTop: 12 }}>
        Al registrarla, cada producto entra al inventario y su costo se actualiza con el de esta compra.
        {f.condicion === "contado"
          ? " El pago sale de la caja abierta."
          : " Queda como cuenta por pagar."}
      </div>
    </Modal>
  );
}

/* ── Pago a proveedor ─────────────────────────────────────────────── */
function ModalPago({
  compra, simbolo, procesando, onCerrar, onGuardar,
}: {
  compra: Compra; simbolo: string; procesando: boolean;
  onCerrar: () => void; onGuardar: (b: Record<string, unknown>) => void;
}) {
  const [f, setF] = useState({
    monto: String(compra.saldo), fecha: hoyISO(), metodo_pago: "efectivo", referencia: "",
  });
  const monto = Number(f.monto);

  return (
    <Modal
      abierto titulo={`Pagar compra ${compra.codigo}`} onCerrar={onCerrar} ancho={500}
      pie={
        <>
          <Btn tono="neutro" onClick={onCerrar}>Cancelar</Btn>
          <Btn disabled={procesando || !(monto > 0)}
               onClick={() => onGuardar({
                 compra_id: compra.id, proveedor_id: compra.proveedor_id,
                 monto, fecha: f.fecha, metodo_pago: f.metodo_pago,
                 referencia: f.referencia || null,
               })}>
            {procesando ? "Guardando…" : "Registrar pago"}
          </Btn>
        </>
      }
    >
      <div style={{ background: T.panel2, border: `1px solid ${T.borde}`, borderRadius: 10, padding: 13, marginBottom: 15, fontSize: 13.5 }}>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
          <span style={{ color: T.suave }}>Proveedor</span><strong>{compra.proveedor_nombre}</strong>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
          <span style={{ color: T.suave }}>Total</span><span>{RD(compra.total, simbolo)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
          <span style={{ color: T.suave }}>Saldo</span><strong>{RD(compra.saldo, simbolo)}</strong>
        </div>
      </div>
      <div style={{ display: "grid", gap: 13, gridTemplateColumns: "1fr 1fr" }}>
        <div>
          <Etiqueta>Monto</Etiqueta>
          <input type="number" step="0.01" style={{ ...inputBase, fontSize: 16, fontWeight: 700 }}
                 value={f.monto} onChange={(e) => setF({ ...f, monto: e.target.value })} />
        </div>
        <div>
          <Etiqueta>Fecha</Etiqueta>
          <input type="date" style={inputBase} value={f.fecha}
                 onChange={(e) => setF({ ...f, fecha: e.target.value })} />
        </div>
        <div>
          <Etiqueta>Forma de pago</Etiqueta>
          <select style={inputBase} value={f.metodo_pago}
                  onChange={(e) => setF({ ...f, metodo_pago: e.target.value })}>
            {Object.entries(ETIQUETA_METODO_PAGO)
              .filter(([k]) => !["credito", "mixto"].includes(k))
              .map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <Etiqueta>Referencia</Etiqueta>
          <input style={inputBase} value={f.referencia}
                 onChange={(e) => setF({ ...f, referencia: e.target.value })} />
        </div>
      </div>
    </Modal>
  );
}
