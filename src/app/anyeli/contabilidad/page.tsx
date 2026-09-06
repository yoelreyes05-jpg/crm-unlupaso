"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Aviso, Btn, Card, Cargando, Etiqueta, Kpi, PCT, RD, Seccion, Tabla, Titulo, Vacio,
  api, inputBase, mesLargo, rejilla, T,
} from "@/components/anyeli/ui";
import type { PrDashboard, PrGananciaMensual, PrPrestamoVista } from "@/types/anyeli";

interface GananciaInv {
  inversionista_id: string | null;
  inversionista_nombre: string;
  mes: string;
  capital_recuperado: number;
  ganancia: number;
  ganancia_administrador: number;
}

interface Socio {
  id: string;
  nombre: string;
  capital: number;
  ganancia: number;
  administrador: number;
}

interface Respuesta {
  kpis: PrDashboard;
  meses: PrGananciaMensual[];
  porInversionista: GananciaInv[];
  cartera: PrPrestamoVista[];
  periodo: {
    desde: string;
    hasta: string;
    resumen: { capital: number; interes: number; inversionistas: number; administrador: number };
    porSocio: Socio[];
  };
}

export default function Contabilidad() {
  const [d, setD] = useState<Respuesta | null>(null);
  const [simbolo, setSimbolo] = useState("RD$");
  const [desde, setDesde] = useState(`${new Date().getFullYear()}-01-01`);
  const [hasta, setHasta] = useState(new Date().toISOString().slice(0, 10));
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setCargando(true);
    Promise.all([
      api<{ data: Respuesta }>(`/contabilidad?desde=${desde}&hasta=${hasta}`),
      api<{ data: { simbolo_moneda: string } }>("/config").catch(() => null),
    ])
      .then(([r, cfg]) => {
        setD(r.data);
        if (cfg?.data?.simbolo_moneda) setSimbolo(cfg.data.simbolo_moneda);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Error al cargar"))
      .finally(() => setCargando(false));
  }, [desde, hasta]);

  if (cargando && !d) return <Cargando />;
  if (error) return <Aviso texto={error} />;
  if (!d) return null;

  const k = d.kpis;
  const r = d.periodo.resumen;

  return (
    <div>
      <Titulo
        texto="💹  Contabilidad"
        sub="Ganancias del administrador y de cada inversionista"
        acciones={<Btn tono="neutro" onClick={() => window.print()}>Imprimir</Btn>}
      />

      <div style={{ ...rejilla(215), marginBottom: 18 }}>
        <Kpi titulo="Interés cobrado (histórico)" valor={RD(k.interes_cobrado_total, simbolo)} />
        <Kpi titulo="Mi ganancia acumulada" valor={RD(k.ganancia_administrador, simbolo)} tono="ok" />
        <Kpi titulo="Ganancia inversionistas" valor={RD(k.ganancia_inversionistas, simbolo)} tono="acento" />
        <Kpi titulo="Capital en la calle" valor={RD(k.capital_por_recuperar, simbolo)}
             detalle={`${k.prestamos_activos} préstamo(s)`} />
      </div>

      <Seccion titulo="Resumen por período" style={{ marginBottom: 18 }}>
        <div style={{ display: "grid", gap: 13, gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", marginBottom: 16 }}>
          <div>
            <Etiqueta>Desde</Etiqueta>
            <input type="date" style={inputBase} value={desde} onChange={(e) => setDesde(e.target.value)} />
          </div>
          <div>
            <Etiqueta>Hasta</Etiqueta>
            <input type="date" style={inputBase} value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </div>
        </div>

        <div style={{ ...rejilla(200), marginBottom: 16 }}>
          <Kpi titulo="Capital recuperado" valor={RD(r.capital, simbolo)} />
          <Kpi titulo="Interés generado" valor={RD(r.interes, simbolo)} />
          <Kpi titulo="Para inversionistas" valor={RD(r.inversionistas, simbolo)} tono="acento" />
          <Kpi titulo="Para mí" valor={RD(r.administrador, simbolo)} tono="ok" />
        </div>

        {d.periodo.porSocio.length > 0 && (
          <Card style={{ padding: 0, overflow: "hidden" }}>
            <Tabla
              columnas={[
                { name: "nombre", label: "Inversionista",
                  fmt: (v, f) => f.id === "propio"
                    ? <strong>{String(v)}</strong>
                    : <Link href={`/anyeli/inversionistas/${f.id}`} style={{ color: T.texto, fontWeight: 700, textDecoration: "none" }}>{String(v)}</Link> },
                { name: "capital", label: "Capital devuelto", alinear: "right", fmt: (v) => RD(v as number, simbolo) },
                { name: "ganancia", label: "Su ganancia", alinear: "right",
                  fmt: (v) => <strong style={{ color: T.acento }}>{RD(v as number, simbolo)}</strong> },
                { name: "administrador", label: "Mi ganancia", alinear: "right",
                  fmt: (v) => <strong style={{ color: T.ok }}>{RD(v as number, simbolo)}</strong> },
                { name: "id", label: "Reparto", alinear: "right",
                  fmt: (_v, f) => {
                    const total = Number(f.ganancia) + Number(f.administrador);
                    return total > 0
                      ? <span style={{ fontSize: 12, color: T.suave }}>
                          {PCT((Number(f.ganancia) / total) * 100, 1)} / {PCT((Number(f.administrador) / total) * 100, 1)}
                        </span>
                      : "—";
                  } },
              ]}
              filas={d.periodo.porSocio as unknown as Record<string, unknown>[]}
            />
          </Card>
        )}
      </Seccion>

      <Seccion titulo="Estado de resultados por mes" style={{ marginBottom: 18, padding: 0 }}>
        {d.meses.length === 0 ? <Vacio texto="Sin movimientos registrados." /> : (
          <Tabla
            columnas={[
              { name: "mes", label: "Mes", fmt: (v) => <strong>{mesLargo(v as string)}</strong> },
              { name: "capital_recuperado", label: "Capital recuperado", alinear: "right", fmt: (v) => RD(v as number, simbolo) },
              { name: "interes_total", label: "Interés cobrado", alinear: "right", fmt: (v) => <strong>{RD(v as number, simbolo)}</strong> },
              { name: "ganancia_inversionistas", label: "Inversionistas", alinear: "right",
                fmt: (v) => <span style={{ color: T.acento }}>{RD(v as number, simbolo)}</span> },
              { name: "ganancia_administrador", label: "Administrador", alinear: "right",
                fmt: (v) => <strong style={{ color: T.ok }}>{RD(v as number, simbolo)}</strong> },
              { name: "prestamos_con_movimiento", label: "Préstamos", alinear: "right" },
            ]}
            filas={d.meses as unknown as Record<string, unknown>[]}
          />
        )}
      </Seccion>

      <Seccion titulo="Detalle por inversionista y mes" style={{ marginBottom: 18, padding: 0 }}>
        {d.porInversionista.length === 0 ? <Vacio texto="Sin datos." /> : (
          <Tabla
            columnas={[
              { name: "inversionista_nombre", label: "Inversionista", fmt: (v) => <strong>{String(v)}</strong> },
              { name: "mes", label: "Mes", fmt: (v) => mesLargo(v as string) },
              { name: "capital_recuperado", label: "Capital recuperado", alinear: "right", fmt: (v) => RD(v as number, simbolo) },
              { name: "ganancia", label: "Su ganancia", alinear: "right",
                fmt: (v) => <span style={{ color: T.acento }}>{RD(v as number, simbolo)}</span> },
              { name: "ganancia_administrador", label: "Mi ganancia", alinear: "right",
                fmt: (v) => <span style={{ color: T.ok }}>{RD(v as number, simbolo)}</span> },
            ]}
            filas={d.porInversionista as unknown as Record<string, unknown>[]}
          />
        )}
      </Seccion>

      <Seccion titulo="Cartera por préstamo" style={{ padding: 0 }}>
        <Tabla
          filaRoja={(f) => f.estado_visual === "atrasado"}
          columnas={[
            { name: "codigo", label: "Préstamo",
              fmt: (v, f) => <Link href={`/anyeli/creditos/${f.id}`} style={{ color: "inherit", fontWeight: 700, textDecoration: "none" }}>{String(v)}</Link> },
            { name: "cliente_nombre", label: "Cliente" },
            { name: "inversionista_nombre", label: "Inversionista", fmt: (v) => v ? String(v) : "propio" },
            { name: "capital", label: "Capital", alinear: "right", fmt: (v) => RD(v as number, simbolo) },
            { name: "total_cobrado", label: "Cobrado", alinear: "right", fmt: (v) => RD(v as number, simbolo) },
            { name: "saldo_total", label: "Saldo", alinear: "right", fmt: (v) => <strong>{RD(v as number, simbolo)}</strong> },
            { name: "interes_pagado", label: "Interés cobrado", alinear: "right",
              fmt: (v) => <span style={{ color: T.ok }}>{RD(v as number, simbolo)}</span> },
            { name: "estado_visual", label: "Estado",
              fmt: (v) => <span style={{ fontSize: 12 }}>{String(v).replace("_", " ")}</span> },
          ]}
          filas={d.cartera as unknown as Record<string, unknown>[]}
        />
      </Seccion>
    </div>
  );
}
