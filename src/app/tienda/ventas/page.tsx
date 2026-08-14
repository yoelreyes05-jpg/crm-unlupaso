"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Aviso, Badge, Btn, Card, Cargando, ETIQUETA_METODO_PAGO, Kpi, RD, Tabla, Titulo, Vacio,
  api, fecha, inputBase, rejilla, tonoDoc, T,
} from "@/components/tienda/ui";

interface Venta {
  id: string; codigo: string; fecha: string; cliente_nombre: string; cliente_id: string | null;
  condicion: string; metodo_pago: string; total: number; pagado: number; saldo: number;
  ganancia: number; estado: string; estado_visual: string; dias_vencida: number;
  fecha_vence: string | null; ncf: string | null;
}

const FILTROS = [
  { valor: "todos",    texto: "Todas" },
  { valor: "hoy",      texto: "De hoy" },
  { valor: "credito",  texto: "A crédito" },
  { valor: "pendiente", texto: "Con saldo" },
];

export default function VentasPage() {
  const [lista, setLista] = useState<Venta[]>([]);
  const [filtro, setFiltro] = useState("todos");
  const [busqueda, setBusqueda] = useState("");
  const [simbolo, setSimbolo] = useState("RD$");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [r, cfg] = await Promise.all([
          api<{ data: Venta[] }>("/ventas?limit=1000"),
          api<{ data: { simbolo_moneda: string } }>("/config").catch(() => null),
        ]);
        setLista(r.data ?? []);
        if (cfg?.data?.simbolo_moneda) setSimbolo(cfg.data.simbolo_moneda);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al cargar");
      } finally {
        setCargando(false);
      }
    })();
  }, []);

  const filtradas = useMemo(() => {
    const hoy = new Date().toISOString().slice(0, 10);
    const b = busqueda.trim().toLowerCase();
    return lista.filter((v) => {
      if (filtro === "hoy" && v.fecha !== hoy) return false;
      if (filtro === "credito" && v.condicion !== "credito") return false;
      if (filtro === "pendiente" && !(Number(v.saldo) > 0.01 && v.estado !== "anulada")) return false;
      if (!b) return true;
      return (
        v.codigo.toLowerCase().includes(b) ||
        (v.cliente_nombre ?? "").toLowerCase().includes(b) ||
        (v.ncf ?? "").toLowerCase().includes(b)
      );
    });
  }, [lista, filtro, busqueda]);

  const t = filtradas.reduce(
    (a, v) => v.estado === "anulada" ? a : ({
      facturado: a.facturado + Number(v.total),
      cobrado: a.cobrado + Number(v.pagado),
      saldo: a.saldo + Number(v.saldo),
      ganancia: a.ganancia + Number(v.ganancia),
    }),
    { facturado: 0, cobrado: 0, saldo: 0, ganancia: 0 }
  );

  if (cargando) return <Cargando />;

  return (
    <div>
      <Titulo
        texto="🧾  Ventas"
        sub={`${filtradas.length} factura(s)`}
        acciones={
          <Link href="/tienda/ventas/nueva" style={{ textDecoration: "none" }}>
            <Btn>+ Nueva venta</Btn>
          </Link>
        }
      />

      {error && <Aviso texto={error} />}

      <div style={{ ...rejilla(205), marginBottom: 16 }}>
        <Kpi titulo="Facturado" valor={RD(t.facturado, simbolo)} />
        <Kpi titulo="Cobrado" valor={RD(t.cobrado, simbolo)} tono="ok" />
        <Kpi titulo="Por cobrar" valor={RD(t.saldo, simbolo)} tono={t.saldo > 0 ? "warn" : "neutro"} />
        <Kpi titulo="Ganancia" valor={RD(t.ganancia, simbolo)} tono="acento"
             detalle="Sin ITBIS, ya restado el costo" />
      </div>

      <div style={{ display: "flex", gap: 9, flexWrap: "wrap", marginBottom: 14, alignItems: "center" }}>
        <div style={{ display: "flex", background: T.panel, border: `1px solid ${T.borde}`, borderRadius: 10, padding: 3 }}>
          {FILTROS.map((x) => (
            <button key={x.valor} onClick={() => setFiltro(x.valor)}
              style={{
                border: "none", borderRadius: 8, padding: "7px 14px", cursor: "pointer",
                fontSize: 13, fontWeight: 700,
                background: filtro === x.valor ? T.acento : "transparent",
                color: filtro === x.valor ? "#fff" : T.suave,
              }}>{x.texto}</button>
          ))}
        </div>
        <input style={{ ...inputBase, maxWidth: 300, background: T.panel }}
               placeholder="Buscar factura, cliente o NCF…"
               value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
      </div>

      <Card style={{ padding: 0, overflow: "hidden" }}>
        {filtradas.length === 0 ? (
          <Vacio texto="No hay facturas que coincidan."
                 accion={<Link href="/tienda/ventas/nueva" style={{ textDecoration: "none" }}><Btn>Registrar la primera</Btn></Link>} />
        ) : (
          <Tabla
            filaRoja={(f) => f.estado_visual === "vencida"}
            columnas={[
              { name: "codigo", label: "Factura", fmt: (v, f) => (
                <Link href={`/tienda/ventas/${f.id}`} style={{ color: "inherit", fontWeight: 700, textDecoration: "none" }}>
                  {String(v)}
                  {f.ncf ? <div style={{ fontSize: 10.5, opacity: 0.7 }}>NCF {String(f.ncf)}</div> : null}
                </Link>
              ) },
              { name: "fecha", label: "Fecha", fmt: (v) => fecha(v as string) },
              { name: "cliente_nombre", label: "Cliente" },
              { name: "condicion", label: "Condición",
                fmt: (v, f) => (
                  <div>
                    <Badge texto={String(v)} tono={v === "credito" ? "info" : "neutro"} />
                    <div style={{ fontSize: 10.5, color: T.suave, marginTop: 2 }}>
                      {ETIQUETA_METODO_PAGO[String(f.metodo_pago)] ?? String(f.metodo_pago)}
                    </div>
                  </div>
                ) },
              { name: "total",  label: "Total",  alinear: "right", fmt: (v) => <strong>{RD(v as number, simbolo)}</strong> },
              { name: "pagado", label: "Cobrado", alinear: "right", fmt: (v) => RD(v as number, simbolo) },
              { name: "saldo",  label: "Saldo",  alinear: "right",
                fmt: (v) => Number(v) > 0.01 ? <strong>{RD(v as number, simbolo)}</strong> : "—" },
              { name: "fecha_vence", label: "Vence",
                fmt: (v, f) => v ? (
                  <div style={{ whiteSpace: "nowrap" }}>
                    {fecha(v as string)}
                    {Number(f.dias_vencida) > 0 && (
                      <div style={{ fontSize: 10.5, fontWeight: 800 }}>{String(f.dias_vencida)} días</div>
                    )}
                  </div>
                ) : "—" },
              { name: "estado_visual", label: "Estado",
                fmt: (v) => <Badge texto={String(v)} tono={tonoDoc(String(v))} /> },
            ]}
            filas={filtradas as unknown as Record<string, unknown>[]}
          />
        )}
      </Card>
    </div>
  );
}
