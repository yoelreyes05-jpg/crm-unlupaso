"use client";
/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║           UNLUPASO — Sistema POS Completo                       ║
 * ║           Un lugar para soñar                                   ║
 * ║           Tel: 829-644-7991                                     ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * Uso:
 *   Copia este archivo a src/app/(dashboard)/pos/page.tsx
 *   Asegúrate de tener API_URL en src/config.ts
 *
 * APIs requeridas (igual que tu backend actual):
 *   GET  /cafeteria/productos
 *   POST /cafeteria/productos
 *   PUT  /cafeteria/productos/:id
 *   PATCH /cafeteria/productos/:id
 *   DELETE /cafeteria/productos/:id
 *   POST /cafeteria/venta
 *   GET  /cafeteria/ordenes
 *   GET  /cafeteria/cuadre
 *   POST /cafeteria/cuadre
 *   GET  /cafeteria/cuadre/auto?fecha=YYYY-MM-DD
 */

import {
  useEffect, useState, useMemo, useCallback, useRef,
} from "react";
import { API_URL as API } from "@/config";

// ─── Constantes del negocio ───────────────────────────────────────────────────
const NEGOCIO = {
  nombre:    "UNLUPASO",
  slogan:    "Un lugar para soñar",
  telefono:  "829-644-7991",
  rnc:       "",           // opcional
  direccion: "",           // opcional
};

// ─── Métodos de pago ──────────────────────────────────────────────────────────
const METODOS = [
  { key: "EFECTIVO",      label: "💵 Efectivo",      color: "#10b981" },
  { key: "TARJETA",       label: "💳 Tarjeta",        color: "#3b82f6" },
  { key: "TRANSFERENCIA", label: "📲 Transferencia",  color: "#8b5cf6" },
] as const;

// ─── Tipos NCF (DGII República Dominicana) ────────────────────────────────────
const NCF_TIPOS = [
  { key: "B02", label: "B02", desc: "Consumidor Final" },
  { key: "B01", label: "B01", desc: "Crédito Fiscal"   },
  { key: "B14", label: "B14", desc: "Régimen Especial" },
  { key: "B15", label: "B15", desc: "Gubernamental"    },
] as const;

const NCF_DESC: Record<string, string> = Object.fromEntries(
  NCF_TIPOS.map(n => [n.key, n.desc])
);

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface Producto {
  id: number;
  nombre: string;
  precio: number;
  categoria: string;
  stock: number;
  imagen?: string;
}

interface ItemCarrito extends Producto {
  qty: number;
}

interface Venta {
  id: number;
  total: number;
  metodo_pago: string;
  ncf?: string;
  ncf_tipo?: string;
  created_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// UTILIDADES DE IMPRESIÓN
// ─────────────────────────────────────────────────────────────────────────────

/** Imprime HTML usando un iframe oculto (método más confiable) */
function imprimirHTML(html: string) {
  const prev = document.getElementById("__unlupaso_print__");
  if (prev) prev.remove();
  const iframe = document.createElement("iframe");
  iframe.id = "__unlupaso_print__";
  iframe.style.cssText =
    "position:fixed;top:-9999px;left:-9999px;width:820px;height:1000px;border:none;opacity:0;";
  document.body.appendChild(iframe);
  const doc =
    iframe.contentDocument || (iframe.contentWindow as any)?.document;
  if (!doc) {
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); }
    return;
  }
  doc.open(); doc.write(html); doc.close();
  iframe.onload = () => {
    try {
      (iframe.contentWindow as any)?.focus();
      (iframe.contentWindow as any)?.print();
    } catch {
      const w = window.open("", "_blank");
      if (w) { w.document.write(html); w.document.close(); }
    }
  };
}

/** Genera el HTML del recibo térmico 80mm */
function generarRecibo(
  items: ItemCarrito[],
  total: number,
  metodo: string,
  ncf: string | undefined,
  ncfTipo: string,
  ventaId: number | string
): string {
  const fecha = new Date().toLocaleString("es-DO", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
  const ncfDesc = NCF_DESC[ncfTipo] || ncfTipo;
  const lineas = items.map(p =>
    `<div class="item">
       <span>${p.nombre} x${p.qty}</span>
       <span>RD$ ${(p.precio * p.qty).toFixed(2)}</span>
     </div>`
  ).join("");

  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/>
  <title>Recibo ${NEGOCIO.nombre}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box;}
    body{font-family:'Courier New',monospace;font-size:13px;max-width:320px;margin:0 auto;padding:20px 14px;}
    .center{text-align:center;}
    .bold{font-weight:700;}
    .lg{font-size:16px;}
    .sm{font-size:11px;color:#666;}
    hr{border:none;border-top:1px dashed #ccc;margin:10px 0;}
    .item{display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px dotted #ddd;}
    .total-row{display:flex;justify-content:space-between;padding:9px 0;font-size:16px;font-weight:900;border-top:2px solid #111;margin-top:6px;}
    .ncf-box{background:#111;color:#fff;padding:10px 12px;border-radius:6px;margin:12px 0;text-align:center;}
    .ncf-num{font-size:16px;font-weight:900;letter-spacing:3px;}
    .ncf-tipo{font-size:10px;color:rgba(255,255,255,.6);margin-top:3px;}
    @media print{body{padding:4px;}}
  </style></head><body>
  <div class="center">
    <div class="bold lg">${NEGOCIO.nombre}</div>
    <div class="sm">${NEGOCIO.slogan}</div>
    <div class="sm">Tel: ${NEGOCIO.telefono}</div>
    ${NEGOCIO.rnc ? `<div class="sm">${NEGOCIO.rnc}</div>` : ""}
    ${NEGOCIO.direccion ? `<div class="sm">${NEGOCIO.direccion}</div>` : ""}
  </div>
  <hr/>
  <div class="center sm">
    Fecha: ${fecha}<br/>
    Recibo: #${String(ventaId).padStart(5, "0")}<br/>
    Comprobante: <strong>${ncfDesc}</strong>
  </div>
  <hr/>
  ${lineas}
  <div class="total-row"><span>TOTAL</span><span>RD$ ${total.toFixed(2)}</span></div>
  <div style="display:flex;justify-content:space-between;font-size:11px;margin-top:5px;color:#666;">
    <span>Pago: ${metodo}</span>
    <span>${ncfTipo} · ${ncfDesc}</span>
  </div>
  ${ncf ? `<div class="ncf-box">
    <div class="sm" style="color:rgba(255,255,255,.6);margin-bottom:2px;">Comprobante Fiscal</div>
    <div class="ncf-num">${ncf}</div>
    <div class="ncf-tipo">${ncfDesc}</div>
  </div>` : ""}
  <hr/>
  <div class="center sm">
    ¡Gracias por su visita!<br/>
    ${NEGOCIO.nombre} · ${NEGOCIO.telefono}
  </div>
  </body></html>`;
}

/** Genera el HTML del cuadre diario para imprimir */
function generarHTMLCuadre(c: any): string {
  const diferencia =
    c.efectivo_contado != null
      ? Number(c.efectivo_contado) - Number(c.ventas_efectivo)
      : null;

  const row = (lbl: string, val: string, bold = false, color = "#111") =>
    `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f0f0f0;">
       <span style="color:#555;">${lbl}</span>
       <span style="font-weight:${bold ? 800 : 500};color:${color};">${val}</span>
     </div>`;

  const fmt = (n: any) =>
    "RD$ " + Number(n || 0).toLocaleString("es-DO", {
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    });

  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/>
  <title>Cuadre ${NEGOCIO.nombre} — ${c.fecha}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box;}
    body{font-family:Arial,sans-serif;font-size:13px;padding:28px;max-width:560px;margin:auto;}
    h1{font-size:17px;font-weight:900;}
    .sec{font-weight:700;font-size:11px;text-transform:uppercase;color:#d97706;
      letter-spacing:.5px;margin:14px 0 6px;border-bottom:2px solid #fde68a;padding-bottom:3px;}
    .total-line{display:flex;justify-content:space-between;padding:8px 0;
      font-weight:800;font-size:15px;}
    .footer{text-align:center;font-size:11px;color:#aaa;margin-top:24px;
      border-top:1px dashed #ddd;padding-top:12px;line-height:1.8;}
    @media print{button{display:none!important;}}
  </style></head><body>
  <div style="text-align:center;margin-bottom:18px;">
    <h1>${NEGOCIO.nombre}</h1>
    <div style="font-size:12px;color:#555;">${NEGOCIO.slogan}</div>
    <div style="font-size:12px;color:#888;margin-top:4px;">
      CUADRE DIARIO — ${c.fecha}<br/>
      Responsable: <b>${c.usuario || "—"}</b> · Transacciones: <b>${c.transacciones_count || 0}</b>
    </div>
  </div>
  <div class="sec">Ventas del día</div>
  ${row("Ventas en efectivo", fmt(c.ventas_efectivo))}
  ${Number(c.ventas_tarjeta || 0) > 0 ? row("Ventas con tarjeta", fmt(c.ventas_tarjeta)) : ""}
  ${Number(c.ventas_transferencia || 0) > 0 ? row("Ventas por transferencia", fmt(c.ventas_transferencia)) : ""}
  <div class="total-line" style="border-top:2px solid #d97706;margin-top:4px;">
    <span>TOTAL VENTAS</span><span>${fmt(c.ventas_total)}</span>
  </div>
  <div class="sec">Cuadre de efectivo</div>
  ${row("Efectivo esperado en caja", fmt(c.ventas_efectivo))}
  ${c.efectivo_contado != null
    ? row("Efectivo contado físicamente", fmt(c.efectivo_contado), true)
    : `<div style="color:#aaa;font-size:12px;padding:6px 0;">Sin conteo físico registrado</div>`}
  ${diferencia !== null
    ? `<div class="total-line" style="border-top:2px solid ${diferencia >= 0 ? "#10b981" : "#ef4444"};margin-top:4px;color:${diferencia >= 0 ? "#065f46" : "#991b1b"};">
         <span>DIFERENCIA</span><span>${diferencia >= 0 ? "+" : ""}${fmt(diferencia)}</span>
       </div>` : ""}
  ${c.notas ? `<div class="sec">Notas</div><p style="color:#555;font-size:13px;">${c.notas}</p>` : ""}
  <div style="display:flex;justify-content:space-around;margin-top:20px;">
    <div style="text-align:center;">
      <div style="border-top:1px solid #333;width:180px;padding-top:4px;font-size:11px;color:#555;">Responsable — ${c.usuario || ""}</div>
    </div>
    <div style="text-align:center;">
      <div style="border-top:1px solid #333;width:180px;padding-top:4px;font-size:11px;color:#555;">Supervisado por</div>
    </div>
  </div>
  <div class="footer">
    ${NEGOCIO.nombre} · ${NEGOCIO.slogan} · Tel: ${NEGOCIO.telefono}<br/>
    Impreso: ${new Date().toLocaleString("es-DO", { timeZone: "America/Santo_Domingo" })}
  </div>
  <script>setTimeout(() => window.print(), 400);<\/script>
  </body></html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export default function UnlupasoPOS() {
  // ── Estado global ─────────────────────────────────────────────────────────
  const [tab, setTab] = useState<"pos" | "productos" | "historial" | "cuadre">("pos");

  return (
    <div style={S.app}>
      {/* ══ HEADER ══════════════════════════════════════════════════════════ */}
      <header style={S.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
          <span style={{ fontSize: 28 }}>☕</span>
          <div>
            <div style={S.headerTitle}>{NEGOCIO.nombre}</div>
            <div style={S.headerSub}>{NEGOCIO.slogan} · {NEGOCIO.telefono}</div>
          </div>
        </div>
        {/* Tabs de navegación */}
        <nav style={{ display: "flex", gap: 6 }}>
          {(
            [
              { k: "pos",       icon: "🛒", label: "Punto de Venta" },
              { k: "productos", icon: "📦", label: "Productos"      },
              { k: "historial", icon: "📋", label: "Historial"      },
              { k: "cuadre",    icon: "🏦", label: "Cuadre"         },
            ] as { k: typeof tab; icon: string; label: string }[]
          ).map(t => (
            <button
              key={t.k}
              onClick={() => setTab(t.k)}
              style={{
                ...S.tabBtn,
                background: tab === t.k ? "#f59e0b" : "#334155",
                color:      tab === t.k ? "#111"    : "#94a3b8",
              }}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </nav>
      </header>

      {/* ══ CONTENIDO ═══════════════════════════════════════════════════════ */}
      {tab === "pos"       && <TabPOS />}
      {tab === "productos" && <TabProductos />}
      {tab === "historial" && <TabHistorial />}
      {tab === "cuadre"    && <TabCuadre />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: PUNTO DE VENTA
// ─────────────────────────────────────────────────────────────────────────────
function TabPOS() {
  const [productos,   setProductos]   = useState<Producto[]>([]);
  const [carrito,     setCarrito]     = useState<ItemCarrito[]>([]);
  const [catActiva,   setCatActiva]   = useState("Todos");
  const [busqueda,    setBusqueda]    = useState("");
  const [metodo,      setMetodo]      = useState<string>("EFECTIVO");
  const [ncfTipo,     setNcfTipo]     = useState("B02");
  const [montoRec,    setMontoRec]    = useState("");
  const [cobrando,    setCobrando]    = useState(false);
  const [ultimaVenta, setUltimaVenta] = useState<{ venta: Venta; items: ItemCarrito[] } | null>(null);
  const [stockModal,  setStockModal]  = useState<Producto | null>(null);
  const [stockVal,    setStockVal]    = useState("");

  const cargarProductos = useCallback(async () => {
    try {
      const r = await fetch(`${API}/cafeteria/productos`);
      const d = await r.json();
      setProductos(Array.isArray(d) ? d : []);
    } catch { setProductos([]); }
  }, []);

  useEffect(() => { cargarProductos(); }, [cargarProductos]);

  // Categorías dinámicas
  const categorias = useMemo(() => {
    const s = new Set(productos.map(p => p.categoria || "Sin categoría"));
    return ["Todos", ...Array.from(s)];
  }, [productos]);

  // Productos filtrados
  const productosFiltrados = useMemo(() => {
    let list = catActiva === "Todos"
      ? productos
      : productos.filter(p => (p.categoria || "Sin categoría") === catActiva);
    if (busqueda.trim())
      list = list.filter(p =>
        p.nombre.toLowerCase().includes(busqueda.toLowerCase())
      );
    return list;
  }, [productos, catActiva, busqueda]);

  // ── Carrito ──────────────────────────────────────────────────────────────
  const agregar = (prod: Producto) => {
    if (prod.stock <= 0) return;
    setCarrito(prev => {
      const ex = prev.find(p => p.id === prod.id);
      if (ex) {
        if (ex.qty >= prod.stock) return prev;
        return prev.map(p => p.id === prod.id ? { ...p, qty: p.qty + 1 } : p);
      }
      return [...prev, { ...prod, qty: 1 }];
    });
  };

  const cambiarQty = (id: number, delta: number) => {
    setCarrito(prev =>
      prev.map(p => p.id === id ? { ...p, qty: Math.max(0, p.qty + delta) } : p)
          .filter(p => p.qty > 0)
    );
  };

  const total  = carrito.reduce((a, p) => a + p.precio * p.qty, 0);
  const vuelto = Number(montoRec || 0) - total;

  // ── Cobrar ───────────────────────────────────────────────────────────────
  const cobrar = async () => {
    if (carrito.length === 0) return;
    if (metodo === "EFECTIVO" && Number(montoRec) > 0 && vuelto < 0) {
      alert(`Monto insuficiente. Faltan RD$ ${Math.abs(vuelto).toFixed(2)}`);
      return;
    }
    setCobrando(true);
    const snap = [...carrito];
    try {
      const res = await fetch(`${API}/cafeteria/venta`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items:       snap.map(p => ({ id: p.id, qty: p.qty, precio: p.precio })),
          total,
          metodo_pago: metodo,
          ncf_tipo:    ncfTipo,
        }),
      });
      const data: Venta = await res.json();
      if (!res.ok || (data as any).error) {
        alert("❌ Error: " + ((data as any).error || "Error desconocido"));
        return;
      }
      setUltimaVenta({ venta: data, items: snap });
      imprimirHTML(generarRecibo(snap, total, metodo, data.ncf, ncfTipo, data.id));
      setCarrito([]);
      setMontoRec("");
      cargarProductos();
    } catch (e: any) {
      alert("Error de conexión: " + e.message);
    } finally {
      setCobrando(false);
    }
  };

  // ── Ajuste rápido de stock ───────────────────────────────────────────────
  const guardarStock = async () => {
    if (!stockModal || stockVal === "") return;
    await fetch(`${API}/cafeteria/productos/${stockModal.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stock: Number(stockVal) }),
    });
    setStockModal(null);
    setStockVal("");
    cargarProductos();
  };

  return (
    <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

      {/* ── Panel izquierdo: Productos ──────────────────────────────────── */}
      <div style={S.panelLeft}>

        {/* Búsqueda */}
        <div style={S.searchBar}>
          <input
            placeholder="🔍 Buscar producto..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            style={S.searchInput}
          />
        </div>

        {/* Categorías */}
        <div style={S.catBar}>
          {categorias.map(cat => (
            <button
              key={cat}
              onClick={() => setCatActiva(cat)}
              style={{
                ...S.catBtn,
                background: catActiva === cat ? "#f59e0b" : "#334155",
                color:      catActiva === cat ? "#111"    : "#94a3b8",
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Grid de productos */}
        <div style={S.productGrid}>
          {productosFiltrados.length === 0 && (
            <div style={S.emptyMsg}>Sin productos en esta categoría</div>
          )}
          {productosFiltrados.map(prod => {
            const sinStock  = prod.stock <= 0;
            const enCarrito = carrito.find(p => p.id === prod.id);
            const stockBajo = !sinStock && prod.stock <= 5;
            return (
              <button
                key={prod.id}
                onClick={() => !sinStock && agregar(prod)}
                style={{
                  ...S.prodCard,
                  opacity:    sinStock ? 0.45 : 1,
                  cursor:     sinStock ? "not-allowed" : "pointer",
                  boxShadow:  enCarrito ? "0 0 0 2px #f59e0b" : "0 2px 8px rgba(0,0,0,0.4)",
                  background: enCarrito ? "#1d3a5f" : "#1e293b",
                }}
              >
                {/* Badge cantidad en carrito */}
                {enCarrito && (
                  <div style={S.qtyBadge}>{enCarrito.qty}</div>
                )}

                {/* Imagen o placeholder */}
                {prod.imagen
                  ? <img src={prod.imagen} alt={prod.nombre} style={S.prodImg} />
                  : <div style={S.prodImgPlaceholder}>☕</div>
                }

                <div style={S.prodNombre}>{prod.nombre}</div>
                <div style={S.prodPrecio}>RD$ {Number(prod.precio).toFixed(2)}</div>
                <div style={{
                  fontSize: 10, marginTop: 2,
                  color: sinStock ? "#ef4444" : stockBajo ? "#f59e0b" : "#64748b",
                }}>
                  {sinStock ? "❌ Sin stock" : stockBajo ? `⚠️ ${prod.stock} restantes` : `📦 ${prod.stock}`}
                </div>

                {/* Botón ajuste rápido de stock */}
                <button
                  onClick={e => {
                    e.stopPropagation();
                    setStockModal(prod);
                    setStockVal(String(prod.stock));
                  }}
                  title="Ajustar stock"
                  style={S.stockBtn}
                >
                  ⚙
                </button>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Panel derecho: Carrito + Cobro ──────────────────────────────── */}
      <div style={S.panelRight}>

        {/* Carrito header */}
        <div style={S.cartHeader}>
          <span style={{ fontWeight: 800, fontSize: 15 }}>
            🛒 Carrito&nbsp;
            <span style={{ fontSize: 12, color: "#64748b" }}>
              ({carrito.reduce((a, i) => a + i.qty, 0)} items)
            </span>
          </span>
          {carrito.length > 0 && (
            <button onClick={() => setCarrito([])} style={S.vaciarBtn}>
              ✕ Vaciar
            </button>
          )}
        </div>

        {/* Items del carrito */}
        <div style={S.cartItems}>
          {carrito.length === 0 && (
            <div style={S.emptyCart}>Toca un producto para agregar</div>
          )}
          {carrito.map(p => (
            <div key={p.id} style={S.cartRow}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{p.nombre}</div>
                <div style={{ fontSize: 12, color: "#10b981" }}>
                  RD$ {(p.precio * p.qty).toFixed(2)}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <button onClick={() => cambiarQty(p.id, -1)} style={S.qtyBtn}>−</button>
                <span style={{ fontSize: 14, fontWeight: 800, minWidth: 22, textAlign: "center" }}>
                  {p.qty}
                </span>
                <button
                  onClick={() => cambiarQty(p.id, +1)}
                  disabled={p.qty >= p.stock}
                  style={{ ...S.qtyBtn, opacity: p.qty >= p.stock ? 0.4 : 1 }}
                >
                  +
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Panel de pago */}
        <div style={S.payPanel}>

          {/* Total */}
          <div style={S.totalRow}>
            <span>TOTAL</span>
            <span style={{ color: "#10b981" }}>RD$ {total.toFixed(2)}</span>
          </div>

          {/* Monto recibido + vuelto */}
          <div style={{ marginBottom: 10 }}>
            <label style={S.payLabel}>💵 Monto recibido (RD$)</label>
            <input
              type="number"
              value={montoRec}
              onChange={e => setMontoRec(e.target.value)}
              placeholder="0.00"
              style={S.montoInput}
            />
            {Number(montoRec) > 0 && (
              <div style={{
                ...S.vueltoBox,
                background: vuelto >= 0 ? "#064e3b" : "#450a0a",
                color:      vuelto >= 0 ? "#34d399" : "#fca5a5",
              }}>
                {vuelto >= 0
                  ? `💚 Vuelto: RD$ ${vuelto.toFixed(2)}`
                  : `🔴 Faltan: RD$ ${Math.abs(vuelto).toFixed(2)}`}
              </div>
            )}
          </div>

          {/* Método de pago */}
          <div style={{ marginBottom: 10 }}>
            <label style={S.payLabel}>Método de pago</label>
            <div style={{ display: "flex", gap: 5 }}>
              {METODOS.map(m => (
                <button
                  key={m.key}
                  onClick={() => setMetodo(m.key)}
                  style={{
                    ...S.metodoBtn,
                    background: metodo === m.key ? m.color : "#334155",
                    color:      metodo === m.key ? "#fff"   : "#94a3b8",
                  }}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tipo NCF */}
          <div style={{ marginBottom: 12 }}>
            <label style={S.payLabel}>🧾 Comprobante Fiscal</label>
            <div style={{ display: "flex", gap: 5 }}>
              {NCF_TIPOS.map(n => (
                <button
                  key={n.key}
                  onClick={() => setNcfTipo(n.key)}
                  style={{
                    ...S.ncfBtn,
                    background: ncfTipo === n.key ? "#1d4ed8" : "#334155",
                    color:      ncfTipo === n.key ? "#fff"    : "#94a3b8",
                    boxShadow:  ncfTipo === n.key ? "0 2px 8px rgba(29,78,216,0.4)" : "none",
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 900 }}>{n.key}</div>
                  <div style={{ fontSize: 9, opacity: 0.85 }}>{n.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Botón cobrar */}
          <button
            onClick={cobrar}
            disabled={cobrando || carrito.length === 0}
            style={{
              ...S.cobrarBtn,
              background: carrito.length === 0
                ? "#334155"
                : "linear-gradient(135deg,#059669,#10b981)",
              opacity: cobrando ? 0.7 : 1,
            }}
          >
            {cobrando ? "⏳ Procesando..." : `🖨️ COBRAR · RD$ ${total.toFixed(2)}`}
          </button>

          {/* Reimprimir última venta */}
          {ultimaVenta && (
            <div style={{ marginTop: 10 }}>
              <div style={S.ultimaVentaBox}>
                ✅ Venta #{ultimaVenta.venta.id} procesada
                {ultimaVenta.venta.ncf && (
                  <div style={{ fontSize: 11, color: "#6ee7b7", marginTop: 2 }}>
                    NCF: {ultimaVenta.venta.ncf}
                  </div>
                )}
              </div>
              <button
                onClick={() =>
                  imprimirHTML(generarRecibo(
                    ultimaVenta.items, ultimaVenta.venta.total,
                    ultimaVenta.venta.metodo_pago, ultimaVenta.venta.ncf,
                    ultimaVenta.venta.ncf_tipo || "B02", ultimaVenta.venta.id
                  ))
                }
                style={S.reimprimirBtn}
              >
                🔁 Reimprimir último recibo
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Modal ajuste de stock ────────────────────────────────────────── */}
      {stockModal && (
        <div style={S.overlay}>
          <div style={S.modal}>
            <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 8 }}>
              📦 Ajustar Stock
            </h3>
            <p style={{ fontSize: 14, color: "#94a3b8", marginBottom: 12 }}>
              {stockModal.nombre}
            </p>
            <input
              type="number"
              min={0}
              value={stockVal}
              onChange={e => setStockVal(e.target.value)}
              autoFocus
              style={S.modalInput}
            />
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => { setStockModal(null); setStockVal(""); }}
                style={S.modalBtnCancel}
              >
                Cancelar
              </button>
              <button onClick={guardarStock} style={S.modalBtnOk}>
                ✓ Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: GESTIÓN DE PRODUCTOS
// ─────────────────────────────────────────────────────────────────────────────
function TabProductos() {
  const [productos,     setProductos]     = useState<Producto[]>([]);
  const [nuevo,         setNuevo]         = useState({ nombre: "", precio: "", categoria: "General", stock: "" });
  const [nuevoImagen,   setNuevoImagen]   = useState("");
  const [editandoId,    setEditandoId]    = useState<number | null>(null);
  const [editForm,      setEditForm]      = useState<any>({});
  const [editImagenId,  setEditImagenId]  = useState<number | null>(null);
  const [editImagenB64, setEditImagenB64] = useState("");
  const [guardando,     setGuardando]     = useState(false);
  const fileNewRef  = useRef<HTMLInputElement>(null);
  const fileEditRef = useRef<HTMLInputElement>(null);

  const obtener = useCallback(async () => {
    try {
      const r = await fetch(`${API}/cafeteria/productos`);
      const d = await r.json();
      setProductos(Array.isArray(d) ? d : []);
    } catch { setProductos([]); }
  }, []);

  useEffect(() => { obtener(); }, [obtener]);

  const leerImagen = (file: File, cb: (b64: string) => void) => {
    const reader = new FileReader();
    reader.onload = e => cb(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const crearProducto = async () => {
    if (!nuevo.nombre || !nuevo.precio) return alert("Nombre y precio son requeridos");
    await fetch(`${API}/cafeteria/productos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...nuevo, imagen: nuevoImagen || null }),
    });
    setNuevo({ nombre: "", precio: "", categoria: "General", stock: "" });
    setNuevoImagen("");
    if (fileNewRef.current) fileNewRef.current.value = "";
    obtener();
  };

  const guardarEdicion = async () => {
    if (!editandoId) return;
    setGuardando(true);
    try {
      await fetch(`${API}/cafeteria/productos/${editandoId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      setEditandoId(null);
      setEditForm({});
      obtener();
    } catch { alert("Error al guardar"); }
    finally { setGuardando(false); }
  };

  const guardarImagen = async () => {
    if (!editImagenId || !editImagenB64) return;
    await fetch(`${API}/cafeteria/productos/${editImagenId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imagen: editImagenB64 }),
    });
    setEditImagenId(null);
    setEditImagenB64("");
    if (fileEditRef.current) fileEditRef.current.value = "";
    obtener();
  };

  const archivar = async (p: Producto) => {
    if (!confirm(`¿Archivar "${p.nombre}"?\nEl historial de ventas se conserva.`)) return;
    setProductos(prev => prev.filter(x => x.id !== p.id));
    try {
      const res = await fetch(`${API}/cafeteria/productos/${p.id}`, { method: "DELETE" });
      if (!res.ok) { alert("Error al archivar"); await obtener(); }
      else await obtener();
    } catch { await obtener(); }
  };

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 24, display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-start" }}>

      {/* Formulario nuevo producto */}
      <div style={{ ...S.lightCard, width: 340, flexShrink: 0 }}>
        <h2 style={S.lightCardTitle}>➕ Nuevo Producto</h2>

        {[
          { label: "Nombre *", key: "nombre", type: "text", placeholder: "Ej: Café negro, Churro..." },
          { label: "Precio (RD$) *", key: "precio", type: "number", placeholder: "0.00" },
          { label: "Categoría", key: "categoria", type: "text", placeholder: "Helados, Bebidas, Snacks..." },
          { label: "Stock inicial", key: "stock", type: "number", placeholder: "0" },
        ].map(f => (
          <div key={f.key} style={{ marginBottom: 12 }}>
            <label style={S.lLabel}>{f.label}</label>
            <input
              type={f.type}
              placeholder={f.placeholder}
              value={(nuevo as any)[f.key]}
              onChange={e => setNuevo({ ...nuevo, [f.key]: e.target.value })}
              style={S.lInput}
            />
          </div>
        ))}

        <div style={{ marginBottom: 12 }}>
          <label style={S.lLabel}>📸 Imagen (opcional)</label>
          <input
            ref={fileNewRef}
            type="file"
            accept="image/*"
            onChange={e => { const f = e.target.files?.[0]; if (f) leerImagen(f, b64 => setNuevoImagen(b64)); }}
            style={{ fontSize: 13, width: "100%", marginBottom: 6 }}
          />
          {nuevoImagen && (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <img src={nuevoImagen} alt="preview" style={{ width: 56, height: 56, borderRadius: 8, objectFit: "cover" }} />
              <button
                onClick={() => { setNuevoImagen(""); if (fileNewRef.current) fileNewRef.current.value = ""; }}
                style={{ fontSize: 12, color: "#dc2626", background: "#fee2e2", border: "none", borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}
              >✕ Quitar</button>
            </div>
          )}
        </div>

        <button onClick={crearProducto} style={S.lBtnPrimary}>
          💾 Guardar Producto
        </button>
      </div>

      {/* Lista de productos */}
      <div style={{ ...S.lightCard, flex: 1, minWidth: 320 }}>
        <h2 style={S.lightCardTitle}>📋 Productos ({productos.length})</h2>

        {productos.map(p => (
          <div key={p.id}>
            {editandoId !== p.id && (
              <div style={S.prodRow}>
                {/* Thumbnail */}
                {p.imagen
                  ? <img src={p.imagen} alt={p.nombre} style={S.prodThumb} />
                  : <div style={S.prodThumbPlaceholder}>☕</div>
                }
                {/* Info */}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{p.nombre}</div>
                  <div style={{ fontSize: 12, color: "#888" }}>
                    {p.categoria} ·{" "}
                    <span style={{ color: p.stock <= 0 ? "#ef4444" : p.stock <= 5 ? "#f59e0b" : "#10b981", fontWeight: 700 }}>
                      Stock: {p.stock}
                    </span>
                    {" · "}RD$ {Number(p.precio).toFixed(2)}
                  </div>
                </div>
                {/* Acciones */}
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    onClick={() => { setEditImagenId(p.id); setEditandoId(null); setEditImagenB64(""); }}
                    style={S.lBtnSm}
                    title="Cambiar imagen"
                  >📸</button>
                  <button
                    onClick={() => { setEditandoId(p.id); setEditForm({ nombre: p.nombre, precio: p.precio, categoria: p.categoria, stock: p.stock }); setEditImagenId(null); }}
                    style={{ ...S.lBtnSm, background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe" }}
                  >✏️ Editar</button>
                  <button
                    onClick={() => archivar(p)}
                    style={{ ...S.lBtnSm, background: "#fee2e2", color: "#dc2626", border: "1px solid #fca5a5" }}
                  >📦 Archivar</button>
                </div>
              </div>
            )}

            {/* Formulario cambiar imagen */}
            {editImagenId === p.id && editandoId !== p.id && (
              <div style={S.editBox}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>📸 Cambiar imagen — {p.nombre}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <input
                    ref={fileEditRef}
                    type="file"
                    accept="image/*"
                    onChange={e => { const f = e.target.files?.[0]; if (f) leerImagen(f, b64 => setEditImagenB64(b64)); }}
                    style={{ fontSize: 12 }}
                  />
                  {editImagenB64 && <img src={editImagenB64} alt="preview" style={{ width: 40, height: 40, borderRadius: 6, objectFit: "cover" }} />}
                  <button onClick={guardarImagen} disabled={!editImagenB64} style={S.lBtnPrimary}>✓ Guardar</button>
                  <button onClick={() => { setEditImagenId(null); setEditImagenB64(""); }} style={S.lBtnCancel}>✕</button>
                </div>
              </div>
            )}

            {/* Formulario edición completa */}
            {editandoId === p.id && (
              <div style={{ ...S.editBox, background: "#eff6ff", border: "1px solid #bfdbfe" }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#1d4ed8", marginBottom: 10 }}>
                  ✏️ Editando: {p.nombre}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                  {[
                    { label: "Nombre", key: "nombre" },
                    { label: "Categoría", key: "categoria" },
                    { label: "Precio (RD$)", key: "precio", type: "number" },
                    { label: "Stock", key: "stock", type: "number" },
                  ].map(f => (
                    <div key={f.key}>
                      <label style={{ ...S.lLabel, color: "#1d4ed8" }}>{f.label}</label>
                      <input
                        type={f.type || "text"}
                        value={editForm[f.key] ?? ""}
                        onChange={e => setEditForm((prev: any) => ({ ...prev, [f.key]: e.target.value }))}
                        style={{ ...S.lInput, border: "1px solid #93c5fd", marginBottom: 0 }}
                      />
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={guardarEdicion} disabled={guardando} style={S.lBtnPrimary}>
                    {guardando ? "Guardando..." : "✓ Guardar Cambios"}
                  </button>
                  <button onClick={() => { setEditandoId(null); setEditForm({}); }} style={S.lBtnCancel}>
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: HISTORIAL DE VENTAS
// ─────────────────────────────────────────────────────────────────────────────
function TabHistorial() {
  const [historial, setHistorial] = useState<Venta[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [busqueda,  setBusqueda]  = useState("");
  const [fechaFiltro, setFechaFiltro] = useState("");

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/cafeteria/ordenes`);
      const d = await r.json();
      setHistorial(Array.isArray(d) ? d : []);
    } catch { setHistorial([]); }
    setLoading(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const filtrado = useMemo(() => {
    let list = historial;
    if (busqueda.trim())
      list = list.filter(v =>
        String(v.id).includes(busqueda) ||
        (v.ncf && v.ncf.includes(busqueda)) ||
        v.metodo_pago.toLowerCase().includes(busqueda.toLowerCase())
      );
    if (fechaFiltro)
      list = list.filter(v =>
        v.created_at && v.created_at.startsWith(fechaFiltro)
      );
    return list;
  }, [historial, busqueda, fechaFiltro]);

  const totalFiltrado = filtrado.reduce((a, v) => a + Number(v.total), 0);

  const metodoColor: Record<string, string> = {
    EFECTIVO: "#10b981", TARJETA: "#3b82f6", TRANSFERENCIA: "#8b5cf6",
  };

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
      {/* Header */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0, flex: 1 }}>
          📋 Historial de Ventas
        </h2>
        <input
          placeholder="🔍 Buscar por ID, NCF, método..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          style={{ ...S.lInput, width: 240, marginBottom: 0, background: "#1e293b", color: "#f1f5f9", border: "1px solid #334155" }}
        />
        <input
          type="date"
          value={fechaFiltro}
          onChange={e => setFechaFiltro(e.target.value)}
          style={{ ...S.lInput, width: 160, marginBottom: 0, background: "#1e293b", color: "#f1f5f9", border: "1px solid #334155" }}
        />
        <button onClick={cargar} style={{ ...S.metodoBtn, background: "#334155", color: "#94a3b8", whiteSpace: "nowrap" }}>
          🔄 Actualizar
        </button>
      </div>

      {/* Resumen rápido */}
      {filtrado.length > 0 && (
        <div style={{ background: "#1e293b", borderRadius: 12, padding: "10px 16px", marginBottom: 16, display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 11, color: "#64748b" }}>VENTAS MOSTRADAS</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#f1f5f9" }}>{filtrado.length}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "#64748b" }}>TOTAL</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#10b981" }}>RD$ {totalFiltrado.toFixed(2)}</div>
          </div>
        </div>
      )}

      {loading && <div style={S.emptyMsg}>Cargando...</div>}

      {!loading && filtrado.length === 0 && (
        <div style={S.emptyMsg}>Sin ventas para mostrar</div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {filtrado.map(v => (
          <div key={v.id} style={S.histRow}>
            <div style={{ background: "#0f172a", borderRadius: 8, padding: "6px 10px", textAlign: "center", minWidth: 52 }}>
              <div style={{ fontSize: 10, color: "#64748b" }}>#{String(v.id).padStart(4, "0")}</div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#10b981" }}>
                RD$ {Number(v.total).toFixed(2)}
              </div>
              {v.ncf && (
                <div style={{ fontSize: 11, color: "#64748b" }}>NCF: {v.ncf}</div>
              )}
            </div>
            <div style={{ textAlign: "right" }}>
              <span style={{
                background: metodoColor[v.metodo_pago] || "#64748b",
                color: "#fff", borderRadius: 6, padding: "3px 9px", fontSize: 11, fontWeight: 700,
              }}>
                {v.metodo_pago || "EFECTIVO"}
              </span>
              <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
                {v.created_at
                  ? new Date(v.created_at).toLocaleString("es-DO")
                  : "—"}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: CUADRE DIARIO
// ─────────────────────────────────────────────────────────────────────────────
function TabCuadre() {
  const hoy = new Date().toISOString().slice(0, 10);
  const [historial,    setHistorial]    = useState<any[]>([]);
  const [loading,      setLoading]      = useState(false);
  const [fetching,     setFetching]     = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [preview,      setPreview]      = useState<any>(null);
  const [fechaSel,     setFechaSel]     = useState(hoy);
  const [efectContado, setEfectContado] = useState("");
  const [notas,        setNotas]        = useState("");

  const cargarHistorial = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/cafeteria/cuadre`);
      const d = await r.json();
      setHistorial(Array.isArray(d) ? d : []);
    } catch { setHistorial([]); }
    setLoading(false);
  }, []);

  useEffect(() => { cargarHistorial(); }, [cargarHistorial]);

  const generarPreview = async () => {
    setFetching(true);
    setPreview(null);
    try {
      const r = await fetch(`${API}/cafeteria/cuadre/auto?fecha=${fechaSel}`);
      const d = await r.json();
      setPreview(d);
    } catch { alert("Error al calcular ventas del día"); }
    setFetching(false);
  };

  const guardar = async () => {
    if (!preview) return;
    setSaving(true);
    const diferencia = efectContado !== ""
      ? Number(efectContado) - Number(preview.ventas_efectivo)
      : null;
    try {
      const res = await fetch(`${API}/cafeteria/cuadre`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fecha:                preview.fecha,
          usuario:              NEGOCIO.nombre,
          ventas_efectivo:      preview.ventas_efectivo,
          ventas_tarjeta:       preview.ventas_tarjeta,
          ventas_transferencia: preview.ventas_transferencia,
          ventas_total:         preview.ventas_total,
          transacciones_count:  preview.transacciones_count,
          efectivo_contado:     efectContado !== "" ? Number(efectContado) : null,
          diferencia,
          notas:                notas || null,
        }),
      });
      const data = await res.json();
      if (data.error) { alert("Error: " + data.error); return; }
      setPreview(null);
      setEfectContado("");
      setNotas("");
      await cargarHistorial();
    } catch { alert("Error al guardar el cuadre"); }
    setSaving(false);
  };

  const fmt = (n: any) =>
    "RD$ " + Number(n || 0).toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const diferencia = preview && efectContado !== ""
    ? Number(efectContado) - Number(preview.ventas_efectivo)
    : null;

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>

      {/* Panel de generación */}
      <div style={{ ...S.lightCard, border: "2px solid #f59e0b", marginBottom: 20 }}>
        <h3 style={{ ...S.lightCardTitle, color: "#92400e" }}>🏦 Cuadre Diario</h3>

        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 160 }}>
            <label style={S.lLabel}>Fecha del cuadre</label>
            <input
              type="date"
              value={fechaSel}
              onChange={e => { setFechaSel(e.target.value); setPreview(null); }}
              style={{ ...S.lInput, marginBottom: 0 }}
            />
          </div>
          <button
            onClick={generarPreview}
            disabled={fetching}
            style={{ ...S.lBtnPrimary, background: "#d97706", minWidth: 200 }}
          >
            {fetching ? "⏳ Calculando..." : "⚡ Calcular ventas del día"}
          </button>
        </div>

        {preview && (
          <div style={{ marginTop: 18 }}>
            <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#92400e" }}>
              📊 <b>{preview.transacciones_count} transacción{preview.transacciones_count !== 1 ? "es" : ""}</b> registradas el {preview.fecha}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              {/* Ventas por método */}
              <div>
                <div style={S.cuadreSecTitle}>📥 Ventas por método</div>
                {[
                  ["💵 Efectivo",       preview.ventas_efectivo],
                  ...(Number(preview.ventas_tarjeta || 0) > 0      ? [["💳 Tarjeta",       preview.ventas_tarjeta]]       : []),
                  ...(Number(preview.ventas_transferencia || 0) > 0 ? [["📲 Transferencia", preview.ventas_transferencia]] : []),
                ].map(([lbl, val]) => (
                  <div key={lbl} style={S.cuadreRow}>
                    <span style={{ color: "#555" }}>{lbl}</span>
                    <span style={{ fontWeight: 600 }}>{fmt(val)}</span>
                  </div>
                ))}
                <div style={{ ...S.cuadreRow, borderTop: "2px solid #d97706", fontWeight: 800, fontSize: 14 }}>
                  <span>TOTAL</span><span>{fmt(preview.ventas_total)}</span>
                </div>
              </div>

              {/* Cuadre de efectivo */}
              <div>
                <div style={S.cuadreSecTitle}>⚖️ Cuadre de efectivo</div>
                <div style={S.cuadreRow}>
                  <span style={{ color: "#555" }}>Efectivo esperado</span>
                  <span style={{ fontWeight: 700, color: "#10b981" }}>{fmt(preview.ventas_efectivo)}</span>
                </div>
                <div style={{ marginTop: 12 }}>
                  <label style={S.lLabel}>💰 Efectivo contado (opcional)</label>
                  <input
                    type="number"
                    value={efectContado}
                    onChange={e => setEfectContado(e.target.value)}
                    placeholder="Dejar vacío si no contaste"
                    style={{ ...S.lInput, marginBottom: 0, fontSize: 14 }}
                  />
                </div>
                {diferencia !== null && (
                  <div style={{
                    ...S.cuadreRow,
                    borderTop: `2px solid ${diferencia >= 0 ? "#10b981" : "#ef4444"}`,
                    fontWeight: 800, fontSize: 14,
                    color: diferencia >= 0 ? "#065f46" : "#991b1b",
                  }}>
                    <span>DIFERENCIA</span>
                    <span>{diferencia >= 0 ? "+" : ""}{fmt(diferencia)}</span>
                  </div>
                )}
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <label style={S.lLabel}>📝 Notas (opcional)</label>
              <textarea
                value={notas}
                onChange={e => setNotas(e.target.value)}
                placeholder="Observaciones, incidencias..."
                style={{ ...S.lInput, height: 54, resize: "vertical", marginBottom: 0 }}
              />
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <button onClick={guardar} disabled={saving} style={{ ...S.lBtnPrimary, flex: 2 }}>
                {saving ? "Guardando..." : "💾 Guardar cuadre"}
              </button>
              <button
                onClick={() => { setPreview(null); setEfectContado(""); setNotas(""); }}
                style={{ ...S.lBtnCancel, flex: 1 }}
              >✕ Cancelar</button>
            </div>
          </div>
        )}
      </div>

      {/* Historial de cuadres */}
      <div style={S.lightCard}>
        <h3 style={S.lightCardTitle}>📋 Historial de Cuadres</h3>
        {loading
          ? <p style={{ color: "#888", textAlign: "center", padding: 20 }}>Cargando...</p>
          : historial.length === 0
            ? <p style={{ color: "#888", textAlign: "center", padding: 20 }}>Sin cuadres guardados</p>
            : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      {["Fecha", "Transac.", "Efectivo", "Tarjeta+Transfer.", "Total", "Contado", "Diferencia", ""].map(h => (
                        <th key={h} style={{ textAlign: "left", padding: "10px 10px", background: "#fef9c3", fontSize: 12, fontWeight: 700, borderBottom: "2px solid #fde68a" }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {historial.map((c: any) => {
                      const otros = Number(c.ventas_tarjeta || 0) + Number(c.ventas_transferencia || 0);
                      const diff  = Number(c.diferencia);
                      return (
                        <tr key={c.id}>
                          <td style={S.td}>{c.fecha}</td>
                          <td style={{ ...S.td, textAlign: "center" }}>{c.transacciones_count ?? "—"}</td>
                          <td style={S.td}>{fmt(c.ventas_efectivo)}</td>
                          <td style={S.td}>{fmt(otros)}</td>
                          <td style={{ ...S.td, fontWeight: 700 }}>{fmt(c.ventas_total)}</td>
                          <td style={S.td}>
                            {c.efectivo_contado != null ? fmt(c.efectivo_contado) : <span style={{ color: "#aaa" }}>—</span>}
                          </td>
                          <td style={{ ...S.td, fontWeight: 700, color: diff === 0 ? "#6b7280" : diff > 0 ? "#10b981" : "#ef4444" }}>
                            {c.efectivo_contado != null
                              ? (diff >= 0 ? "+" : "") + fmt(diff)
                              : <span style={{ color: "#aaa", fontSize: 11 }}>sin conteo</span>}
                          </td>
                          <td style={S.td}>
                            <button onClick={() => imprimirHTML(generarHTMLCuadre(c))} style={S.lBtnSm}>
                              🖨️ Imprimir
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
        }
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ESTILOS
// ─────────────────────────────────────────────────────────────────────────────
const S = {
  // Layout principal
  app: {
    display: "flex", flexDirection: "column" as const,
    height: "100vh", background: "#0f172a",
    fontFamily: "system-ui, -apple-system, sans-serif",
    color: "#f1f5f9",
  },
  // Header
  header: {
    display: "flex", alignItems: "center", gap: 16,
    padding: "12px 20px",
    background: "#1e293b", borderBottom: "1px solid #334155",
    flexShrink: 0,
  },
  headerTitle: { fontWeight: 800, fontSize: 17, color: "#f1f5f9" },
  headerSub:   { fontSize: 11,   color: "#64748b" },
  tabBtn: {
    padding: "8px 16px", borderRadius: 8, border: "none",
    cursor: "pointer", fontWeight: 700, fontSize: 12,
    transition: "all 0.15s",
  },
  // Paneles POS
  panelLeft: {
    flex: 1, display: "flex", flexDirection: "column" as const,
    overflow: "hidden", borderRight: "1px solid #1e293b",
  },
  panelRight: {
    width: 310, display: "flex", flexDirection: "column" as const,
    background: "#1e293b",
  },
  // Búsqueda
  searchBar: {
    padding: "10px 14px", background: "#1e293b", borderBottom: "1px solid #334155",
    flexShrink: 0,
  },
  searchInput: {
    width: "100%", background: "#334155", border: "1px solid #475569",
    borderRadius: 8, color: "#f1f5f9", padding: "9px 12px", fontSize: 14,
    boxSizing: "border-box" as const,
  },
  // Categorías
  catBar: {
    display: "flex", gap: 6, padding: "8px 14px",
    overflowX: "auto" as const, background: "#1e293b",
    borderBottom: "1px solid #334155", flexShrink: 0,
  },
  catBtn: {
    padding: "6px 14px", borderRadius: 20, border: "none",
    cursor: "pointer", fontWeight: 700, fontSize: 12,
    whiteSpace: "nowrap" as const, transition: "all 0.15s",
  },
  // Grid productos
  productGrid: {
    flex: 1, overflowY: "auto" as const, padding: 14,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
    gap: 10, alignContent: "start" as const,
  },
  prodCard: {
    position: "relative" as const,
    display: "flex", flexDirection: "column" as const, alignItems: "center",
    padding: "12px 8px", borderRadius: 14, border: "none",
    transition: "all 0.15s", textAlign: "center" as const,
  },
  prodImg: {
    width: 64, height: 64, borderRadius: 10,
    objectFit: "cover" as const, marginBottom: 8,
  },
  prodImgPlaceholder: {
    width: 64, height: 64, borderRadius: 10,
    background: "#334155", display: "flex",
    alignItems: "center", justifyContent: "center",
    fontSize: 28, marginBottom: 8,
  },
  prodNombre: { fontSize: 12, fontWeight: 700, color: "#f1f5f9", lineHeight: 1.2, marginBottom: 4 },
  prodPrecio: { fontSize: 14, fontWeight: 900, color: "#10b981" },
  qtyBadge: {
    position: "absolute" as const, top: 6, right: 6,
    background: "#f59e0b", color: "#111",
    borderRadius: "50%", width: 20, height: 20,
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 11, fontWeight: 900,
  },
  stockBtn: {
    position: "absolute" as const, bottom: 4, right: 4,
    background: "#334155", border: "none", borderRadius: 6,
    color: "#94a3b8", fontSize: 10, padding: "2px 5px", cursor: "pointer",
  },
  // Carrito
  cartHeader: {
    padding: "12px 16px", borderBottom: "1px solid #334155",
    display: "flex", justifyContent: "space-between", alignItems: "center",
    flexShrink: 0,
  },
  cartItems: { flex: 1, overflowY: "auto" as const, padding: "8px 12px" },
  emptyCart: { textAlign: "center" as const, color: "#475569", padding: "32px 0", fontSize: 13 },
  emptyMsg:  { gridColumn: "1 / -1", textAlign: "center" as const, color: "#475569", padding: 32, fontSize: 15 },
  cartRow: {
    display: "flex", alignItems: "center", gap: 8,
    padding: "8px 0", borderBottom: "1px solid #334155",
  },
  vaciarBtn: {
    background: "#450a0a", color: "#fca5a5", border: "none",
    borderRadius: 6, padding: "4px 10px", fontSize: 11,
    fontWeight: 700, cursor: "pointer",
  },
  qtyBtn: {
    width: 28, height: 28, borderRadius: 7, border: "none",
    background: "#334155", color: "#f1f5f9",
    fontSize: 16, fontWeight: 900, cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  // Panel de pago
  payPanel: {
    padding: "12px 14px", borderTop: "1px solid #334155",
    background: "#0f172a", flexShrink: 0,
  },
  totalRow: {
    display: "flex", justifyContent: "space-between",
    fontSize: 20, fontWeight: 900, marginBottom: 10,
  },
  payLabel: { display: "block", fontSize: 10, color: "#64748b", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: 1, marginBottom: 5 },
  montoInput: {
    width: "100%", background: "#1e293b", border: "1px solid #334155",
    borderRadius: 8, color: "#f1f5f9", padding: "9px 12px",
    fontSize: 16, fontWeight: 700, boxSizing: "border-box" as const, marginBottom: 6,
  },
  vueltoBox: {
    borderRadius: 8, padding: "10px 12px",
    textAlign: "center" as const, fontWeight: 800, fontSize: 15, marginBottom: 8,
  },
  metodoBtn: {
    flex: 1, padding: "8px 4px", borderRadius: 8, border: "none",
    cursor: "pointer", fontWeight: 700, fontSize: 11,
  },
  ncfBtn: {
    flex: 1, padding: "7px 4px", borderRadius: 7, border: "none",
    cursor: "pointer", fontWeight: 700, fontSize: 10, lineHeight: 1.3,
  },
  cobrarBtn: {
    width: "100%", padding: "15px", borderRadius: 12, border: "none",
    color: "#fff", fontSize: 16, fontWeight: 900, cursor: "pointer",
    boxShadow: "0 4px 16px rgba(16,185,129,0.4)", marginTop: 2,
  },
  ultimaVentaBox: {
    background: "#064e3b", borderRadius: 8,
    padding: "8px 12px", fontSize: 12,
    fontWeight: 700, color: "#34d399",
  },
  reimprimirBtn: {
    padding: "9px", background: "#1e293b", color: "#94a3b8",
    border: "1px solid #334155", borderRadius: 8, cursor: "pointer",
    width: "100%", marginTop: 8, fontSize: 12, fontWeight: 700,
  },
  // Modal
  overlay: {
    position: "fixed" as const, inset: 0,
    background: "rgba(0,0,0,0.75)",
    display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
  },
  modal: {
    background: "#1e293b", borderRadius: 16, padding: 28,
    width: 300, border: "1px solid #334155",
  },
  modalInput: {
    width: "100%", background: "#334155", border: "1px solid #475569",
    borderRadius: 8, color: "#f1f5f9", padding: "10px 12px",
    fontSize: 16, marginBottom: 14, boxSizing: "border-box" as const,
  },
  modalBtnCancel: {
    flex: 1, padding: 10, background: "#334155", color: "#94a3b8",
    border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700,
  },
  modalBtnOk: {
    flex: 1, padding: 10, background: "#10b981", color: "#fff",
    border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700,
  },
  // Modo claro (productos, cuadre)
  lightCard: {
    background: "#fff", padding: 20, borderRadius: 15,
    boxShadow: "0 4px 20px rgba(0,0,0,0.08)", marginBottom: 16,
  },
  lightCardTitle: { marginBottom: 16, fontSize: 18, fontWeight: 700 },
  lLabel: { display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4, color: "#555" },
  lInput: {
    display: "block", marginBottom: 12, padding: "11px 12px",
    width: "100%", borderRadius: 8, border: "1px solid #ddd",
    boxSizing: "border-box" as const, fontSize: 14, background: "#fff", color: "#111",
  },
  lBtnPrimary: {
    display: "block", padding: "11px 20px", background: "#111827", color: "#fff",
    border: "none", borderRadius: 8, cursor: "pointer",
    width: "100%", fontWeight: 700, fontSize: 14,
  },
  lBtnCancel: {
    padding: "11px 16px", background: "#f1f5f9", color: "#555",
    border: "1px solid #ddd", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 14,
  },
  lBtnSm: {
    background: "#f1f5f9", color: "#555", border: "1px solid #e2e8f0",
    borderRadius: 7, padding: "5px 10px", fontSize: 12, cursor: "pointer",
  },
  prodRow: {
    display: "flex", alignItems: "center", gap: 12,
    padding: "10px 0", borderBottom: "1px solid #f0f0f0",
  },
  prodThumb: {
    width: 50, height: 50, borderRadius: 8,
    objectFit: "cover" as const, border: "1px solid #e5e7eb", flexShrink: 0,
  },
  prodThumbPlaceholder: {
    width: 50, height: 50, borderRadius: 8,
    background: "#f1f5f9", display: "flex",
    alignItems: "center", justifyContent: "center",
    fontSize: 22, flexShrink: 0,
  },
  editBox: {
    background: "#f8fafc", border: "1px solid #e2e8f0",
    borderRadius: 10, padding: "12px 14px", marginBottom: 8,
  },
  // Historial
  histRow: {
    background: "#1e293b", borderRadius: 12,
    padding: "12px 16px", display: "flex",
    alignItems: "center", gap: 16, border: "1px solid #334155",
  },
  // Cuadre
  cuadreSecTitle: {
    fontWeight: 700, fontSize: 12, color: "#374151",
    textTransform: "uppercase" as const, letterSpacing: ".5px",
    marginBottom: 8, borderBottom: "2px solid #fde68a", paddingBottom: 4,
  },
  cuadreRow: {
    display: "flex", justifyContent: "space-between",
    padding: "5px 0", borderBottom: "1px solid #f0f0f0", fontSize: 13,
  },
  td: {
    padding: "10px 10px", borderBottom: "1px solid #f0f0f0",
    fontSize: 13,
  },
} as const;
