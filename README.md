# Dimensionamento de Pilar de Concreto Armado — Web

Aplicação web para dimensionamento de pilares de concreto armado de seção
retangular submetidos à **flexo-compressão reta**, conforme a **NBR 6118:2014**.

Porta para a web dos scripts Python originais, mantendo a mesma lógica de
cálculo e oferecendo **dois métodos selecionáveis** para a resultante de
compressão no concreto:

| Método | Modelo | Precisão | Origem |
|---|---|---|---|
| **Parabólico** | Diagrama parábola-retângulo integrado numericamente | Mais preciso | [Couto-Dimensionamento-PilarParabolica](https://github.com/rafaelhofstatterdev/Couto-Dimensionamento-PilarParabolica) |
| **Retangular** | Bloco simplificado (0,8x de altura, 0,85·fcd uniforme, resultante a 0,4x) | Simplificado | [Couto-Dimensionamento-Pilar](https://github.com/rafaelhofstatterdev/Couto-Dimensionamento-Pilar) |

A escolha do método é feita diretamente na interface.

> **Todos os cálculos rodam no navegador (client-side).** Nenhum dado é enviado a
> servidores — o build é estático e pode ser hospedado em qualquer servidor local.

## Funcionalidades

- Cálculo da linha neutra (`x`), área de aço total (`As`) e domínio de deformação.
- Diagrama parábola-retângulo do concreto integrado numericamente.
- Desenho da seção transversal (zona comprimida, linha neutra, armaduras).
- Sugestões de armadura comercial.
- Geração do **memorial de cálculo em PDF** (também client-side).

## Stack

- **React + TypeScript** (Vite)
- **Tailwind CSS v4** — design minimalista e institucional
- **jsPDF** — memorial de cálculo
- **Vitest** — testes de paridade com o cálculo Python

O `scipy` (usado no Python para `brentq`, `quad`, `minimize_scalar`) foi
reimplementado em TypeScript puro em [`src/lib/numerics.ts`](src/lib/numerics.ts).

## Desenvolvimento

```bash
npm install
npm run dev      # servidor de desenvolvimento
npm run test     # testes (valida os números contra o Python original)
npm run build    # build estático em dist/
npm run preview  # serve o build de produção localmente
```

## Hospedagem (servidor local)

Após `npm run build`, copie o conteúdo da pasta `dist/` para o servidor.
O `base: "./"` no `vite.config.ts` usa caminhos relativos, então funciona em
qualquer subpasta — inclusive abrindo o `index.html` diretamente, se o servidor
permitir.

## Validação

Os testes em [`src/lib/calculo.test.ts`](src/lib/calculo.test.ts) reproduzem o
"exercício do professor" para **os dois métodos** e conferem os resultados
contra os valores gerados pelos scripts Python originais (`x`, `As`, `Rcc`,
domínio, deformações, tensões e bitolas comerciais).

---

*Desenvolvido no âmbito das atividades do Grupo de Análises Estruturais — UFPel.*
