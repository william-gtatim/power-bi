---
name: tabela-com-filtros
description: Cria ou atualiza, num projeto Power BI (.pbip/PBIR), uma página padronizada de listagem com título, filtros (slicers dropdown) na lateral esquerda para cada coluna e uma tabela com todas as colunas, sem totais. Usar quando o utilizador pedir uma "tabela com filtros", "página de listagem", "relatório tabela + filtros" ou "página igual à de Contatos" para uma tabela do modelo.
---

# Página padronizada: tabela com filtros

Gera sempre o mesmo layout, sem configuração manual:

- **Topo:** título (Segoe UI Semibold, 28px) com uma barra verde curta (`#117865`) por baixo.
- **Lateral esquerda:** um filtro em lista suspensa por coluna, com rótulo legível na cor do tema, caixa de pesquisa quando há muitos valores, e aplicação **automática** (sem botão Aplicar).
- **Resto da página:** `tableEx` com as colunas e rótulos legíveis, sem totais, colunas a ocupar a largura (`growToFit`) e linha verde por baixo dos cabeçalhos.
- **Página:** 1920×1080. A altura cresce sozinha quando há mais de 10 filtros.

O gerador é [gerar_pagina.js](gerar_pagina.js). Ele lê uma especificação em JSON e escreve os ficheiros PBIR. Se a página com esse nome não existir, cria-a; se existir, **substitui todos os visuais dela**.

## Fluxo

1. **Identificar** a pasta `.Report` e a tabela do modelo. Se o utilizador não disser, pergunta qual é a tabela. Se só houver uma tabela, usa-a.

2. **Descobrir as colunas:**
   - Se o MCP `powerbi-modeling-mcp` estiver disponível, liga-te ao Desktop (`connection_operations` → `ListLocalInstances` / `Connect`) e lista as colunas (`column_operations` → `List`). Para decidir a pesquisa, conta os valores distintos com `dax_query_operations`, por exemplo `EVALUATE ROW("c1", DISTINCTCOUNT(t[c1]), ...)`.
   - Sem MCP, lê `<Nome>.SemanticModel/definition/tables/<tabela>.tmdl`.
   - Ignora colunas ocultas (`isHidden`) e colunas técnicas, a menos que o utilizador as queira.

3. **Montar a especificação** em `scripts/specs/<pagina>.json`, na raiz do projeto, para ficar versionada e poder ser regenerada:
   ```json
   {
     "report": "../../<pasta>/<Nome>.Report",
     "page": "Contatos",
     "title": "Contatos",
     "table": "contatos",
     "columns": [
       { "field": "id", "label": "ID", "search": true },
       { "field": "email", "label": "E-mail", "search": true },
       { "field": "cidade", "label": "Cidade", "search": false },
       { "field": "observacoes", "label": "Observações", "filter": false }
     ]
   }
   ```
   - `report` é relativo ao ficheiro da especificação.
   - `label`: nome legível em português, com acentos e maiúscula inicial. Por exemplo, `codigo_postal` → "Código postal" e `email` → "E-mail".
   - **Padrão:** todos os filtros são listas suspensas com aplicação automática. `search: true` quando a coluna tem **mais de cerca de 25 valores distintos**, ou é texto livre, ID, e-mail, telefone, endereço ou código; `search: false` nas restantes.
   - **Não uses `"tipo": "texto"` nem `"aplicar"` por iniciativa própria.** São só para casos especiais, quando o utilizador os pedir (ver [Opções para casos especiais](#opções-para-casos-especiais)). Se a tabela for muito grande, podes mencioná-las como possibilidade, mas mantém o padrão.
   - `filter: false` para colunas que só aparecem na tabela, como texto longo ou observações.
   - A ordem das colunas segue a ordem do modelo, salvo indicação do utilizador.

4. **Antes de escrever, verifica o Desktop:** `powerbi-report-author preview <Nome>.Report --host desktop --status`.
   - Se `hasUnsavedChanges: true`, **não geres ainda**. Pede ao utilizador para gravar (Ctrl+S) ou para fechar sem gravar, conforme queira manter as alterações dele. Se o Desktop gravar depois de gerares, sobrescreve os ficheiros.

5. **Gerar** a partir da raiz do projeto:
   ```bash
   node .claude/skills/tabela-com-filtros/gerar_pagina.js scripts/specs/<pagina>.json
   ```
   O script também repõe o `$schema` de `<Nome>.pbip` e `definition.pbir`, que o Desktop apaga ao gravar e sem o qual a validação falha.

6. **Validar e ver o resultado.** Carrega a skill `powerbi-authoring:powerbi-report-cli` (modo `authoring`) e segue as regras de pré-visualização dela:
   - `powerbi-report-author validate <Nome>.Report` tem de passar sem erros.
   - Faz `--status` e depois `--reload` no Desktop. Se o relatório não estiver aberto, faz open/attach, sem `--reload`.
   - Tira a captura com `--screenshot` para a pasta temporária de validação que a skill indica, revê a imagem e apaga essa pasta no fim.
   - Confirma o título, a barra verde, os filtros com os rótulos certos, a tabela com os cabeçalhos legíveis e a ausência de totais.

7. **Data/hora automática:** verifica a anotação `__PBI_TimeIntelligenceEnabled` do modelo (`model_operations` → `Get`). Se for `1`, recomenda desligá-la, porque cria uma tabela de datas escondida por cada coluna de data e aumenta o tamanho do modelo e o tempo de atualização. Com o acordo do utilizador, usa `model_operations` → `Update` com a anotação a `0`. O `Update` substitui todas as anotações, por isso envia também as outras que já existem.

8. **Modelo, opcional mas recomendado:** colunas numéricas que não se somam (IDs, códigos, telefones, anos) devem ter `summarizeBy: None`. Com MCP, usa `column_operations` → `Update` com `summarizeBy: "None"` e a anotação `SummarizationSetBy = User`. Faz isto só com o acordo do utilizador, e lembra-o de gravar no Desktop depois.

9. **Reportar** o que foi criado ou atualizado: a página, o número de filtros, as colunas com pesquisa ou filtro de texto, se tem botões Aplicar/Limpar e o caminho da especificação. Não faças commit sem o utilizador pedir.

## Opções para casos especiais

O gerador suporta duas opções que **não fazem parte do padrão**. Usa-as apenas a pedido do utilizador, normalmente em tabelas muito grandes (milhões de linhas) onde os filtros ficam lentos.

| Opção | Onde | Efeito | Quando faz sentido |
|---|---|---|---|
| `"tipo": "texto"` | numa coluna | Filtro de texto (`textSlicer`): o utilizador escreve o valor e não se carrega a lista de valores. | Colunas quase únicas com muitos valores (e-mail, telefone, endereço, códigos). Só funciona com colunas de **texto**. |
| `"aplicar": true` | na especificação | Acrescenta os botões "Aplicar filtros" (verde) e "Limpar filtros" (contorno) por baixo dos filtros. As seleções ficam pendentes até clicar em Aplicar, por isso cada clique deixa de consultar o modelo. | Tabelas grandes com vários filtros, quando a atualização a cada clique fica lenta. |

Exemplo:
```json
{ "...": "...", "aplicar": true,
  "columns": [ { "field": "email", "label": "E-mail", "tipo": "texto" } ] }
```

Notas:
- O botão "Aplicar filtros" aparece cinzento enquanto não há seleções pendentes. Isso é o comportamento normal (visto no Desktop).
- Sem ajustes, o filtro de texto aparecia com cartão branco, subtítulo técnico e caixa de escrita cortada. O gerador já desliga o cartão e o subtítulo e alinha o título com os outros filtros, mas essa versão ainda **não foi verificada no Desktop**. Na primeira vez que usares esta opção, confirma-a na captura.

## Alterar o padrão

O estilo está nas constantes do topo de `gerar_pagina.js`: `VERDE`, tamanhos, margens e a largura da lateral. Se o utilizador quiser mudar o padrão para todas as páginas, altera lá e regenera cada especificação em `scripts/specs/`.

## Limites

- Uma tabela do modelo por página. Colunas de outras tabelas relacionadas não são suportadas pelo gerador.
- Os filtros são listas suspensas (ou de texto, em casos especiais). Para datas, a lista suspensa funciona, mas se o utilizador pedir um intervalo de datas, adiciona esse slicer à mão seguindo a referência `slicers.md` da skill `powerbi-report-cli`.
- O gerador é dono da página: qualquer visual adicionado à mão nessa página desaparece quando ela for regenerada.
