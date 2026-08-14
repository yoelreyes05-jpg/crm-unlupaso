"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Badge, Btn, Cargando, Kpi, PCT, RD, Seccion, Tabla, Titulo, Vacio,
  api, fecha, mesLargo, rejilla, tonoPrestamo, T,
} from "@/components/prestamos/ui";
import type { PrInversionistaVista, PrMovimientoInversionista, PrPrestamoVista } from "@/types/prestamos";

interface GananciaInv {
  inversionista_id: string;
  mes: string;
  capital_recuperado: number;
  ganancia: number;
  ganancia_administrador: number;
}

export default function DetalleInversionista() {
  const { id } = useParams<{ id: string }>();
  const [inv, setInv] = useState<PrInversionistaVista | null>(null);
  const [prestamos, setPrestamos] = useState<PrPrestamoVista[]>([]);
  const [movs, setMovs] = useState<PrMovimientoInversionista[]>([]);
  const [meses, setMeses] = useState<GananciaInv[]>([]);
  const [simbolo, setSimbolo] = useState("RD$");
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [vi, pr, mv, gi, cfg] = await Promise.all([
          api<{ data: PrInversionistaVista[] }>(`/vistas/pr_v_inversionistas?id=${id}`),
          api<{ data: PrPrestamoVista[] }>(`/creditos?inversionista_id=${id}`),
          api<{ data: PrMovimientoInversionista[] }>(`/movimientos?inversionista_id=${id}`),
          api<{ data: GananciaInv[] }>(`/vistas/pr_v_ganancias_inversionista?inversionista_id=${id}`),
          api<{ data: { simbolo_moneda: string } }>("/config").catch(() => null),
        ]);
        setInv(vi.data?.[0] ?? null);
        setPrestamos(pr.data ?? []);
        setMovs(mv.data ?? []);
        setMeses(gi.data ?? []);
        if (cfg?.data?.simbolo_moneda) setSimbolo(cfg.data.simbolo_moneda);
      } finally {
        setCargando(false);
      }
    })();
  }, [id]);

  if (cargando) return <Cargando />;
  if (!inv) return <Vacio texto="Inversionista no encontrado." />;

  return (
    <div>
      <Link href="/prestamos/inversionistas" style={{ fontSize: 12, color: T.acento, textDecoration: "none" }}>
        ← Inversionistas
      </Link>
      <div style={{ height: 8 }} />
      <Titulo
        texto={inv.nombre}
        sub={
          <>
            {inv.codigo} · {inv.telefono || "sin teléfono"} ·{" "}
            {inv.modo_reparto_default === "tasa"
              ? `${PCT(inv.tasa_default, 1)} mensual pactado`
              : `${PCT(inv.porcentaje_default, 1)} del interés`}
          </>
        }
        acciones={<Btn tono="neutro" onClick={() => window.print()}>Imprimir estado</Btn>}
      />

      <div style={{ ...rejilla(205), marginBottom: 18 }}>
        <Kpi titulo="Capital aportado" valor={RD(inv.capital_aportado, simbolo)}
             detalle={`Aportes ${RD(inv.aportes, simbolo)} · retiros ${RD(inv.retiros, simbolo)}`} />
        <Kpi titulo="Capital en la calle" valor={RD(inv.capital_en_calle, simbolo)} tono="acento"
             detalle={`${inv.prestamos_activos} préstamo(s) activo(s)`} />
        <Kpi titulo="Capital disponible" valor={RD(inv.capital_disponible, simbolo)}
             tono={Number(inv.capital_disponible) < 0 ? "err" : "neutro"}
             detalle="Listo para colocar" />
        <Kpi titulo="Ganancia por pagarle" valor={RD(inv.ganancia_por_pagar, simbolo)} tono="ok"
             detalle={`Ganado ${RD(inv.interes_ganado, simbolo)} · retirado ${RD(inv.ganancia_retirada, simbolo)}`} />
      </div>

      <Seccion titulo="Ganancias por mes" style={{ marginBottom: 18, padding: 0 }}>
        {meses.length === 0 ? <Vacio texto="Sin ganancias registradas todavía." /> : (
          <Tabla
            columnas={[
              { name: "mes", label: "Mes", fmt: (v) => mesLargo(v as string) },
              { name: "capital_recuperado", label: "Capital recuperado", alinear: "right", fmt: (v) => RD(v as number, simbolo) },
              { name: "ganancia", label: "Su ganancia", alinear: "right",
                fmt: (v) => <strong style={{ color: T.ok }}>{RD(v as number, simbolo)}</strong> },
              { name: "ganancia_administrador", label: "Ganancia del administrador", alinear: "right",
                fmt: (v) => <span style={{ color: T.suave }}>{RD(v as number, simbolo)}</span> },
            ]}
            filas={meses as unknown as Record<string, unknown>[]}
          />
        )}
      </Seccion>

      <Seccion titulo={`Préstamos financiados (${prestamos.length})`} style={{ marginBottom: 18, padding: 0 }}>
        {prestamos.length === 0 ? <Vacio texto="Este inversionista aún no financia préstamos." /> : (
          <Tabla
            filaRoja={(f) => f.estado_visual === "atrasado"}
            columnas={[
              { name: "codigo", label: "Código",
                fmt: (v, f) => <Link href={`/prestamos/creditos/${f.id}`} style={{ color: "inherit", fontWeight: 700 }}>{String(v)}</Link> },
              { name: "cliente_nombre", label: "Cliente" },
              { name: "capital", label: "Capital", alinear: "right", fmt: (v) => RD(v as number, simbolo) },
              { name: "tasa_interes", label: "Tasa", alinear: "right", fmt: (v) => PCT(v as number, 1) },
              { name: "tasa_inversionista", label: "Su parte", alinear: "right",
                fmt: (v, f) => f.modo_reparto === "tasa" ? PCT(v as number, 1) : `${PCT(f.porcentaje_inversionista as number, 1)} int.` },
              { name: "saldo_total", label: "Saldo", alinear: "right", fmt: (v) => <strong>{RD(v as number, simbolo)}</strong> },
              { name: "estado_visual", label: "Estado",
                fmt: (v) => <Badge texto={String(v) === "al_dia" ? "al día" : String(v)} tono={tonoPrestamo(String(v))} /> },
            ]}
            filas={prestamos as unknown as Record<string, unknown>[]}
          />
        )}
      </Seccion>

      <Seccion titulo="Movimientos de caja" style={{ padding: 0 }}>
        {movs.length === 0 ? <Vacio texto="Sin movimientos registrados." /> : (
          <Tabla
            columnas={[
              { name: "fecha", label: "Fecha", fmt: (v) => fecha(v as string) },
              { name: "tipo", label: "Tipo",
                fmt: (v) => <Badge texto={String(v).replace("_", " ")} tono={v === "aporte" ? "ok" : "warn"} /> },
              { name: "descripcion", label: "Descripción" },
              { name: "monto", label: "Monto", alinear: "right", fmt: (v) => <strong>{RD(v as number, simbolo)}</strong> },
            ]}
            filas={movs as unknown as Record<string, unknown>[]}
          />
        )}
      </Seccion>
    </div>
  );
}
