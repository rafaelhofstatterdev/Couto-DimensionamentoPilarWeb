/**
 * Geracao do memorial de calculo em PDF, 100% client-side (jsPDF).
 * Porta do gerar_pdf.py (ReportLab) — mesma estrutura de secoes e o
 * desenho da secao transversal desenhado vetorialmente no proprio PDF.
 */
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  type DadosEntrada,
  type ResultadoCalculo,
  calcularArmaduraComercial,
} from "./calculo";

const AZUL = "#1a237e";
const CINZA = "#808080";

function dataHoje(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function gerarMemorialPDF(
  dados: DadosEntrada,
  r: ResultadoCalculo,
): void {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const margin = 20;
  let y = margin;

  const gamma_c = dados.gamma_c ?? 1.4;
  const gamma_s = dados.gamma_s ?? 1.15;
  const As_min = 0.004 * dados.b * dados.h;

  // ---- Cabecalho ----
  doc.setFont("helvetica", "bold").setFontSize(15).setTextColor("#000");
  doc.text("RELATORIO DE DIMENSIONAMENTO", W / 2, y, { align: "center" });
  y += 6;
  doc.setFont("helvetica", "normal").setFontSize(10).setTextColor("#333");
  doc.text("PILAR DE CONCRETO ARMADO (FLEXO-COMPRESSAO RETA)", W / 2, y, {
    align: "center",
  });
  y += 5;
  doc.text("Conforme NBR 6118:2014", W / 2, y, { align: "center" });
  y += 5;
  doc.setFontSize(8).setTextColor(CINZA);
  doc.text(`Data: ${dataHoje()}`, W / 2, y, { align: "center" });
  y += 8;

  const secao = (titulo: string) => {
    if (y > 260) {
      doc.addPage();
      y = margin;
    }
    doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(AZUL);
    doc.text(titulo, margin, y);
    y += 6;
  };

  const tabela = (head: string[], body: (string | number)[][]) => {
    autoTable(doc, {
      startY: y,
      head: [head],
      body: body.map((row) => row.map(String)),
      margin: { left: margin, right: margin },
      styles: { fontSize: 9, cellPadding: 1.5 },
      headStyles: { fillColor: [128, 128, 128], textColor: 255 },
      theme: "grid",
    });
    // @ts-expect-error lastAutoTable e injetado pelo plugin
    y = doc.lastAutoTable.finalY + 6;
  };

  // ---- 1. Dados de entrada ----
  secao("1. DADOS DE ENTRADA");
  tabela(
    ["Geometria", "Valor"],
    [
      ["Largura (b)", `${dados.b.toFixed(1)} cm`],
      ["Altura (h)", `${dados.h.toFixed(1)} cm`],
      ["Cobrimento (c)", `${dados.cobrimento.toFixed(1)} cm`],
    ],
  );
  tabela(
    ["Materiais", "Valor"],
    [
      ["Resistencia do concreto (fck)", `${dados.fck.toFixed(1)} MPa`],
      ["Tensao do aco (fy)", `${dados.fy.toFixed(0)} MPa`],
      ["Coef. ponderacao concreto (gc)", gamma_c.toFixed(2)],
      ["Coef. ponderacao aco (gs)", gamma_s.toFixed(2)],
    ],
  );
  tabela(
    ["Solicitacoes (caracteristicas)", "Valor"],
    [
      ["Forca normal (Nk)", `${dados.Nk.toFixed(1)} kN`],
      ["Excentricidade (e)", `${dados.e.toFixed(1)} cm`],
    ],
  );
  tabela(
    ["Camada", "No de barras", "d (cm)"],
    dados.camadas.map((c, i) => [`C${i + 1}`, c.nb, c.d.toFixed(2)]),
  );

  // ---- 2. Esforcos de calculo ----
  secao("2. ESFORCOS DE CALCULO (ELU)");
  tabela(
    ["Grandeza", "Calculo", "Resultado"],
    [
      ["Forca normal (Nd)", `Nk x ${gamma_c} = ${dados.Nk.toFixed(1)} x ${gamma_c}`, `${r.Nd.toFixed(2)} kN`],
      ["Momento fletor (Md)", `Nd x e = ${r.Nd.toFixed(2)} x ${dados.e.toFixed(1)}`, `${r.Md.toFixed(2)} kN.cm`],
    ],
  );

  // ---- 3. Resistencias de calculo ----
  secao("3. RESISTENCIAS DE CALCULO");
  tabela(
    ["Grandeza", "Calculo", "Resultado"],
    [
      ["Concreto (fcd)", `fck / ${gamma_c} = ${dados.fck.toFixed(1)} / ${gamma_c}`, `${r.fcd.toFixed(2)} MPa`],
      ["Aco (fyd)", `fy / ${gamma_s} = ${dados.fy.toFixed(0)} / ${gamma_s}`, `${r.fyd.toFixed(2)} MPa`],
    ],
  );

  // ---- 4. Resultados ----
  secao("4. RESULTADOS DO DIMENSIONAMENTO");
  tabela(
    ["Equilibrio da secao", "Valor"],
    [
      [
        "Metodo de calculo",
        dados.metodo === "retangular"
          ? "Retangular (bloco simplificado 0.8x / 0.85fcd)"
          : "Parabolico (parabola-retangulo, integracao numerica)",
      ],
      ["Linha neutra (x)", `${r.x.toFixed(3)} cm`],
      ["Dominio", r.dominio],
      ["Rcc (concreto)", `${r.Rcc.toFixed(2)} kN`],
      ["Convergencia f(x)", `${r.f_x.toExponential(2)} (~ 0)`],
    ],
  );
  tabela(
    ["Camada", "d (cm)", "eps_si", "sigma_sdi (MPa)", "As,i (cm2)"],
    dados.camadas.map((c, i) => [
      `C${i + 1}`,
      c.d.toFixed(2),
      r.deformacoes[i].toFixed(6),
      r.tensoes[i].toFixed(2),
      r.As_camadas[i].toFixed(2),
    ]),
  );

  // ---- 5. Armadura ----
  secao("5. ARMADURA TOTAL E SUGESTOES");
  const As_final = r.As_total < As_min ? As_min : r.As_total;
  tabela(
    ["Armadura", "Valor"],
    [
      ["As,total (calculado)", `${r.As_total.toFixed(2)} cm2`],
      ["As,min (0.4% Ac)", `${As_min.toFixed(2)} cm2`],
      [
        "Situacao",
        r.As_total < As_min
          ? "ATENCAO: adotar armadura minima"
          : "OK: calculada > minima",
      ],
    ],
  );
  const sugestoes = calcularArmaduraComercial(As_final);
  if (sugestoes.length) {
    tabela(
      ["Opcao", "Bitola", "Area total (cm2)", "Margem"],
      sugestoes.map(([diam, areaUnit, n], i) => {
        const areaTotal = areaUnit * n;
        const margem = ((areaTotal - r.As_total) / r.As_total) * 100;
        return [
          i + 1,
          `${n}ϕ${diam.toFixed(1)}mm`,
          areaTotal.toFixed(2),
          `+${margem.toFixed(1)}%`,
        ];
      }),
    );
  }

  // ---- 6. Visualizacao ----
  doc.addPage();
  y = margin;
  secao("6. VISUALIZACAO DA SECAO");
  desenharSecao(doc, dados, r, margin, y, W - 2 * margin);

  // ---- 7. Resumo ----
  doc.addPage();
  y = margin;
  secao("7. RESUMO DO DIMENSIONAMENTO");
  const resumoTxt = sugestoes.length
    ? `${sugestoes[0][2]}ϕ${sugestoes[0][0].toFixed(1)}mm (As = ${(sugestoes[0][1] * sugestoes[0][2]).toFixed(2)} cm2)`
    : "N/A";
  doc.setFillColor(AZUL);
  doc.rect(margin, y, W - 2 * margin, 14, "F");
  doc.setTextColor(255).setFont("helvetica", "bold").setFontSize(11);
  doc.text("ARMADURA LONGITUDINAL:", margin + 4, y + 9);
  doc.setFont("helvetica", "normal");
  doc.text(resumoTxt, margin + 62, y + 9);
  y += 24;

  doc.setTextColor(CINZA).setFont("helvetica", "italic").setFontSize(8);
  doc.text(
    "Memorial gerado automaticamente pelo software de dimensionamento de pilares",
    W / 2,
    y,
    { align: "center" },
  );
  y += 4;
  doc.text(
    "Universidade Federal de Pelotas - Centro de Engenharias",
    W / 2,
    y,
    { align: "center" },
  );

  doc.save("memorial_calculo.pdf");
}

/** Desenha a secao transversal vetorialmente dentro do PDF. */
function desenharSecao(
  doc: jsPDF,
  dados: DadosEntrada,
  r: ResultadoCalculo,
  ox: number,
  oy: number,
  maxW: number,
): void {
  const { b, h, cobrimento, camadas } = dados;
  // escala (mm por cm) para caber na largura/altura disponivel
  const padCm = 16;
  const scale = Math.min(maxW / (b + padCm), 220 / (h + padCm));
  const px = (cmX: number) => ox + (cmX + padCm / 2) * scale;
  const py = (cmY: number) => oy + (cmY + 6) * scale;

  // zona comprimida
  if (r.x > 0) {
    doc.setFillColor(220, 223, 240);
    doc.rect(px(0), py(0), b * scale, Math.min(r.x, h) * scale, "F");
  }
  // contorno
  doc.setDrawColor("#1a1a1a").setLineWidth(0.4);
  doc.rect(px(0), py(0), b * scale, h * scale, "S");

  // linha neutra
  if (r.x > 0 && r.x <= h) {
    doc.setDrawColor("#c62828").setLineWidth(0.3).setLineDashPattern([1, 1], 0);
    doc.line(px(-1), py(r.x), px(b + 1), py(r.x));
    doc.setLineDashPattern([], 0);
    doc.setFontSize(8).setTextColor("#c62828");
    doc.text(`x = ${r.x.toFixed(2)} cm`, px(b + 1.5), py(r.x));
  }

  // armaduras
  doc.setFillColor(AZUL);
  camadas.forEach((c, i) => {
    const xs =
      c.nb <= 1
        ? [b / 2]
        : Array.from(
            { length: c.nb },
            (_, k) => cobrimento + (k * (b - 2 * cobrimento)) / (c.nb - 1),
          );
    xs.forEach((bx) => doc.circle(px(bx), py(c.d), 0.7 * scale, "F"));
    doc.setFontSize(8).setTextColor("#555");
    doc.text(`C${i + 1}: ${c.nb}ϕ`, px(b + 1.5), py(c.d) + 1);
  });

  // cotas
  doc.setTextColor("#1a1a1a").setFontSize(9);
  doc.text(`b = ${b} cm`, px(b / 2), py(h + 8), { align: "center" });
  doc.text(`h = ${h} cm`, px(-padCm / 2 + 3), py(h / 2), {
    align: "center",
    angle: 90,
  });
}
