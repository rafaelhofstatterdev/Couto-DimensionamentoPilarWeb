import { useState } from "react";
import {
  CalculoPilar,
  type DadosEntrada,
  type ResultadoCalculo,
} from "./lib/calculo";
import { gerarMemorialPDF } from "./lib/pdf";
import { InputForm, type FormState } from "./components/InputForm";
import { Results } from "./components/Results";
import { SectionDrawing } from "./components/SectionDrawing";

const EXEMPLO: FormState = {
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
};

function toDados(s: FormState): DadosEntrada {
  return { ...s, gamma_c: 1.4 };
}

export default function App() {
  const [state, setState] = useState<FormState>(EXEMPLO);
  const [resultado, setResultado] = useState<ResultadoCalculo | null>(null);
  const [dadosCalc, setDadosCalc] = useState<DadosEntrada | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const calcular = () => {
    try {
      setErro(null);
      const dados = toDados(state);
      const r = new CalculoPilar(dados).resolver();
      setResultado(r);
      setDadosCalc(dados);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
      setResultado(null);
    }
  };

  const carregarExemplo = () => {
    setState(EXEMPLO);
    setResultado(null);
    setErro(null);
  };

  return (
    <div className="mx-auto min-h-screen max-w-7xl px-6 py-8">
      <header className="mb-8 border-b border-[var(--color-line)] pb-5">
        <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">
          Universidade Federal de Pelotas · Centro de Engenharias
        </p>
        <h1 className="mt-2 font-serif text-2xl font-bold text-[var(--color-ink)]">
          Dimensionamento de Pilar de Concreto Armado
        </h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Flexo-compressao reta · secao retangular · NBR 6118:2014
        </p>
      </header>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(320px,380px)_1fr]">
        {/* Coluna de entrada */}
        <div>
          <InputForm
            state={state}
            setState={setState}
            onCalcular={calcular}
            onExemplo={carregarExemplo}
          />
        </div>

        {/* Coluna de resultados */}
        <div className="flex flex-col gap-6">
          {erro && (
            <div className="border-l-2 border-red-500 bg-red-50 px-4 py-3 text-sm text-red-800">
              {erro}
            </div>
          )}

          {!resultado && !erro && (
            <div className="flex h-full min-h-[300px] items-center justify-center border border-dashed border-[var(--color-line)] text-center text-sm text-[var(--color-muted)]">
              Preencha os dados e clique em <strong className="mx-1">Calcular</strong>{" "}
              para obter o dimensionamento.
            </div>
          )}

          {resultado && dadosCalc && (
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2 xl:items-start">
              <section className="border border-[var(--color-line)] bg-white p-4 xl:sticky xl:top-6">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="font-serif text-sm font-bold text-[var(--color-institutional)]">
                    Secao transversal
                  </h3>
                  <button
                    onClick={() => gerarMemorialPDF(dadosCalc, resultado)}
                    className="border border-[var(--color-line)] px-3 py-1 text-xs text-[var(--color-muted)] transition-colors hover:bg-[var(--color-subtle)]"
                  >
                    Gerar memorial (PDF)
                  </button>
                </div>
                <SectionDrawing dados={dadosCalc} resultado={resultado} />
              </section>
              <Results dados={dadosCalc} r={resultado} />
            </div>
          )}
        </div>
      </div>

      <footer className="mt-12 border-t border-[var(--color-line)] pt-4 text-xs text-[var(--color-muted)]">
        Calculos executados integralmente no navegador (client-side). Nenhum dado
        e enviado a servidores.
      </footer>
    </div>
  );
}
