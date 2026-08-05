"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, Card, RD, T, Badge, fecha } from "@/components/reposteria/ui";
import type { RepDashboard, RepLoteAlerta, RepEvento } from "@/types/reposteria";

export default function DashboardReposteria() {
  const [d, setD]           = useState<RepDashboard | null>(null);
  const [lotes, setLotes]   = useState<RepLoteAlerta[]>([]);
  const [eventos, setEv]    = useState<RepEvento[]>([]);
  const [error, setError]   = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const [dash, l, e] = await Promise.all([
          api<{ data: RepDashboard }>("/dashboard"),
          api<{ data: RepLoteAlerta[] }>("/vistas/lotes-alerta?limit=8"),
          api<{ data: RepEvento[] }>("/eventos?limit=6"),
        ]);
        setD(dash.data); setLotes(l.data ?? []); setEv(e.data ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al cargar el dashboard");
      }
    })();
  }, []);

  const hora   = new Date().getHours();
  const saludo = hora < 12 ? "Buenos días" : hora < 18 ? "Buenas tardes" : "Buenas noches";

  const tarjetas = [
    { label: "Ventas de hoy",       valor: RD(d?.ventas_hoy),  icono: "💵", color: T.ok    },
    { label: "Ventas del mes",      valor: RD(d?.ventas_mes),  icono: "📈", color: T.info  },
    { label: "Por cobrar",          valor: RD(d?.por_cobrar),  icono: "📥", color: T.warn  },
    { label: "Por pagar",           valor: RD(d?.por_pagar),   icono: "📤", color: T.err   },
    { label: "Eventos 7 días",      valor: String(d?.eventos_proximos ?? 0),      icono: "🎉", color: T.acento },
    { label: "Cotizaciones abiertas", valor: String(d?.cotizaciones_abiertas ?? 0), icono: "💬", color: "#8b5cf6" },
    { label: "Ingredientes críticos", valor: String(d?.ingredientes_criticos ?? 0), icono: "🥣", color: T.err },
    { label: "Lotes por vencer",    valor: String(d?.lotes_por_vencer ?? 0),      icono: "⏱️", color: T.warn },
  ];

  const tonoLote: Record<string, string> = { ok: "ok", proximo: "warn", critico: "err", vencido: "err" };

  return (
    <div>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 26, margin: 0 }}>{saludo} 👋</h1>
        <p style={{ color: T.suave, fontSize: 13.5, marginTop: 5 }}>
          {new Date().toLocaleDateString("es-DO", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          {d && (d.caja_abierta
            ? <span style={{ marginLeft: 10 }}><Badge texto="Caja abierta" tono="ok" /></span>
            : <span style={{ marginLeft: 10 }}><Badge texto="Caja cerrada" tono="neutro" /></span>)}
        </p>
      </div>

      {error && <Card style={{ borderColor: T.err, color: T.err, marginBottom: 18 }}>{error}</Card>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(215px, 1fr))", gap: 14, marginBottom: 24 }}>
        {tarjetas.map((t) => (
          <Card key={t.label}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                width: 42, height: 42, borderRadius: 12, fontSize: 20,
                background: t.color + "22", display: "flex", alignItems: "center", justifyContent: "center",
              }}>{t.icono}</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 11, color: T.suave, textTransform: "uppercase", letterSpacing: 0.4 }}>{t.label}</div>
                <div style={{ fontSize: 19, fontWeight: 800, marginTop: 2 }}>{d ? t.valor : "…"}</div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 16 }}>
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
            <strong>⏱️ Lotes por vencer</strong>
            <Link href="/reposteria/lotes" style={{ color: T.acento2, fontSize: 12.5, textDecoration: "none" }}>Ver todos →</Link>
          </div>
          {lotes.length === 0
            ? <div style={{ color: T.suave, fontSize: 13 }}>Sin lotes registrados.</div>
            : lotes.map((l) => (
              <div key={l.id} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "9px 0", borderBottom: `1px solid ${T.borde}55`,
              }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{l.nombre_lote}</div>
                  <div style={{ fontSize: 11.5, color: T.suave }}>
                    {l.cantidad_actual} {l.unidad} · vence {fecha(l.fecha_vencimiento)}
                  </div>
                </div>
                <Badge texto={l.nivel_alerta} tono={tonoLote[l.nivel_alerta] ?? "neutro"} />
              </div>
            ))}
        </Card>

        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
            <strong>🎉 Próximos eventos</strong>
            <Link href="/reposteria/eventos" style={{ color: T.acento2, fontSize: 12.5, textDecoration: "none" }}>Ver todos →</Link>
          </div>
          {eventos.length === 0
            ? <div style={{ color: T.suave, fontSize: 13 }}>No hay eventos programados.</div>
            : eventos.map((e) => (
              <div key={e.id} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "9px 0", borderBottom: `1px solid ${T.borde}55`,
              }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{e.nombre_evento}</div>
                  <div style={{ fontSize: 11.5, color: T.suave }}>
                    {fecha(e.fecha_evento)} · {RD(e.total)}
                  </div>
                </div>
                <Badge texto={e.estado.replace("_", " ")} tono={e.estado === "confirmado" ? "ok" : e.estado === "cancelado" ? "err" : "info"} />
              </div>
            ))}
        </Card>
      </div>
    </div>
  );
}
