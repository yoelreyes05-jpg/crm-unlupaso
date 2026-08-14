"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Aviso, Badge, Btn, Cargando, Etiqueta, Kpi, Modal, PCT, RD, Seccion, Tabla,
  api, fecha, hoyISO, inputBase, rejilla, tonoStock, CrudPage, T,
  type Campo, type Columna, type Opcion,
} from "@/components/tienda/ui";

/** Inventario: catálogo de productos y kardex de entradas y salidas. */

const campos: Campo[] = [
  { name: "nombre",       label: "Nombre del producto", requerido: true, ancho: 2 },
  { name: "codigo_barra", label: "Código de barra" },
  { name: "categoria",    label: "Categoría" },
  { name: "marca",        label: "Marca" },
  { name: "unidad",       label: "Unidad", defecto: "unidad", ayuda: "unidad, caja, libra…" },
  { name: "costo",     label: "Costo de compra", tipo: "number", paso: "0.01", defecto: 0 },
  { name: "precio",    label: "Precio de venta (sin ITBIS)", tipo: "number", paso: "0.01", defecto: 0 },
  { name: "itbis_pct", label: "ITBIS %", tipo: "number", paso: "0.01", defecto: 0,
    ayuda: "0 si el producto es exento; 18 para que se le sume el impuesto" },
  { name: "stock_minimo", label: "Stock mínimo", tipo: "number", paso: "0.001", defecto: 0,
    ayuda: "Debajo de esta cantidad el sistema avisa" },
  { name: "ubicacion",  label: "Ubicación en la tienda" },
  { name: "proveedor_id", label: "Proveedor habitual", tipo: "select",
    fuente: { ruta: "/proveedores?activo=true", etiqueta: (r) => String(r.nombre) } },
  { name: "descripcion", label: "Descripción", tipo: "textarea" },
  { name: "activo",     label: "Activo", tipo: "checkbox", defecto: true, ayuda: "Producto activo" },
];

const columnas: Columna[] = [
  { name: "codigo", label: "Código", fmt: (v) => <span style={{ fontSize: 12, color: T.suave }}>{String(v)}</span> },
  { name: "nombre", label: "Producto", fmt: (v, f) => (
    <div>
      <strong>{String(v)}</strong>
      <div style={{ fontSize: 11, color: T.suave }}>
        {[f.categoria, f.marca].filter(Boolean).join(" · ") || "sin categoría"}
      </div>
    </div>
  ) },
  { name: "stock_actual", label: "Stock", alinear: "right", fmt: (v, f) => (
    <div>
      <strong>{Number(v).toLocaleString("es-DO")} {String(f.unidad ?? "")}</strong>
      <div style={{ fontSize: 10.5, color: T.suave }}>mín. {Number(f.stock_minimo)}</div>
    </div>
  ) },
  { name: "estado_stock", label: "Estado",
    fmt: (v) => <Badge texto={String(v)} tono={tonoStock(String(v))} /> },
  { name: "costo",  label: "Costo",  alinear: "right", fmt: (v) => RD(v as number) },
  { name: "precio", label: "Precio", alinear: "right", fmt: (v) => <strong>{RD(v as number)}</strong> },
  { name: "margen_pct", label: "Margen", alinear: "right",
    fmt: (v, f) => (
      <div>
        <strong style={{ color: Number(v) > 0 ? T.ok : T.suave }}>{PCT(v as number, 1)}</strong>
        <div style={{ fontSize: 10.5, color: T.suave }}>{RD(f.margen as number)}</div>
      </div>
    ) },
  { name: "itbis_pct", label: "ITBIS", alinear: "right",
    fmt: (v) => Number(v) > 0 ? PCT(v as number, 0) : <span style={{ color: T.suave }}>exento</span> },
  { name: "valor_costo", label: "Valor en stock", alinear: "right", fmt: (v) => RD(v as number) },
];

interface Movimiento {
  id: string;
  fecha: string;
  tipo: string;
  cantidad: number;
  costo_unitario: number;
  stock_antes: number;
  stock_despues: number;
  referencia: string | null;
  origen: string;
  notas: string | null;
}

export default function InventarioPage() {
  const [modal, setModal] = useState<Record<string, unknown> | null>(null);
  const [recarga, setRecarga] = useState<(() => void) | null>(null);

  return (
    <>
      <CrudPage
        titulo="Inventario"
        icono="📦"
        ruta="/productos"
        textoNuevo="Producto"
        subtitulo="Catálogo, existencias y movimientos"
        campos={campos}
        columnas={columnas}
        filaRoja={(f) => f.estado_stock === "agotado"}
        filtros={[
          { name: "estado_stock", label: "Stock", opciones: [
            { value: "ok", label: "Con existencia" },
            { value: "bajo", label: "Bajo mínimo" },
            { value: "agotado", label: "Agotados" },
          ] },
          { name: "activo", label: "Estado", opciones: [
            { value: "true", label: "Activos" }, { value: "false", label: "Inactivos" },
          ] },
        ]}
        encabezado={(filas) => {
          const t = filas.reduce(
            (a: { valor: number; venta: number; bajos: number; agotados: number }, p) => ({
              valor: a.valor + Number(p.valor_costo ?? 0),
              venta: a.venta + Number(p.valor_venta ?? 0),
              bajos: a.bajos + (p.estado_stock === "bajo" ? 1 : 0),
              agotados: a.agotados + (p.estado_stock === "agotado" ? 1 : 0),
            }),
            { valor: 0, venta: 0, bajos: 0, agotados: 0 }
          );
          return (
            <div style={rejilla(205)}>
              <Kpi titulo="Valor del inventario" valor={RD(t.valor)} detalle="A precio de costo" tono="acento" />
              <Kpi titulo="Valor a precio de venta" valor={RD(t.venta)}
                   detalle={`Margen potencial ${RD(t.venta - t.valor)}`} tono="ok" />
              <Kpi titulo="Bajo mínimo" valor={t.bajos} tono={t.bajos > 0 ? "warn" : "neutro"}
                   detalle="Hay que reponer pronto" />
              <Kpi titulo="Agotados" valor={t.agotados} tono={t.agotados > 0 ? "err" : "neutro"}
                   detalle="Sin existencia" />
            </div>
          );
        }}
        extraAcciones={(f, recargar) => (
          <button
            onClick={() => { setModal(f); setRecarga(() => recargar); }}
            style={{ background: "transparent", border: "none", color: T.acento, cursor: "pointer", fontSize: 12.5, fontWeight: 700 }}
          >
            Movimientos
          </button>
        )}
      />

      {modal && (
        <MovimientosProducto
          producto={modal}
          onCerrar={() => setModal(null)}
          onCambio={() => recarga?.()}
        />
      )}
    </>
  );
}

/* ── Kardex y ajuste de existencia ────────────────────────────────── */
function MovimientosProducto({
  producto, onCerrar, onCambio,
}: {
  producto: Record<string, unknown>;
  onCerrar: () => void;
  onCambio: () => void;
}) {
  const [movs, setMovs] = useState<Movimiento[]>([]);
  const [stock, setStock] = useState(Number(producto.stock_actual ?? 0));
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [f, setF] = useState({
    tipo: "entrada", cantidad: "", costo_unitario: String(producto.costo ?? ""),
    fecha: hoyISO(), referencia: "", notas: "",
  });

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [m, p] = await Promise.all([
        api<{ data: Movimiento[] }>(`/inventario?producto_id=${producto.id}&limit=100`),
        api<{ data: { stock_actual: number }[] }>(`/vistas/ti_v_productos?id=${producto.id}`),
      ]);
      setMovs(m.data ?? []);
      if (p.data?.[0]) setStock(Number(p.data[0].stock_actual));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron cargar los movimientos");
    } finally {
      setCargando(false);
    }
  }, [producto.id]);

  useEffect(() => { void cargar(); }, [cargar]);

  const cantidad = Number(f.cantidad);
  const valido = Number.isFinite(cantidad) && cantidad !== 0;

  async function registrar() {
    if (!valido) return;
    setGuardando(true); setError(""); setAviso("");
    try {
      await api("/inventario", {
        metodo: "POST",
        body: {
          producto_id: producto.id,
          tipo: f.tipo,
          cantidad,
          costo_unitario: Number(f.costo_unitario) || 0,
          fecha: f.fecha,
          referencia: f.referencia || null,
          notas: f.notas || null,
          origen: f.tipo === "ajuste" ? "conteo" : "manual",
        },
      });
      setAviso("Movimiento registrado.");
      setF({ ...f, cantidad: "", referencia: "", notas: "" });
      await cargar();
      onCambio();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo registrar");
    } finally {
      setGuardando(false);
    }
  }

  const TIPOS: Opcion[] = [
    { value: "entrada",    label: "Entrada (compra o reposición)" },
    { value: "salida",     label: "Salida (uso o retiro)" },
    { value: "devolucion", label: "Devolución de cliente" },
    { value: "merma",      label: "Merma o daño" },
    { value: "ajuste",     label: "Ajuste por conteo (puede ser negativo)" },
  ];

  return (
    <Modal
      abierto
      titulo={`Movimientos · ${producto.nombre}`}
      onCerrar={onCerrar}
      ancho={800}
      pie={<Btn tono="neutro" onClick={onCerrar}>Cerrar</Btn>}
    >
      <div style={{ ...rejilla(150), marginBottom: 16 }}>
        <Kpi titulo="Existencia actual" valor={`${stock.toLocaleString("es-DO")} ${producto.unidad ?? ""}`}
             tono={stock <= 0 ? "err" : stock <= Number(producto.stock_minimo) ? "warn" : "neutro"} />
        <Kpi titulo="Costo" valor={RD(producto.costo as number)} />
        <Kpi titulo="Precio" valor={RD(producto.precio as number)} />
      </div>

      {error && <Aviso texto={error} />}
      {aviso && <Aviso texto={aviso} tono="ok" />}

      <div style={{ border: `1px solid ${T.borde}`, borderRadius: 11, padding: 14, marginBottom: 18 }}>
        <div style={{ fontSize: 12.5, fontWeight: 800, marginBottom: 11 }}>＋ Registrar movimiento</div>
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
          <div style={{ gridColumn: "span 2" }}>
            <Etiqueta>Tipo</Etiqueta>
            <select style={inputBase} value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}>
              {TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <Etiqueta>Cantidad</Etiqueta>
            <input type="number" step="0.001" style={{ ...inputBase, fontWeight: 700 }}
                   value={f.cantidad} onChange={(e) => setF({ ...f, cantidad: e.target.value })} />
          </div>
          {f.tipo === "entrada" && (
            <div>
              <Etiqueta>Costo unitario</Etiqueta>
              <input type="number" step="0.01" style={inputBase} value={f.costo_unitario}
                     onChange={(e) => setF({ ...f, costo_unitario: e.target.value })} />
              <div style={{ fontSize: 10.5, color: T.suave, marginTop: 4 }}>
                Actualiza el costo del producto.
              </div>
            </div>
          )}
          <div>
            <Etiqueta>Fecha</Etiqueta>
            <input type="date" style={inputBase} value={f.fecha}
                   onChange={(e) => setF({ ...f, fecha: e.target.value })} />
          </div>
          <div>
            <Etiqueta>Referencia</Etiqueta>
            <input style={inputBase} value={f.referencia}
                   onChange={(e) => setF({ ...f, referencia: e.target.value })} />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <Etiqueta>Notas</Etiqueta>
            <input style={inputBase} value={f.notas}
                   onChange={(e) => setF({ ...f, notas: e.target.value })} />
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 13 }}>
          <Btn onClick={registrar} disabled={guardando || !valido}>
            {guardando ? "Guardando…" : "Registrar"}
          </Btn>
        </div>
      </div>

      <Seccion titulo={`Historial (${movs.length})`} style={{ padding: 0 }}>
        {cargando ? <Cargando /> : (
          <Tabla
            vacio="Este producto todavía no tiene movimientos."
            columnas={[
              { name: "fecha", label: "Fecha", fmt: (v) => fecha(v as string) },
              { name: "tipo", label: "Tipo", fmt: (v) => (
                <Badge texto={String(v)}
                       tono={["entrada", "devolucion"].includes(String(v)) ? "ok"
                             : String(v) === "ajuste" ? "info" : "warn"} />
              ) },
              { name: "cantidad", label: "Cantidad", alinear: "right",
                fmt: (v) => <strong>{Number(v).toLocaleString("es-DO")}</strong> },
              { name: "stock_antes",   label: "Antes",   alinear: "right", fmt: (v) => Number(v).toLocaleString("es-DO") },
              { name: "stock_despues", label: "Después", alinear: "right",
                fmt: (v) => <strong>{Number(v).toLocaleString("es-DO")}</strong> },
              { name: "origen", label: "Origen", fmt: (v) => <span style={{ fontSize: 12 }}>{String(v)}</span> },
              { name: "referencia", label: "Ref." },
            ]}
            filas={movs as unknown as Record<string, unknown>[]}
          />
        )}
      </Seccion>
    </Modal>
  );
}
