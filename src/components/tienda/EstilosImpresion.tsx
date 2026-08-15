/**
 * Reglas de impresión de todo el módulo de tienda.
 *
 * `@page { margin: 0 }` es lo que quita el encabezado y el pie que el navegador
 * mete solo (la dirección de la página, la fecha y el número de hoja). Como sin
 * margen el papel quedaría sin bordes, el margen se le devuelve al contenido
 * con el padding de <main>.
 */
export default function EstilosImpresion() {
  return (
    <style>{`
      @page { size: auto; margin: 0; }

      @media print {
        html, body {
          background: #fff !important;
          margin: 0 !important;
          padding: 0 !important;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        /* El menú lateral y los botones no van al papel */
        aside, .no-imprimir { display: none !important; }
        main { padding: 12mm !important; }
        /* Que no se impriman las direcciones de los enlaces */
        a { text-decoration: none !important; color: inherit !important; }
        a[href]::after { content: "" !important; }
      }
    `}</style>
  );
}
