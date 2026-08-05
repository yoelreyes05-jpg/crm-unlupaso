"use client";

import { useEffect, useState } from "react";
import { api, Badge, Card, CrudPage, RD, T, type Campo, type Columna } from "@/components/reposteria/ui";
import { CATEGORIAS_INGREDIENTE } from "@/types/reposteria";
import type { RepIngredienteStatus } from "@/types/reposteria";

const UNIDADES = ["unidad", "lb", "kg", "oz", "lt", "ml", "galon", "docena"];

const campos: Campo[] = [
  { name: "nombre",         label: "Ingrediente", requerido: true },
  { name: "categoria",      label: "Categoría", tipo: "select", defecto: "otro",
    opciones: CATEGORIAS_INGREDIENTE.map((c) => ({ value: c, label: c.replace("_", " ") })) },
  { name: "unidad",         label: "Unidad de uso", tipo: "select", defecto: "unidad",
    opciones: UNIDADES.map((u) => ({ value: u, label: u })) },
  { name: "costo_unitario", label: "Costo unitario", tipo: "number", paso: "0.01", defecto: 0 },
  { name: "stock_actual",   label: "Stock actual", tipo: "number", paso: "0.001", defecto: 0 },
  { name: "stock_minimo",   label: "Stock mínimo", tipo: "number", paso: "0.001", defecto: 0 },
  { name: "punto_reorden",  label: "Punto de reorden", tipo: "number", paso: "0.001", defecto: 0,
    ayuda: "Nivel en el que se marca como crítico" },
  { name: "unidad_compra",  label: "Unidad de compra", ayuda: "Ej: saco 50 lb" },
  { name: "costo_compra",   label: "Costo por unidad de compra", tipo: "number", paso: "0.01", defecto: 0 },
  { name: "ubicacion",      label: "Ubicación", ayuda: "Ej: Estante A-2" },
  { name: "proveedor_id",   label: "Proveedor", tipo: "select",
    fuente: { ruta: "/proveedores", etiqueta: (r) => String(r.nombre) } },
  { name: "descripcion",    label: "Descripción", tipo: "textarea" },
  { name: "activo",         label: "Activo", tipo: "checkbox", defecto: true },
];

const columnas: Columna[] = [
  { name: "nombre",         label: "Ingrediente" },
  { name: "categoria",      label: "Categoría" },
  { name: "stock_actual",   label: "Stock", alinear: "right",
    fmt: (v, f) => `${Number(v ?? 0).toLocaleString("es-DO")} ${f.unidad ?? ""}` },
  { name: "punto_reorden",  label: "Reorden", alinear: "right" },
  { name: "costo_unitario", label: "Costo", alinear: "right", fmt: (v) => RD(v as number) },
  { name: "ubicacion",      label: "Ubicación" },
  { name: "activo",         label: "Estado", fmt: (v) => <Badge texto={v ? "activo" : "inactivo"} tono={v ? "ok" : "neutro"} /> },
];

export default function IngredientesPage() {
  const [alertas, setAlertas] = useState<RepIngredienteStatus[]>([]);

  useEffect(() => {
    void api<{ data: RepIngredienteStatus[] }>("/vistas/ingredientes-status")
      .then((r) => setAlertas((r.data ?? []).filter((i) => i.nivel_alerta !== "ok")))
      .catch(() => setAlertas([]));
  }, []);

  const tono: Record<string, string> = { bajo: "warn", critico: "err", agotado: "err" };
  const valorTotal = alertas.reduce((a, i) => a + Number(i.valor_stock ?? 0), 0);

  return (
    <div>
      {alertas.length > 0 && (
        <Card style={{ marginBottom: 18, borderColor: T.warn + "77" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
            <strong>⚠️ {alertas.length} ingrediente(s) requieren atención</strong>
            <span style={{ color: T.suave, fontSize: 12.5 }}>Valor en riesgo: {RD(valorTotal)}</span>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {alertas.slice(0, 14).map((i) => (
              <span key={i.id} style={{
                display: "inline-flex", alignItems: "center", gap: 7,
                background: T.panel2, border: `1px solid ${T.borde}`,
                borderRadius: 9, padding: "6px 10px", fontSize: 12.5,
              }}>
                {i.nombre} <span style={{ color: T.suave }}>({Number(i.stock_actual)} {i.unidad})</span>
                <Badge texto={i.nivel_alerta} tono={tono[i.nivel_alerta] ?? "neutro"} />
              </span>
            ))}
          </div>
        </Card>
      )}

      <CrudPage
        titulo="Ingredientes" icono="🥣" ruta="/ingredientes"
        campos={campos} columnas={columnas} textoNuevo="Ingrediente"
        filtros={[
          { name: "categoria", label: "Categoría", opciones: CATEGORIAS_INGREDIENTE.map((c) => ({ value: c, label: c })) },
          { name: "activo",    label: "Estado",    opciones: [{ value: "true", label: "Activos" }, { value: "false", label: "Inactivos" }] },
        ]}
      />
    </div>
  );
}
