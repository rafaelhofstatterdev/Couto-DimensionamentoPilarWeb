import type { Camada } from "../lib/calculo";

export interface FormState {
  b: number;
  h: number;
  cobrimento: number;
  camadas: Camada[];
  Nk: number;
  e: number;
  fck: number;
  fy: number;
  gamma_s: number;
  x_min: number;
  x_max: number;
}

function Campo({
  label,
  unidade,
  value,
  onChange,
  step = "0.1",
}: {
  label: string;
  unidade?: string;
  value: number;
  onChange: (v: number) => void;
  step?: string;
}) {
  return (
    <label className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-sm text-[var(--color-muted)]">
        {label}
        {unidade && (
          <span className="text-xs text-[var(--color-line)]"> ({unidade})</span>
        )}
      </span>
      <input
        type="number"
        step={step}
        value={Number.isFinite(value) ? value : ""}
        onChange={(ev) => onChange(parseFloat(ev.target.value))}
        className="w-24 rounded border border-[var(--color-line)] bg-white px-2 py-1 text-right font-mono text-sm focus:border-[var(--color-institutional)] focus:outline-none"
      />
    </label>
  );
}

function Grupo({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="border border-[var(--color-line)] bg-white px-4 py-3">
      <legend className="px-1 font-serif text-sm font-bold text-[var(--color-institutional)]">
        {titulo}
      </legend>
      {children}
    </fieldset>
  );
}

export function InputForm({
  state,
  setState,
  onCalcular,
  onExemplo,
}: {
  state: FormState;
  setState: (s: FormState) => void;
  onCalcular: () => void;
  onExemplo: () => void;
}) {
  const set = (patch: Partial<FormState>) => setState({ ...state, ...patch });

  const setCamada = (i: number, patch: Partial<Camada>) => {
    const camadas = state.camadas.map((c, j) =>
      j === i ? { ...c, ...patch } : c,
    );
    set({ camadas });
  };

  const setNumCamadas = (n: number) => {
    if (!Number.isFinite(n) || n < 1) return;
    const camadas = [...state.camadas];
    while (camadas.length < n)
      camadas.push({ nb: 2, d: state.h - state.cobrimento });
    camadas.length = n;
    set({ camadas });
  };

  return (
    <div className="flex flex-col gap-4">
      <Grupo titulo="Geometria da secao">
        <Campo label="Largura b" unidade="cm" value={state.b} onChange={(v) => set({ b: v })} />
        <Campo label="Altura h" unidade="cm" value={state.h} onChange={(v) => set({ h: v })} />
        <Campo label="Cobrimento" unidade="cm" value={state.cobrimento} onChange={(v) => set({ cobrimento: v })} />
      </Grupo>

      <Grupo titulo="Armadura">
        <Campo
          label="Numero de camadas"
          value={state.camadas.length}
          onChange={setNumCamadas}
          step="1"
        />
        <div className="mt-2 overflow-hidden rounded border border-[var(--color-line)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--color-subtle)] text-xs text-[var(--color-muted)]">
                <th className="px-2 py-1 text-left font-normal">Camada</th>
                <th className="px-2 py-1 text-right font-normal">No de barras</th>
                <th className="px-2 py-1 text-right font-normal">d (cm)</th>
              </tr>
            </thead>
            <tbody>
              {state.camadas.map((c, i) => (
                <tr key={i} className="border-t border-[var(--color-line)]">
                  <td className="px-2 py-1 text-[var(--color-muted)]">C{i + 1}</td>
                  <td className="px-1 py-1">
                    <input
                      type="number"
                      step="1"
                      value={Number.isFinite(c.nb) ? c.nb : ""}
                      onChange={(ev) => setCamada(i, { nb: parseInt(ev.target.value, 10) })}
                      className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-right font-mono focus:border-[var(--color-institutional)] focus:outline-none"
                    />
                  </td>
                  <td className="px-1 py-1">
                    <input
                      type="number"
                      step="0.1"
                      value={Number.isFinite(c.d) ? c.d : ""}
                      onChange={(ev) => setCamada(i, { d: parseFloat(ev.target.value) })}
                      className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-right font-mono focus:border-[var(--color-institutional)] focus:outline-none"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Grupo>

      <Grupo titulo="Solicitacoes">
        <Campo label="Forca normal Nk" unidade="kN" value={state.Nk} onChange={(v) => set({ Nk: v })} />
        <Campo label="Excentricidade e" unidade="cm" value={state.e} onChange={(v) => set({ e: v })} />
      </Grupo>

      <Grupo titulo="Materiais">
        <Campo label="fck" unidade="MPa" value={state.fck} onChange={(v) => set({ fck: v })} />
        <Campo label="Aco fy" unidade="MPa" value={state.fy} onChange={(v) => set({ fy: v })} step="1" />
        <Campo label="γs" value={state.gamma_s} onChange={(v) => set({ gamma_s: v })} step="0.01" />
      </Grupo>

      <Grupo titulo="Busca da linha neutra">
        <Campo label="x minimo" unidade="cm" value={state.x_min} onChange={(v) => set({ x_min: v })} />
        <Campo label="x maximo" unidade="cm" value={state.x_max} onChange={(v) => set({ x_max: v })} />
      </Grupo>

      <div className="flex flex-col gap-2">
        <button
          onClick={onCalcular}
          className="bg-[var(--color-institutional)] px-4 py-2.5 font-serif text-sm font-bold tracking-wide text-white transition-opacity hover:opacity-90"
        >
          CALCULAR
        </button>
        <button
          onClick={onExemplo}
          className="border border-[var(--color-line)] bg-white px-4 py-2 text-sm text-[var(--color-muted)] transition-colors hover:bg-[var(--color-subtle)]"
        >
          Carregar exemplo
        </button>
      </div>
    </div>
  );
}
