"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Badge, Btn, Cargando, ETIQUETA_METODO_PAGO, Kpi, RD, Seccion, Tabla, Titulo, Vacio,
  api, fecha, rejilla, tonoDoc, T,
} from "@/components/tienda/ui";

interface Compra {
  id: string; codigo: string; fecha: string; ncf: string | null; proveedor_nombre: string;
  proveedor_telefono: string | null; condicion: string; fecha_vence: string | null;
  subtotal: number; itbis: number; descuento: number; total: number; pagado: number;
  saldo: number; estado: string; estado_visual: string; dias_vencida: number; notas: string | null;
}
interface Item {
  id: string; cantidad: number; costo: number; itbis_pct: number; importe: number;
  ti_productos?: { codigo: string; nombre: string; unidad: string } | null;
}
interface Pago {
  id: string; fecha: string; monto: number; metodo_pago: string;
  referencia: string | null; anulado: boolean;
}

export default function DetalleCompra() {
  const { id } = useParams<{ id: string }>();
  const [d, setD] = useState<{ compra: Compra; items: Item[]; pagos: Pago[] } | null>(null);
  const [simbolo, setSimbolo] = useState("RD$");
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [r, cfg] = await Promise.all([
          api<{ data: { compra: Compra; items: Item[]; pagos: Pago[] } }>(`/compras/${id}`),
          api<{ data: { simbolo_moneda: string } }>("/config").catch(() => null),
        ]);
        setD(r.data);
        if (cfg?.data?.simbolo_moneda) setSimbolo(cfg.data.simbolo_moneda);
      } finally {
        setCargando(false);
      }
    })();
  }, [id]);

  if (cargando) return <Cargando />;
  if (!d) return <Vacio texto="Compra no encontrada." />;

  const c = d.compra;

  return (
    <div style={{ maxWidth: 900 }}>
      <Link href="/tienda/compras" style={{ fontSize: 12, color: T.acento, textDecoration: "none" }}>
        ← Compras
      </Link>
      <div style={{ height: 8 }} />
      <Titulo
        texto={c.codigo}
        sub={
          <span style={{ display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap" }}>
            <Badge texto={c.estado_visual} tono={tonoDoc(c.estado_visual)} />
            <span>{c.proveedor_nombre} · {fecha(c.fecha)}{c.ncf ? ` · NCF ${c.ncf}` : ""}</span>
          </span>
        }
        acciones={<Btn tono="neutro" onClick={() => window.print()}>Imprimir</Btn>}
      />

      <div style={{ ...rejilla(190), marginBottom: 18 }}>
        <Kpi titulo="Total" valor={RD(c.total, simbolo)}
             detalle={`Subtotal ${RD(c.subtotal, simbolo)} + ITBIS ${RD(c.itbis, simbolo)}`} />
        <Kpi titulo="Pagado" valor={RD(c.pagado, simbolo)} tono="ok" />
        <Kpi titulo="Saldo" valor={RD(c.saldo, simbolo)}
             tono={Number(c.saldo) > 0.01 ? (c.estado_visual === "vencida" ? "err" : "warn") : "neutro"} />
        <Kpi titulo="Vence" valor={c.fecha_vence ? fecha(c.fecha_vence) : "—"}
             detalle={Number(c.dias_vencida) > 0 ? `${c.dias_vencida} días vencida` : c.condicion} />
      </div>

      <Seccion titulo="Productos comprados" style={{ marginBottom: 18, padding: 0 }}>
        <Tabla
          columnas={[
            { name: "id", label: "Producto",
              fmt: (_v, f) => {
                const p = f.ti_productos as { codigo: string; nombre: string } | null;
                return (
                  <div>
                    <strong>{p?.nombre ?? "—"}</strong>
                    {p?.codigo && <div style={{ fontSize: 10.5, color: T.suave }}>{p.codigo}</div>}
                  </div>
                );
              } },
            { name: "cantidad", label: "Cantidad", alinear: "right",
              fmt: (v, f) => {
                const p = f.ti_productos as { unidad: string } | null;
                return `${Number(v).toLocaleString("es-DO")} ${p?.unidad ?? ""}`;
              } },
            { name: "costo", label: "Costo unitario", alinear: "right", fmt: (v) => RD(v as number, simbolo) },
            { name: "itbis_pct", label: "ITBIS", alinear: "right",
              fmt: (v) => Number(v) > 0 ? `${Number(v)}%` : "exento" },
            { name: "importe", label: "Importe", alinear: "right",
              fmt: (v) => <strong>{RD(v as number, simbolo)}</strong> },
          ]}
          filas={d.items as unknown as Record<string, unknown>[]}
        />
      </Seccion>

      <Seccion titulo={`Pagos hechos (${d.pagos.filter((p) => !p.anulado).length})`} style={{ padding: 0 }}>
        {d.pagos.length === 0 ? <Vacio texto="Todavía no se ha pagado nada." /> : (
          <Tabla
            columnas={[
              { name: "fecha", label: "Fecha", fmt: (v) => fecha(v as string) },
              { name: "metodo_pago", label: "Forma",
                fmt: (v) => ETIQUETA_METODO_PAGO[String(v)] ?? String(v) },
              { name: "referencia", label: "Referencia" },
              { name: "monto", label: "Monto", alinear: "right",
                fmt: (v) => <strong>{RD(v as number, simbolo)}</strong> },
              { name: "anulado", label: "", fmt: (v) => v ? <Badge texto="anulado" tono="err" /> : null },
            ]}
            filas={d.pagos as unknown as Record<string, unknown>[]}
          />
        )}
      </Seccion>

      {c.notas && (
        <div style={{ marginTop: 16, fontSize: 13, color: T.suave }}>
          <strong>Nota:</strong> {c.notas}
        </div>
      )}
    </div>
  );
}
