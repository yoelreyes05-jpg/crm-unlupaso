"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Aviso, Badge, Btn, Card, Cargando, ETIQUETA_TIPO_PAGO, Etiqueta, Kpi, RD,
  Tabla, Titulo, Vacio, api, fecha, hoyISO, inputBase, rejilla, T,
} from "@/components/anyeli/ui";
import type { PrPago, PrPrestamoVista } from "@/types/anyeli";

export default function PagosPage() {
  const [pagos, setPagos] = useState<PrPago[]>([]);
  const [prestamos, setPrestamos] = useState<PrPrestamoVista[]>([]);
  const [simbolo, setSimbolo] = useState("RD$");
  const [desde, setDesde] = useState(primerDiaDelMes());
  const [hasta, setHasta] = useState(hoyISO());
  const [tipo, setTipo] = useState("todos");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [pg, pr, cfg] = await Promise.all([
          api<{ data: PrPago[] }>("/pagos?limit=1000&anulado=false"),
          api<{ data: PrPrestamoVista[] }>("/creditos?limit=1000"),
          api<{ data: { simbolo_moneda: string } }>("/config").catch(() => null),
        ]);
        setPagos(pg.data ?? []);
        setPrestamos(pr.data ?? []);
        if (cfg?.data?.simbolo_moneda) setSimbolo(cfg.data.simbolo_moneda);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al cargar");
      } finally {
        setCargando(false);
      }
    })();
  }, []);

  const mapa = useMemo(() => {
    const m = new Map<string, PrPrestamoVista>();
    prestamos.forEach((p) => m.set(p.id, p));
    return m;
  }, [prestamos]);

  const filtrados = useMemo(
    () => pagos.filter(
      (p) => !p.anulado && p.fecha >= desde && p.fecha <= hasta && (tipo === "todos" || p.tipo === tipo)
    ),
    [pagos, desde, hasta, tipo]
  );

  const tot = filtrados.reduce(
    (a, p) => ({
      total: a.total + Number(p.monto),
      capital: a.capital + Number(p.monto_capital),
      interes: a.interes + Number(p.monto_interes),
      mora: a.mora + Number(p.monto_mora),
    }),
    { total: 0, capital: 0, interes: 0, mora: 0 }
  );

  if (cargando) return <Cargando />;

  return (
    <div>
      <Titulo texto="✅  Pagos" sub="Todos los cobros registrados" />
      {error && <Aviso texto={error} />}

      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "grid", gap: 13, gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", alignItems: "end" }}>
          <div>
            <Etiqueta>Desde</Etiqueta>
            <input type="date" style={inputBase} value={desde} onChange={(e) => setDesde(e.target.value)} />
          </div>
          <div>
            <Etiqueta>Hasta</Etiqueta>
            <input type="date" style={inputBase} value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </div>
          <div>
            <Etiqueta>Tipo</Etiqueta>
            <select style={inputBase} value={tipo} onChange={(e) => setTipo(e.target.value)}>
              <option value="todos">Todos</option>
              <option value="cuota">Cuota</option>
              <option value="solo_interes">Solo rédito</option>
              <option value="abono_capital">Abono a capital</option>
              <option value="saldo_total">Saldo total</option>
              <option value="mora">Mora</option>
            </select>
          </div>
          <Btn tono="neutro" disabled={!filtrados.length} onClick={() => descargarCSV(filtrados, mapa)}>
            Exportar CSV
          </Btn>
        </div>
      </Card>

      <div style={{ ...rejilla(215), marginBottom: 16 }}>
        <Kpi titulo="Total cobrado" valor={RD(tot.total, simbolo)} detalle={`${filtrados.length} pago(s)`} />
        <Kpi titulo="Capital recuperado" valor={RD(tot.capital, simbolo)} />
        <Kpi titulo="Interés cobrado" valor={RD(tot.interes, simbolo)} tono="ok" />
        <Kpi titulo="Mora cobrada" valor={RD(tot.mora, simbolo)} tono="warn" />
      </div>

      <Card style={{ padding: 0, overflow: "hidden" }}>
        {filtrados.length === 0 ? <Vacio texto="No hay pagos en el rango seleccionado." /> : (
          <Tabla
            columnas={[
              { name: "recibo", label: "Recibo", fmt: (v) => <span style={{ fontSize: 12 }}>{String(v)}</span> },
              { name: "fecha", label: "Fecha", fmt: (v) => fecha(v as string) },
              { name: "prestamo_id", label: "Cliente",
                fmt: (v) => <strong>{mapa.get(String(v))?.cliente_nombre ?? "—"}</strong> },
              { name: "cuota_id", label: "Préstamo",
                fmt: (_v, f) => (
                  <Link href={`/anyeli/creditos/${f.prestamo_id}`} style={{ color: T.acento, fontSize: 12, textDecoration: "none" }}>
                    {mapa.get(String(f.prestamo_id))?.codigo ?? "—"}
                  </Link>
                ) },
              { name: "tipo", label: "Tipo",
                fmt: (v) => <Badge texto={ETIQUETA_TIPO_PAGO[String(v)] ?? String(v)} tono={v === "solo_interes" ? "acento" : "neutro"} /> },
              { name: "metodo_pago", label: "Forma", fmt: (v) => <span style={{ textTransform: "capitalize" }}>{String(v)}</span> },
              { name: "monto_capital", label: "Capital", alinear: "right", fmt: (v) => RD(v as number, simbolo) },
              { name: "monto_interes", label: "Interés", alinear: "right", fmt: (v) => RD(v as number, simbolo) },
              { name: "monto_mora", label: "Mora", alinear: "right", fmt: (v) => RD(v as number, simbolo) },
              { name: "monto", label: "Total", alinear: "right", fmt: (v) => <strong>{RD(v as number, simbolo)}</strong> },
            ]}
            filas={filtrados as unknown as Record<string, unknown>[]}
          />
        )}
      </Card>
    </div>
  );
}

function primerDiaDelMes() {
  const f = new Date();
  return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}-01`;
}

function descargarCSV(pagos: PrPago[], mapa: Map<string, PrPrestamoVista>) {
  const cab = ["Recibo", "Fecha", "Cliente", "Prestamo", "Tipo", "Forma", "Capital", "Interes", "Mora", "Total"];
  const filas = pagos.map((p) => {
    const pr = mapa.get(p.prestamo_id);
    return [
      p.recibo, p.fecha, pr?.cliente_nombre ?? "", pr?.codigo ?? "",
      p.tipo, p.metodo_pago, p.monto_capital, p.monto_interes, p.monto_mora, p.monto,
    ].join(",");
  });
  const csv = [cab.join(","), ...filas].join("\n");
  const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `pagos-${hoyISO()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
