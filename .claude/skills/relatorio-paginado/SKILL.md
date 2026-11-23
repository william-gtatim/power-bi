---
name: relatorio-paginado
description: Cria relatórios paginados do Power BI (.rdl, Power BI Report Builder) ligados diretamente ao PostgreSQL (Neon) por ODBC, com parâmetros (incluindo escolha múltipla e cascata), uma página por grupo (ex.: por colaborador), subtotais e totais, prontos a executar e exportar para PDF sem publicar nada. Usar quando o utilizador pedir um "relatório paginado", "relatório para imprimir/PDF", "uma página por colaborador/cliente", "folha de ponto", "Report Builder" ou ".rdl" neste projeto.
---

# Relatórios paginados (.rdl) ligados ao PostgreSQL

O padrão foi provado com o relatório **Ausências por colaborador** ([rh/paginado/ausencias_colaborador.rdl](../../../rh/paginado/ausencias_colaborador.rdl)). O utilizador executou-o no Report Builder com dados do Neon e funcionou. O gerador desse relatório ([rh/paginado/gerar_rdl_ausencias.js](../../../rh/paginado/gerar_rdl_ausencias.js)) é o **exemplo de referência**: copia-o e adapta-o.

## O que é preciso (já instalado nesta máquina)

| Peça | Para quê | Como verificar |
|---|---|---|
| **Power BI Report Builder** (Microsoft Store) | Abrir, executar e exportar o `.rdl` | `Get-AppxPackage Microsoft.PowerBIReportBuilder` |
| **Driver ODBC psqlODBC 64 bits** ("PostgreSQL Unicode(x64)", versão 18.00.0005) | Ligação do Report Builder ao PostgreSQL | `Get-OdbcDriver \| ? Name -like '*PostgreSQL*'` |
| **Pacote `pg`** (Node, na raiz do projeto) e **`.env`** com `DATABASE_URL` | Testar as consultas antes de as pôr no relatório | `node .claude/skills/relatorio-paginado/testar_sql.js "SELECT 1"` |
| **Python 3** (`python3`) | Validador do RDL da skill da comunidade | `python3 --version` |
| Skill **`paginated-reports:paginated-report`** (plugin `paginated-reports@power-bi-agentic-development`) | Referência do formato RDL (`references/rdl-format.md`), modelos e **validador** `scripts/validate_rdl.py`, que também corre por hook depois de cada Write/Edit num `.rdl` | `claude.exe plugin list` |
| MCP **`pbirb`** (opcional) | Edições pontuais a um `.rdl` existente sem regenerar | `claude.exe mcp list` |

Caminho do validador: `~/.claude/plugins/cache/power-bi-agentic-development/paginated-reports/<versão>/skills/paginated-report/scripts/validate_rdl.py`.

**Não é preciso** publicar no serviço Power BI, ter capacidade Premium nem gateway: o relatório executa localmente no Report Builder. Se um dia for publicado, uma fonte ODBC precisa de um **gateway de dados**. A alternativa é usar como fonte o modelo semântico publicado (ver a skill `paginated-report`, `semantic-model-starter.rdl`).

## Ficheiros desta skill

- **[rdl.js](rdl.js):** funções que geram XML RDL na ordem que o Report Builder exige:
  - `relatorio()` (documento completo) e `fonteOdbcPostgres()`;
  - `dataset()` e `parametro()` / `layoutParametros()`;
  - `criarTextbox()`, `cell()`, `vazia`, `row()` (células e linhas da Tablix);
  - `cabecalhoPagina()`, `rodapePagina()`, `paginaA4`;
  - `gravar()` (UTF-8 com BOM) e `CORES` (o mesmo verde `#117865` dos relatórios interativos).
- **[testar_sql.js](testar_sql.js):** corre uma consulta no PostgreSQL do `.env` e mostra colunas, tipos (já convertidos para `rd:TypeName`) e as primeiras linhas.

## Fluxo

1. **Requisitos, curto.** O que vai em cada página (o grupo), que colunas, que totais, que parâmetros e valores por defeito. Infere o que já foi dito na conversa e pergunta só o que falta.
2. **Escrever e testar as consultas SQL** com `testar_sql.js`, com valores reais dos parâmetros:
   - uma consulta por **lista de valores** de cada parâmetro (valor + rótulo);
   - uma por **valor por defeito**: escolhe defaults que mostrem algo útil, por exemplo os 3 com mais registos, e **nunca "todos"**, que dá centenas de páginas;
   - a **consulta principal**.
   Confirma que os nomes e tipos das colunas batem com os `<Field>` que vais declarar.
3. **Criar o gerador** em `<projeto>/paginado/gerar_rdl_<nome>.js`, copiando o das ausências:
   - gera **GUIDs novos** (`node -e "console.log(require('crypto').randomUUID())"`) para `REPORT_ID` e `DATASOURCE_ID` e fixa-os no gerador;
   - adapta as consultas, os campos, as colunas (a soma das larguras é 18 cm em A4 vertical), as linhas da Tablix e a hierarquia de grupos.
4. **Gerar e validar:**
   ```bash
   node <projeto>/paginado/gerar_rdl_<nome>.js
   python3 <validador>/validate_rdl.py <projeto>/paginado/<nome>.rdl
   ```
5. **Abrir no Report Builder** para o utilizador testar: `powershell -NoProfile -Command "Start-Process -FilePath (Resolve-Path '<caminho>.rdl')"`. O utilizador clica em **Executar** e introduz as credenciais do PostgreSQL (utilizador e password do `.env`, que **nunca** se escrevem no `.rdl`).
6. **Verificar o resultado.** Não há pré-visualização por CLI. Pede ao utilizador para **Exportar → PDF** e dizer onde o gravou; lê o PDF com a ferramenta Read. Uma captura de ecrã também serve. Se der erro, pede a mensagem completa.
7. **Iterar:** corrige o gerador, gera de novo e valida. Antes de cada nova versão, o utilizador tem de **fechar o relatório no Report Builder sem gravar**, para não escrever por cima do ficheiro gerado.

## Regras do RDL (aprendidas, não repetir)

- **ODBC não expande parâmetros com vários valores** (`IN (?)`). A consulta tem de ser uma **expressão VB** (`<CommandText>="SELECT ... IN (" & Join(Parameters!X.Value, ",") & ")"</CommandText>`), sem `<QueryParameters>`. Com expressão, o Report Builder não deduz os campos, por isso declara todos os `<Field>` à mão.
- **Segurança na expressão:**
  - nos parâmetros com vários valores, usa `DataType` **`Integer`** com valores vindos de uma lista; assim o `Join` só produz números;
  - nos parâmetros de texto, usa `Replace(Parameters!X.Value, "'", "''")` dentro de `'...'`.
- **Parâmetros em cascata:** basta a consulta da lista do parâmetro filho referir `Parameters!Pai.Value`. Mantém só um nível de cascata.
- **`RepeatOnNewPage`:** numa hierarquia de linhas, as linhas fixas irmãs de um grupo dinâmico têm de ter **todas o mesmo valor**. Se só uma o tiver, o Report Builder recusa o relatório ("invalid TablixMember … RepeatOnNewPage"). O validador não apanha isto.
- **Contagens da Tablix:**
  - n.º de membros-folha da hierarquia de linhas = n.º de `<TablixRow>`;
  - n.º de membros da hierarquia de colunas = n.º de `<TablixColumn>`;
  - cada linha tem uma `<TablixCell>` por coluna. Com `ColSpan` N, seguem-se N-1 `<TablixCell />` vazias.
- **Uma página por grupo:** `<PageBreak><BreakLocation>Between</BreakLocation></PageBreak>` dentro do `<Group>`. As linhas de cabeçalho do grupo levam `KeepWithGroup After` e os totais `KeepWithGroup Before`.
- **Ordem dos elementos:** `DataSources → DataSets → ReportSections → ReportParameters → ReportParametersLayout`. Dentro do parâmetro: `DataType, DefaultValue, Prompt, ValidValues, MultiValue`. O `rdl.js` já respeita isto.
- **Largura:** o corpo mais as margens esquerda e direita tem de ser ≤ largura da página, senão o PDF ganha páginas em branco. A4 vertical com margens de 1,5 cm dá 18 cm úteis.
- **Datas:** o psqlODBC devolve `date` como `System.DateTime`; formata com `<Format>dd/MM/yyyy</Format>`. Os nomes dos meses em português vêm do SQL (`rh.calendario.nome_mes`), não do VB.
- **Neon por ODBC:** `Driver={PostgreSQL Unicode(x64)};Server=<host -pooler>;Port=5432;Database=<base>;SSLmode=require` funciona com o psqlODBC 18. Se um driver antigo falhar por SNI, experimenta acrescentar `;pqopt={options=endpoint=<id-do-endpoint>}` (não testado aqui; confirma na documentação da Neon).
- **Pré-visualização ≠ PDF:** a paginação e as margens só ficam exatas no PDF exportado.

## Limites

- A verificação depende do utilizador (executar, exportar o PDF). Não afirmes que o relatório funciona sem esse resultado.
- O MCP `pbirb` serve para editar `.rdl` existentes. Para relatórios novos deste projeto, prefere o gerador com `rdl.js`, que é reprodutível e versionado.
