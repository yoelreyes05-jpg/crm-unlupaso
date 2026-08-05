/**
 * Impresión de documentos de CROW EVENTS: recibo de POS, factura y cotización.
 * Todos llevan el logo dorado y el teléfono 829-404-1644.
 */

import type { Negocio } from "@/lib/reposteria/negocio";

const RD = (n: number) =>
  "RD$ " + Number(n ?? 0).toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fechaLarga = (v?: string | null) =>
  v ? new Date(v.length <= 10 ? v + "T12:00:00" : v).toLocaleDateString("es-DO",
    { day: "2-digit", month: "long", year: "numeric" }) : "—";

export function imprimirHTML(html: string) {
  const prev = document.getElementById("__crow_print__");
  if (prev) prev.remove();
  const iframe = document.createElement("iframe");
  iframe.id = "__crow_print__";
  iframe.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:820px;height:1100px;border:none;opacity:0";
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument;
  if (!doc) {
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); }
    return;
  }
  doc.open(); doc.write(html); doc.close();
  iframe.onload = () => {
    // Espera a que cargue el logo antes de abrir el diálogo de impresión
    setTimeout(() => { iframe.contentWindow?.focus(); iframe.contentWindow?.print(); }, 350);
  };
}

const ESTILOS = `
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:Georgia,'Times New Roman',serif;color:#3a2c1c;background:#fff;padding:34px 40px}
  .logo{display:block;margin:0 auto 6px;max-width:230px;height:auto}
  .head{text-align:center;border-bottom:3px double #a9812a;padding-bottom:14px;margin-bottom:20px}
  .neg{font-size:12px;color:#8a7758;line-height:1.5}
  .tit{font-size:21px;font-weight:bold;letter-spacing:2px;color:#7a5c2e;margin:16px 0 4px}
  .meta{display:flex;justify-content:space-between;gap:26px;font-size:12.5px;margin-bottom:18px}
  .meta strong{color:#7a5c2e}
  table{width:100%;border-collapse:collapse;font-size:12.5px;margin-bottom:14px}
  th{background:#f7f1e3;color:#7a5c2e;text-align:left;padding:8px 10px;border-bottom:2px solid #a9812a;font-size:11px;letter-spacing:.6px;text-transform:uppercase}
  td{padding:8px 10px;border-bottom:1px solid #ece3d2}
  .r{text-align:right}
  .tot{width:290px;margin-left:auto;font-size:13px}
  .tot div{display:flex;justify-content:space-between;padding:5px 0}
  .tot .grand{border-top:2px solid #a9812a;margin-top:6px;padding-top:9px;font-size:16px;font-weight:bold;color:#7a5c2e}
  .ncf{margin:18px auto 0;max-width:330px;text-align:center;border:2px solid #a9812a;border-radius:8px;padding:9px}
  .ncf b{font-size:15px;letter-spacing:3px;color:#7a5c2e}
  .pie{margin-top:26px;text-align:center;font-size:11.5px;color:#8a7758;border-top:1px solid #ece3d2;padding-top:12px;line-height:1.6}
  @media print{body{padding:16px 20px}}
`;

function cabecera(n: Negocio) {
  return `<div class="head">
    <img class="logo" src="${n.logo}" alt="${n.nombre}"/>
    <div class="neg">
      ${n.telefono ? `Tel: ${n.telefono}` : ""}
      ${n.rnc ? ` · RNC: ${n.rnc}` : ""}
      ${n.direccion ? `<br/>${n.direccion}` : ""}
    </div>
  </div>`;
}

function pie(n: Negocio) {
  return `<div class="pie">
    ${n.nombre} · ${n.slogan}<br/>
    Tel: ${n.telefono}${n.rnc ? ` · RNC: ${n.rnc}` : ""}
  </div>`;
}

export interface LineaDoc {
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  descuento?: number;
  subtotal: number;
}

export interface DatosDoc {
  titulo: string;          // "FACTURA" | "COTIZACIÓN"
  numero: string;
  fecha?: string | null;
  vencimiento?: string | null;
  cliente?: string | null;
  telefonoCliente?: string | null;
  rncCliente?: string | null;
  ncf?: string | null;
  ncfTipo?: string | null;
  lineas: LineaDoc[];
  subtotal: number;
  itbis: number;
  descuento: number;
  total: number;
  pagado?: number;
  balance?: number;
  condiciones?: string | null;
  notas?: string | null;
}

/** Factura o cotización tamaño carta. */
export function documentoHTML(n: Negocio, d: DatosDoc): string {
  const filas = d.lineas.map((l) => `<tr>
    <td>${l.descripcion}</td>
    <td class="r">${Number(l.cantidad)}</td>
    <td class="r">${RD(l.precio_unitario)}</td>
    <td class="r">${RD(l.descuento ?? 0)}</td>
    <td class="r">${RD(l.subtotal)}</td>
  </tr>`).join("");

  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"/>
  <title>${d.titulo} ${d.numero}</title><style>${ESTILOS}</style></head><body>
  ${cabecera(n)}
  <div class="tit" style="text-align:center">${d.titulo} ${d.numero}</div>
  <div class="meta">
    <div>
      <strong>Cliente</strong><br/>
      ${d.cliente ?? "Consumidor final"}<br/>
      ${d.rncCliente ? `RNC/Cédula: ${d.rncCliente}<br/>` : ""}
      ${d.telefonoCliente ? `Tel: ${d.telefonoCliente}` : ""}
    </div>
    <div style="text-align:right">
      <strong>Fecha</strong><br/>${fechaLarga(d.fecha)}<br/>
      ${d.vencimiento ? `<strong>Vence</strong><br/>${fechaLarga(d.vencimiento)}` : ""}
    </div>
  </div>
  <table>
    <thead><tr>
      <th>Descripción</th><th class="r">Cant.</th><th class="r">Precio</th>
      <th class="r">Desc.</th><th class="r">Importe</th>
    </tr></thead>
    <tbody>${filas}</tbody>
  </table>
  <div class="tot">
    <div><span>Subtotal</span><span>${RD(d.subtotal)}</span></div>
    <div><span>Descuento</span><span>${RD(d.descuento)}</span></div>
    <div><span>ITBIS</span><span>${RD(d.itbis)}</span></div>
    <div class="grand"><span>TOTAL</span><span>${RD(d.total)}</span></div>
    ${d.pagado !== undefined ? `<div><span>Pagado</span><span>${RD(d.pagado)}</span></div>` : ""}
    ${d.balance !== undefined ? `<div><span><strong>Balance</strong></span><span><strong>${RD(d.balance)}</strong></span></div>` : ""}
  </div>
  ${d.ncf ? `<div class="ncf"><div style="font-size:9.5px;color:#8a7758;letter-spacing:1px">COMPROBANTE FISCAL ${d.ncfTipo ?? ""}</div><b>${d.ncf}</b></div>` : ""}
  ${d.condiciones ? `<div style="margin-top:22px;font-size:11.5px"><strong style="color:#7a5c2e">Condiciones</strong><br/>${d.condiciones.replace(/\n/g, "<br/>")}</div>` : ""}
  ${d.notas ? `<div style="margin-top:14px;font-size:11.5px"><strong style="color:#7a5c2e">Notas</strong><br/>${d.notas.replace(/\n/g, "<br/>")}</div>` : ""}
  ${pie(n)}
  </body></html>`;
}

export interface ItemRecibo {
  nombre: string;
  qty: number;
  precio: number;
}

/** Recibo térmico del POS (80 mm). */
export function reciboHTML(
  n: Negocio,
  items: ItemRecibo[],
  total: number,
  itbis: number,
  metodo: string,
  ncf: string | null,
  ncfTipo: string,
  ncfDesc: string,
  numero: string
): string {
  const f = new Date().toLocaleString("es-DO",
    { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const lineas = items.map((i) =>
    `<div class="it"><span>${i.nombre} x${i.qty}</span><span>${RD(i.precio * i.qty)}</span></div>`).join("");

  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"/><title>${numero}</title><style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Courier New',monospace;font-size:13px;max-width:320px;margin:0 auto;padding:16px 14px;color:#231a10}
  .c{text-align:center}.sm{font-size:11px;color:#6b5a41}
  img{max-width:190px;height:auto;margin:0 auto 6px;display:block}
  hr{border:none;border-top:1px dashed #c6b491;margin:9px 0}
  .it{display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px dotted #ddd2bd}
  .tot{display:flex;justify-content:space-between;padding:8px 0;font-size:16px;font-weight:900;border-top:2px solid #7a5c2e;margin-top:6px}
  .ncf{border:2px solid #7a5c2e;padding:8px;border-radius:6px;margin:10px 0;text-align:center}
  </style></head><body>
  <img src="${n.logo}" alt="${n.nombre}"/>
  <div class="c sm">${n.slogan}<br/>Tel: ${n.telefono}${n.rnc ? `<br/>RNC: ${n.rnc}` : ""}</div>
  <hr/>
  <div class="c sm">${f}<br/>Venta: <strong>${numero}</strong><br/>Comprobante: ${ncfDesc}</div>
  <hr/>
  ${lineas}
  <div class="it sm"><span>ITBIS incluido</span><span>${RD(itbis)}</span></div>
  <div class="tot"><span>TOTAL</span><span>${RD(total)}</span></div>
  <div class="sm" style="display:flex;justify-content:space-between;margin-top:4px">
    <span>Pago: ${metodo}</span><span>${ncfTipo}</span>
  </div>
  ${ncf ? `<div class="ncf"><div style="font-size:9px;color:#6b5a41">COMPROBANTE FISCAL</div>
    <div style="font-size:15px;font-weight:900;letter-spacing:2px">${ncf}</div></div>` : ""}
  <hr/>
  <div class="c sm">¡Gracias por su compra!<br/>${n.nombre} · ${n.telefono}</div>
  </body></html>`;
}
