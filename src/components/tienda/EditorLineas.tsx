"use client";

/**
 * Editor de líneas para facturas y compras.
 * Se busca el producto, se pone cantidad y precio, y va sumando abajo.
 */

import { useMemo, useState } from "react";
import { Badge, Btn, Etiqueta, RD, T, inputBase } from "./ui";

export interface ProductoOpcion {
  id: string;
  codigo: string;
  nombre: string;
  unidad: string;
  costo: number;
  precio: number;
  itbis_pct: number;
  stock_actual: number;
  /** Datos de agrupación: vienen de ti_v_productos */
  categoria_id?: string | null;
  categoria_nombre?: string | null;
  categoria_color?: string | null;
  tipo_inventario?: string | null;
  lote_codigo?: string | null;
}

export interface Linea {
  producto_id: string;
  descripcion: string;
  cantidad: number;
  precio: number;   // en compras, el costo
  costo: number;
  itbis_pct: number;
  descuento: number;
  unidad: string;
  stock: number;
}

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function importeLinea(l: Linea) {
  return r2(l.cantidad * l.precio - l.descuento);
}
export function itbisLinea(l: Linea) {
  return r2(importeLinea(l) * l.itbis_pct / 100);
}

export function totalesDocumento(lineas: Linea[], descuentoGlobal = 0) {
  const subtotal = r2(lineas.reduce((a, l) => a + importeLinea(l), 0));
  const itbis = r2(lineas.reduce((a, l) => a + itbisLinea(l), 0));
  return { subtotal, itbis, total: r2(subtotal + itbis - descuentoGlobal) };
}

export function EditorLineas({
  productos, lineas, onCambio, modo, simbolo = "RD$",
}: {
  productos: ProductoOpcion[];
  lineas: Linea[];
  onCambio: (l: Linea[]) => void;
  /** 'venta' usa el precio y valida existencia; 'compra' usa el costo */
  modo: "venta" | "compra";
  simbolo?: string;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [grupo, setGrupo] = useState("");

  // Grupos disponibles según lo que tenga el catálogo
  const grupos = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of productos) {
      if (p.categoria_nombre) m.set(String(p.categoria_id ?? p.categoria_nombre), p.categoria_nombre);
    }
    return [...m.entries()].map(([value, label]) => ({ value, label }));
  }, [productos]);

  const encontrados = useMemo(() => {
    const b = busqueda.trim().toLowerCase();
    // Al elegir un grupo se listan sus artículos aunque no se escriba nada:
    // así se vende por grupo sin tener que recordar el nombre de cada pieza.
    if (!b && !grupo) return [];
    return productos
      .filter((p) => !grupo || String(p.categoria_id ?? p.categoria_nombre ?? "") === grupo)
      .filter(
        (p) =>
          !b ||
          p.nombre.toLowerCase().includes(b) ||
          p.codigo.toLowerCase().includes(b) ||
          (p.lote_codigo ?? "").toLowerCase().includes(b)
      )
      .slice(0, grupo && !b ? 30 : 8);
  }, [busqueda, productos, grupo]);

  function agregar(p: ProductoOpcion) {
    const ya = lineas.findIndex((l) => l.producto_id === p.id);
    if (ya >= 0) {
      const copia = [...lineas];
      copia[ya] = { ...copia[ya], cantidad: copia[ya].cantidad + 1 };
      onCambio(copia);
    } else {
      onCambio([
        ...lineas,
        {
          producto_id: p.id,
          descripcion: p.nombre,
          cantidad: 1,
          precio: modo === "venta" ? Number(p.precio) : Number(p.costo),
          costo: Number(p.costo),
          itbis_pct: Number(p.itbis_pct),
          descuento: 0,
          unidad: p.unidad,
          stock: Number(p.stock_actual),
        },
      ]);
    }
    setBusqueda("");
  }

  const set = (i: number, campo: keyof Linea, valor: number) => {
    const copia = [...lineas];
    copia[i] = { ...copia[i], [campo]: valor };
    onCambio(copia);
  };

  const th: React.CSSProperties = {
    textAlign: "left", padding: "8px 8px", fontSize: 10.5, textTransform: "uppercase",
    letterSpacing: 0.4, color: T.suave, borderBottom: `1px solid ${T.borde}`, whiteSpace: "nowrap",
  };
  const td: React.CSSProperties = { padding: "7px 8px", borderBottom: `1px solid ${T.borde}77` };
  const mini: React.CSSProperties = { ...inputBase, padding: "6px 8px", fontSize: 13, textAlign: "right" };

  return (
    <div>
      <div style={{ position: "relative", marginBottom: 14 }}>
        <Etiqueta>Buscar producto por nombre, código o lote</Etiqueta>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            style={{ ...inputBase, flex: "1 1 220px" }}
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Escribe para buscar…"
          />
          {grupos.length > 0 && (
            <select
              style={{ ...inputBase, flex: "0 1 200px" }}
              value={grupo}
              onChange={(e) => setGrupo(e.target.value)}
            >
              <option value="">Todos los grupos</option>
              {grupos.map((g) => (
                <option key={g.value} value={g.value}>{g.label}</option>
              ))}
            </select>
          )}
        </div>
        {encontrados.length > 0 && (
          <div style={{
            position: "absolute", zIndex: 20, top: "100%", left: 0, right: 0, marginTop: 4,
            background: T.panel, border: `1px solid ${T.borde}`, borderRadius: 10,
            boxShadow: "0 10px 30px rgba(30,27,52,0.18)", overflow: "hidden", maxHeight: 300, overflowY: "auto",
          }}>
            {encontrados.map((p) => {
              const sinStock = modo === "venta" && Number(p.stock_actual) <= 0;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => !sinStock && agregar(p)}
                  disabled={sinStock}
                  style={{
                    display: "flex", width: "100%", justifyContent: "space-between", alignItems: "center",
                    gap: 10, padding: "10px 12px", border: "none", textAlign: "left",
                    background: T.panel, cursor: sinStock ? "not-allowed" : "pointer",
                    opacity: sinStock ? 0.5 : 1, borderBottom: `1px solid ${T.borde}66`,
                  }}
                >
                  <span>
                    <strong style={{ fontSize: 13.5 }}>
                      {p.nombre}
                      {p.tipo_inventario === "lote" && (
                        <span style={{
                          marginLeft: 6, fontSize: 10, fontWeight: 800, color: "#fff",
                          background: T.acento, borderRadius: 5, padding: "1px 5px",
                        }}>paca</span>
                      )}
                    </strong>
                    <span style={{ display: "block", fontSize: 11, color: T.suave }}>
                      {[p.categoria_nombre, p.lote_codigo || p.codigo].filter(Boolean).join(" · ")}
                      {" · existencia "}{Number(p.stock_actual)} {p.unidad}
                    </span>
                  </span>
                  <span style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <strong style={{ fontSize: 13 }}>
                      {RD(modo === "venta" ? p.precio : p.costo, simbolo)}
                    </strong>
                    {sinStock && <div><Badge texto="agotado" tono="err" /></div>}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {lineas.length === 0 ? (
        <div style={{
          padding: 28, textAlign: "center", color: T.suave, fontSize: 13.5,
          border: `1px dashed ${T.borde}`, borderRadius: 11,
        }}>
          Busca un producto arriba para empezar.
        </div>
      ) : (
        <div style={{ border: `1px solid ${T.borde}`, borderRadius: 11, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                <th style={th}>Producto</th>
                <th style={{ ...th, textAlign: "right", width: 95 }}>Cantidad</th>
                <th style={{ ...th, textAlign: "right", width: 110 }}>
                  {modo === "venta" ? "Precio" : "Costo"}
                </th>
                <th style={{ ...th, textAlign: "right", width: 80 }}>ITBIS %</th>
                {modo === "venta" && <th style={{ ...th, textAlign: "right", width: 95 }}>Desc.</th>}
                <th style={{ ...th, textAlign: "right", width: 110 }}>Importe</th>
                <th style={{ ...th, width: 40 }} />
              </tr>
            </thead>
            <tbody>
              {lineas.map((l, i) => {
                const excede = modo === "venta" && l.cantidad > l.stock;
                return (
                  <tr key={l.producto_id} style={excede ? { background: T.rojoBg } : undefined}>
                    <td style={td}>
                      <strong>{l.descripcion}</strong>
                      <div style={{ fontSize: 10.5, color: excede ? T.err : T.suave }}>
                        {modo === "venta"
                          ? `existencia ${l.stock} ${l.unidad}${excede ? " — no alcanza" : ""}`
                          : l.unidad}
                      </div>
                    </td>
                    <td style={td}>
                      <input type="number" step="0.001" min={0} style={mini} value={l.cantidad}
                             onChange={(e) => set(i, "cantidad", Number(e.target.value))} />
                    </td>
                    <td style={td}>
                      <input type="number" step="0.01" min={0} style={mini} value={l.precio}
                             onChange={(e) => set(i, "precio", Number(e.target.value))} />
                    </td>
                    <td style={td}>
                      <input type="number" step="0.01" min={0} style={mini} value={l.itbis_pct}
                             onChange={(e) => set(i, "itbis_pct", Number(e.target.value))} />
                    </td>
                    {modo === "venta" && (
                      <td style={td}>
                        <input type="number" step="0.01" min={0} style={mini} value={l.descuento}
                               onChange={(e) => set(i, "descuento", Number(e.target.value))} />
                      </td>
                    )}
                    <td style={{ ...td, textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                      {RD(importeLinea(l), simbolo)}
                      {l.itbis_pct > 0 && (
                        <div style={{ fontSize: 10, color: T.suave, fontWeight: 400 }}>
                          +{RD(itbisLinea(l), simbolo)} itbis
                        </div>
                      )}
                    </td>
                    <td style={{ ...td, textAlign: "center" }}>
                      <button
                        type="button"
                        onClick={() => onCambio(lineas.filter((_, x) => x !== i))}
                        style={{ background: "transparent", border: "none", color: T.err, cursor: "pointer", fontSize: 15 }}
                        title="Quitar"
                      >✕</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function ResumenTotales({
  lineas, descuento, simbolo = "RD$", onDescuento,
}: {
  lineas: Linea[];
  descuento: number;
  simbolo?: string;
  onDescuento?: (v: number) => void;
}) {
  const t = totalesDocumento(lineas, descuento);
  const fila: React.CSSProperties = {
    display: "flex", justifyContent: "space-between", gap: 12, padding: "6px 0", fontSize: 13.5,
  };
  return (
    <div style={{ background: T.panel2, border: `1px solid ${T.borde}`, borderRadius: 11, padding: 16 }}>
      <div style={fila}>
        <span style={{ color: T.suave }}>Subtotal</span>
        <span style={{ fontVariantNumeric: "tabular-nums" }}>{RD(t.subtotal, simbolo)}</span>
      </div>
      <div style={fila}>
        <span style={{ color: T.suave }}>ITBIS</span>
        <span style={{ fontVariantNumeric: "tabular-nums" }}>{RD(t.itbis, simbolo)}</span>
      </div>
      {onDescuento && (
        <div style={{ ...fila, alignItems: "center" }}>
          <span style={{ color: T.suave }}>Descuento general</span>
          <input
            type="number" step="0.01" min={0}
            style={{ ...inputBase, width: 120, textAlign: "right", padding: "6px 9px" }}
            value={descuento}
            onChange={(e) => onDescuento(Number(e.target.value) || 0)}
          />
        </div>
      )}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        borderTop: `2px solid ${T.oscuro}`, marginTop: 8, paddingTop: 12,
      }}>
        <span style={{ fontSize: 13, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5 }}>
          Total
        </span>
        <span style={{ fontSize: 25, fontWeight: 800, color: T.acento, fontVariantNumeric: "tabular-nums" }}>
          {RD(t.total, simbolo)}
        </span>
      </div>
    </div>
  );
}

export { Btn };
