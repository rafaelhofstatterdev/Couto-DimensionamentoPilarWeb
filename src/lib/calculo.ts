/**
 * Modulo de calculo para dimensionamento de pilares de concreto armado.
 *
 * Porta fiel, em TypeScript, do script Python original
 * (calculo_pilar.py — UFPel, "Aula Pilares 1 renovada").
 * Flexo-compressao reta, secao retangular, NBR 6118:2014.
 *
 * Toda a logica e numericamente identica ao Python: as rotinas do scipy
 * foram substituidas pelos equivalentes em src/lib/numerics.ts.
 */

import { adaptiveSimpson, brentq, minimizeScalarBounded } from "./numerics";

/** Uma camada de armadura. */
export interface Camada {
  /** numero de barras */
  nb: number;
  /** distancia ao bordo comprimido (cm) */
  d: number;
}

/** Dados de entrada do problema. */
export interface DadosEntrada {
  b: number; // largura da secao (cm)
  h: number; // altura da secao (cm)
  cobrimento: number; // cobrimento (cm)
  camadas: Camada[];
  Nk: number; // forca normal caracteristica (kN)
  e: number; // excentricidade (cm)
  fck: number; // resistencia caracteristica do concreto (MPa)
  fy: number; // tensao de escoamento do aco (MPa)
  gamma_c?: number; // coef. de seguranca do concreto (default 1.4)
  gamma_s?: number; // coef. de seguranca do aco (default 1.15)
  x_min?: number; // limite inferior para x (cm)
  x_max?: number; // limite superior para x (cm)
}

/** Resultado do dimensionamento. */
export interface ResultadoCalculo {
  x: number; // profundidade da linha neutra (cm)
  As_total: number; // area de aco total (cm2)
  omega1: number;
  omega2: number;
  f_x: number; // f(x) = omega1 - omega2
  deformacoes: number[]; // por camada
  tensoes: number[]; // por camada (MPa)
  As_camadas: number[]; // area de aco por camada (cm2)
  Rcc: number; // resultante de compressao no concreto (kN)
  dc: number; // distancia do CG da compressao ao CG da secao (cm)
  dominio: string;
  convergiu: boolean;
  erro_relativo: number;
  // estatisticas de iteracao
  iteracoes: number;
  primeiro_x: number;
  primeiro_As: number;
  ultimo_x: number;
  ultimo_As: number;
  // variaveis detalhadas
  num1: number;
  den1: number;
  num2: number;
  den2: number;
  soma_sigma_nb: number;
  soma_sigma_nb_z: number;
  epsilon_yd: number;
  // valores de projeto (uteis para o memorial)
  Nd: number;
  Md: number;
  fcd: number;
  fyd: number;
}

interface DadosIntermediarios {
  Rcc: number;
  z_c: number;
  deformacoes: number[];
  tensoes: number[];
  soma_sigma_nb: number;
  soma_sigma_nb_z: number;
  num1: number;
  den1: number;
  num2: number;
  den2: number;
}

export class CalculoPilar {
  readonly dados: Required<DadosEntrada>;
  readonly epsilon_u = 0.0035; // deformacao ultima do concreto
  readonly Es = 200000.0; // modulo de elasticidade do aco (MPa)
  readonly Nd: number;
  readonly Md: number;
  readonly fcd: number;
  readonly fyd: number;
  readonly epsilon_yd: number;
  readonly nb_tot: number;
  private log_iteracoes: { x: number; omega1: number; omega2: number }[] = [];

  constructor(dados: DadosEntrada) {
    this.dados = {
      gamma_c: 1.4,
      gamma_s: 1.15,
      x_min: 1.0,
      x_max: 30.0,
      ...dados,
    };

    this.Nd = this.dados.Nk * this.dados.gamma_c; // kN
    this.Md = this.Nd * this.dados.e; // kN.cm
    this.fcd = this.dados.fck / this.dados.gamma_c; // MPa
    this.fyd = this.dados.fy / this.dados.gamma_s; // MPa
    this.epsilon_yd = this.fyd / this.Es;
    this.nb_tot = this.dados.camadas.reduce((s, c) => s + c.nb, 0);
  }

  /** Deformacao na camada i (positivo = tracao, negativo = compressao). */
  calcularDeformacao(x: number, di: number): number {
    if (x <= 0) return 0.0;
    return this.epsilon_u * (di - x) / x;
  }

  /** Tensao no aco a partir da deformacao (MPa). */
  calcularTensao(epsilon_si: number): number {
    if (epsilon_si < -this.epsilon_yd) {
      return -this.fyd;
    } else if (epsilon_si <= this.epsilon_yd) {
      return (epsilon_si / this.epsilon_yd) * this.fyd;
    } else {
      return this.fyd;
    }
  }

  /** Tensao no concreto (diagrama parabola-retangulo, NBR 6118) — MPa. */
  getTensaoConcreto(deformacao: number): number {
    const eps = Math.abs(deformacao);
    const fcd = this.fcd;

    if (eps <= 0.002) {
      return 0.85 * fcd * (1.0 - Math.pow(1.0 - eps / 0.002, 2));
    } else if (eps <= 0.0035) {
      return 0.85 * fcd;
    } else {
      if (eps <= 0.0035 * 1.1) return 0.85 * fcd;
      return 0.0;
    }
  }

  /**
   * Resultante de compressao no concreto (Rcc, kN) e a distancia z_c (cm)
   * do seu ponto de aplicacao ao CG da secao, via integracao numerica.
   */
  calcularRcc(x: number): [number, number] {
    if (x <= 0) return [0.0, 0.0];

    const limiteIntegracao = Math.min(x, this.dados.h);
    const dMax = Math.max(...this.dados.camadas.map((c) => c.d));

    const epsSTeste = x > 0 ? 0.0035 * (dMax - x) / x : 999.0;

    let epsilonTopo: number;
    if (epsSTeste > 0.01) {
      // Dominio 2: aco escoa a 10%o, concreto < 3.5%o
      epsilonTopo = 0.01 * x / (dMax - x);
    } else {
      // Dominios 3, 4, 4a, 5: concreto na ruptura (3.5%o)
      epsilonTopo = 0.0035;
    }

    const tensaoEmY = (y: number): number => {
      const epsY = epsilonTopo * (1.0 - y / x);
      if (epsY < 0) return 0.0;
      return this.getTensaoConcreto(epsY);
    };

    const resForca = adaptiveSimpson(tensaoEmY, 0, limiteIntegracao);
    const Rcc = (resForca * this.dados.b) / 10.0; // -> kN

    const momentoEmY = (y: number): number => tensaoEmY(y) * y;
    const resMomento = adaptiveSimpson(momentoEmY, 0, limiteIntegracao);
    const MTopo = (resMomento * this.dados.b) / 10.0; // kN.cm

    if (Rcc === 0) return [0.0, 0.0];

    const yC = MTopo / Rcc; // posicao a partir do topo
    const zC = this.dados.h / 2 - yC; // distancia ao CG da secao

    return [Rcc, zC];
  }

  /** Calcula omega1, omega2 e os dados intermediarios para um x. */
  calcularOmega(x: number): [number, number, DadosIntermediarios] {
    const [Rcc, zC] = this.calcularRcc(x);

    let somaSigmaNb = 0.0;
    let somaSigmaNbZ = 0.0;
    const deformacoes: number[] = [];
    const tensoes: number[] = [];

    for (const camada of this.dados.camadas) {
      const epsilonSi = this.calcularDeformacao(x, camada.d);
      const sigmaSdi = this.calcularTensao(epsilonSi);

      deformacoes.push(epsilonSi);
      tensoes.push(sigmaSdi);

      // coeficiente de forca (kN/cm2): sigma * (nbi/nbtot) / 10
      const coef = (sigmaSdi * camada.nb) / this.nb_tot / 10;
      const zS = this.dados.h / 2 - camada.d; // braco em relacao ao CG

      somaSigmaNb += coef;
      somaSigmaNbZ += coef * zS;
    }

    const num1 = Rcc - this.Nd;
    const den1 = somaSigmaNb;
    const num2 = Rcc * zC - this.Md;
    const den2 = somaSigmaNbZ;

    let omega1: number;
    if (Math.abs(den1) < 1e-10) {
      omega1 = num1 > 0 ? 1e10 : -1e10;
    } else {
      omega1 = num1 / den1;
    }

    let omega2: number;
    if (Math.abs(den2) < 1e-10) {
      omega2 = num2 > 0 ? 1e10 : -1e10;
    } else {
      omega2 = num2 / den2;
    }

    const dados: DadosIntermediarios = {
      Rcc,
      z_c: zC,
      deformacoes,
      tensoes,
      soma_sigma_nb: somaSigmaNb,
      soma_sigma_nb_z: somaSigmaNbZ,
      num1,
      den1,
      num2,
      den2,
    };

    this.log_iteracoes.push({ x, omega1, omega2 });

    return [omega1, omega2, dados];
  }

  /**
   * f(x) zerada via produto cruzado (evita singularidades):
   * f(x) = num1*den2 - num2*den1
   */
  funcaoF(x: number): number {
    const [, , dados] = this.calcularOmega(x);
    return dados.num1 * dados.den2 - dados.num2 * dados.den1;
  }

  /** Determina o dominio de deformacao. */
  determinarDominio(x: number): string {
    const epsilonSMax = Math.max(
      ...this.dados.camadas.map((c) => this.calcularDeformacao(x, c.d)),
    );

    if (x < 0) return "Tracao pura";
    if (epsilonSMax > 0.01) return "Dominio 2";
    if (epsilonSMax > this.epsilon_yd) return "Dominio 3";
    if (epsilonSMax > 0) return "Dominio 4";
    if (epsilonSMax > -this.epsilon_yd) return "Dominio 4a";
    return "Dominio 5";
  }

  /** Resolve o problema de dimensionamento. */
  resolver(): ResultadoCalculo {
    this.log_iteracoes = [];

    let xSolution: number;
    let convergiu: boolean;

    try {
      xSolution = brentq(
        (x) => this.funcaoF(x),
        this.dados.x_min,
        this.dados.x_max,
        1e-6,
        100,
      );
      convergiu = true;
    } catch {
      const result = minimizeScalarBounded(
        (x) => Math.abs(this.funcaoF(x)),
        this.dados.x_min,
        this.dados.x_max,
      );
      xSolution = result.x;
      convergiu = result.fun < 1e-3;
    }

    const [omega1, omega2, dadosInter] = this.calcularOmega(xSolution);

    // As pela equacao mais estavel (maior denominador)
    let AsTotal: number;
    if (Math.abs(dadosInter.den2) > Math.abs(dadosInter.den1)) {
      AsTotal = omega2;
    } else if (Math.abs(dadosInter.den1) > 1e-10) {
      AsTotal = omega1;
    } else {
      AsTotal = 0.0;
    }

    const fX = omega1 - omega2;

    const AsCamadas = this.dados.camadas.map(
      (camada) => (AsTotal * camada.nb) / this.nb_tot,
    );

    const erroRelativo =
      AsTotal !== 0 ? Math.abs(omega1 - omega2) / Math.abs(AsTotal) : 0.0;

    const dominio = this.determinarDominio(xSolution);

    const iteracoes = this.log_iteracoes.length;
    let primeiroX = 0,
      primeiroAs = 0,
      ultimoX = 0,
      ultimoAs = 0;
    if (iteracoes > 0) {
      const primeira = this.log_iteracoes[0];
      const ultima = this.log_iteracoes[iteracoes - 1];
      primeiroX = primeira.x;
      primeiroAs =
        Math.abs(primeira.omega2) < 1e5 ? primeira.omega2 : primeira.omega1;
      ultimoX = ultima.x;
      ultimoAs = AsTotal;
    }

    return {
      x: xSolution,
      As_total: AsTotal,
      omega1,
      omega2,
      f_x: fX,
      deformacoes: dadosInter.deformacoes,
      tensoes: dadosInter.tensoes,
      As_camadas: AsCamadas,
      Rcc: dadosInter.Rcc,
      dc: dadosInter.z_c,
      dominio,
      convergiu,
      erro_relativo: erroRelativo,
      iteracoes,
      primeiro_x: primeiroX,
      primeiro_As: primeiroAs,
      ultimo_x: ultimoX,
      ultimo_As: ultimoAs,
      num1: dadosInter.num1,
      den1: dadosInter.den1,
      num2: dadosInter.num2,
      den2: dadosInter.den2,
      soma_sigma_nb: dadosInter.soma_sigma_nb,
      soma_sigma_nb_z: dadosInter.soma_sigma_nb_z,
      epsilon_yd: this.epsilon_yd,
      Nd: this.Nd,
      Md: this.Md,
      fcd: this.fcd,
      fyd: this.fyd,
    };
  }
}

/** Bitola comercial: [diametro_mm, area_unitaria_cm2, quantidade]. */
export type SugestaoBitola = [number, number, number];

/** Sugere combinacoes de barras comerciais para atender As. */
export function calcularArmaduraComercial(asCalculado: number): SugestaoBitola[] {
  const bitolas: [number, number][] = [
    [6.3, 0.315],
    [8, 0.5],
    [10, 0.785],
    [12.5, 1.227],
    [16, 2.011],
    [20, 3.142],
    [25, 4.909],
    [32, 8.042],
  ];

  const sugestoes: SugestaoBitola[] = [];

  for (const [diametro, areaUnit] of bitolas) {
    const nBarras = Math.ceil(asCalculado / areaUnit);
    if (nBarras >= 4 && nBarras <= 12) {
      const areaTotal = nBarras * areaUnit;
      if (areaTotal >= asCalculado * 1.0) {
        sugestoes.push([diametro, areaUnit, nBarras]);
      }
    }
  }

  sugestoes.sort((a, b) => a[1] * a[2] - b[1] * b[2]);
  return sugestoes.slice(0, 3);
}
