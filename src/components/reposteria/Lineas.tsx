"use client";

/**
 * Editor de líneas reutilizable para eventos, cotizaciones y facturas.
 * Los totales del documento los recalcula la base de datos por trigger.
 */

import { useCallback, useEffect, useState } from "react";
import { api, Aviso, Btn, Card, Etiqueta, iconBtn, inputBase, RD, T, Tabla } from "./ui";

export type TipoLinea = "producto" | "equipo" | "servicio";

interface Catalogo { id: string; nombre: string; precio: number }

export default function LineasEditor({
  ruta, campoPadre, padreId, conEquipos = false, onCambio,
}: {
  /** Endpoint de las líneas, p.ej. "/evento-items" */
  ruta: string;
  /** Nombre de la FK, p.ej. "evento_id" */
  campoPadre: string;
  padreId: string;
  /** true en eventos: permite alquilar equipos y cobrar por días */
  conEquipos?: boolean;
  onCambio?: () => void;
}) {
  const [lineas, setLineas]   = useState<Record<string, unknown>[]>([]);
  const [productos, setProd]  = useState<Catalogo[]>([]);
  const [equipos, setEquipos] = useState<Catalogo[]>([]);
  const [error, setError]     = useState("");

  const [f, setF] = useState({
    tipo: "producto" as TipoLinea,
    referencia: "",
    descripcion: "",
    cantidad: "1",
    dias: "1",
    precio: "",
    descuento: "0",
  });

  const cargar = useCallback(async () => {
    try {
      const r = await api<{ data: Record<string, unknown>[] }>(`${ruta}?${campoPadre}=${padreId}`);
      setLineas(r.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar las líneas");
    }
  }, [ruta, campoPadre, padreId]);

  useEffect(() => { void cargar(); }, [cargar]);

  useEffect(() => {
    void (async () => {
      try {
        const p = await api<{ data: Record<string, unknown>[] }>("/productos?activo=true&limit=500");
        setProd((p.data ?? []).map((x) => ({ id: String(x.id), nombre: String(x.nombre), precio: Number(x.precio_venta ?? 0) })));
      } catch { setProd([]); }
      if (conEquipos) {
        try {
          const e = await api<{ data: Record<string, unknown>[] }>("/equipos?activo=true&limit=500");
          setEquipos((e.data ?? []).map((x) => ({ id: String(x.id), nombre: String(x.nombre), precio: Number(x.precio_alquiler ?? 0) })));
        } catch { setEquipos([]); }
      }
    })();
  }, [conEquipos]);

  const catalogo = f.tipo === "equipo" ? equipos : productos;

  function elegirRef(id: string) {
    const item = catalogo.find((c) => c.id === id);
    setF((p) => ({
      ...p,
      referencia: id,
      descripcion: item?.nombre ?? p.descripcion,
      precio: item ? String(item.precio) : p.precio,
    }));
  }

  async function agregar() {
    if (!f.descripcion) { setError("Escribe una descripción"); return; }
    try {
      const body: Record<string, unknown> = {
        [campoPadre]: padreId,
        descripcion: f.descripcion,
        cantidad: Number(f.cantidad || 1),
        precio_unitario: Number(f.precio || 0),
        descuento: Number(f.descuento || 0),
      };
      if (conEquipos) {
        body.tipo = f.tipo;
        body.dias_alquiler = Number(f.dias || 1);
        if (f.tipo === "producto") body.producto_id = f.referencia || null;
        if (f.tipo === "equipo")   body.equipo_id   = f.referencia || null;
      } else if (f.referencia) {
        body.producto_id = f.referencia;
      }

      await api(ruta, { metodo: "POST", body });
      setF({ tipo: f.tipo, referencia: "", descripcion: "", cantidad: "1", dias: "1", precio: "", descuento: "0" });
      setError("");
      await cargar();
      onCambio?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al agregar la línea");
    }
  }

  async function quitar(id: string) {
    try { await api(`${ruta}/${id}`, { metodo: "DELETE" }); await cargar(); onCambio?.(); }
    catch (e) { setError(e instanceof Error ? e.message : "Error al eliminar"); }
  }

  const totalLineas = lineas.reduce((a, l) => a + Number(l.subtotal ?? 0), 0);

  return (
    <div>
      {error && <Aviso texto={error} />}

      <Card style={{ marginBottom: 14 }}>
        <strong style={{ display: "block", marginBottom: 12 }}>Agregar línea</strong>
        <div style={{
          display: "grid",
          gridTemplateColumns: conEquipos ? "120px 1.4fr 1.4fr 80px 70px 110px auto" : "1.4fr 1.4fr 90px 110px 100px auto",
          gap: 9, alignItems: "end",
        }}>
          {conEquipos && (
            <div>
              <Etiqueta>Tipo</Etiqueta>
              <select value={f.tipo}
                onChange={(e) => setF((p) => ({ ...p, tipo: e.target.value as TipoLinea, referencia: "" }))}
                style={inputBase}>
                <option value="producto">Producto</option>
                <option value="equipo">Equipo</option>
                <option value="servicio">Servicio</option>
              </select>
            </div>
          )}

          <div>
            <Etiqueta>{f.tipo === "equipo" ? "Equipo" : "Producto"}</Etiqueta>
            <select value={f.referencia} onChange={(e) => elegirRef(e.target.value)}
              style={inputBase} disabled={conEquipos && f.tipo === "servicio"}>
              <option value="">— libre —</option>
              {catalogo.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>

          <div>
            <Etiqueta>Descripción</Etiqueta>
            <input value={f.descripcion} onChange={(e) => setF((p) => ({ ...p, descripcion: e.target.value }))} style={inputBase} />
          </div>

          <div>
            <Etiqueta>Cant.</Etiqueta>
            <input type="number" step="0.001" value={f.cantidad}
              onChange={(e) => setF((p) => ({ ...p, cantidad: e.target.value }))} style={inputBase} />
          </div>

          {conEquipos && (
            <div>
              <Etiqueta>Días</Etiqueta>
              <input type="number" value={f.dias}
                onChange={(e) => setF((p) => ({ ...p, dias: e.target.value }))} style={inputBase} />
            </div>
          )}

          <div>
            <Etiqueta>Precio</Etiqueta>
            <input type="number" step="0.01" value={f.precio}
              onChange={(e) => setF((p) => ({ ...p, precio: e.target.value }))} style={inputBase} />
          </div>

          {!conEquipos && (
            <div>
              <Etiqueta>Desc.</Etiqueta>
              <input type="number" step="0.01" value={f.descuento}
                onChange={(e) => setF((p) => ({ ...p, descuento: e.target.value }))} style={inputBase} />
            </div>
          )}

          <Btn onClick={agregar}>Agregar</Btn>
        </div>
      </Card>

      <Card style={{ padding: 0, overflow: "hidden" }}>
        <Tabla
          vacio="Sin líneas todavía."
          columnas={[
            ...(conEquipos ? [{ name: "tipo", label: "Tipo" }] : []),
            { name: "descripcion", label: "Descripción" },
            { name: "cantidad", label: "Cant.", alinear: "right" as const },
            ...(conEquipos ? [{ name: "dias_alquiler", label: "Días", alinear: "right" as const }] : []),
            { name: "precio_unitario", label: "Precio", alinear: "right" as const, fmt: (v: unknown) => RD(v as number) },
            { name: "descuento", label: "Desc.", alinear: "right" as const, fmt: (v: unknown) => RD(v as number) },
            { name: "subtotal", label: "Subtotal", alinear: "right" as const, fmt: (v: unknown) => RD(v as number) },
          ]}
          filas={lineas}
          acciones={(l) => <button onClick={() => quitar(String(l.id))} style={iconBtn} title="Quitar">🗑️</button>}
        />
        {lineas.length > 0 && (
          <div style={{
            display: "flex", justifyContent: "flex-end", gap: 16,
            padding: "12px 16px", borderTop: `1px solid ${T.borde}`, fontSize: 14,
          }}>
            <span style={{ color: T.suave }}>Suma de líneas</span>
            <strong>{RD(totalLineas)}</strong>
          </div>
        )}
      </Card>
    </div>
  );
}
