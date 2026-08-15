"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Aviso, Badge, Barra, Btn, Cargando, Etiqueta, Kpi, Modal, PCT, RD, Seccion, Tabla,
  api, fecha, hoyISO, inputBase, rejilla, tonoStock, CrudPage, T,
  type Campo, type Columna, type Opcion,
} from "@/components/tienda/ui";

/**
 * Inventario de MAXMATT SHOP.
 *
 * Tres pestañas:
 *  · Pacas      → se compra el lote completo y se vende pieza por pieza.
 *  · Productos  → artículos sueltos de toda la vida.
 *  · Categorías → ropa nueva, ropa usada, calzado…
 */

type Pestana = "pacas" | "productos" | "categorias";

export default function InventarioPage() {
  const [pestana, setPestana] = useState<Pestana>("pacas");

  return (
    <div>
      <Pestanas actual={pestana} onCambio={setPestana} />
      {pestana === "pacas" && <Pacas />}
      {pestana === "productos" && <Productos />}
      {pestana === "categorias" && <Categorias />}
    </div>
  );
}

/* ── Barra de pestañas ─────────────────────────────────────────────── */
function Pestanas({ actual, onCambio }: { actual: Pestana; onCambio: (p: Pestana) => void }) {
  const items: { id: Pestana; texto: string; icono: string }[] = [
    { id: "pacas", texto: "Pacas y lotes", icono: "🧺" },
    { id: "productos", texto: "Productos sueltos", icono: "📦" },
    { id: "categorias", texto: "Categorías", icono: "🏷️" },
  ];
  return (
    <div style={{
      display: "flex", gap: 6, marginBottom: 18, flexWrap: "wrap",
      borderBottom: `1px solid ${T.borde}`, paddingBottom: 10,
    }}>
      {items.map((i) => {
        const activo = actual === i.id;
        return (
          <button
            key={i.id}
            onClick={() => onCambio(i.id)}
            style={{
              border: `1px solid ${activo ? T.acento : T.borde}`,
              background: activo ? T.acento : "#fff",
              color: activo ? "#fff" : T.texto,
              borderRadius: 10, padding: "8px 15px", cursor: "pointer",
              fontSize: 13, fontWeight: 700,
            }}
          >
            {i.icono} {i.texto}
          </button>
        );
      })}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   1 · PACAS
   ══════════════════════════════════════════════════════════════════ */

const camposPaca: Campo[] = [
  { name: "nombre", label: "Nombre de la paca", requerido: true, ancho: 2,
    ayuda: "Ej.: Paca de blusas dama · Fardo de jeans usados" },
  { name: "codigo", label: "Código", ayuda: "Se genera solo, pero puedes ponerle el tuyo. No se puede repetir." },
  { name: "categoria_id", label: "Categoría", tipo: "select",
    fuente: { ruta: "/categorias?activo=true", etiqueta: (r) => String(r.nombre) } },
  { name: "lote_codigo", label: "Código del lote", ayuda: "El que trae el fardo, si tiene" },
  { name: "costo_lote", label: "¿Cuánto costó la paca completa?", tipo: "number", paso: "0.01",
    requerido: true, defecto: 0, ayuda: "El total que pagaste por el fardo" },
  { name: "piezas_lote", label: "¿Cuántas piezas trae?", tipo: "number", paso: "1",
    requerido: true, defecto: 0, ayuda: "Con esto se reparte el costo entre cada pieza" },
  { name: "precio", label: "Precio de venta por pieza", tipo: "number", paso: "0.01", defecto: 0,
    ayuda: "Lo que le cobras al cliente por cada pieza" },
  { name: "fecha_lote", label: "Fecha de compra", tipo: "date" },
  { name: "proveedor_id", label: "Proveedor", tipo: "select",
    fuente: { ruta: "/proveedores?activo=true", etiqueta: (r) => String(r.nombre) } },
  { name: "itbis_pct", label: "ITBIS %", tipo: "number", paso: "0.01", defecto: 0,
    ayuda: "0 si vendes exento" },
  { name: "stock_minimo", label: "Avisar cuando queden", tipo: "number", paso: "1", defecto: 0 },
  { name: "descripcion", label: "Notas de la paca", tipo: "textarea", ancho: 2 },
  { name: "activo", label: "Activa", tipo: "checkbox", defecto: true, ayuda: "Paca activa" },
];

const columnasPaca: Columna[] = [
  { name: "nombre", label: "Paca", fmt: (v, f) => (
    <div>
      <strong>{String(v)}</strong>
      <div style={{ fontSize: 11, color: T.suave }}>
        {[f.categoria_nombre, f.lote_codigo || f.codigo].filter(Boolean).join(" · ")}
        {f.fecha_lote ? ` · ${fecha(f.fecha_lote as string)}` : ""}
      </div>
    </div>
  ) },
  { name: "costo_lote", label: "Costo del lote", alinear: "right", fmt: (v, f) => (
    <div>
      <strong>{RD(v as number)}</strong>
      <div style={{ fontSize: 10.5, color: T.suave }}>
        {Number(f.piezas_iniciales).toLocaleString("es-DO")} pzas · {RD(f.costo_por_pieza as number)} c/u
      </div>
    </div>
  ) },
  { name: "piezas_restantes", label: "Quedan", alinear: "right", fmt: (v, f) => (
    <div>
      <strong style={{ color: Number(v) <= 0 ? T.err : T.texto }}>
        {Number(v).toLocaleString("es-DO")}
      </strong>
      <div style={{ fontSize: 10.5, color: T.suave }}>
        vendidas {Number(f.piezas_vendidas).toLocaleString("es-DO")}
      </div>
    </div>
  ) },
  { name: "recuperacion_pct", label: "Recuperación de la inversión", fmt: (v, f) => (
    <div style={{ minWidth: 150 }}>
      <Barra valor={Number(v)} />
      <div style={{ fontSize: 10.5, color: T.suave, marginTop: 4 }}>
        {PCT(v as number, 0)} · {Number(f.falta_recuperar) > 0
          ? `faltan ${RD(f.falta_recuperar as number)}`
          : "inversión recuperada"}
      </div>
    </div>
  ) },
  { name: "ganancia", label: "Ganancia", alinear: "right", fmt: (v, f) => (
    <div>
      <strong style={{ color: Number(v) > 0 ? T.ok : T.suave }}>{RD(v as number)}</strong>
      <div style={{ fontSize: 10.5, color: T.suave }}>
        si vende todo: {RD(f.ganancia_proyectada as number)}
      </div>
    </div>
  ) },
  { name: "precio_por_pieza", label: "Precio pza.", alinear: "right",
    fmt: (v) => <strong>{RD(v as number)}</strong> },
  { name: "estado_lote", label: "Estado", fmt: (v) => (
    <Badge
      texto={{
        nueva: "sin vender", en_venta: "en venta",
        recuperada: "ya se pagó sola", agotada: "agotada",
      }[String(v)] ?? String(v)}
      tono={{ nueva: "info", en_venta: "warn", recuperada: "ok", agotada: "neutro" }[String(v)] ?? "neutro"}
    />
  ) },
];

function Pacas() {
  const [modal, setModal] = useState<Record<string, unknown> | null>(null);
  const [recarga, setRecarga] = useState<(() => void) | null>(null);

  return (
    <>
      <CrudPage
        titulo="Pacas y lotes"
        icono="🧺"
        ruta="/lotes"
        textoNuevo="Paca"
        subtitulo="Se compra el fardo completo y el sistema reparte el costo entre cada pieza"
        campos={camposPaca}
        columnas={columnasPaca}
        filaRoja={(f) => Number(f.piezas_restantes) <= 0 && Number(f.falta_recuperar) > 0}
        filtros={[
          { name: "estado_lote", label: "Estado", opciones: [
            { value: "nueva", label: "Sin vender" },
            { value: "en_venta", label: "En venta" },
            { value: "recuperada", label: "Ya se pagó sola" },
            { value: "agotada", label: "Agotadas" },
          ] },
          { name: "activo", label: "Activas", opciones: [
            { value: "true", label: "Activas" }, { value: "false", label: "Inactivas" },
          ] },
        ]}
        encabezado={(filas) => {
          type TotalPacas = {
            invertido: number; recuperado: number; falta: number;
            ganancia: number; porVender: number; piezas: number;
          };
          const t = filas.reduce(
            (a: TotalPacas, p) => ({
              invertido: a.invertido + Number(p.costo_lote ?? 0),
              recuperado: a.recuperado + Number(p.recuperado ?? 0),
              falta: a.falta + Number(p.falta_recuperar ?? 0),
              ganancia: a.ganancia + Number(p.ganancia ?? 0),
              porVender: a.porVender + Number(p.por_vender ?? 0),
              piezas: a.piezas + Number(p.piezas_restantes ?? 0),
            }),
            { invertido: 0, recuperado: 0, falta: 0, ganancia: 0, porVender: 0, piezas: 0 }
          );
          const pct = t.invertido > 0 ? (100 * t.recuperado) / t.invertido : 0;
          return (
            <div style={rejilla(205)}>
              <Kpi titulo="Invertido en pacas" valor={RD(t.invertido)} tono="acento"
                   detalle={`${filas.length} pacas`} />
              <Kpi titulo="Ya recuperado" valor={RD(t.recuperado)} tono="ok"
                   detalle={`${pct.toFixed(0)}% de lo invertido`} />
              <Kpi titulo="Falta recuperar" valor={RD(t.falta)}
                   tono={t.falta > 0 ? "warn" : "neutro"}
                   detalle={t.falta > 0 ? "Todavía no se paga sola" : "Todo recuperado"} />
              <Kpi titulo="Ganancia de las pacas" valor={RD(t.ganancia)} tono="ok"
                   detalle="Ya cobrada, sin contar lo que queda" />
              <Kpi titulo="Mercancía por vender" valor={RD(t.porVender)}
                   detalle={`${t.piezas.toLocaleString("es-DO")} piezas en existencia`} />
            </div>
          );
        }}
        borrar={{
          query: "definitivo=1",
          confirmar: (f) =>
            `¿Sacar del inventario la paca «${f.nombre}»?\n\n` +
            "Desaparece del catálogo junto con sus movimientos y no se puede recuperar.\n\n" +
            "Las facturas donde ya aparezca NO se tocan: conservan la descripción, " +
            "el precio y el importe, así que los totales y la ganancia siguen igual.",
        }}
        extraAcciones={(f, recargar) => (
          <button
            onClick={() => { setModal(f); setRecarga(() => recargar); }}
            style={{ background: "transparent", border: "none", color: T.acento, cursor: "pointer", fontSize: 12.5, fontWeight: 700 }}
          >
            Movimientos
          </button>
        )}
        encabezadoFormulario={() => (
          <div style={{
            background: T.panel2, border: `1px solid ${T.borde}`, borderRadius: 10,
            padding: 12, fontSize: 12, color: T.suave, lineHeight: 1.55, marginBottom: 14,
          }}>
            <strong style={{ color: T.texto }}>Cómo funciona una paca:</strong> pones lo que te costó el
            fardo y cuántas piezas trae. El sistema divide el costo entre las piezas, así cada venta
            descuenta su parte de la inversión y lo que sobra queda como ganancia del grupo.
            <div style={{ marginTop: 6 }}>
              Ejemplo: paca de 3,000 con 100 piezas → cada pieza carga 30 de costo. Si vendes a 200,
              con 15 piezas ya recuperaste los 3,000 y el resto es ganancia.
            </div>
            <div style={{ marginTop: 6 }}>
              Al crearla se carga el inventario completo de una vez. Si después necesitas corregir
              las piezas que hay en existencia, usa <strong>Movimientos → Ajuste por conteo</strong>.
            </div>
          </div>
        )}
      />

      {modal && (
        <MovimientosProducto
          producto={{ ...modal, stock_actual: modal.piezas_restantes, costo: modal.costo_por_pieza, precio: modal.precio_por_pieza }}
          onCerrar={() => setModal(null)}
          onCambio={() => recarga?.()}
        />
      )}
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════
   2 · PRODUCTOS SUELTOS
   ══════════════════════════════════════════════════════════════════ */

const campos: Campo[] = [
  { name: "nombre",       label: "Nombre del producto", requerido: true, ancho: 2 },
  { name: "codigo",       label: "Código",
    ayuda: "Se genera solo, pero puedes ponerle el tuyo. No se puede repetir." },
  { name: "codigo_barra", label: "Código de barra" },
  { name: "categoria_id", label: "Categoría", tipo: "select",
    fuente: { ruta: "/categorias?activo=true", etiqueta: (r) => String(r.nombre) } },
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
        {[f.categoria_nombre ?? f.categoria, f.marca].filter(Boolean).join(" · ") || "sin categoría"}
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

function Productos() {
  const [modal, setModal] = useState<Record<string, unknown> | null>(null);
  const [recarga, setRecarga] = useState<(() => void) | null>(null);

  return (
    <>
      <CrudPage
        titulo="Productos sueltos"
        icono="📦"
        ruta="/productos?tipo_inventario=unitario"
        textoNuevo="Producto"
        subtitulo="Artículos que se cuentan uno por uno"
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
        borrar={{
          query: "definitivo=1",
          confirmar: (f) =>
            `¿Sacar «${f.nombre}» del inventario?\n\n` +
            "Desaparece del catálogo junto con sus movimientos y no se puede recuperar.\n\n" +
            "Las facturas donde ya aparezca NO se tocan: conservan la descripción, " +
            "el precio y el importe, así que los totales y la ganancia siguen igual.",
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

/* ══════════════════════════════════════════════════════════════════
   3 · CATEGORÍAS
   ══════════════════════════════════════════════════════════════════ */

const camposCategoria: Campo[] = [
  { name: "nombre", label: "Nombre", requerido: true, ancho: 2,
    ayuda: "Ropa nueva, ropa usada, calzado…" },
  { name: "color", label: "Color", ayuda: "Código hex, ej. #7c3aed", defecto: "#7c3aed" },
  { name: "orden", label: "Orden en la lista", tipo: "number", paso: "1", defecto: 100 },
  { name: "descripcion", label: "Descripción", tipo: "textarea", ancho: 2 },
  { name: "activo", label: "Activa", tipo: "checkbox", defecto: true, ayuda: "Categoría activa" },
];

function Categorias() {
  const [ganancias, setGanancias] = useState<Record<string, unknown>[]>([]);

  useEffect(() => {
    api<{ data: Record<string, unknown>[] }>("/vistas/ti_v_ganancia_categoria")
      .then((r) => setGanancias(r.data ?? []))
      .catch(() => setGanancias([]));
  }, []);

  return (
    <>
      <CrudPage
        titulo="Categorías"
        icono="🏷️"
        ruta="/categorias"
        textoNuevo="Categoría"
        subtitulo="Agrupa la mercancía para saber qué grupo deja más"
        campos={camposCategoria}
        columnas={[
          { name: "nombre", label: "Categoría", fmt: (v, f) => (
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{
                width: 12, height: 12, borderRadius: 4,
                background: String(f.color ?? "#64748b"), display: "inline-block",
              }} />
              <strong>{String(v)}</strong>
            </span>
          ) },
          { name: "descripcion", label: "Descripción" },
          { name: "orden", label: "Orden", alinear: "right" },
          { name: "activo", label: "Estado",
            fmt: (v) => <Badge texto={v ? "activa" : "inactiva"} tono={v ? "ok" : "neutro"} /> },
        ]}
        borrar={{
          confirmar: (f) =>
            `¿Borrar la categoría «${f.nombre}»?\n\n` +
            "Los productos que la tengan se quedan sin categoría, pero no se borra ninguno.",
        }}
      />

      <div style={{ height: 18 }} />
      <Seccion titulo="Ganancia por categoría" style={{ padding: 0 }}>
        <Tabla
          vacio="Todavía no hay ventas para comparar categorías."
          columnas={[
            { name: "categoria_nombre", label: "Categoría", fmt: (v, f) => (
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{
                  width: 12, height: 12, borderRadius: 4,
                  background: String(f.categoria_color ?? "#64748b"), display: "inline-block",
                }} />
                <strong>{String(v)}</strong>
              </span>
            ) },
            { name: "productos", label: "Artículos", alinear: "right" },
            { name: "unidades_vendidas", label: "Unidades vendidas", alinear: "right",
              fmt: (v) => Number(v).toLocaleString("es-DO") },
            { name: "vendido", label: "Vendido", alinear: "right", fmt: (v) => RD(v as number) },
            { name: "costo", label: "Costo", alinear: "right", fmt: (v) => RD(v as number) },
            { name: "ganancia", label: "Ganancia", alinear: "right",
              fmt: (v) => <strong style={{ color: Number(v) > 0 ? T.ok : T.suave }}>{RD(v as number)}</strong> },
            { name: "valor_en_stock", label: "Valor en stock", alinear: "right", fmt: (v) => RD(v as number) },
          ]}
          filas={ganancias}
        />
      </Seccion>
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

  const esLote = producto.tipo_inventario === "lote" || producto.costo_lote !== undefined;

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
        <Kpi titulo={esLote ? "Piezas que quedan" : "Existencia actual"}
             valor={`${stock.toLocaleString("es-DO")} ${producto.unidad ?? ""}`}
             tono={stock <= 0 ? "err" : stock <= Number(producto.stock_minimo) ? "warn" : "neutro"} />
        <Kpi titulo={esLote ? "Costo por pieza" : "Costo"} valor={RD(producto.costo as number)} />
        <Kpi titulo="Precio" valor={RD(producto.precio as number)} />
      </div>

      {error && <Aviso texto={error} />}
      {aviso && <Aviso texto={aviso} tono="ok" />}
      {esLote && (
        <Aviso tono="info" texto={
          "En una paca el costo por pieza sale de dividir el costo del lote entre las piezas, " +
          "así que aquí no hace falta poner costo unitario."
        } />
      )}

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
          {f.tipo === "entrada" && !esLote && (
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
