"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  api, Aviso, Badge, Btn, Card, Etiqueta, iconBtn, inputBase, RD, T, Tabla,
} from "@/components/reposteria/ui";
import type { RepIngrediente, RepReceta, RepRecetaIngrediente } from "@/types/reposteria";

export default function RecetaDetalle() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [receta, setReceta] = useState<RepReceta | null>(null);
  const [lineas, setLineas] = useState<RepRecetaIngrediente[]>([]);
  const [ingredientes, setIngredientes] = useState<RepIngrediente[]>([]);
  const [error, setError] = useState("");

  const [nuevo, setNuevo] = useState({ ingrediente_id: "", cantidad: "", unidad: "" });

  const cargar = useCallback(async () => {
    try {
      const [r, l, ing] = await Promise.all([
        api<{ data: RepReceta }>(`/recetas/${id}`),
        api<{ data: RepRecetaIngrediente[] }>(`/receta-ingredientes?receta_id=${id}`),
        api<{ data: RepIngrediente[] }>("/ingredientes?activo=true&limit=500"),
      ]);
      setReceta(r.data); setLineas(l.data ?? []); setIngredientes(ing.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar la receta");
    }
  }, [id]);

  useEffect(() => { void cargar(); }, [cargar]);

  const nombreIng = (iid: string) => ingredientes.find((i) => i.id === iid)?.nombre ?? "—";

  async function agregar() {
    if (!nuevo.ingrediente_id || !nuevo.cantidad) { setError("Elige el ingrediente y la cantidad"); return; }
    const ing = ingredientes.find((i) => i.id === nuevo.ingrediente_id);
    try {
      await api("/receta-ingredientes", {
        metodo: "POST",
        body: {
          receta_id: id,
          ingrediente_id: nuevo.ingrediente_id,
          cantidad: Number(nuevo.cantidad),
          unidad: nuevo.unidad || ing?.unidad || "unidad",
        },
      });
      setNuevo({ ingrediente_id: "", cantidad: "", unidad: "" });
      setError("");
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al agregar el ingrediente");
    }
  }

  async function quitar(lid: string) {
    try { await api(`/receta-ingredientes/${lid}`, { metodo: "DELETE" }); await cargar(); }
    catch (e) { setError(e instanceof Error ? e.message : "Error al eliminar"); }
  }

  if (!receta) {
    return <div style={{ color: T.suave }}>{error ? <Aviso texto={error} /> : "Cargando…"}</div>;
  }

  const precioSugerido = Number(receta.costo_por_unidad ?? 0) * 2.5;

  return (
    <div>
      <button onClick={() => router.push("/reposteria/recetas")} style={{ ...iconBtn, marginBottom: 14 }}>← Recetas</button>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap", marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 24, margin: 0 }}>📖 {receta.nombre}</h1>
          <p style={{ color: T.suave, fontSize: 13.5, marginTop: 6 }}>
            Rinde {receta.rendimiento} {receta.unidad_rendimiento}
            {receta.descripcion ? ` · ${receta.descripcion}` : ""}
          </p>
        </div>
        <Badge texto={receta.activo ? "activa" : "inactiva"} tono={receta.activo ? "ok" : "neutro"} />
      </div>

      {error && <Aviso texto={error} />}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14, marginBottom: 20 }}>
        {[
          { l: "Costo total de la receta", v: RD(receta.costo_total) },
          { l: "Costo por unidad",         v: RD(receta.costo_por_unidad) },
          { l: "Precio sugerido (x2.5)",   v: RD(precioSugerido) },
          { l: "Ingredientes",             v: String(lineas.length) },
        ].map((k) => (
          <Card key={k.l}>
            <div style={{ fontSize: 11, color: T.suave, textTransform: "uppercase", letterSpacing: 0.4 }}>{k.l}</div>
            <div style={{ fontSize: 20, fontWeight: 800, marginTop: 5 }}>{k.v}</div>
          </Card>
        ))}
      </div>

      <Card style={{ marginBottom: 18 }}>
        <strong style={{ display: "block", marginBottom: 14 }}>Agregar ingrediente</strong>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: 10, alignItems: "end" }}>
          <div>
            <Etiqueta>Ingrediente</Etiqueta>
            <select
              value={nuevo.ingrediente_id}
              onChange={(e) => {
                const ing = ingredientes.find((i) => i.id === e.target.value);
                setNuevo((p) => ({ ...p, ingrediente_id: e.target.value, unidad: ing?.unidad ?? "" }));
              }}
              style={inputBase}
            >
              <option value="">— seleccionar —</option>
              {ingredientes.map((i) => (
                <option key={i.id} value={i.id}>{i.nombre} ({RD(i.costo_unitario)}/{i.unidad})</option>
              ))}
            </select>
          </div>
          <div>
            <Etiqueta>Cantidad</Etiqueta>
            <input type="number" step="0.001" value={nuevo.cantidad}
              onChange={(e) => setNuevo((p) => ({ ...p, cantidad: e.target.value }))} style={inputBase} />
          </div>
          <div>
            <Etiqueta>Unidad</Etiqueta>
            <input value={nuevo.unidad}
              onChange={(e) => setNuevo((p) => ({ ...p, unidad: e.target.value }))} style={inputBase} />
          </div>
          <Btn onClick={agregar}>Agregar</Btn>
        </div>
      </Card>

      <Card style={{ padding: 0, overflow: "hidden" }}>
        <Tabla
          vacio="Esta receta aún no tiene ingredientes."
          columnas={[
            { name: "ingrediente_id", label: "Ingrediente", fmt: (v) => nombreIng(String(v)) },
            { name: "cantidad", label: "Cantidad", alinear: "right", fmt: (v, f) => `${Number(v)} ${f.unidad ?? ""}` },
            { name: "costo_linea", label: "Costo", alinear: "right", fmt: (v) => RD(v as number) },
          ]}
          filas={lineas as unknown as Record<string, unknown>[]}
          acciones={(f) => (
            <button onClick={() => quitar(String(f.id))} style={iconBtn} title="Quitar">🗑️</button>
          )}
        />
      </Card>

      {receta.instrucciones && (
        <Card style={{ marginTop: 18 }}>
          <strong style={{ display: "block", marginBottom: 10 }}>Instrucciones</strong>
          <div style={{ whiteSpace: "pre-wrap", fontSize: 13.5, color: T.texto, lineHeight: 1.6 }}>
            {receta.instrucciones}
          </div>
        </Card>
      )}
    </div>
  );
}
