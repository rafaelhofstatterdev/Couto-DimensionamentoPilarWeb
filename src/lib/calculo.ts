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

/**
 * Metodo de calculo da resultante de compressao no concreto:
 * - "parabolico": diagrama parabola-retangulo integrado numericamente
 *   (mais preciso — repo Couto-Dimensionamento-PilarParabolica).
 * - "retangular": bloco retangular simplificado 0.8x / 0.85fcd
 *   (simplificado — repo Couto-Dimensionamento-Pilar).
 */
export type MetodoCalculo = "parabolico" | "retangular";

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
  metodo?: MetodoCalculo; // modelo do diagrama do concreto (default "parabolico")
  gamma_f?: number; // coef. de ponderacao das acoes (default 1.4) — NBR 6118 Tab. 11.1
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
  As_min: number; // armadura minima (cm2) — NBR 6118 17.3.5.3.1
  As_max: number; // armadura maxima (cm2) — NBR 6118 17.3.5.3.2
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
  readonly Es = 210000.0; // modulo de elasticidade do aco (MPa) — NBR 6118 8.3.6
  readonly Nd: number;
  readonly Md: number;
  readonly fcd: number;
  readonly fyd: number;
  readonly epsilon_yd: number;
  readonly nb_tot: number;

  // Parametros do diagrama do concreto, funcao do fck (NBR 6118:2014, 8.2.10).
  // Grupo I (fck <= 50 MPa) e Grupo II (55 <= fck <= 90 MPa).
  readonly epsilon_c2: number; // encurtamento no inicio do patamar
  readonly epsilon_cu: number; // encurtamento ultimo do concreto
  readonly n_par: number; // expoente da parabola
  readonly lambda: number; // relacao altura do bloco retangular / x
  readonly alpha_c: number; // fator de reducao da tensao (efeito Rusch + grupo II)

  private log_iteracoes: { x: number; omega1: number; omega2: number }[] = [];

  constructor(dados: DadosEntrada) {
    this.dados = {
      metodo: "parabolico",
      gamma_f: 1.4,
      gamma_c: 1.4,
      gamma_s: 1.15,
      x_min: 1.0,
      x_max: 30.0,
      ...dados,
    };

    // Nd usa o coeficiente de ponderacao das ACOES (gamma_f), nao o do concreto.
    this.Nd = this.dados.Nk * this.dados.gamma_f; // kN
    this.Md = this.Nd * this.dados.e; // kN.cm
    this.fcd = this.dados.fck / this.dados.gamma_c; // MPa
    this.fyd = this.dados.fy / this.dados.gamma_s; // MPa
    this.epsilon_yd = this.fyd / this.Es;
    this.nb_tot = this.dados.camadas.reduce((s, c) => s + c.nb, 0);

    // Parametros do diagrama parabola-retangulo conforme o grupo de resistencia.
    const fck = this.dados.fck;
    if (fck <= 50) {
      this.epsilon_c2 = 0.002;
      this.epsilon_cu = 0.0035;
      this.n_par = 2.0;
      this.lambda = 0.8;
      this.alpha_c = 0.85;
    } else {
      const t = (90 - fck) / 100;
      this.epsilon_c2 = (2.0 + 0.085 * Math.pow(fck - 50, 0.53)) / 1000;
      this.epsilon_cu = (2.6 + 35 * Math.pow(t, 4)) / 1000;
      this.n_par = 1.4 + 23.4 * Math.pow(t, 4);
      this.lambda = 0.8 - (fck - 50) / 400;
      this.alpha_c = 0.85 * (1 - (fck - 50) / 200);
    }
  }

  /**
   * Deformacao no concreto na fibra mais comprimida (topo), respeitando o
   * pivo correto: nos Dominios 3-5 o pivo e o concreto (epsilon_cu); no
   * Dominio 2 o pivo passa a ser o aco mais tracionado a 10%o, e o topo
   * fica abaixo de epsilon_cu. Usado tanto nas deformacoes das armaduras
   * quanto na integracao do diagrama do concreto (consistencia interna).
   */
  private epsilonTopo(x: number): number {
    if (x <= 0) return 0.0;
    const dMax = Math.max(...this.dados.camadas.map((c) => c.d));
    const epsSConcretoPivot = (this.epsilon_cu * (dMax - x)) / x;
    if (epsSConcretoPivot > 0.01) {
      // Dominio 2: pivo no aco a 10%o
      return (0.01 * x) / (dMax - x);
    }
    return this.epsilon_cu;
  }

  /** Deformacao na camada i (positivo = tracao, negativo = compressao). */
  calcularDeformacao(x: number, di: number): number {
    if (x <= 0) return 0.0;
    // Distribuicao linear de Bernoulli a partir do topo (pivo correto).
    return (this.epsilonTopo(x) * (di - x)) / x;
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
    const sigmaMax = this.alpha_c * this.fcd;

    if (eps <= this.epsilon_c2) {
      return sigmaMax * (1.0 - Math.pow(1.0 - eps / this.epsilon_c2, this.n_par));
    } else if (eps <= this.epsilon_cu) {
      return sigmaMax;
    } else {
      if (eps <= this.epsilon_cu * 1.1) return sigmaMax;
      return 0.0;
    }
  }

  /**
   * Resultante de compressao no concreto (Rcc, kN) e a distancia z_c (cm)
   * do seu ponto de aplicacao ao CG da secao. Despacha para o modelo
   * escolhido (parabola-retangulo ou bloco retangular simplificado).
   */
  calcularRcc(x: number): [number, number] {
    if (x <= 0) return [0.0, 0.0];
    return this.dados.metodo === "retangular"
      ? this.calcularRccRetangular(x)
      : this.calcularRccParabolico(x);
  }

  /**
   * Bloco retangular simplificado (NBR 6118): altura comprimida lambda*x,
   * tensao uniforme alpha_c*fcd, resultante a lambda*x/2 do bordo comprimido.
   * Para fck <= 50: lambda=0.8, alpha_c=0.85 (resultante a 0.4x).
   */
  private calcularRccRetangular(x: number): [number, number] {
    const Rcc = (this.lambda * this.dados.b * x * this.alpha_c * this.fcd) / 10; // kN
    const zC = this.dados.h / 2 - (this.lambda * x) / 2;
    return [Rcc, zC];
  }

  /** Diagrama parabola-retangulo integrado numericamente (modelo preciso). */
  private calcularRccParabolico(x: number): [number, number] {
    const limiteIntegracao = Math.min(x, this.dados.h);
    const epsilonTopo = this.epsilonTopo(x);

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
    if (x < 0) return "Tracao pura";
    if (x === 0) return "Dominio 1";

    // Deformacao do aco mais tracionado assumindo o concreto no pivo (epsilon_cu).
    // Se exceder 10%o, o pivo real e o aco => Dominio 2. Caso contrario, o
    // concreto governa e a deformacao "nao travada" classifica os Dominios 3-5.
    const dMax = Math.max(...this.dados.camadas.map((c) => c.d));
    const epsSConcretoPivot = (this.epsilon_cu * (dMax - x)) / x;

    if (epsSConcretoPivot > 0.01) return "Dominio 2";
    if (epsSConcretoPivot > this.epsilon_yd) return "Dominio 3";
    if (epsSConcretoPivot > 0) return "Dominio 4";
    if (epsSConcretoPivot > -this.epsilon_yd) return "Dominio 4a";
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

    // Armadura minima e maxima (NBR 6118:2014, 17.3.5.3).
    // As,min = max(0.15*Nd/fyd ; 0.004*Ac).  fyd em MPa -> /10 = kN/cm2.
    const Ac = this.dados.b * this.dados.h;
    const AsMin = Math.max((0.15 * this.Nd) / (this.fyd / 10), 0.004 * Ac);
    const AsMax = 0.08 * Ac; // 8% da secao, considerando regioes de emenda

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
      As_min: AsMin,
      As_max: AsMax,
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
