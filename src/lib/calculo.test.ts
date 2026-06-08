import { describe, it, expect } from "vitest";
import { CalculoPilar, calcularArmaduraComercial } from "./calculo";

/**
 * Os valores de referencia foram gerados por uma copia do script Python
 * original com as MESMAS correcoes de teoria aplicadas de forma independente
 * (Es = 210 GPa conforme NBR 6118 8.3.6, e pivo correto do Dominio 2 nas
 * deformacoes do aco). Servem como oraculo independente da implementacao TS.
 */
describe("CalculoPilar — exercicio do professor, metodo PARABOLICO", () => {
  const r = new CalculoPilar({
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
  }).resolver();

  it("x", () => expect(r.x).toBeCloseTo(24.8983, 3));
  it("As_total", () => expect(r.As_total).toBeCloseTo(15.7863, 3));
  it("Rcc", () => expect(r.Rcc).toBeCloseTo(489.4969, 2));
  it("dc", () => expect(r.dc).toBeCloseTo(9.6431, 3));
  it("dominio", () => expect(r.dominio).toBe("Dominio 4"));
  it("epsilon_yd (Es=210GPa)", () => expect(r.epsilon_yd).toBeCloseTo(0.00207, 5));
  it("deformacoes", () => {
    expect(r.deformacoes[0]).toBeCloseTo(-0.002938, 5);
    expect(r.deformacoes[1]).toBeCloseTo(0.001561, 5);
  });
  it("tensoes", () => {
    expect(r.tensoes[0]).toBeCloseTo(-434.783, 2);
    expect(r.tensoes[1]).toBeCloseTo(327.724, 2);
  });
  it("As_min = max(0.15 Nd/fyd ; 0.4% Ac) = 0.4% Ac neste caso", () =>
    expect(r.As_min).toBeCloseTo(3.2, 3));
  it("As_max = 8% Ac", () => expect(r.As_max).toBeCloseTo(64.0, 3));
});

describe("CalculoPilar — exercicio do professor, metodo RETANGULAR", () => {
  const r = new CalculoPilar({
    metodo: "retangular",
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
  }).resolver();

  it("x", () => expect(r.x).toBeCloseTo(25.0196, 3));
  it("As_total", () => expect(r.As_total).toBeCloseTo(15.6678, 3));
  it("Rcc", () => expect(r.Rcc).toBeCloseTo(486.0948, 2));
  it("dc", () => expect(r.dc).toBeCloseTo(9.9922, 3));
  it("dominio", () => expect(r.dominio).toBe("Dominio 4"));
  it("tensoes", () => {
    expect(r.tensoes[0]).toBeCloseTo(-434.783, 2);
    expect(r.tensoes[1]).toBeCloseTo(322.571, 2);
  });
});

describe("CalculoPilar — flexao dominante (Dominio 3)", () => {
  const base = {
    b: 20,
    h: 60,
    cobrimento: 4,
    camadas: [
      { nb: 3, d: 4.0 },
      { nb: 3, d: 30.0 },
      { nb: 3, d: 56.0 },
    ],
    Nk: 200,
    e: 60,
    fck: 25,
    fy: 500,
    gamma_s: 1.15,
    x_min: 1,
    x_max: 40,
  };

  it("parabolico", () => {
    const r = new CalculoPilar(base).resolver();
    expect(r.x).toBeCloseTo(17.0341, 3);
    expect(r.As_total).toBeCloseTo(9.5642, 3);
    expect(r.dominio).toBe("Dominio 3");
  });
  it("retangular", () => {
    const r = new CalculoPilar({ ...base, metodo: "retangular" }).resolver();
    expect(r.x).toBeCloseTo(17.1887, 3);
    expect(r.As_total).toBeCloseTo(9.4834, 3);
    expect(r.dominio).toBe("Dominio 3");
  });
});

/**
 * Caso que cai no DOMINIO 2 (N pequeno, e grande). Sem a correcao do pivo,
 * o codigo antigo dava eps_s = 18.3%o (impossivel — a NBR limita a 10%o).
 * Com a correcao, a deformacao do aco trava em 10%o e o equilibrio muda.
 */
describe("CalculoPilar — Dominio 2 (pivo no aco a 10 por mil)", () => {
  const r = new CalculoPilar({
    b: 20,
    h: 50,
    cobrimento: 4,
    camadas: [
      { nb: 2, d: 4.0 },
      { nb: 2, d: 46.0 },
    ],
    Nk: 80,
    e: 80,
    fck: 25,
    fy: 500,
    gamma_s: 1.15,
    x_min: 1,
    x_max: 40,
  }).resolver();

  it("x", () => expect(r.x).toBeCloseTo(8.4008, 3));
  it("As_total", () => expect(r.As_total).toBeCloseTo(7.0832, 3));
  it("aco tracionado travado em 10 por mil", () =>
    expect(r.deformacoes[1]).toBeCloseTo(0.01, 6));
  it("classificado como Dominio 2", () => expect(r.dominio).toBe("Dominio 2"));
});

/**
 * Parametros do diagrama do concreto para fck > 50 (Grupo II, NBR 6118 8.2.10).
 * Valores conferidos manualmente para fck = 60 MPa.
 */
describe("Parametros do Grupo II (fck = 60 MPa)", () => {
  const c = new CalculoPilar({
    b: 20,
    h: 40,
    cobrimento: 4,
    camadas: [
      { nb: 2, d: 4.0 },
      { nb: 2, d: 36.0 },
    ],
    Nk: 410,
    e: 25,
    fck: 60,
    fy: 500,
  });

  it("lambda = 0.8 - (fck-50)/400", () => expect(c.lambda).toBeCloseTo(0.775, 4));
  it("alpha_c = 0.85*(1-(fck-50)/200)", () =>
    expect(c.alpha_c).toBeCloseTo(0.8075, 4));
  it("epsilon_cu = 2.6 + 35*((90-fck)/100)^4 [%o]", () =>
    expect(c.epsilon_cu).toBeCloseTo(0.0028835, 6));
  it("epsilon_c2 = 2.0 + 0.085*(fck-50)^0.53 [%o]", () =>
    expect(c.epsilon_c2).toBeCloseTo(0.0022884, 6));
});

/** Para fck <= 50 os parametros devem reduzir ao Grupo I (constantes). */
describe("Parametros do Grupo I (fck = 20 MPa)", () => {
  const c = new CalculoPilar({
    b: 20,
    h: 40,
    cobrimento: 4,
    camadas: [{ nb: 4, d: 4.0 }],
    Nk: 100,
    e: 5,
    fck: 20,
    fy: 500,
  });
  it("lambda = 0.8", () => expect(c.lambda).toBe(0.8));
  it("alpha_c = 0.85", () => expect(c.alpha_c).toBe(0.85));
  it("epsilon_cu = 3.5%o", () => expect(c.epsilon_cu).toBe(0.0035));
  it("epsilon_c2 = 2.0%o", () => expect(c.epsilon_c2).toBe(0.002));
});

describe("calcularArmaduraComercial", () => {
  it("sugestoes para As=15.7863", () => {
    const s = calcularArmaduraComercial(15.7863);
    expect(s).toEqual([
      [16, 2.011, 8],
      [20, 3.142, 6],
      [25, 4.909, 4],
    ]);
  });
});
