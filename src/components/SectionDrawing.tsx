import type { DadosEntrada, ResultadoCalculo } from "../lib/calculo";

/**
 * Desenho da secao transversal em SVG (substitui o canvas matplotlib do
 * app PyQt original): contorno da secao, zona comprimida, linha neutra,
 * armaduras por camada e cotas b/h. Coordenadas em cm; eixo y para baixo
 * representa a profundidade a partir do bordo comprimido (topo).
 */
export function SectionDrawing({
  dados,
  resultado,
}: {
  dados: DadosEntrada;
  resultado: ResultadoCalculo | null;
}) {
  const { b, h, cobrimento, camadas } = dados;
  const pad = 12; // margem em cm para cotas e rotulos
  const vbW = b + pad * 2;
  const vbH = h + pad * 2;

  const x = resultado?.x ?? 0;

  // posicoes das barras numa camada: nb pontos de cobrimento a b-cobrimento
  const barX = (nb: number): number[] => {
    if (nb <= 1) return [b / 2];
    const out: number[] = [];
    for (let i = 0; i < nb; i++) {
      out.push(cobrimento + (i * (b - 2 * cobrimento)) / (nb - 1));
    }
    return out;
  };

  return (
    <svg
      viewBox={`${-pad} ${-pad} ${vbW} ${vbH}`}
      className="w-full h-auto max-h-[460px]"
      style={{ fontFamily: "Georgia, serif" }}
    >
      {/* zona comprimida (topo, altura = x) */}
      {resultado && x > 0 && (
        <rect
          x={0}
          y={0}
          width={b}
          height={Math.min(x, h)}
          fill="#1a237e"
          opacity={0.08}
        />
      )}

      {/* contorno da secao */}
      <rect
        x={0}
        y={0}
        width={b}
        height={h}
        fill="none"
        stroke="#1a1a1a"
        strokeWidth={0.4}
      />

      {/* linha neutra */}
      {resultado && x > 0 && x <= h && (
        <line
          x1={-1}
          y1={x}
          x2={b + 1}
          y2={x}
          stroke="#c62828"
          strokeWidth={0.35}
          strokeDasharray="1.2 0.8"
        />
      )}

      {/* armaduras */}
      {camadas.map((camada, i) =>
        barX(camada.nb).map((bx, j) => (
          <circle
            key={`${i}-${j}`}
            cx={bx}
            cy={camada.d}
            r={0.7}
            fill="#1a237e"
          />
        )),
      )}

      {/* rotulos das camadas */}
      {camadas.map((camada, i) => (
        <text
          key={`lbl-${i}`}
          x={b + 1.5}
          y={camada.d}
          fontSize={2.4}
          fill="#555"
          dominantBaseline="middle"
        >
          C{i + 1}: {camada.nb}ϕ
        </text>
      ))}

      {/* cota b (embaixo) */}
      <line x1={0} y1={h + 4} x2={b} y2={h + 4} stroke="#888" strokeWidth={0.2} />
      <text
        x={b / 2}
        y={h + 7.5}
        fontSize={2.6}
        fill="#1a1a1a"
        textAnchor="middle"
      >
        b = {b} cm
      </text>

      {/* cota h (esquerda) */}
      <line x1={-4} y1={0} x2={-4} y2={h} stroke="#888" strokeWidth={0.2} />
      <text
        x={-6.5}
        y={h / 2}
        fontSize={2.6}
        fill="#1a1a1a"
        textAnchor="middle"
        transform={`rotate(-90 ${-6.5} ${h / 2})`}
      >
        h = {h} cm
      </text>

      {/* rotulo da linha neutra */}
      {resultado && x > 0 && x <= h && (
        <text
          x={b + 1.5}
          y={x}
          fontSize={2.2}
          fill="#c62828"
          dominantBaseline="middle"
        >
          x = {x.toFixed(2)} cm
        </text>
      )}
    </svg>
  );
}
