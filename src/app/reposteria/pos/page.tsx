"use client";

/**
 * POS de CROW EVENTS — punto de venta rápido.
 * Vende productos del catálogo y lotes perecederos (descuenta el lote por trigger).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, Aviso, Badge, Btn, Card, Etiqueta, inputBase, ORO, RD, T } from "@/components/reposteria/ui";
import { imprimirHTML, reciboHTML } from "@/components/reposteria/imprimir";
import { negocioDesdeConfig, type Negocio } from "@/lib/reposteria/negocio";
import { NCF_TIPOS } from "@/types/reposteria";
import type { RepLoteAlerta, RepProducto } from "@/types/reposteria";

type Item = {
  clave: string;
  producto_id: string | null;
  lote_id: string | null;
  nombre: string;
  categoria: string | null;
  precio: number;
  costo: number;
  itbisPct: number;
  qty: number;
  maximo?: number;
};

const METODOS = [
  { key: "EFECTIVO",      label: "💵 Efectivo",      color: T.ok },
  { key: "TARJETA",       label: "💳 Tarjeta",       color: T.info },
  { key: "TRANSFERENCIA", label: "📲 Transferencia", color: T.bronce },
];

export default function PosCrowEvents() {
  const [productos, setProductos] = useState<RepProducto[]>([]);
  const [lotes, setLotes]         = useState<RepLoteAlerta[]>([]);
  const [negocio, setNegocio]     = useState<Negocio>(negocioDesdeConfig(undefined));
  const [carrito, setCarrito]     = useState<Item[]>([]);
  const [busqueda, setBusqueda]   = useState("");
  const [categoria, setCategoria] = useState("");
  const [metodo, setMetodo]       = useState("EFECTIVO");
  const [ncfTipo, setNcfTipo]     = useState("B02");
  const [cliente, setCliente]     = useState({ nombre: "", rnc: "" });
  const [cajero, setCajero]       = useState("");
  const [error, setError]         = useState("");
  const [ok, setOk]               = useState("");
  const [cobrando, setCobrando]   = useState(false);
  const [vista, setVista]         = useState<"productos" | "lotes">("productos");

  const cargar = useCallback(async () => {
    try {
      const [p, l, c] = await Promise.all([
        api<{ data: RepProducto[] }>("/productos?activo=true&vende_en_pos=true&limit=500"),
        api<{ data: RepLoteAlerta[] }>("/vistas/lotes-alerta?limit=200"),
        api<{ data: Record<string, string> }>("/config"),
      ]);
      setProductos(p.data ?? []);
      setLotes((l.data ?? []).filter((x) => x.estado === "disponible" && Number(x.cantidad_actual) > 0));
      setNegocio(negocioDesdeConfig(c.data));
      setNcfTipo(c.data?.ncf_default || "B02");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar el catálogo");
    }
  }, []);

  useEffect(() => { void cargar(); }, [cargar]);

  const categorias = useMemo(
    () => Array.from(new Set(productos.map((p) => p.categoria))).sort(),
    [productos]
  );

  const visibles = useMemo(() => productos.filter((p) =>
    (!categoria || p.categoria === categoria) &&
    (!busqueda || p.nombre.toLowerCase().includes(busqueda.toLowerCase()))
  ), [productos, categoria, busqueda]);

  const lotesVisibles = useMemo(() => lotes.filter((l) =>
    !busqueda || l.nombre_lote.toLowerCase().includes(busqueda.toLowerCase())
  ), [lotes, busqueda]);

  function agregarProducto(p: RepProducto) {
    setCarrito((c) => {
      const k = `p-${p.id}`;
      const ex = c.find((i) => i.clave === k);
      if (ex) return c.map((i) => i.clave === k ? { ...i, qty: i.qty + 1 } : i);
      return [...c, {
        clave: k, producto_id: p.id, lote_id: null, nombre: p.nombre,
        categoria: p.categoria, precio: Number(p.precio_venta),
        costo: Number(p.costo_estimado), itbisPct: Number(p.itbis ?? 0), qty: 1,
      }];
    });
  }

  function agregarLote(l: RepLoteAlerta) {
    setCarrito((c) => {
      const k = `l-${l.id}`;
      const ex = c.find((i) => i.clave === k);
      const max = Number(l.cantidad_actual);
      if (ex) return c.map((i) => i.clave === k ? { ...i, qty: Math.min(i.qty + 1, max) } : i);
      return [...c, {
        clave: k, producto_id: l.producto_id, lote_id: l.id, nombre: l.nombre_lote,
        categoria: l.categoria, precio: Number(l.precio_venta), costo: Number(l.costo_unitario),
        itbisPct: 0, qty: 1, maximo: max,
      }];
    });
  }

  function cambiarQty(clave: string, delta: number) {
    setCarrito((c) => c.flatMap((i) => {
      if (i.clave !== clave) return [i];
      const q = i.qty + delta;
      if (q <= 0) return [];
      if (i.maximo && q > i.maximo) return [i];
      return [{ ...i, qty: q }];
    }));
  }

  const subtotal = carrito.reduce((a, i) => a + i.precio * i.qty, 0);
  const itbis    = carrito.reduce((a, i) => a + (i.precio * i.qty * i.itbisPct) / (100 + i.itbisPct), 0);
  const total    = subtotal;

  async function cobrar() {
    if (carrito.length === 0) return;
    setCobrando(true); setError(""); setOk("");
    try {
      const r = await api<{ data: { numero: string; ncf: string | null } }>("/venta", {
        metodo: "POST",
        body: {
          total, subtotal: total - itbis, itbis_total: itbis, descuento: 0,
          metodo_pago: metodo, ncf_tipo: ncfTipo,
          cliente_nombre: cliente.nombre || null,
          cliente_rnc: cliente.rnc || null,
          cajero: cajero || null,
          items: carrito.map((i) => ({
            producto_id: i.producto_id, lote_id: i.lote_id,
            nombre_producto: i.nombre, categoria: i.categoria,
            qty: i.qty, precio_unitario: i.precio, costo_unitario: i.costo,
            itbis: (i.precio * i.qty * i.itbisPct) / (100 + i.itbisPct),
            descuento: 0, subtotal: i.precio * i.qty,
          })),
        },
      });

      const ncfDesc = NCF_TIPOS.find((n) => n.key === ncfTipo)?.desc ?? ncfTipo;
      imprimirHTML(reciboHTML(
        negocio,
        carrito.map((i) => ({ nombre: i.nombre, qty: i.qty, precio: i.precio })),
        total, itbis, metodo, r.data.ncf, ncfTipo, ncfDesc, r.data.numero,
      ));
      setOk(`Venta ${r.data.numero} registrada${r.data.ncf ? ` · NCF ${r.data.ncf}` : ""}`);
      setCarrito([]); setCliente({ nombre: "", rnc: "" });
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cobrar");
    } finally { setCobrando(false); }
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 370px", gap: 18, alignItems: "start" }}>
      {/* Catálogo */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
          <h1 style={{ fontSize: 24, margin: 0, color: T.bronce }}>🧁 Punto de venta</h1>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => setVista("productos")} style={tabStyle(vista === "productos")}>Catálogo</button>
            <button onClick={() => setVista("lotes")} style={tabStyle(vista === "lotes")}>Lotes del día ({lotes.length})</button>
          </div>
        </div>

        {error && <Aviso texto={error} />}
        {ok && <Aviso texto={ok} tono="ok" />}

        <div style={{ display: "flex", gap: 9, marginBottom: 14, flexWrap: "wrap" }}>
          <input placeholder="Buscar…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
            style={{ ...inputBase, maxWidth: 250 }} />
          {vista === "productos" && (
            <select value={categoria} onChange={(e) => setCategoria(e.target.value)} style={{ ...inputBase, maxWidth: 190 }}>
              <option value="">Todas las categorías</option>
              {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(158px, 1fr))", gap: 11 }}>
          {vista === "productos"
            ? visibles.map((p) => (
              <button key={p.id} onClick={() => agregarProducto(p)} style={tarjetaBtn}>
                <div style={{ fontWeight: 700, fontSize: 13.5, lineHeight: 1.3 }}>{p.nombre}</div>
                <div style={{ fontSize: 11, color: T.suave, margin: "5px 0 8px" }}>{p.categoria} · {p.unidad}</div>
                <div style={{ fontWeight: 800, color: T.acento2, fontSize: 15 }}>{RD(p.precio_venta)}</div>
              </button>
            ))
            : lotesVisibles.map((l) => (
              <button key={l.id} onClick={() => agregarLote(l)} style={tarjetaBtn}>
                <div style={{ fontWeight: 700, fontSize: 13.5, lineHeight: 1.3 }}>{l.nombre_lote}</div>
                <div style={{ fontSize: 11, color: T.suave, margin: "5px 0 6px" }}>
                  {l.cantidad_actual} {l.unidad} disponibles
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: 800, color: T.acento2, fontSize: 15 }}>{RD(l.precio_venta)}</span>
                  <Badge texto={l.nivel_alerta} tono={l.nivel_alerta === "ok" ? "ok" : l.nivel_alerta === "proximo" ? "warn" : "err"} />
                </div>
              </button>
            ))}
        </div>

        {((vista === "productos" && visibles.length === 0) || (vista === "lotes" && lotesVisibles.length === 0)) && (
          <Card style={{ textAlign: "center", color: T.suave, marginTop: 12 }}>
            {vista === "productos" ? "No hay productos que coincidan." : "No hay lotes disponibles."}
          </Card>
        )}
      </div>

      {/* Carrito */}
      <Card style={{ position: "sticky", top: 20 }}>
        <strong style={{ display: "block", marginBottom: 12 }}>🛒 Carrito ({carrito.length})</strong>

        <div style={{ maxHeight: 280, overflowY: "auto", marginBottom: 12 }}>
          {carrito.length === 0
            ? <div style={{ color: T.suave, fontSize: 13, padding: "18px 0", textAlign: "center" }}>Agrega productos o lotes</div>
            : carrito.map((i) => (
              <div key={i.clave} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                gap: 8, padding: "8px 0", borderBottom: `1px solid ${T.borde}55`,
              }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{i.nombre}</div>
                  <div style={{ fontSize: 11, color: T.suave }}>
                    {RD(i.precio)} {i.lote_id ? "· lote" : ""}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <button onClick={() => cambiarQty(i.clave, -1)} style={qtyBtn}>−</button>
                  <span style={{ minWidth: 20, textAlign: "center", fontWeight: 700, fontSize: 13 }}>{i.qty}</span>
                  <button onClick={() => cambiarQty(i.clave, 1)} style={qtyBtn}>+</button>
                </div>
                <div style={{ minWidth: 74, textAlign: "right", fontWeight: 700, fontSize: 13 }}>
                  {RD(i.precio * i.qty)}
                </div>
              </div>
            ))}
        </div>

        <div style={{ borderTop: `1px solid ${T.borde}`, paddingTop: 12, marginBottom: 12 }}>
          <Fila etiqueta="Subtotal" valor={RD(total - itbis)} />
          <Fila etiqueta="ITBIS incluido" valor={RD(itbis)} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 20, fontWeight: 900, marginTop: 8 }}>
            <span>TOTAL</span><span style={{ color: T.acento2 }}>{RD(total)}</span>
          </div>
        </div>

        <Etiqueta>Método de pago</Etiqueta>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, marginBottom: 12 }}>
          {METODOS.map((m) => (
            <button key={m.key} onClick={() => setMetodo(m.key)} style={{
              background: metodo === m.key ? m.color : T.panel2,
              color: "#fff", border: `1px solid ${metodo === m.key ? m.color : T.borde}`,
              borderRadius: 9, padding: "8px 4px", fontSize: 11, fontWeight: 700, cursor: "pointer",
            }}>{m.label}</button>
          ))}
        </div>

        <Etiqueta>Comprobante fiscal</Etiqueta>
        <select value={ncfTipo} onChange={(e) => setNcfTipo(e.target.value)} style={{ ...inputBase, marginBottom: 12 }}>
          {NCF_TIPOS.map((n) => <option key={n.key} value={n.key}>{n.key} — {n.desc}</option>)}
        </select>

        {ncfTipo !== "B02" && (
          <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
            <input placeholder="Nombre del cliente" value={cliente.nombre}
              onChange={(e) => setCliente((p) => ({ ...p, nombre: e.target.value }))} style={inputBase} />
            <input placeholder="RNC / Cédula" value={cliente.rnc}
              onChange={(e) => setCliente((p) => ({ ...p, rnc: e.target.value }))} style={inputBase} />
          </div>
        )}

        <input placeholder="Cajero (opcional)" value={cajero}
          onChange={(e) => setCajero(e.target.value)} style={{ ...inputBase, marginBottom: 12 }} />

        <Btn onClick={cobrar} disabled={carrito.length === 0 || cobrando} style={{ width: "100%", padding: "13px", fontSize: 16 }}>
          {cobrando ? "Procesando…" : `Cobrar ${RD(total)}`}
        </Btn>
        {carrito.length > 0 && (
          <Btn tono="neutro" onClick={() => setCarrito([])} style={{ width: "100%", marginTop: 8 }}>Vaciar carrito</Btn>
        )}
      </Card>
    </div>
  );
}

function Fila({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: T.suave, padding: "2px 0" }}>
      <span>{etiqueta}</span><span>{valor}</span>
    </div>
  );
}

const tarjetaBtn: React.CSSProperties = {
  background: T.panel, border: `1px solid ${T.borde}`, borderRadius: 12,
  padding: 13, textAlign: "left", cursor: "pointer", color: T.texto,
  boxShadow: "0 1px 3px rgba(58,44,28,0.06)",
};

const qtyBtn: React.CSSProperties = {
  background: T.panel2, border: `1px solid ${T.borde}`, color: T.texto,
  width: 24, height: 24, borderRadius: 7, cursor: "pointer", fontSize: 15, lineHeight: 1,
};

function tabStyle(activo: boolean): React.CSSProperties {
  return {
    background: activo ? ORO : T.panel,
    color: activo ? "#fff" : T.suave,
    border: `1px solid ${activo ? T.acento : T.borde}`,
    borderRadius: 9, padding: "7px 13px", fontSize: 12.5, fontWeight: 700, cursor: "pointer",
  };
}
