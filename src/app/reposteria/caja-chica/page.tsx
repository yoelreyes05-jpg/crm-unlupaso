"use client";

import { useCallback, useEffect, useState } from "react";
import {
  api, Aviso, Badge, Btn, Card, Etiqueta, iconBtn, inputBase, RD, T, Tabla, fecha,
} from "@/components/reposteria/ui";
import type { RepCajaChica, RepCajaChicaGasto, RepCajaChicaReposicion } from "@/types/reposteria";

const hoy = new Date().toISOString().slice(0, 10);

export default function CajaChicaPage() {
  const [fondo, setFondo]   = useState<RepCajaChica | null>(null);
  const [gastos, setGastos] = useState<RepCajaChicaGasto[]>([]);
  const [repos, setRepos]   = useState<RepCajaChicaReposicion[]>([]);
  const [error, setError]   = useState("");

  const [gasto, setGasto] = useState({ descripcion: "", categoria: "general", monto: "", fecha: hoy });
  const [repo, setRepo]   = useState({ monto: "", descripcion: "", fecha: hoy });

  const cargar = useCallback(async () => {
    try {
      const f = await api<{ data: RepCajaChica[] }>("/caja-chica?activo=true");
      const actual = (f.data ?? [])[0] ?? null;
      setFondo(actual);
      if (actual) {
        const [g, r] = await Promise.all([
          api<{ data: RepCajaChicaGasto[] }>(`/caja-chica-gastos?fondo_id=${actual.id}&limit=100`),
          api<{ data: RepCajaChicaReposicion[] }>(`/caja-chica-reposiciones?fondo_id=${actual.id}&limit=50`),
        ]);
        setGastos(g.data ?? []); setRepos(r.data ?? []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar la caja chica");
    }
  }, []);

  useEffect(() => { void cargar(); }, [cargar]);

  async function crearFondo() {
    try {
      await api("/caja-chica", { metodo: "POST", body: { nombre: "Caja Chica Repostería", fondo_inicial: 5000, umbral_reponer: 1000 } });
      await cargar();
    } catch (e) { setError(e instanceof Error ? e.message : "Error al crear el fondo"); }
  }

  async function agregarGasto() {
    if (!fondo || !gasto.descripcion || !gasto.monto) { setError("Completa descripción y monto"); return; }
    try {
      await api("/caja-chica-gastos", {
        metodo: "POST",
        body: { fondo_id: fondo.id, ...gasto, monto: Number(gasto.monto) },
      });
      setGasto({ descripcion: "", categoria: "general", monto: "", fecha: hoy });
      setError("");
      await cargar();
    } catch (e) { setError(e instanceof Error ? e.message : "Error al registrar el gasto"); }
  }

  async function agregarRepo() {
    if (!fondo || !repo.monto) { setError("Indica el monto de la reposición"); return; }
    try {
      await api("/caja-chica-reposiciones", {
        metodo: "POST",
        body: { fondo_id: fondo.id, ...repo, monto: Number(repo.monto) },
      });
      setRepo({ monto: "", descripcion: "", fecha: hoy });
      setError("");
      await cargar();
    } catch (e) { setError(e instanceof Error ? e.message : "Error al registrar la reposición"); }
  }

  async function borrar(ruta: string, id: string) {
    if (!confirm("¿Eliminar este registro?")) return;
    try { await api(`${ruta}/${id}`, { metodo: "DELETE" }); await cargar(); }
    catch (e) { setError(e instanceof Error ? e.message : "Error al eliminar"); }
  }

  if (!fondo) {
    return (
      <div>
        <h1 style={{ fontSize: 24, margin: "0 0 18px" }}>🪙 Caja chica</h1>
        {error && <Aviso texto={error} />}
        <Card style={{ maxWidth: 460 }}>
          <p style={{ fontSize: 13.5, color: T.suave, marginTop: 0 }}>No hay un fondo de caja chica activo.</p>
          <Btn onClick={crearFondo}>Crear fondo</Btn>
        </Card>
      </div>
    );
  }

  const bajo = Number(fondo.saldo_actual) <= Number(fondo.umbral_reponer);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
        <h1 style={{ fontSize: 24, margin: 0 }}>🪙 {fondo.nombre}</h1>
        {bajo && <Badge texto="requiere reposición" tono="warn" />}
      </div>

      {error && <Aviso texto={error} />}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 20 }}>
        {[
          { l: "Fondo inicial",  v: RD(fondo.fondo_inicial) },
          { l: "Saldo actual",   v: RD(fondo.saldo_actual) },
          { l: "Umbral",         v: RD(fondo.umbral_reponer) },
          { l: "Gastos del mes", v: RD(gastos.filter((g) => g.fecha >= hoy.slice(0, 8) + "01").reduce((a, g) => a + Number(g.monto), 0)) },
        ].map((k) => (
          <Card key={k.l}>
            <div style={{ fontSize: 11, color: T.suave, textTransform: "uppercase", letterSpacing: 0.4 }}>{k.l}</div>
            <div style={{ fontSize: 19, fontWeight: 800, marginTop: 4 }}>{k.v}</div>
          </Card>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(330px, 1fr))", gap: 16, marginBottom: 18 }}>
        <Card>
          <strong style={{ display: "block", marginBottom: 12 }}>Registrar gasto</strong>
          <div style={{ display: "grid", gap: 10 }}>
            <div>
              <Etiqueta>Descripción</Etiqueta>
              <input value={gasto.descripcion} onChange={(e) => setGasto((p) => ({ ...p, descripcion: e.target.value }))} style={inputBase} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              <div>
                <Etiqueta>Categoría</Etiqueta>
                <input value={gasto.categoria} onChange={(e) => setGasto((p) => ({ ...p, categoria: e.target.value }))} style={inputBase} />
              </div>
              <div>
                <Etiqueta>Monto</Etiqueta>
                <input type="number" step="0.01" value={gasto.monto}
                  onChange={(e) => setGasto((p) => ({ ...p, monto: e.target.value }))} style={inputBase} />
              </div>
              <div>
                <Etiqueta>Fecha</Etiqueta>
                <input type="date" value={gasto.fecha} onChange={(e) => setGasto((p) => ({ ...p, fecha: e.target.value }))} style={inputBase} />
              </div>
            </div>
            <Btn tono="err" onClick={agregarGasto}>Registrar gasto</Btn>
          </div>
        </Card>

        <Card>
          <strong style={{ display: "block", marginBottom: 12 }}>Reponer fondo</strong>
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <Etiqueta>Monto</Etiqueta>
                <input type="number" step="0.01" value={repo.monto}
                  onChange={(e) => setRepo((p) => ({ ...p, monto: e.target.value }))} style={inputBase} />
              </div>
              <div>
                <Etiqueta>Fecha</Etiqueta>
                <input type="date" value={repo.fecha} onChange={(e) => setRepo((p) => ({ ...p, fecha: e.target.value }))} style={inputBase} />
              </div>
            </div>
            <div>
              <Etiqueta>Descripción</Etiqueta>
              <input value={repo.descripcion} onChange={(e) => setRepo((p) => ({ ...p, descripcion: e.target.value }))} style={inputBase} />
            </div>
            <Btn tono="ok" onClick={agregarRepo}>Reponer</Btn>
          </div>
        </Card>
      </div>

      <h2 style={{ fontSize: 17, margin: "0 0 12px" }}>Gastos</h2>
      <Card style={{ padding: 0, overflow: "hidden", marginBottom: 20 }}>
        <Tabla
          vacio="Sin gastos registrados."
          columnas={[
            { name: "fecha",       label: "Fecha", fmt: (v) => fecha(v as string) },
            { name: "descripcion", label: "Descripción" },
            { name: "categoria",   label: "Categoría" },
            { name: "monto",       label: "Monto", alinear: "right", fmt: (v) => RD(v as number) },
          ]}
          filas={gastos as unknown as Record<string, unknown>[]}
          acciones={(g) => <button onClick={() => borrar("/caja-chica-gastos", String(g.id))} style={iconBtn}>🗑️</button>}
        />
      </Card>

      <h2 style={{ fontSize: 17, margin: "0 0 12px" }}>Reposiciones</h2>
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <Tabla
          vacio="Sin reposiciones."
          columnas={[
            { name: "fecha",       label: "Fecha", fmt: (v) => fecha(v as string) },
            { name: "descripcion", label: "Descripción" },
            { name: "monto",       label: "Monto", alinear: "right", fmt: (v) => RD(v as number) },
          ]}
          filas={repos as unknown as Record<string, unknown>[]}
          acciones={(r) => <button onClick={() => borrar("/caja-chica-reposiciones", String(r.id))} style={iconBtn}>🗑️</button>}
        />
      </Card>
    </div>
  );
}
