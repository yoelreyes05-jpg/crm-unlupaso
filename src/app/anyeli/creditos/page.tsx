"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Aviso, Badge, Barra, Btn, Card, Cargando, ETIQUETA_FRECUENCIA, Kpi, PCT, RD,
  Tabla, Titulo, Vacio, api, fecha, inputBase, rejilla, tonoPrestamo, T,
} from "@/components/anyeli/ui";
import type { PrPrestamoVista } from "@/types/anyeli";

const FILTROS = [
  { valor: "todos",    texto: "Todos" },
  { valor: "activo",   texto: "Activos" },
  { valor: "atrasado", texto: "Atrasados" },
  { valor: "pagado",   texto: "Pagados" },
];

export default function ListaPrestamos() {
  const [lista, setLista] = useState<PrPrestamoVista[]>([]);
  const [filtro, setFiltro] = useState("todos");
  const [busqueda, setBusqueda] = useState("");
  const [simbolo, setSimbolo] = useState("RD$");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setCargando(true);
    const q =
      filtro === "todos" ? "" :
      filtro === "atrasado" ? "?estado_visual=atrasado" : `?estado=${filtro}`;

    Promise.all([
      api<{ data: PrPrestamoVista[] }>(`/creditos${q}`),
      api<{ data: { simbolo_moneda: string } }>("/config").catch(() => null),
    ])
      .then(([r, cfg]) => {
        setLista(r.data ?? []);
        if (cfg?.data?.simbolo_moneda) setSimbolo(cfg.data.simbolo_moneda);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Error al cargar"))
      .finally(() => setCargando(false));
  }, [filtro]);

  const filtrados = useMemo(() => {
    const b = busqueda.trim().toLowerCase();
    if (!b) return lista;
    return lista.filter(
      (p) =>
        p.codigo.toLowerCase().includes(b) ||
        (p.cliente_nombre ?? "").toLowerCase().includes(b) ||
        (p.cliente_cedula ?? "").toLowerCase().includes(b) ||
        (p.inversionista_nombre ?? "").toLowerCase().includes(b)
    );
  }, [lista, busqueda]);

  const tot = filtrados.reduce(
    (a, p) => ({
      capital: a.capital + Number(p.capital),
      saldo:   a.saldo   + Number(p.saldo_total),
      cobrado: a.cobrado + Number(p.total_cobrado),
    }),
    { capital: 0, saldo: 0, cobrado: 0 }
  );

  return (
    <div>
      <Titulo
        texto="📄  Préstamos"
        sub={`${filtrados.length} préstamo(s)`}
        acciones={
          <Link href="/anyeli/creditos/nuevo" style={{ textDecoration: "none" }}>
            <Btn>+ Nuevo préstamo</Btn>
          </Link>
        }
      />

      <div style={{ ...rejilla(215), marginBottom: 16 }}>
        <Kpi titulo="Capital colocado" valor={RD(tot.capital, simbolo)} tono="acento" />
        <Kpi titulo="Saldo por cobrar" valor={RD(tot.saldo, simbolo)} />
        <Kpi titulo="Total cobrado" valor={RD(tot.cobrado, simbolo)} tono="ok" />
      </div>

      <div style={{ display: "flex", gap: 9, flexWrap: "wrap", marginBottom: 14, alignItems: "center" }}>
        <div style={{ display: "flex", background: T.panel, border: `1px solid ${T.borde}`, borderRadius: 10, padding: 3 }}>
          {FILTROS.map((f) => (
            <button
              key={f.valor}
              onClick={() => setFiltro(f.valor)}
              style={{
                border: "none", borderRadius: 8, padding: "7px 14px", cursor: "pointer",
                fontSize: 13, fontWeight: 700,
                background: filtro === f.valor ? T.acento : "transparent",
                color: filtro === f.valor ? "#fff" : T.suave,
              }}
            >{f.texto}</button>
          ))}
        </div>
        <input
          style={{ ...inputBase, maxWidth: 320, background: T.panel }}
          placeholder="Buscar cliente, código o inversionista…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </div>

      {error && <Aviso texto={error} />}

      <Card style={{ padding: 0, overflow: "hidden" }}>
        {cargando ? <Cargando /> : filtrados.length === 0 ? (
          <Vacio
            texto="No hay préstamos que coincidan."
            accion={<Link href="/anyeli/creditos/nuevo" style={{ textDecoration: "none" }}><Btn>Crear el primero</Btn></Link>}
          />
        ) : (
          <Tabla
            filaRoja={(f) => f.estado_visual === "atrasado"}
            columnas={[
              { name: "codigo", label: "Código",
                fmt: (v, f) => (
                  <Link href={`/anyeli/creditos/${f.id}`} style={{ color: "inherit", fontWeight: 700, textDecoration: "none" }}>
                    {String(v)}
                    {Number(f.ciclo) > 1 && (
                      <div style={{ marginTop: 3 }}>
                        <Badge texto={`reenganche ${Number(f.ciclo) - 1}`} tono="acento" />
                      </div>
                    )}
                  </Link>
                ) },
              { name: "cliente_nombre", label: "Cliente",
                fmt: (v, f) => (
                  <Link href={`/anyeli/creditos/${f.id}`} style={{ color: "inherit", fontWeight: 600, textDecoration: "none" }}>
                    {String(v)}
                    <div style={{ fontSize: 11, opacity: 0.65 }}>{String(f.cliente_telefono ?? "")}</div>
                  </Link>
                ) },
              { name: "inversionista_nombre", label: "Inversionista",
                fmt: (v, f) => v
                  ? <Link href={`/anyeli/inversionistas/${f.inversionista_id}`} style={{ color: "inherit", textDecoration: "none" }}>{String(v)}</Link>
                  : <span style={{ fontSize: 12, fontStyle: "italic", opacity: 0.6 }}>capital propio</span> },
              { name: "capital", label: "Capital", alinear: "right", fmt: (v) => RD(v as number, simbolo) },
              { name: "tasa_interes", label: "Tasa", alinear: "right", fmt: (v) => <strong>{PCT(v as number, 1)}</strong> },
              { name: "num_cuotas", label: "Plan",
                fmt: (v, f) => <span style={{ fontSize: 12 }}>{String(v)} × {ETIQUETA_FRECUENCIA[String(f.frecuencia)]}</span> },
              { name: "monto_cuota", label: "Cuota", alinear: "right", fmt: (v) => RD(v as number, simbolo) },
              { name: "saldo_total", label: "Saldo", alinear: "right", fmt: (v) => <strong>{RD(v as number, simbolo)}</strong> },
              { name: "avance_pct", label: "Avance",
                fmt: (v, f) => (
                  <div style={{ minWidth: 96 }}>
                    <Barra valor={Number(v)} />
                    <div style={{ fontSize: 10.5, opacity: 0.7, marginTop: 3 }}>
                      {String(f.cuotas_pagadas)}/{String(f.cuotas_totales)} cuotas
                    </div>
                  </div>
                ) },
              { name: "proximo_vencimiento", label: "Próx. vence",
                fmt: (v, f) => (
                  <div style={{ whiteSpace: "nowrap", fontSize: 12.5 }}>
                    {fecha(v as string)}
                    {Number(f.cuotas_atrasadas) > 0 && (
                      <div style={{ fontWeight: 700 }}>{String(f.cuotas_atrasadas)} atrasada(s)</div>
                    )}
                  </div>
                ) },
              { name: "estado_visual", label: "Estado",
                fmt: (v) => <Badge texto={String(v) === "al_dia" ? "al día" : String(v)} tono={tonoPrestamo(String(v))} /> },
            ]}
            filas={filtrados as unknown as Record<string, unknown>[]}
          />
        )}
      </Card>
    </div>
  );
}
