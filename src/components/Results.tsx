import {
  type DadosEntrada,
  type ResultadoCalculo,
  calcularArmaduraComercial,
} from "../lib/calculo";

function Linha({
  label,
  valor,
  destaque,
}: {
  label: string;
  valor: string;
  destaque?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between border-b border-[var(--color-line)] py-1.5 last:border-0">
      <span className="text-sm text-[var(--color-muted)]">{label}</span>
      <span
        className={`font-mono ${destaque ? "text-base font-bold text-[var(--color-institutional)]" : "text-sm text-[var(--color-ink)]"}`}
      >
        {valor}
      </span>
    </div>
  );
}

function Cartao({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-[var(--color-line)] bg-white p-4">
      <h3 className="mb-2 font-serif text-sm font-bold text-[var(--color-institutional)]">
        {titulo}
      </h3>
      {children}
    </section>
  );
}

export function Results({
  dados,
  r,
}: {
  dados: DadosEntrada;
  r: ResultadoCalculo;
}) {
  const As_min = 0.004 * dados.b * dados.h;
  const As_final = r.As_total < As_min ? As_min : r.As_total;
  const sugestoes = calcularArmaduraComercial(As_final);

  return (
    <div className="flex flex-col gap-4">
      <Cartao titulo="Sintese">
        <Linha label="Linha neutra (x)" valor={`${r.x.toFixed(3)} cm`} />
        <Linha label="Area de aco total (As)" valor={`${r.As_total.toFixed(3)} cm²`} destaque />
        <Linha label="Dominio de deformacao" valor={r.dominio} />
        <Linha label="Convergencia f(x)" valor={`${r.f_x.toExponential(2)} ≈ 0`} />
        {r.As_total < As_min && (
          <p className="mt-2 border-l-2 border-amber-500 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            As calculado &lt; As,min (0,4%·Ac = {As_min.toFixed(2)} cm²). Adotar
            armadura minima.
          </p>
        )}
      </Cartao>

      <Cartao titulo="Esforcos e resistencias de calculo">
        <Linha label="Nd = Nk · γf" valor={`${r.Nd.toFixed(2)} kN`} />
        <Linha label="Md = Nd · e" valor={`${r.Md.toFixed(2)} kN·cm`} />
        <Linha label="fcd = fck / γc" valor={`${r.fcd.toFixed(2)} MPa`} />
        <Linha label="fyd = fy / γs" valor={`${r.fyd.toFixed(2)} MPa`} />
        <Linha label="Rcc (concreto)" valor={`${r.Rcc.toFixed(2)} kN`} />
        <Linha label="εyd" valor={r.epsilon_yd.toFixed(5)} />
      </Cartao>

      <Cartao titulo="Detalhes por camada">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-[var(--color-muted)]">
              <th className="py-1 text-left font-normal">Camada</th>
              <th className="py-1 text-right font-normal">d (cm)</th>
              <th className="py-1 text-right font-normal">εsi</th>
              <th className="py-1 text-right font-normal">σsdi (MPa)</th>
              <th className="py-1 text-right font-normal">As,i (cm²)</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {dados.camadas.map((c, i) => (
              <tr key={i} className="border-t border-[var(--color-line)]">
                <td className="py-1 text-[var(--color-muted)]">C{i + 1}</td>
                <td className="py-1 text-right">{c.d.toFixed(2)}</td>
                <td className="py-1 text-right">{r.deformacoes[i].toFixed(6)}</td>
                <td className="py-1 text-right">{r.tensoes[i].toFixed(2)}</td>
                <td className="py-1 text-right">{r.As_camadas[i].toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Cartao>

      {sugestoes.length > 0 && (
        <Cartao titulo="Sugestoes de armadura comercial">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-[var(--color-muted)]">
                <th className="py-1 text-left font-normal">Opcao</th>
                <th className="py-1 text-left font-normal">Bitola</th>
                <th className="py-1 text-right font-normal">As (cm²)</th>
                <th className="py-1 text-right font-normal">Margem</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {sugestoes.map(([diam, areaUnit, n], i) => {
                const areaTotal = areaUnit * n;
                const margem = ((areaTotal - r.As_total) / r.As_total) * 100;
                return (
                  <tr
                    key={i}
                    className={`border-t border-[var(--color-line)] ${i === 0 ? "bg-[var(--color-subtle)]" : ""}`}
                  >
                    <td className="py-1 text-[var(--color-muted)]">{i + 1}</td>
                    <td className="py-1">
                      {n}ϕ{diam.toFixed(1)}mm
                    </td>
                    <td className="py-1 text-right">{areaTotal.toFixed(2)}</td>
                    <td className="py-1 text-right">+{margem.toFixed(1)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-[var(--color-muted)]">
            Recomendacao:{" "}
            <span className="font-mono text-[var(--color-institutional)]">
              {sugestoes[0][2]}ϕ{sugestoes[0][0].toFixed(1)}mm
            </span>
          </p>
        </Cartao>
      )}
    </div>
  );
}
