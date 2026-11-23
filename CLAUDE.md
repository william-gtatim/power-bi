# Ferramentas para Power BI

Este ambiente tem o plugin `powerbi-authoring@fabric-collection` (repositório `microsoft/skills-for-fabric`) instalado ao nível do utilizador. Usa-o para qualquer trabalho em projetos Power BI.

## Skills

Carrega a skill adequada com a ferramenta Skill **antes** de ler ou editar ficheiros do projeto.

| Skill | Quando usar |
|---|---|
| `powerbi-authoring:semantic-model-authoring` | Modelo semântico: tabelas, colunas, medidas, DAX, relações, Power Query/M, partições, parâmetros, segurança (RLS), refresh. |
| `powerbi-authoring:powerbi-report-cli` | Relatório: planear, desenhar, criar e editar páginas e visuais (PBIR), validar, pré-visualizar, tirar screenshots, publicar no Fabric. |

- A `powerbi-report-cli` funciona por modos (`planning`, `design`, `authoring`, `management`). Lê o ficheiro de referência do modo antes de agir, como indica a skill.
- Num pedido que envolve modelo e relatório, faz primeiro o modelo e depois o relatório.

## Servidor MCP: `powerbi-modeling-mcp`

O plugin fornece este servidor (arranca com `npx @microsoft/powerbi-modeling-mcp`). As ferramentas chamam-se `mcp__plugin_powerbi-authoring_powerbi-modeling-mcp__*`, por exemplo `table_operations`, `measure_operations`, `relationship_operations`, `partition_operations`, `dax_query_operations` e `database_operations`.

- Liga-te ao modelo antes de qualquer operação:
  - **Ficheiros PBIP/TMDL em disco:** aponta para a pasta `<nome>.SemanticModel/definition`.
  - **Power BI Desktop aberto:** liga-te à instância em execução.
- Na primeira utilização pode ser preciso aceitar a EULA (`accept_eula`). Pede confirmação ao utilizador antes.
- Para editar o modelo, prefere o MCP a editar o TMDL à mão, porque o MCP valida e grava TMDL correto. Edita o TMDL diretamente só se o MCP não estiver disponível.
- Usa só este servidor numa tarefa de modelação. Não o combines com o servidor remoto de Power BI.

## Relatórios paginados (`.rdl`, Power BI Report Builder)

Para relatórios paginados (documentos para imprimir ou exportar, com quebras de página, por exemplo uma página por colaborador), as skills `powerbi-authoring` acima **não servem**. Neste projeto, segue a skill **`relatorio-paginado`** (`.claude/skills/relatorio-paginado/`), que descreve o processo provado: ODBC ao Neon, gerador Node com `rdl.js`, validação e PDF. Ela apoia-se em:

- **Skill `paginated-reports:paginated-report`** (plugin `paginated-reports@power-bi-agentic-development`, da comunidade). Tem modelos em `assets/` (incluindo `sql-starter.rdl`), um validador (`scripts/validate_rdl.py`, que também corre sozinho por hook depois de cada Write/Edit num `.rdl`) e scripts para publicar e exportar.
- **MCP `pbirb`** (`pbirb-mcp`, da comunidade, corre com `uvx`): mais de 100 ferramentas para editar `.rdl` (conjuntos de dados, parâmetros, agrupamentos, estilos). Prefere-o a editar o XML à mão.
- **Dados do PostgreSQL (Neon) sem publicar:** fonte ODBC com o driver `PostgreSQL Unicode(x64)` (instalado). As credenciais são pedidas na execução; **não as escrevas no `.rdl`**.
- **Verificação:** não há pré-visualização por CLI. O utilizador executa no Report Builder e exporta para PDF, e eu leio o PDF. Uma captura de ecrã também serve.

## Regras de trabalho

- **Formato:** só os projetos `.pbip`, com TMDL para o modelo e PBIR para o relatório, podem ser editados como ficheiros e versionados. Se o projeto for `.pbix`, pede ao utilizador que o grave como `.pbip`.
- **Power BI Desktop aberto:** se editares ficheiros em disco com o projeto aberto no Desktop, ele pode sobrescrever as alterações ao gravar, e não vê as alterações até ser reaberto. Antes de editar ficheiros, pede ao utilizador que feche o projeto, ou trabalha através da ligação MCP ao Desktop.
- **Git:** antes de alterações significativas, confirma que há um commit para onde voltar (`git status`). Não faças commits sem o utilizador pedir.
- **Validação:** depois de editar, valida (a `powerbi-report-cli` tem validação de PBIR) e informa o que foi verificado e o que não foi.
- **Fabric e Azure:** publicar ou descarregar exige `az login`. Editar localmente não exige.
- **Telemetria:** a skill de relatórios exige o header `x-ms-fabric-skill` nas chamadas a `api.fabric.microsoft.com`. Segue a instrução da skill.

## Notas do ambiente (Windows)

- O comando `claude` não está no PATH. O executável da extensão do VS Code está em `~/.vscode/extensions/anthropic.claude-code-*/resources/native-binary/claude.exe`.
- Para atualizar o plugin: `claude.exe plugin update powerbi-authoring@fabric-collection`.
- O `uv`/`uvx` está em `%APPDATA%\Python\Python314\Scripts\` (instalado com `pip --user`), que não está no PATH. O MCP `pbirb` está registado com esse caminho absoluto.
