import { describe, it, expect } from "vitest";
import { CalculoPilar, calcularArmaduraComercial } from "./calculo";

/**
 * Valores de referencia capturados rodando o script Python original
 * (calculo_pilar.py) com o "exercicio do professor":
 *   b=20 h=40 cob=4 | camadas (2@4cm, 2@36cm) | Nk=410 e=25 fck=20 fy=500
 * Saida Python:
 *   x=24.6501  As=15.8942  Dominio 4  Rcc=484.6167  dc=9.7464
 *   def=[-0.002932, 0.001612]  tens=[-434.783, 322.31]
 */
describe("CalculoPilar — exercicio do professor (paridade com Python)", () => {
  const calc = new CalculoPilar({
    b: 20,
    h: 40,
    cobrimento: 4,
    camadas: [
      { nb: 2, d: 4.0 },
      { nb: 2, d: 36.0 },
    ],
    Nk: 410,
    e: 25,
    fck: 20,
    fy: 500,
    gamma_s: 1.15,
    x_min: 1,
    x_max: 30,
  });
  const r = calc.resolver();

  it("linha neutra x", () => {
    expect(r.x).toBeCloseTo(24.6501, 3);
  });
  it("area de aco total As", () => {
    expect(r.As_total).toBeCloseTo(15.8942, 3);
  });
  it("resultante de compressao Rcc", () => {
    expect(r.Rcc).toBeCloseTo(484.6167, 2);
  });
  it("posicao da compressao dc", () => {
    expect(r.dc).toBeCloseTo(9.7464, 3);
  });
  it("dominio de deformacao", () => {
    expect(r.dominio).toBe("Dominio 4");
  });
  it("deformacoes por camada", () => {
    expect(r.deformacoes[0]).toBeCloseTo(-0.002932, 5);
    expect(r.deformacoes[1]).toBeCloseTo(0.001612, 5);
  });
  it("tensoes por camada", () => {
    expect(r.tensoes[0]).toBeCloseTo(-434.783, 2);
    expect(r.tensoes[1]).toBeCloseTo(322.31, 2);
  });
  it("convergiu", () => {
    expect(r.convergiu).toBe(true);
  });
});

describe("calcularArmaduraComercial", () => {
  it("sugestoes para As=15.8942", () => {
    const s = calcularArmaduraComercial(15.8942);
    expect(s).toEqual([
      [16, 2.011, 8],
      [20, 3.142, 6],
      [25, 4.909, 4],
    ]);
  });
});
