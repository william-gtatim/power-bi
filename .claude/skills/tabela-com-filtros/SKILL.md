---
name: tabela-com-filtros
description: Cria ou atualiza, num projeto Power BI (.pbip/PBIR), uma página padronizada de listagem com título, cartão com o total, filtros (listas suspensas) na lateral esquerda, tabela sem totais e uma página de detalhe por drillthrough. Usar quando o utilizador pedir uma "tabela com filtros", "página de listagem", "relatório tabela + filtros", "página de detalhe" ou "página igual à de Contatos/Colaboradores" para uma tabela do modelo.
---

# Página padronizada: tabela com filtros (+ detalhe)

O padrão foi aprovado pelo utilizador na página **Colaboradores** do relatório `rh` ([scripts/specs/colaboradores.json](../../../scripts/specs/colaboradores.json)). Gera sempre o mesmo layout:

**Listagem** (1920×1080):
- **Topo:** título (Segoe UI Semibold, 28px) com uma barra verde curta (`#117865`) por baixo. À direita, um **cartão com o total** de linhas (número verde, sem abreviação, por exemplo 2.000), que acompanha os filtros.
- **Lateral esquerda (240px):** **até 10 filtros** em lista suspensa, com aplicação automática, rótulo a 12pt e caixa de pesquisa quando há muitos valores. Os outros filtros vão para o **painel Filtros** do Power BI.
- **Resto da página:** `tableEx` com rótulos legíveis, letra de 14pt, sem totais, colunas a ocupar a largura (`growToFit`) e linha verde por baixo dos cabeçalhos. **Não pode ter scroll horizontal.**

**Detalhe** (opcional, recomendado): página escondida nos separadores, aberta com clique direito numa linha → *Drill-through*. Tem uma seta de voltar ao lado do título (estilo app móvel) e um cartão por secção, com todos os campos da linha.

Os geradores são [gerar_pagina.js](gerar_pagina.js) (listagem) e [gerar_detalhe.js](gerar_detalhe.js) (detalhe, chamado automaticamente quando a especificação tem `"detalhe"`). Se a página com esse nome não existir, criam-na; se existir, **substituem todos os visuais dela**.

## Fluxo

1. **Identificar** a pasta `.Report` e a tabela do modelo. Se o utilizador não disser, pergunta qual é a tabela. Se só houver uma, usa-a.

2. **Descobrir as colunas:**
   - Se o MCP `powerbi-modeling-mcp` estiver disponível, liga-te ao Desktop (`connection_operations` → `ListLocalInstances` / `Connect`) ou à pasta (`ConnectFolder`) e lista as colunas (`column_operations` → `List`). Para decidir a pesquisa, conta os valores distintos com `dax_query_operations`, por exemplo `EVALUATE ROW("c1", DISTINCTCOUNT(t[c1]), ...)`.
   - Sem MCP, lê `<Nome>.SemanticModel/definition/tables/<tabela>.tmdl`.
   - Ignora colunas ocultas (`isHidden`) e colunas técnicas, a menos que o utilizador as queira.
   - Se a tabela tiver ids de outras tabelas, os **nomes** devem vir do modelo ou da origem (por exemplo, uma vista SQL com os joins, como `rh.vw_colaboradores`), não os ids.

3. **Montar a especificação** em `scripts/specs/<pagina>.json`, na raiz do projeto, para ficar versionada e poder ser regenerada:
   ```json
   {
     "report": "../../<pasta>/<Nome>.Report",
     "page": "Colaboradores",
     "title": "Colaboradores",
     "table": "colaboradores",
     "columns": [
       { "field": "id", "label": "ID", "filter": "painel" },
       { "field": "nome", "label": "Nome", "search": true },
       { "field": "departamento", "label": "Departamento", "table": false },
       { "field": "data_admissao", "label": "Data de admissão", "filter": "painel" },
       { "field": "observacoes", "label": "Observações", "filter": false }
     ],
     "detalhe": {
       "page": "Detalhe do colaborador",
       "drillthrough": "id",
       "sections": [
         { "title": "Identificação", "fields": [ { "field": "id", "label": "ID" }, { "field": "nome", "label": "Nome" } ] }
       ]
     }
   }
   ```
   - `report` é relativo ao ficheiro da especificação.
   - `label`: nome legível em português, com acentos e maiúscula inicial. Por exemplo, `codigo_postal` → "Código postal" e `email` → "E-mail".
   - **Filtros:** listas suspensas com aplicação automática. `search: true` quando a coluna tem **mais de cerca de 25 valores distintos**, ou é texto livre, ID, nome, e-mail, telefone, endereço ou código; `search: false` nas restantes.
   - **Lateral com no máximo 10 filtros:** escolhe os mais úteis para o dia a dia (nomes, categorias, hierarquias, estado). Põe os restantes com `"filter": "painel"`: IDs, datas, atributos pouco usados ou redundantes. Se passarem de 10, o gerador move os excedentes para o painel e avisa. Nesse caso, corrige a especificação.
   - **Tabela sem scroll horizontal:** com letra de 14pt, cabem cerca de **10 colunas** (menos, se forem longas). Tira da tabela com `"table": false` as colunas redundantes (por exemplo Departamento e Nível quando o Cargo já os inclui, ou Direção quando se deduz do departamento) e as pouco consultadas na listagem. Ficam como filtro e aparecem no detalhe. Os cabeçalhos longos alargam a coluna, porque a quebra de linha não funciona com `growToFit`.
   - `filter: false` para colunas que só aparecem na tabela, como texto longo ou observações.
   - **Detalhe:** inclui-o por defeito. `drillthrough` é a coluna-chave (normalmente o ID), que tem de estar na tabela da listagem. Agrupa **todos** os campos em 2 a 4 secções temáticas, com no máximo cerca de 6 campos por secção (por exemplo Identificação, Função, Contrato).
   - **Opções da página e respetivos padrões:** `"total": { "field": <1.ª coluna>, "label": "Total de <título>" }`, ou `false` para não ter cartão; `"larguraFiltros": 240`; `"fonte": { "tabela": 14, "cabecalho": 14, "filtros": 12 }`; `"maxFiltrosLateral": 10`. Só os indiques para mudar o padrão.
   - **Não uses `"tipo": "texto"` nem `"aplicar"` por iniciativa própria.** São para casos especiais (ver abaixo).
   - A ordem das colunas segue a ordem do modelo, salvo indicação do utilizador.

4. **Antes de escrever, verifica o Desktop:** `powerbi-report-author preview <Nome>.Report --host desktop --status`.
   - Se `hasUnsavedChanges: true`, **não geres ainda**. Se o Desktop gravar depois de gerares, sobrescreve os ficheiros. Pede ao utilizador para gravar ou fechar sem gravar, a menos que ele já te tenha autorizado a fechar sem gravar durante os testes (ver memória).
   - Nota: logo depois de abrir um PBIP, o Desktop costuma indicar `hasUnsavedChanges: true` mesmo sem alterações do utilizador.

5. **Gerar** a partir da raiz do projeto (gera também o detalhe, se existir):
   ```bash
   node .claude/skills/tabela-com-filtros/gerar_pagina.js scripts/specs/<pagina>.json
   ```
   O script também repõe o `$schema` de `<Nome>.pbip` e `definition.pbir`, que o Desktop apaga ao gravar e sem o qual a validação falha. Lê os `avisos` do resultado.

6. **Validar e ver o resultado.** Carrega a skill `powerbi-authoring:powerbi-report-cli` (modo `authoring`) e segue as regras de pré-visualização dela:
   - `powerbi-report-author validate <Nome>.Report` tem de passar sem erros.
   - Faz `--status` e depois `--reload` no Desktop. Se o relatório não estiver aberto, faz open/attach, sem `--reload`. Corre o status e a abertura/recarregamento **em comandos separados** e, se o status indicar `hasUnsavedChanges: true`, pára (ver passo 4).
   - **Abrir o Desktop neste computador:** o Power BI Desktop está instalado pela Microsoft Store, e a CLI não o encontra sozinha (dá `HOST_UNAVAILABLE` com "executable was not found"). Descobre a pasta e define `PBI_DESKTOP_PATH` **no mesmo comando** da abertura:
     ```bash
     L=$(powershell -NoProfile -Command "Get-AppxPackage Microsoft.MicrosoftPowerBIDesktop | Select-Object -ExpandProperty InstallLocation" | tr -d '\r') && \
       export PBI_DESKTOP_PATH="$L\\bin\\PBIDesktop.exe" && \
       powerbi-report-author preview <pasta>/<Nome>.Report --host desktop
     ```
     A versão da pasta muda quando a Store atualiza o Power BI, por isso consulta-a sempre. Usa o nome exato do pacote: `*PowerBI*` também apanha o Power BI Report Builder e o caminho fica errado.
   - **Fechar o Desktop sem gravar** (só com autorização): `taskkill //F //IM PBIDesktop.exe`.
   - **Dados vazios depois de abrir** (aviso "Algumas das tabelas estão incompletas ou não têm dados"): o modelo abriu sem cache. Pede ao utilizador para clicar em **Atualizar agora**. Se a origem for PostgreSQL ou outra base com autenticação, ele tem de introduzir as credenciais no Desktop; nunca as escrevas no modelo.
   - Tira as capturas com `--screenshot <pasta> --all-pages` para a pasta temporária de validação que a skill indica, revê as imagens e apaga essa pasta no fim.
   - **Confirma:**
     - título, barra verde e cartão de total com o número completo;
     - até 10 filtros com rótulos legíveis;
     - tabela **sem scroll horizontal** e sem totais;
     - no detalhe, seta ao lado do título e cartões sem texto cortado.

     Sem drillthrough, a página de detalhe mostra o `Min()` de todas as linhas. Isso é normal, porque pelo drillthrough mostra só a linha escolhida.
   - No Desktop, os botões (por exemplo Voltar) acionam-se com **Ctrl + clique**. No serviço basta um clique.

7. **Data/hora automática:** verifica a anotação `__PBI_TimeIntelligenceEnabled` do modelo (`model_operations` → `Get`). Se for `1`, podes mencioná-lo, porque cria uma tabela de datas escondida por cada coluna de data. O Desktop guarda esta opção à sua maneira e repõe-na ao abrir, por isso a forma fiável de a desligar é no próprio Desktop: *Opções → Arquivo atual → Carregamento de dados*. Não insistas se o utilizador não quiser.

8. **Modelo, opcional mas recomendado:** colunas numéricas que não se somam (IDs, códigos, telefones, anos) devem ter `summarizeBy: None`. Com MCP, usa `column_operations` → `Update` com `summarizeBy: "None"` e a anotação `SummarizationSetBy = User`. Faz isto só com o acordo do utilizador.

9. **Reportar** o que foi criado ou atualizado:
   - as páginas e o número de filtros na lateral e no painel;
   - as colunas que ficaram fora da tabela;
   - o rótulo do total e o caminho da especificação.

   Não faças commit sem o utilizador pedir.

## Opções para casos especiais

O gerador suporta duas opções que **não fazem parte do padrão**. Usa-as apenas a pedido do utilizador, normalmente em tabelas muito grandes (milhões de linhas) onde os filtros ficam lentos.

| Opção | Onde | Efeito | Quando faz sentido |
|---|---|---|---|
| `"tipo": "texto"` | numa coluna | Filtro de texto (`textSlicer`): o utilizador escreve o valor e não se carrega a lista de valores. | Colunas quase únicas com muitos valores (e-mail, telefone, endereço, códigos). Só funciona com colunas de **texto**. |
| `"aplicar": true` | na especificação | Acrescenta os botões "Aplicar filtros" (verde) e "Limpar filtros" (contorno) por baixo dos filtros. As seleções ficam pendentes até clicar em Aplicar, por isso cada clique deixa de consultar o modelo. | Tabelas grandes com vários filtros, quando a atualização a cada clique fica lenta. |

Notas:
- O botão "Aplicar filtros" aparece cinzento enquanto não há seleções pendentes. Isso é o comportamento normal (visto no Desktop).
- A formatação do filtro de texto (sem cartão, sem subtítulo, título como os outros filtros) **ainda não foi verificada no Desktop** com o padrão atual. Confirma-a na captura na primeira vez que usares esta opção.

## Lições do Desktop (não repetir)

- `header.textSize` dos slicers é **ignorado**. O rótulo usa o **título do visual** (VCO `title`) com o `header` escondido, e o `responsive` do tema fica desligado.
- `wordWrap` nos cabeçalhos da tabela não reduz a largura com `growToFit`. Para tirar o scroll horizontal, retiram-se colunas.
- O cartão (`cardVisual`) abrevia por defeito ("2 Mil"). Usa `labelDisplayUnits: 1D` para mostrar o número completo.
- Textos e datas em cartões usam `Aggregation` com `Function: 3` (Min). A contagem usa `Function: 5` (CountNonNull).
- **Matriz (`pivotTable`) expandida em todos os níveis:** cada projeção em `Rows` leva `"active": true`, e `expansionStates` tem uma entrada por nível com `isPinned: true` (só o 1.º com `identityKeys`) e `root: {}`. `isCollapsed: false` **não** expande. Este formato foi confirmado lendo o que o Desktop grava com "Expandir → Tudo" (ver `scripts/gerar_ausencias.js`). Quando não souberes o formato, pede ao utilizador para fazer a ação no Desktop e gravar, e lê o ficheiro.
- **Valores que só devem aparecer nas linhas de detalhe** de uma matriz (vazios nos subtotais): usa `IF ( ISINSCOPE ( t[coluna_folha] ), ... )`. `HASONEVALUE` falha quando o grupo tem um só registo.
- **Atualizar dados sem o utilizador:** com o Desktop aberto, `partition_operations` → `RefreshWithXMLA` pelo MCP funciona com as credenciais que o Desktop já guardou. Depois de atualizar só algumas tabelas, corre `model_operations` → `RefreshWithXMLA` com `Calculate`.
- **Coluna nova num modelo com cache:** a cache (`cache.abf`) é de antes da coluna existir, por isso ela aparece vazia até se atualizar essa tabela.
- **Editar o TMDL com o Desktop aberto** mostra o aviso "Os arquivos deste projeto foram alterados externamente". Se a mesma alteração também foi feita no Desktop pelo MCP, o aviso pode ser ignorado.

## Alterar o padrão

O estilo está nas constantes e nos padrões do topo de `gerar_pagina.js` e `gerar_detalhe.js`: `VERDE`, tamanhos, margens, largura da lateral, fontes e limite de filtros. Se o utilizador quiser mudar o padrão para todas as páginas, altera lá e regenera cada especificação em `scripts/specs/`. Atenção: isso também altera as páginas existentes quando forem regeneradas.

## Limites

- Uma tabela do modelo por página. Colunas de outras tabelas relacionadas não são suportadas pelo gerador; resolve-as no modelo ou numa vista.
- Os filtros são listas suspensas (ou de texto, em casos especiais). Para datas, a lista suspensa funciona, mas se o utilizador pedir um intervalo de datas, adiciona esse slicer à mão seguindo a referência `slicers.md` da skill `powerbi-report-cli`.
- O gerador é dono das suas páginas: qualquer visual adicionado à mão nelas desaparece quando forem regeneradas.
