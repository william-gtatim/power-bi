---
name: tabela-com-filtros
description: Cria ou atualiza, num projeto Power BI (.pbip/PBIR), uma página padronizada de listagem com título, filtros (slicers dropdown) na lateral esquerda para cada coluna e uma tabela com todas as colunas, sem totais. Usar quando o utilizador pedir uma "tabela com filtros", "página de listagem", "relatório tabela + filtros" ou "página igual à de Contatos" para uma tabela do modelo.
---

# Página padronizada: tabela com filtros

Gera sempre o mesmo layout, sem configuração manual:

- **Topo:** título (Segoe UI Semibold, 28px) com uma barra verde curta (`#117865`) por baixo.
- **Lateral esquerda:** um slicer em lista suspensa por coluna, com rótulo legível na cor do tema, e caixa de pesquisa nas colunas com muitos valores.
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
       { "field": "cidade", "label": "Cidade", "search": false },
       { "field": "observacoes", "label": "Observações", "filter": false }
     ]
   }
   ```
   - `report` é relativo ao ficheiro da especificação.
   - `label`: nome legível em português, com acentos e maiúscula inicial. Por exemplo, `codigo_postal` → "Código postal" e `email` → "E-mail".
   - `search: true` quando a coluna tem **mais de cerca de 25 valores distintos**, ou sempre que for texto livre, ID, e-mail, telefone ou endereço.
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

7. **Modelo, opcional mas recomendado:** colunas numéricas que não se somam (IDs, códigos, telefones, anos) devem ter `summarizeBy: None`. Com MCP, usa `column_operations` → `Update` com `summarizeBy: "None"` e a anotação `SummarizationSetBy = User`. Faz isto só com o acordo do utilizador, e lembra-o de gravar no Desktop depois.

8. **Reportar** o que foi criado ou atualizado: a página, o número de filtros, as colunas com pesquisa e o caminho da especificação. Não faças commit sem o utilizador pedir.

## Alterar o padrão

O estilo está nas constantes do topo de `gerar_pagina.js`: `VERDE`, tamanhos, margens e a largura da lateral. Se o utilizador quiser mudar o padrão para todas as páginas, altera lá e regenera cada especificação em `scripts/specs/`.

## Limites

- Uma tabela do modelo por página. Colunas de outras tabelas relacionadas não são suportadas pelo gerador.
- Os filtros são sempre listas suspensas. Para datas, a lista suspensa funciona, mas se o utilizador pedir um intervalo de datas, adiciona esse slicer à mão seguindo a referência `slicers.md` da skill `powerbi-report-cli`.
- O gerador é dono da página: qualquer visual adicionado à mão nessa página desaparece quando ela for regenerada.
