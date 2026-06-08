/**
 * Metodos numericos em TypeScript puro — substituem as rotinas do scipy
 * usadas no script Python original (brentq, integrate.quad, minimize_scalar).
 *
 * Todos os calculos rodam client-side, sem dependencias externas.
 */

/**
 * Integracao numerica adaptativa de Simpson.
 * Equivalente funcional a `scipy.integrate.quad` para integrandos suaves
 * por partes (o diagrama parabola-retangulo do concreto tem um "joelho"
 * em eps = 0.002, que o esquema adaptativo refina automaticamente).
 */
export function adaptiveSimpson(
  f: (x: number) => number,
  a: number,
  b: number,
  tol = 1e-10,
  maxDepth = 50,
): number {
  if (a === b) return 0;

  const simpson = (lo: number, hi: number, flo: number, fmid: number, fhi: number) =>
    ((hi - lo) / 6) * (flo + 4 * fmid + fhi);

  const recurse = (
    lo: number,
    hi: number,
    flo: number,
    fmid: number,
    fhi: number,
    whole: number,
    eps: number,
    depth: number,
  ): number => {
    const mid = (lo + hi) / 2;
    const lmid = (lo + mid) / 2;
    const rmid = (mid + hi) / 2;
    const flmid = f(lmid);
    const frmid = f(rmid);
    const left = simpson(lo, mid, flo, flmid, fmid);
    const right = simpson(mid, hi, fmid, frmid, fhi);
    if (depth <= 0 || Math.abs(left + right - whole) <= 15 * eps) {
      return left + right + (left + right - whole) / 15;
    }
    return (
      recurse(lo, mid, flo, flmid, fmid, left, eps / 2, depth - 1) +
      recurse(mid, hi, fmid, frmid, fhi, right, eps / 2, depth - 1)
    );
  };

  const mid = (a + b) / 2;
  const fa = f(a);
  const fmid = f(mid);
  const fb = f(b);
  const whole = simpson(a, b, fa, fmid, fb);
  return recurse(a, b, fa, fmid, fb, whole, tol, maxDepth);
}

/**
 * Metodo de Brent para encontrar a raiz de f em [a, b].
 * Equivalente a `scipy.optimize.brentq`.
 * Lanca um erro se f(a) e f(b) tiverem o mesmo sinal (sem troca de sinal),
 * espelhando o `ValueError` do scipy — o chamador pode entao recorrer
 * a minimizacao de |f(x)| como fallback.
 */
export function brentq(
  f: (x: number) => number,
  a: number,
  b: number,
  xtol = 1e-6,
  maxiter = 100,
): number {
  let fa = f(a);
  let fb = f(b);

  if (fa * fb > 0) {
    throw new Error(
      "f(a) e f(b) tem o mesmo sinal — nao ha troca de sinal no intervalo.",
    );
  }

  if (Math.abs(fa) < Math.abs(fb)) {
    [a, b] = [b, a];
    [fa, fb] = [fb, fa];
  }

  let c = a;
  let fc = fa;
  let mflag = true;
  let d = c;

  for (let iter = 0; iter < maxiter; iter++) {
    if (fb === 0 || Math.abs(b - a) < xtol) {
      return b;
    }

    let s: number;
    if (fa !== fc && fb !== fc) {
      // Interpolacao quadratica inversa
      s =
        (a * fb * fc) / ((fa - fb) * (fa - fc)) +
        (b * fa * fc) / ((fb - fa) * (fb - fc)) +
        (c * fa * fb) / ((fc - fa) * (fc - fb));
    } else {
      // Secante
      s = b - (fb * (b - a)) / (fb - fa);
    }

    const cond1 = !((s > (3 * a + b) / 4 && s < b) || (s < (3 * a + b) / 4 && s > b));
    const cond2 = mflag && Math.abs(s - b) >= Math.abs(b - c) / 2;
    const cond3 = !mflag && Math.abs(s - b) >= Math.abs(c - d) / 2;
    const cond4 = mflag && Math.abs(b - c) < xtol;
    const cond5 = !mflag && Math.abs(c - d) < xtol;

    if (cond1 || cond2 || cond3 || cond4 || cond5) {
      // Bisseccao
      s = (a + b) / 2;
      mflag = true;
    } else {
      mflag = false;
    }

    const fs = f(s);
    d = c;
    c = b;
    fc = fb;

    if (fa * fs < 0) {
      b = s;
      fb = fs;
    } else {
      a = s;
      fa = fs;
    }

    if (Math.abs(fa) < Math.abs(fb)) {
      [a, b] = [b, a];
      [fa, fb] = [fb, fa];
    }
  }

  return b;
}

/**
 * Minimizacao escalar limitada via secao aurea.
 * Equivalente a `scipy.optimize.minimize_scalar(method="bounded")`.
 * Retorna { x, fun } com o ponto de minimo e o valor da funcao.
 */
export function minimizeScalarBounded(
  f: (x: number) => number,
  a: number,
  b: number,
  xtol = 1e-8,
  maxiter = 500,
): { x: number; fun: number } {
  const gr = (Math.sqrt(5) - 1) / 2; // ~0.618
  let lo = a;
  let hi = b;
  let c = hi - gr * (hi - lo);
  let d = lo + gr * (hi - lo);
  let fc = f(c);
  let fd = f(d);

  for (let i = 0; i < maxiter && Math.abs(hi - lo) > xtol; i++) {
    if (fc < fd) {
      hi = d;
      d = c;
      fd = fc;
      c = hi - gr * (hi - lo);
      fc = f(c);
    } else {
      lo = c;
      c = d;
      fc = fd;
      d = lo + gr * (hi - lo);
      fd = f(d);
    }
  }

  const x = (lo + hi) / 2;
  return { x, fun: f(x) };
}
