"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Aviso, Badge, Btn, Cargando, Kpi, RD, Seccion, Tabla, Titulo, Vacio,
  api, fecha, mesLargo, rejilla, T,
} from "@/components/anyeli/ui";
import type { PrCuotaVista, PrDashboard, PrGananciaMensual } from "@/types/anyeli";

interface Respuesta {
  kpis: PrDashboard;
  meses: PrGananciaMensual[];
  atrasadas: PrCuotaVista[];
  proximas: PrCuotaVista[];
}

export default function TableroPrestamos() {
  const [d, setD] = useState<Respuesta | null>(null);
  const [simbolo, setSimbolo] = useState("RD$");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [dash, cfg] = await Promise.all([
          api<{ data: Respuesta }>("/dashboard"),
          api<{ data: { simbolo_moneda: string } }>("/config").catch(() => null),
        ]);
        setD(dash.data);
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
            Ejecuta <code>supabase/anyeli_schema.sql</code> en Supabase y revisa{" "}
            <a href="/api/anyeli/salud" style={{ color: "inherit" }}>/api/anyeli/salud</a>.
          </div>
        </>
      } />
    );
  }
  if (!d) return null;

  const k = d.kpis;
  const maxMes = Math.max(
    1,
    ...d.meses.map((m) => Number(m.ganancia_administrador) + Number(m.ganancia_inversionistas))
  );

  return (
    <div>
      <Titulo
        texto="📊  Tablero"
        sub="Resumen de la cartera de préstamos"
        acciones={<Link href="/anyeli/creditos/nuevo" style={{ textDecoration: "none" }}><Btn>+ Nuevo préstamo</Btn></Link>}
      />

      <div style={{ ...rejilla(215), marginBottom: 14 }}>
        <Kpi titulo="Capital colocado" valor={RD(k.capital_colocado, simbolo)}
             detalle={`${k.prestamos_activos} préstamo(s) activo(s)`} tono="acento" />
        <Kpi titulo="Por cobrar" valor={RD(k.cartera_por_cobrar, simbolo)}
             detalle={`Capital por recuperar: ${RD(k.capital_por_recuperar, simbolo)}`} />
        <Kpi titulo="Mi ganancia (administrador)" valor={RD(k.ganancia_administrador, simbolo)}
             detalle={`Este mes: ${RD(k.ganancia_admin_mes, simbolo)}`} tono="ok" />
        <Kpi titulo="En atraso" valor={RD(k.monto_atrasado, simbolo)}
             detalle={`${k.prestamos_atrasados} préstamo(s) atrasado(s)`}
             tono={Number(k.prestamos_atrasados) > 0 ? "err" : "neutro"} />
      </div>

      <div style={{ ...rejilla(215), marginBottom: 20 }}>
        <Kpi titulo="Interés cobrado total" valor={RD(k.interes_cobrado_total, simbolo)} />
        <Kpi titulo="Ganancia inversionistas" valor={RD(k.ganancia_inversionistas, simbolo)}
             detalle={`${k.inversionistas_activos} inversionista(s)`} />
        <Kpi titulo="Cobrado este mes" valor={RD(k.cobrado_mes, simbolo)} />
        <Kpi titulo="Clientes activos" valor={k.clientes_activos} />
      </div>

      <div style={{ display: "grid", gap: 18, gridTemplateColumns: "repeat(auto-fit, minmax(430px, 1fr))", marginBottom: 18 }}>
        <Seccion
          titulo={`🔴  Cuotas atrasadas (${d.atrasadas.length})`}
          accion={<Link href="/anyeli/cobranza" style={{ fontSize: 12, fontWeight: 700, color: T.acento, textDecoration: "none" }}>Ver cobranza →</Link>}
          style={{ padding: 0 }}
        >
          {d.atrasadas.length === 0 ? (
            <Vacio texto="No hay cuotas atrasadas. Todo al día." />
          ) : (
            <Tabla
              filaRoja={() => true}
              columnas={[
                { name: "cliente_nombre", label: "Cliente",
                  fmt: (v, f) => (
                    <Link href={`/anyeli/creditos/${f.prestamo_id}`} style={{ color: "inherit", fontWeight: 700 }}>
                      {String(v)}
                      <div style={{ fontSize: 11, opacity: 0.7, fontWeight: 400 }}>{String(f.prestamo_codigo)}</div>
                    </Link>
                  ) },
                { name: "numero", label: "Cuota", fmt: (v) => `#${v}` },
                { name: "fecha_vencimiento", label: "Venció", fmt: (v) => fecha(v as string) },
                { name: "dias_atraso", label: "Atraso", alinear: "right", fmt: (v) => <Badge texto={`${v} d`} tono="err" /> },
                { name: "pendiente", label: "A cobrar", alinear: "right",
                  fmt: (v, f) => <strong>{RD(Number(v) + Number(f.mora_pendiente), simbolo)}</strong> },
              ]}
              filas={d.atrasadas as unknown as Record<string, unknown>[]}
            />
          )}
        </Seccion>

        <Seccion titulo="📅  Próximos 7 días" style={{ padding: 0 }}>
          {d.proximas.length === 0 ? (
            <Vacio texto="Sin vencimientos en los próximos 7 días." />
          ) : (
            <Tabla
              columnas={[
                { name: "cliente_nombre", label: "Cliente",
                  fmt: (v, f) => (
                    <Link href={`/anyeli/creditos/${f.prestamo_id}`} style={{ color: T.texto, fontWeight: 600, textDecoration: "none" }}>
                      {String(v)}
                      <div style={{ fontSize: 11, color: T.suave, fontWeight: 400 }}>{String(f.prestamo_codigo)}</div>
                    </Link>
                  ) },
                { name: "numero", label: "Cuota", fmt: (v) => `#${v}` },
                { name: "fecha_vencimiento", label: "Vence", fmt: (v) => fecha(v as string) },
                { name: "pendiente", label: "Monto", alinear: "right", fmt: (v) => <strong>{RD(v as number, simbolo)}</strong> },
              ]}
              filas={d.proximas as unknown as Record<string, unknown>[]}
            />
          )}
        </Seccion>
      </div>

      <Seccion titulo="💹  Ganancias por mes">
        {d.meses.length === 0 ? (
          <Vacio texto="Aún no hay pagos registrados." />
        ) : (
          <div>
            {d.meses.slice(0, 10).map((m) => {
              const admin = Number(m.ganancia_administrador);
              const inv = Number(m.ganancia_inversionistas);
              return (
                <div key={m.mes} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 9 }}>
                  <div style={{ width: 120, flexShrink: 0, fontSize: 12, fontWeight: 600, color: T.suave }}>
                    {mesLargo(m.mes)}
                  </div>
                  <div style={{ flex: 1, display: "flex", height: 22, borderRadius: 5, overflow: "hidden", background: "#e3eaf0" }}>
                    <div title={`Administrador: ${RD(admin, simbolo)}`}
                         style={{ width: `${(admin / maxMes) * 100}%`, background: T.ok }} />
                    <div title={`Inversionistas: ${RD(inv, simbolo)}`}
                         style={{ width: `${(inv / maxMes) * 100}%`, background: T.acento2 }} />
                  </div>
                  <div style={{ width: 135, flexShrink: 0, textAlign: "right", fontSize: 12.5, fontVariantNumeric: "tabular-nums" }}>
                    {RD(admin + inv, simbolo)}
                  </div>
                </div>
              );
            })}
            <div style={{ display: "flex", gap: 16, marginTop: 12, fontSize: 11.5, color: T.suave }}>
              <span><span style={{ display: "inline-block", width: 10, height: 10, background: T.ok, borderRadius: 2, marginRight: 5 }} />Administrador</span>
              <span><span style={{ display: "inline-block", width: 10, height: 10, background: T.acento2, borderRadius: 2, marginRight: 5 }} />Inversionistas</span>
            </div>
          </div>
        )}
      </Seccion>
    </div>
  );
}
