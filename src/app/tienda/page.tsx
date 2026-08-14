"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Aviso, Badge, Btn, Cargando, Kpi, RD, Seccion, Tabla, Titulo, Vacio,
  api, fecha, mesLargo, rejilla, tonoDoc, tonoStock, T,
} from "@/components/tienda/ui";

interface Kpis {
  clientes_activos: number; productos_activos: number; productos_bajos: number;
  productos_agotados: number; valor_inventario: number; ventas_hoy: number;
  ventas_mes: number; ganancia_mes: number; gastos_mes: number;
  por_cobrar: number; por_cobrar_vencido: number; por_pagar: number;
  por_pagar_vencido: number; caja_abierta: number; efectivo_en_caja: number;
}
interface Datos {
  kpis: Kpis;
  meses: { mes: string; ingresos: number; ganancia_neta: number; gastos: number }[];
  bajos: Record<string, unknown>[];
  top: Record<string, unknown>[];
  ultimas: Record<string, unknown>[];
  caja: { efectivo_esperado: number; fecha_apertura: string } | null;
}

export default function TableroTienda() {
  const [d, setD] = useState<Datos | null>(null);
  const [simbolo, setSimbolo] = useState("RD$");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [r, cfg] = await Promise.all([
          api<{ data: Datos }>("/dashboard"),
          api<{ data: { simbolo_moneda: string } }>("/config").catch(() => null),
        ]);
        setD(r.data);
        if (cfg?.data?.simbolo_moneda) setSimbolo(cfg.data.simbolo_moneda);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al cargar");
      } finally {
        setCargando(false);
      }
    })();
  }, []);

  if (cargando) return <Cargando />;
  if (error) {
    return (
      <Aviso texto={
        <>
          {error}
          <div style={{ marginTop: 6 }}>
            Ejecuta <code>supabase/tienda_schema.sql</code> en Supabase y revisa{" "}
            <a href="/api/tienda/salud" style={{ color: "inherit" }}>/api/tienda/salud</a>.
          </div>
        </>
      } />
    );
  }
  if (!d) return null;

  const k = d.kpis;
  const maxMes = Math.max(1, ...d.meses.map((m) => Number(m.ingresos)));

  return (
    <div>
      <Titulo
        texto="🏠  Tablero"
        sub="Resumen de la tienda"
        acciones={
          <>
            {!k.caja_abierta && (
              <Link href="/tienda/caja" style={{ textDecoration: "none" }}>
                <Btn tono="warn">Abrir caja</Btn>
              </Link>
            )}
            <Link href="/tienda/ventas/nueva" style={{ textDecoration: "none" }}>
              <Btn>+ Nueva venta</Btn>
            </Link>
          </>
        }
      />

      <div style={{ ...rejilla(205), marginBottom: 14 }}>
        <Kpi titulo="Ventas de hoy" valor={RD(k.ventas_hoy, simbolo)} tono="acento" />
        <Kpi titulo="Ventas del mes" valor={RD(k.ventas_mes, simbolo)}
             detalle={`Ganancia ${RD(k.ganancia_mes, simbolo)}`} />
        <Kpi titulo="Efectivo en caja" valor={RD(k.efectivo_en_caja, simbolo)}
             detalle={k.caja_abierta ? "Caja abierta" : "Caja cerrada"}
             tono={k.caja_abierta ? "ok" : "neutro"} />
        <Kpi titulo="Valor del inventario" valor={RD(k.valor_inventario, simbolo)}
             detalle={`${k.productos_activos} producto(s)`} />
      </div>

      <div style={{ ...rejilla(205), marginBottom: 20 }}>
        <Kpi titulo="Por cobrar" valor={RD(k.por_cobrar, simbolo)}
             detalle={k.por_cobrar_vencido > 0 ? `${RD(k.por_cobrar_vencido, simbolo)} vencido` : "nada vencido"}
             tono={k.por_cobrar_vencido > 0 ? "err" : "neutro"} />
        <Kpi titulo="Por pagar" valor={RD(k.por_pagar, simbolo)}
             detalle={k.por_pagar_vencido > 0 ? `${RD(k.por_pagar_vencido, simbolo)} vencido` : "nada vencido"}
             tono={k.por_pagar_vencido > 0 ? "warn" : "neutro"} />
        <Kpi titulo="Gastos del mes" valor={RD(k.gastos_mes, simbolo)} />
        <Kpi titulo="Hay que reponer" valor={k.productos_bajos + k.productos_agotados}
             detalle={`${k.productos_agotados} agotado(s)`}
             tono={k.productos_agotados > 0 ? "err" : k.productos_bajos > 0 ? "warn" : "neutro"} />
      </div>

      <div style={{ display: "grid", gap: 18, gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", marginBottom: 18 }}>
        <Seccion
          titulo={`📉  Hay que reponer (${d.bajos.length})`}
          accion={<Link href="/tienda/inventario" style={{ fontSize: 12, fontWeight: 700, color: T.acento, textDecoration: "none" }}>Ver inventario →</Link>}
          style={{ padding: 0 }}
        >
          {d.bajos.length === 0 ? <Vacio texto="Todo con existencia suficiente." /> : (
            <Tabla
              filaRoja={(f) => f.estado_stock === "agotado"}
              columnas={[
                { name: "nombre", label: "Producto", fmt: (v, f) => (
                  <div>
                    <strong>{String(v)}</strong>
                    <div style={{ fontSize: 10.5, opacity: 0.7 }}>{String(f.codigo)}</div>
                  </div>
                ) },
                { name: "stock_actual", label: "Quedan", alinear: "right",
                  fmt: (v, f) => <strong>{Number(v)} {String(f.unidad ?? "")}</strong> },
                { name: "stock_minimo", label: "Mínimo", alinear: "right", fmt: (v) => Number(v) },
                { name: "estado_stock", label: "Estado",
                  fmt: (v) => <Badge texto={String(v)} tono={tonoStock(String(v))} /> },
              ]}
              filas={d.bajos}
            />
          )}
        </Seccion>

        <Seccion
          titulo="🧾  Últimas ventas"
          accion={<Link href="/tienda/ventas" style={{ fontSize: 12, fontWeight: 700, color: T.acento, textDecoration: "none" }}>Ver todas →</Link>}
          style={{ padding: 0 }}
        >
          {d.ultimas.length === 0 ? <Vacio texto="Todavía no hay ventas." /> : (
            <Tabla
              columnas={[
                { name: "codigo", label: "Factura", fmt: (v, f) => (
                  <Link href={`/tienda/ventas/${f.id}`} style={{ color: T.texto, fontWeight: 700, textDecoration: "none" }}>
                    {String(v)}
                  </Link>
                ) },
                { name: "fecha", label: "Fecha", fmt: (v) => fecha(v as string) },
                { name: "cliente_nombre", label: "Cliente" },
                { name: "total", label: "Total", alinear: "right",
                  fmt: (v) => <strong>{RD(v as number, simbolo)}</strong> },
                { name: "estado_visual", label: "Estado",
                  fmt: (v) => <Badge texto={String(v)} tono={tonoDoc(String(v))} /> },
              ]}
              filas={d.ultimas}
            />
          )}
        </Seccion>
      </div>

      <div style={{ display: "grid", gap: 18, gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))" }}>
        <Seccion titulo="💹  Ingresos por mes">
          {d.meses.length === 0 ? <Vacio texto="Sin movimientos todavía." /> : (
            <div>
              {d.meses.slice(0, 8).map((m) => (
                <div key={m.mes} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 9 }}>
                  <div style={{ width: 115, flexShrink: 0, fontSize: 12, fontWeight: 600, color: T.suave }}>
                    {mesLargo(m.mes)}
                  </div>
                  <div style={{ flex: 1, height: 20, background: "#e6e3f3", borderRadius: 5, overflow: "hidden" }}>
                    <div style={{
                      width: `${(Number(m.ingresos) / maxMes) * 100}%`, height: "100%",
                      background: T.acento2,
                    }} />
                  </div>
                  <div style={{ width: 130, flexShrink: 0, textAlign: "right", fontSize: 12.5, fontVariantNumeric: "tabular-nums" }}>
                    {RD(m.ingresos, simbolo)}
                    <div style={{ fontSize: 10.5, color: Number(m.ganancia_neta) >= 0 ? T.ok : T.err }}>
                      neto {RD(m.ganancia_neta, simbolo)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Seccion>

        <Seccion titulo="🏆  Lo que más se vende" style={{ padding: 0 }}>
          {d.top.length === 0 ? <Vacio texto="Sin ventas todavía." /> : (
            <Tabla
              columnas={[
                { name: "nombre", label: "Producto", fmt: (v, f) => (
                  <div>
                    <strong>{String(v)}</strong>
                    <div style={{ fontSize: 10.5, color: T.suave }}>{String(f.categoria ?? "")}</div>
                  </div>
                ) },
                { name: "unidades", label: "Unidades", alinear: "right",
                  fmt: (v) => Number(v).toLocaleString("es-DO") },
                { name: "vendido", label: "Vendido", alinear: "right", fmt: (v) => RD(v as number, simbolo) },
                { name: "ganancia", label: "Ganancia", alinear: "right",
                  fmt: (v) => <strong style={{ color: T.ok }}>{RD(v as number, simbolo)}</strong> },
              ]}
              filas={d.top}
            />
          )}
        </Seccion>
      </div>
    </div>
  );
}
