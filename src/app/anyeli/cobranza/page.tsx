"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Aviso, Badge, Cargando, Kpi, RD, Seccion, Tabla, Titulo, Vacio,
  api, fecha, inputBase, rejilla, tonoCuota, T,
} from "@/components/anyeli/ui";
import type { PrCuotaVista } from "@/types/anyeli";

interface Respuesta {
  atrasadas: PrCuotaVista[];
  hoy: PrCuotaVista[];
  proximas: PrCuotaVista[];
}

export default function Cobranza() {
  const [d, setD] = useState<Respuesta | null>(null);
  const [simbolo, setSimbolo] = useState("RD$");
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [r, cfg] = await Promise.all([
          api<{ data: Respuesta }>("/cobranza?dias=15"),
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

  const filtrar = useMemo(() => {
    const b = busqueda.trim().toLowerCase();
    return (lista: PrCuotaVista[]) =>
      !b ? lista : lista.filter(
        (c) =>
          (c.cliente_nombre ?? "").toLowerCase().includes(b) ||
          (c.prestamo_codigo ?? "").toLowerCase().includes(b)
      );
  }, [busqueda]);

  if (cargando) return <Cargando />;
  if (error) return <Aviso texto={error} />;
  if (!d) return null;

  const atrasadas = filtrar(d.atrasadas);
  const hoy = filtrar(d.hoy);
  const proximas = filtrar(d.proximas);

  const suma = (l: PrCuotaVista[]) =>
    l.reduce((a, c) => a + Number(c.pendiente) + Number(c.mora_pendiente), 0);

  return (
    <div>
      <Titulo texto="⏰  Cobranza" sub="Lo que hay que cobrar hoy y lo que está vencido" />

      <div style={{ ...rejilla(215), marginBottom: 16 }}>
        <Kpi titulo="En atraso" valor={RD(suma(atrasadas), simbolo)}
             detalle={`${atrasadas.length} cuota(s)`} tono={atrasadas.length ? "err" : "neutro"} />
        <Kpi titulo="Vence hoy" valor={RD(suma(hoy), simbolo)} detalle={`${hoy.length} cuota(s)`} />
        <Kpi titulo="Próximos 15 días" valor={RD(suma(proximas), simbolo)} detalle={`${proximas.length} cuota(s)`} />
      </div>

      <input
        style={{ ...inputBase, maxWidth: 380, background: T.panel, marginBottom: 16 }}
        placeholder="Buscar cliente o código de préstamo…"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
      />

      <Seccion titulo={`🔴  Cuotas atrasadas (${atrasadas.length})`} style={{ marginBottom: 18, padding: 0 }}>
        {atrasadas.length === 0
          ? <Vacio texto="No hay nada atrasado. Buen trabajo." />
          : <TablaCobros lista={atrasadas} simbolo={simbolo} roja />}
      </Seccion>

      <Seccion titulo={`Vencen hoy (${hoy.length})`} style={{ marginBottom: 18, padding: 0 }}>
        {hoy.length === 0 ? <Vacio texto="Sin cuotas que venzan hoy." /> : <TablaCobros lista={hoy} simbolo={simbolo} />}
      </Seccion>

      <Seccion titulo={`Próximos 15 días (${proximas.length})`} style={{ padding: 0 }}>
        {proximas.length === 0 ? <Vacio texto="Sin vencimientos próximos." /> : <TablaCobros lista={proximas} simbolo={simbolo} />}
      </Seccion>
    </div>
  );
}

function TablaCobros({ lista, simbolo, roja }: { lista: PrCuotaVista[]; simbolo: string; roja?: boolean }) {
  return (
    <Tabla
      filaRoja={() => !!roja}
      columnas={[
        { name: "cliente_nombre", label: "Cliente", fmt: (v, f) => (
          <div>
            <strong>{String(v)}</strong>
            {f.cliente_telefono ? <div style={{ fontSize: 11, opacity: 0.7 }}>{String(f.cliente_telefono)}</div> : null}
          </div>
        ) },
        { name: "prestamo_codigo", label: "Préstamo", fmt: (v) => <span style={{ fontSize: 12 }}>{String(v)}</span> },
        { name: "numero", label: "Cuota", fmt: (v) => `#${v}` },
        { name: "fecha_vencimiento", label: "Vence", fmt: (v) => fecha(v as string) },
        { name: "dias_atraso", label: "Atraso", alinear: "right", fmt: (v) => Number(v) > 0 ? `${v} d` : "—" },
        { name: "pendiente", label: "Cuota", alinear: "right", fmt: (v) => RD(v as number, simbolo) },
        { name: "mora_pendiente", label: "Mora", alinear: "right",
          fmt: (v) => Number(v) > 0 ? RD(v as number, simbolo) : "—" },
        { name: "total", label: "A cobrar", alinear: "right",
          fmt: (_v, f) => <strong>{RD(Number(f.pendiente) + Number(f.mora_pendiente), simbolo)}</strong> },
        { name: "estado_visual", label: "Estado",
          fmt: (v) => <Badge texto={String(v).replace("_", " ")} tono={tonoCuota(String(v))} /> },
      ]}
      filas={lista as unknown as Record<string, unknown>[]}
      acciones={(f) => (
        <Link href={`/anyeli/creditos/${f.prestamo_id}`}
              style={{ color: "inherit", fontSize: 12.5, fontWeight: 700, textDecoration: "none" }}>
          Cobrar →
        </Link>
      )}
    />
  );
}
