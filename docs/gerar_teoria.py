# -*- coding: utf-8 -*-
"""
Gera o documento teorico (PDF) que embasa os calculos da aplicacao.
Dimensionamento de pilar de concreto armado a flexo-compressao reta,
secao retangular, conforme NBR 6118:2014 e a apostila de J. M. Bastos.

Uso:  python docs/gerar_teoria.py
Saida: docs/teoria-dimensionamento-pilar.pdf
"""

import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY
from reportlab.lib.colors import HexColor
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, ListFlowable,
    ListItem,
)

AZUL = HexColor("#1a237e")

# Registrar Arial (tem gregas, por mille, etc.) ----------------------------
FONTS = r"C:\Windows\Fonts"
pdfmetrics.registerFont(TTFont("Arial", os.path.join(FONTS, "arial.ttf")))
pdfmetrics.registerFont(TTFont("Arial-Bold", os.path.join(FONTS, "arialbd.ttf")))
pdfmetrics.registerFont(TTFont("Arial-Italic", os.path.join(FONTS, "ariali.ttf")))
pdfmetrics.registerFontFamily(
    "Arial", normal="Arial", bold="Arial-Bold", italic="Arial-Italic"
)

styles = getSampleStyleSheet()
S = {
    "titulo": ParagraphStyle("t", parent=styles["Heading1"], fontName="Arial-Bold",
                             fontSize=18, alignment=TA_CENTER, textColor=HexColor("#111"),
                             spaceAfter=4),
    "sub": ParagraphStyle("s", parent=styles["Normal"], fontName="Arial",
                          fontSize=11, alignment=TA_CENTER, textColor=HexColor("#444"),
                          spaceAfter=2),
    "h1": ParagraphStyle("h1", parent=styles["Heading2"], fontName="Arial-Bold",
                         fontSize=13, textColor=AZUL, spaceBefore=14, spaceAfter=6),
    "h2": ParagraphStyle("h2", parent=styles["Heading3"], fontName="Arial-Bold",
                         fontSize=11, textColor=HexColor("#111"), spaceBefore=8, spaceAfter=4),
    "p": ParagraphStyle("p", parent=styles["Normal"], fontName="Arial",
                        fontSize=10, alignment=TA_JUSTIFY, spaceAfter=6, leading=14),
    "f": ParagraphStyle("f", parent=styles["Normal"], fontName="Arial",
                        fontSize=10.5, alignment=TA_CENTER, spaceBefore=2, spaceAfter=8,
                        textColor=HexColor("#1a237e"), leading=15),
    "ref": ParagraphStyle("r", parent=styles["Normal"], fontName="Arial-Italic",
                          fontSize=9, textColor=HexColor("#666"), spaceAfter=4),
}

story = []


def P(txt, st="p"):
    story.append(Paragraph(txt, S[st]))


def F(txt):
    story.append(Paragraph(txt, S["f"]))


def SP(h=0.2):
    story.append(Spacer(1, h * cm))


def bullets(items):
    story.append(ListFlowable(
        [ListItem(Paragraph(t, S["p"]), leftIndent=10) for t in items],
        bulletType="bullet", start="•", leftIndent=12,
    ))
    SP(0.1)


# ============================ CAPA ============================
P("Dimensionamento de Pilares de Concreto Armado", "titulo")
P("Flexo-compressão reta · seção retangular", "sub")
P("Base teórica conforme NBR 6118:2014", "sub")
P("Universidade Federal de Pelotas — Centro de Engenharias", "sub")
SP(0.5)

# ============================ 1 ============================
P("1. Objetivo e escopo", "h1")
P("Este documento reúne a base teórica empregada na ferramenta de "
  "dimensionamento. O problema tratado é o de uma seção retangular de "
  "concreto armado submetida a uma força normal de compressão N e a um "
  "momento fletor M em torno de um único eixo principal — a chamada "
  "<b>flexo-compressão reta (normal)</b>. Determina-se a área de aço "
  "longitudinal A<sub>s</sub> necessária para o Estado-Limite Último (ELU) "
  "de ruptura da seção.")
P("<b>Está dentro do escopo:</b> equilíbrio da seção no ELU, compatibilidade "
  "de deformações, domínios, e os dois modelos de distribuição de tensões no "
  "concreto (diagrama parábola-retângulo e bloco retangular equivalente).")
P("<b>Está fora do escopo (propositalmente):</b> excentricidades de 2ª ordem "
  "(efeitos locais de esbeltez, e<sub>2</sub>), fluência, flexo-compressão "
  "oblíqua e a excentricidade mínima de 1ª ordem. A excentricidade <i>e</i> "
  "fornecida à ferramenta deve já englobar todos os efeitos que o projetista "
  "julgar aplicáveis; o programa dimensiona a seção para o par (N, M=N·e) "
  "informado.")

# ============================ 2 ============================
P("2. Notação", "h1")
nota = [
    ["b, h", "largura e altura da seção (cm)"],
    ["d<sub>i</sub>", "distância da camada i de armadura ao bordo mais comprimido (cm)"],
    ["x", "profundidade da linha neutra, medida do bordo comprimido (cm)"],
    ["N<sub>k</sub>, N<sub>d</sub>", "força normal característica e de cálculo (kN)"],
    ["e", "excentricidade da força normal (cm); M<sub>d</sub> = N<sub>d</sub>·e"],
    ["f<sub>ck</sub>, f<sub>cd</sub>", "resistência do concreto característica e de cálculo (MPa)"],
    ["f<sub>y</sub>, f<sub>yd</sub>", "tensão de escoamento do aço característica e de cálculo (MPa)"],
    ["E<sub>s</sub>", "módulo de elasticidade do aço (MPa)"],
    ["ε<sub>c2</sub>, ε<sub>cu</sub>", "deformações do concreto no início do patamar e última"],
    ["ε<sub>yd</sub>", "deformação de escoamento de cálculo do aço"],
    ["R<sub>cc</sub>", "resultante de compressão no concreto (kN)"],
    ["γ<sub>f</sub>, γ<sub>c</sub>, γ<sub>s</sub>", "coef. de ponderação: ações, concreto e aço"],
]
t = Table([[Paragraph(a, S["p"]), Paragraph(b, S["p"])] for a, b in nota],
          colWidths=[3.2 * cm, 12.5 * cm])
t.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"),
                       ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
                       ("TOPPADDING", (0, 0), (-1, -1), 1)]))
story.append(t)
SP()

# ============================ 3 ============================
P("3. Hipóteses básicas (NBR 6118, item 17.2.2)", "h1")
bullets([
    "<b>Seções planas permanecem planas</b> (hipótese de Bernoulli): a "
    "deformação varia linearmente ao longo da altura da seção.",
    "<b>Aderência perfeita</b> entre aço e concreto: a deformação na barra é "
    "igual à do concreto adjacente.",
    "<b>Resistência do concreto à tração desprezada</b> no ELU.",
    "O encurtamento de ruptura do concreto e o alongamento máximo do aço "
    "definem os <b>domínios de deformação</b>.",
])

# ============================ 4 ============================
P("4. Comportamento dos materiais", "h1")

P("4.1 Concreto — diagrama parábola-retângulo", "h2")
P("A tensão de compressão no concreto em função do encurtamento ε<sub>c</sub> "
  "(em valor absoluto) é dada por:")
F("σ<sub>c</sub> = α<sub>c</sub>·f<sub>cd</sub>·[1 − (1 − ε<sub>c</sub>/ε<sub>c2</sub>)<sup>n</sup>]  "
  "para 0 ≤ ε<sub>c</sub> ≤ ε<sub>c2</sub>")
F("σ<sub>c</sub> = α<sub>c</sub>·f<sub>cd</sub>  "
  "para ε<sub>c2</sub> &lt; ε<sub>c</sub> ≤ ε<sub>cu</sub>")
P("sendo f<sub>cd</sub> = f<sub>ck</sub>/γ<sub>c</sub>. O fator α<sub>c</sub> "
  "(0,85 para concretos do Grupo I) incorpora o efeito Rüsch (carga de longa "
  "duração). Os parâmetros dependem da classe de resistência:")

P("<b>Grupo I — concretos até C50</b> (f<sub>ck</sub> ≤ 50 MPa):")
F("ε<sub>c2</sub> = 2,0‰ &nbsp;&nbsp; ε<sub>cu</sub> = 3,5‰ &nbsp;&nbsp; "
  "n = 2 &nbsp;&nbsp; α<sub>c</sub> = 0,85 &nbsp;&nbsp; λ = 0,8")

P("<b>Grupo II — concretos C55 a C90</b> (50 &lt; f<sub>ck</sub> ≤ 90 MPa):")
F("ε<sub>c2</sub> = 2,0‰ + 0,085‰·(f<sub>ck</sub>−50)<sup>0,53</sup>")
F("ε<sub>cu</sub> = 2,6‰ + 35‰·[(90−f<sub>ck</sub>)/100]<sup>4</sup>")
F("n = 1,4 + 23,4·[(90−f<sub>ck</sub>)/100]<sup>4</sup>")
F("λ = 0,8 − (f<sub>ck</sub>−50)/400 &nbsp;&nbsp;&nbsp; "
  "α<sub>c</sub> = 0,85·[1 − (f<sub>ck</sub>−50)/200]")
P("Para f<sub>ck</sub> = 50 MPa as expressões do Grupo II reproduzem, por "
  "continuidade, os valores do Grupo I.", "ref")

P("4.2 Aço — diagrama elastoplástico perfeito", "h2")
P("Adota-se diagrama bilinear, idêntico à tração e à compressão. No trecho "
  "elástico σ<sub>s</sub> = E<sub>s</sub>·ε<sub>s</sub>; atingido o escoamento, "
  "a tensão é constante e igual a f<sub>yd</sub>:")
F("σ<sub>s</sub> = E<sub>s</sub>·ε<sub>s</sub>  se |ε<sub>s</sub>| ≤ ε<sub>yd</sub>  "
  "&nbsp;&nbsp;|&nbsp;&nbsp;  σ<sub>s</sub> = ± f<sub>yd</sub>  se |ε<sub>s</sub>| &gt; ε<sub>yd</sub>")
P("com f<sub>yd</sub> = f<sub>y</sub>/γ<sub>s</sub> e ε<sub>yd</sub> = "
  "f<sub>yd</sub>/E<sub>s</sub>. Conforme a NBR 6118, item 8.3.6, adota-se "
  "<b>E<sub>s</sub> = 210 GPa</b> (210.000 MPa). Para o aço CA-50 isso "
  "resulta em ε<sub>yd</sub> = (500/1,15)/210000 ≈ <b>2,07‰</b>. O alongamento "
  "do aço no ELU é limitado a <b>10‰</b> (deformação plástica excessiva).")

# ============================ 5 ============================
P("5. Esforços de cálculo", "h1")
P("As ações são majoradas pelo coeficiente de ponderação γ<sub>f</sub> "
  "(igual a 1,4 para combinações normais — NBR 6118, Tabela 11.1):")
F("N<sub>d</sub> = γ<sub>f</sub>·N<sub>k</sub> &nbsp;&nbsp;&nbsp;&nbsp; "
  "M<sub>d</sub> = N<sub>d</sub>·e")
P("As resistências são minoradas: f<sub>cd</sub> = f<sub>ck</sub>/γ<sub>c</sub> "
  "(γ<sub>c</sub> = 1,4) e f<sub>yd</sub> = f<sub>y</sub>/γ<sub>s</sub> "
  "(γ<sub>s</sub> = 1,15). Observe que γ<sub>f</sub> (ações) e γ<sub>c</sub> "
  "(concreto) têm o mesmo valor numérico 1,4, mas significados distintos.", "ref")

# ============================ 6 ============================
P("6. Domínios de deformação e compatibilidade", "h1")
P("A reta de deformações no ELU gira em torno de um <b>pivô</b>. A deformação "
  "em uma fibra a uma distância d<sub>i</sub> do bordo comprimido segue de "
  "Bernoulli:")
F("ε<sub>si</sub> = ε<sub>topo</sub>·(d<sub>i</sub> − x)/x")
P("onde ε<sub>topo</sub> é o encurtamento na fibra mais comprimida (positivo "
  "para tração, negativo para compressão, na convenção adotada). O pivô "
  "depende do domínio:")
bullets([
    "<b>Domínios 3, 4, 4a e 5</b> — o concreto governa: o bordo comprimido "
    "atinge ε<sub>cu</sub>, logo ε<sub>topo</sub> = ε<sub>cu</sub>.",
    "<b>Domínio 2</b> — o aço governa: a armadura mais tracionada atinge o "
    "alongamento máximo de 10‰ e o concreto fica abaixo de ε<sub>cu</sub>. "
    "Nesse caso ε<sub>topo</sub> = 10‰·x/(d<sub>máx</sub> − x), e a deformação "
    "das armaduras é coerentemente limitada (nunca ultrapassa 10‰).",
])
P("A fronteira entre os domínios é identificada testando a deformação do aço "
  "mais tracionado <i>supondo</i> o concreto no pivô (ε<sub>cu</sub>): se esse "
  "valor superaria 10‰, a peça está no Domínio 2 e o pivô migra para o aço. A "
  "classificação por domínios usa ε<sub>yd</sub> e o limite de 10‰ como "
  "fronteiras.")

# ============================ 7 ============================
P("7. Resultante de compressão no concreto", "h1")
P("A força R<sub>cc</sub> e a posição do seu centro de gravidade são obtidas "
  "de dois modos. A distância z<sub>c</sub> é medida a partir do centro "
  "geométrico da seção (h/2).")

P("7.1 Modelo parabólico (preciso)", "h2")
P("Integra-se o diagrama parábola-retângulo ao longo da altura comprimida. "
  "Sendo y a profundidade a partir do topo e ε(y) = ε<sub>topo</sub>·(1 − y/x):")
F("R<sub>cc</sub> = b·∫<sub>0</sub><sup>min(x,h)</sup> σ<sub>c</sub>(ε(y)) dy")
F("y<sub>c</sub> = [ b·∫ σ<sub>c</sub>·y dy ] / R<sub>cc</sub> &nbsp;&nbsp;&nbsp; "
  "z<sub>c</sub> = h/2 − y<sub>c</sub>")
P("A integração é feita numericamente (quadratura adaptativa de Simpson), o "
  "que captura exatamente a forma da parábola. É o método recomendado por ser "
  "mais preciso.")

P("7.2 Modelo do bloco retangular (simplificado)", "h2")
P("A NBR 6118 permite substituir o diagrama parábola-retângulo por um bloco "
  "retangular equivalente de altura λx e tensão uniforme α<sub>c</sub>·"
  "f<sub>cd</sub>:")
F("R<sub>cc</sub> = α<sub>c</sub>·f<sub>cd</sub>·b·(λx) &nbsp;&nbsp;&nbsp;&nbsp; "
  "z<sub>c</sub> = h/2 − λx/2")
P("Para o Grupo I (λ = 0,8; α<sub>c</sub> = 0,85) a resultante fica a 0,4x do "
  "bordo comprimido. É um pouco mais conservador que o modelo parabólico, "
  "porém de cálculo fechado.")

# ============================ 8 ============================
P("8. Equações de equilíbrio e solução", "h1")
P("O equilíbrio da seção fornece duas equações. Adotando a convenção de "
  "tensões no aço positivas para tração e definindo z<sub>s,i</sub> = h/2 − "
  "d<sub>i</sub> como o braço de cada camada em relação ao CG:")
F("ΣF = 0:  N<sub>d</sub> = R<sub>cc</sub> − A<sub>s</sub>·Σ(σ<sub>sdi</sub>·n<sub>bi</sub>/n<sub>b</sub>)")
F("ΣM<sub>CG</sub> = 0:  M<sub>d</sub> = R<sub>cc</sub>·z<sub>c</sub> − A<sub>s</sub>·Σ(σ<sub>sdi</sub>·n<sub>bi</sub>/n<sub>b</sub>·z<sub>s,i</sub>)")
P("Isolando A<sub>s</sub> em cada equação obtêm-se duas estimativas, que aqui "
  "chamamos ω<sub>1</sub> (forças) e ω<sub>2</sub> (momentos):")
F("ω<sub>1</sub> = (R<sub>cc</sub> − N<sub>d</sub>) / Σ(σ<sub>sdi</sub>·n<sub>bi</sub>/n<sub>b</sub>)")
F("ω<sub>2</sub> = (R<sub>cc</sub>·z<sub>c</sub> − M<sub>d</sub>) / Σ(σ<sub>sdi</sub>·n<sub>bi</sub>/n<sub>b</sub>·z<sub>s,i</sub>)")
P("A profundidade da linha neutra correta é aquela em que as duas estimativas "
  "coincidem (ω<sub>1</sub> = ω<sub>2</sub>). Para evitar singularidades "
  "(denominadores nulos), procura-se a raiz da função em produto cruzado:")
F("f(x) = (R<sub>cc</sub>−N<sub>d</sub>)·Σ<sub>(M)</sub> − "
  "(R<sub>cc</sub>·z<sub>c</sub>−M<sub>d</sub>)·Σ<sub>(F)</sub> = 0")
P("A raiz é encontrada pelo <b>método de Brent</b> no intervalo [x<sub>mín</sub>, "
  "x<sub>máx</sub>]; caso não haja troca de sinal, recorre-se à minimização de "
  "|f(x)|. Com x determinado, A<sub>s</sub> é obtido pela equação de "
  "denominador mais estável, e distribuído entre as camadas proporcionalmente "
  "ao número de barras.")

# ============================ 9 ============================
P("9. Armaduras mínima e máxima (NBR 6118, item 17.3.5.3)", "h1")
P("A área calculada deve respeitar os limites:")
F("A<sub>s,mín</sub> = máx( 0,15·N<sub>d</sub>/f<sub>yd</sub> ;  0,4%·A<sub>c</sub> )")
F("A<sub>s,máx</sub> = 8%·A<sub>c</sub>  (incluindo regiões de emenda)")
P("sendo A<sub>c</sub> = b·h a área bruta de concreto. O primeiro termo de "
  "A<sub>s,mín</sub> garante ductilidade frente ao esforço normal de cálculo e "
  "pode ser determinante em pilares muito carregados; o segundo é o mínimo "
  "geométrico. Se A<sub>s</sub> exceder A<sub>s,máx</sub>, a seção é "
  "insuficiente e deve ser aumentada.")

P("9.1 Detalhamento — bitolas comerciais", "h2")
P("A ferramenta sugere combinações de barras comerciais (ϕ6,3 a ϕ32 mm) que "
  "cubram a área necessária com 4 a 12 barras, ordenadas pela menor área total "
  "que ainda atende A<sub>s</sub>.")

# ============================ 10 ============================
P("10. Referências", "h1")
P("ABNT NBR 6118:2014 — <i>Projeto de estruturas de concreto — Procedimento.</i> "
  "Em especial os itens 8.2.10 (diagrama do concreto), 8.3.6 (módulo do aço), "
  "11.7 e Tabela 11.1 (ponderação de ações), 12.4.1 (resistências de cálculo), "
  "17.2.2 (hipóteses do ELU) e 17.3.5.3 (armaduras mínima e máxima).", "ref")
P("BASTOS, P. S. S. <i>Pilares de Concreto Armado.</i> Notas de aula, "
  "Departamento de Engenharia Civil, UNESP — Bauru. (Diagramas de domínios, "
  "diagrama parábola-retângulo, bloco retangular equivalente e exemplos de "
  "flexo-compressão.)", "ref")
P("Material de aula: <i>“Pilares 1 — renovada”</i>, UFPel — Centro de "
  "Engenharias.", "ref")

# ============================ build ============================
out = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                   "teoria-dimensionamento-pilar.pdf")
doc = SimpleDocTemplate(out, pagesize=A4, leftMargin=2.2 * cm,
                        rightMargin=2.2 * cm, topMargin=2 * cm, bottomMargin=2 * cm,
                        title="Teoria — Dimensionamento de Pilar (NBR 6118)")
doc.build(story)
print("PDF gerado:", out)
