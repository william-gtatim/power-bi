// Funções auxiliares para gerar relatórios paginados (.rdl, schema 2016) a partir de Node.
// Usado pelos geradores em <projeto>/paginado/gerar_rdl_*.js (exemplo: rh/paginado/gerar_rdl_ausencias.js).
// Mantém a ordem de elementos que o Report Builder espera (ver SKILL.md, "Regras do RDL").
const crypto = require('crypto');

const CORES = { VERDE: '#117865', CINZA: '#605e5c', LINHA: '#e0e0e0', TEXTO: '#252423' };

/** Escapa texto para XML. */
const x = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** GUID novo (usar uma vez e fixar no gerador: o rd:ReportID tem de ser estável por relatório). */
const guid = () => crypto.randomUUID();

/** Fonte de dados ODBC para PostgreSQL. As credenciais são pedidas ao executar (nunca no ficheiro). */
const fonteOdbcPostgres = ({ nome = 'Neon', servidor, base, porta = 5432, id, prompt = 'Utilizador e password do PostgreSQL:' }) => `
    <DataSource Name="${nome}">
      <ConnectionProperties>
        <DataProvider>ODBC</DataProvider>
        <ConnectString>Driver={PostgreSQL Unicode(x64)};Server=${servidor};Port=${porta};Database=${base};SSLmode=require</ConnectString>
        <Prompt>${x(prompt)}</Prompt>
      </ConnectionProperties>
      <rd:SecurityType>DataBase</rd:SecurityType>
      <rd:DataSourceID>${id}</rd:DataSourceID>
    </DataSource>`;

/** Conjunto de dados. `sql` pode ser texto ou expressão VB ("=..."). `campos` = [[nome, tipo .NET], ...]. */
const dataset = (nome, sql, campos, fonte = 'Neon') => `
    <DataSet Name="${nome}">
      <Query>
        <DataSourceName>${fonte}</DataSourceName>
        <CommandText>${x(sql)}</CommandText>
      </Query>
      <Fields>${campos.map(([n, t]) => `
        <Field Name="${n}">
          <DataField>${n}</DataField>
          <rd:TypeName>${t}</rd:TypeName>
        </Field>`).join('')}
      </Fields>
    </DataSet>`;

/** Fábrica de textboxes para células de Tablix (nomes automáticos tb1, tb2... se não indicados). */
const criarTextbox = () => {
  let n = 0;
  return (valor, { nome, bold, size = '10pt', color = CORES.TEXTO, align, format, bg, borda = true, padTop = '3pt' } = {}) => `
                        <Textbox Name="${nome || 'tb' + (++n)}">
                          <CanGrow>true</CanGrow>
                          <KeepTogether>true</KeepTogether>
                          <Paragraphs>
                            <Paragraph>
                              <TextRuns>
                                <TextRun>
                                  <Value>${x(valor)}</Value>
                                  <Style><FontSize>${size}</FontSize><Color>${color}</Color>${bold ? '<FontWeight>Bold</FontWeight>' : ''}${format ? `<Format>${format}</Format>` : ''}</Style>
                                </TextRun>
                              </TextRuns>
                              <Style>${align ? `<TextAlign>${align}</TextAlign>` : ''}</Style>
                            </Paragraph>
                          </Paragraphs>
                          <Style>
                            <Border><Style>None</Style></Border>${borda ? `
                            <BottomBorder><Color>${CORES.LINHA}</Color><Style>Solid</Style><Width>1pt</Width></BottomBorder>` : ''}${bg ? `
                            <BackgroundColor>${bg}</BackgroundColor>` : ''}
                            <PaddingLeft>4pt</PaddingLeft><PaddingRight>4pt</PaddingRight>
                            <PaddingTop>${padTop}</PaddingTop><PaddingBottom>3pt</PaddingBottom>
                          </Style>
                        </Textbox>`;
};

/** Célula de Tablix. Com colSpan N, a linha tem de ter mais N-1 `vazia` a seguir. */
const cell = (conteudo, colSpan) => `
                    <TablixCell>
                      <CellContents>${conteudo}${colSpan ? `
                        <ColSpan>${colSpan}</ColSpan>` : ''}
                      </CellContents>
                    </TablixCell>`;
const vazia = `
                    <TablixCell />`;

/** Linha de Tablix: uma <TablixCell> (ou `vazia`) por coluna. */
const row = (altura, cells) => `
                <TablixRow>
                  <Height>${altura}</Height>
                  <TablixCells>${cells.join('')}
                  </TablixCells>
                </TablixRow>`;

/** Caixa de texto solta (cabeçalho/rodapé da página). */
const textoSolto = (nome, valor, top, altura, opts = {}) => `
            <Textbox Name="${nome}">
              <CanGrow>true</CanGrow>
              <KeepTogether>true</KeepTogether>
              <Paragraphs>
                <Paragraph>
                  <TextRuns>
                    <TextRun><Value>${x(valor)}</Value><Style><FontSize>${opts.size || '9pt'}</FontSize><Color>${opts.color || CORES.CINZA}</Color>${opts.bold ? '<FontWeight>Bold</FontWeight>' : ''}</Style></TextRun>
                  </TextRuns>
                  <Style>${opts.align ? `<TextAlign>${opts.align}</TextAlign>` : ''}</Style>
                </Paragraph>
              </Paragraphs>
              <Top>${top}</Top><Left>0cm</Left><Height>${altura}</Height><Width>${opts.width || '18cm'}</Width>
              <Style><Border><Style>None</Style></Border><PaddingLeft>2pt</PaddingLeft><PaddingRight>2pt</PaddingRight></Style>
            </Textbox>`;

/** Parâmetro com lista de valores e valor por defeito vindos de datasets. */
const parametro = (nome, tipo, prompt, valores, padrao, multi) => `
    <ReportParameter Name="${nome}">
      <DataType>${tipo}</DataType>
      <DefaultValue>
        <DataSetReference>
          <DataSetName>${padrao[0]}</DataSetName>
          <ValueField>${padrao[1]}</ValueField>
        </DataSetReference>
      </DefaultValue>
      <Prompt>${x(prompt)}</Prompt>
      <ValidValues>
        <DataSetReference>
          <DataSetName>${valores[0]}</DataSetName>
          <ValueField>${valores[1]}</ValueField>
          <LabelField>${valores[2]}</LabelField>
        </DataSetReference>
      </ValidValues>${multi ? `
      <MultiValue>true</MultiValue>` : ''}
    </ReportParameter>`;

/** Grelha do painel de parâmetros (uma linha, um parâmetro por coluna). */
const layoutParametros = nomes => `
  <ReportParametersLayout>
    <GridLayoutDefinition>
      <NumberOfColumns>${nomes.length}</NumberOfColumns>
      <NumberOfRows>1</NumberOfRows>
      <CellDefinitions>${nomes.map((n, i) => `
        <CellDefinition><ColumnIndex>${i}</ColumnIndex><RowIndex>0</RowIndex><ParameterName>${n}</ParameterName></CellDefinition>`).join('')}
      </CellDefinitions>
    </GridLayoutDefinition>
  </ReportParametersLayout>`;

/** Cabeçalho de página padrão: título, linha de contexto (ex.: parâmetros) e traço verde. */
const cabecalhoPagina = (titulo, subtitulo) => `
        <PageHeader>
          <Height>1.6cm</Height>
          <PrintOnFirstPage>true</PrintOnFirstPage>
          <PrintOnLastPage>true</PrintOnLastPage>
          <ReportItems>${textoSolto('Titulo', titulo, '0cm', '0.8cm', { size: '18pt', color: CORES.TEXTO })}${textoSolto('Periodo', subtitulo, '0.85cm', '0.5cm', { size: '10pt' })}
            <Line Name="LinhaTitulo">
              <Top>1.45cm</Top><Left>0cm</Left><Height>0cm</Height><Width>1.5cm</Width>
              <Style><Border><Color>${CORES.VERDE}</Color><Style>Solid</Style><Width>3pt</Width></Border></Style>
            </Line>
          </ReportItems>
          <Style><Border><Style>None</Style></Border></Style>
        </PageHeader>`;

/** Rodapé padrão: data de geração e "Página X de Y". */
const rodapePagina = () => `
        <PageFooter>
          <Height>0.7cm</Height>
          <PrintOnFirstPage>true</PrintOnFirstPage>
          <PrintOnLastPage>true</PrintOnLastPage>
          <ReportItems>${textoSolto('Rodape', '="Gerado em " & Format(Globals!ExecutionTime, "dd/MM/yyyy HH:mm") & "   ·   Página " & Globals!PageNumber & " de " & Globals!TotalPages', '0.1cm', '0.5cm', { size: '8pt', align: 'Right' })}
          </ReportItems>
          <Style><Border><Style>None</Style></Border></Style>
        </PageFooter>`;

/** Moldura A4 vertical com margens de 1,5 cm (largura útil 18 cm). */
const paginaA4 = `
        <PageHeight>29.7cm</PageHeight>
        <PageWidth>21cm</PageWidth>
        <InteractiveHeight>29.7cm</InteractiveHeight>
        <InteractiveWidth>21cm</InteractiveWidth>
        <LeftMargin>1.5cm</LeftMargin>
        <RightMargin>1.5cm</RightMargin>
        <TopMargin>1.5cm</TopMargin>
        <BottomMargin>1.5cm</BottomMargin>
        <Style />`;

/** Documento completo, na ordem que o Report Builder exige. */
const relatorio = ({ reportId, descricao, fontes, datasets, corpo, alturaCorpo, larguraCorpo = '18cm', cabecalho, rodape, pagina = paginaA4, parametros, layout }) => `<?xml version="1.0" encoding="utf-8"?>
<Report MustUnderstand="df"
  xmlns="http://schemas.microsoft.com/sqlserver/reporting/2016/01/reportdefinition"
  xmlns:rd="http://schemas.microsoft.com/SQLServer/reporting/reportdesigner"
  xmlns:df="http://schemas.microsoft.com/sqlserver/reporting/2016/01/reportdefinition/defaultfontfamily">
  <rd:ReportUnitType>Cm</rd:ReportUnitType>
  <rd:ReportID>${reportId}</rd:ReportID>
  <df:DefaultFontFamily>Segoe UI</df:DefaultFontFamily>
  <Description>${x(descricao)}</Description>
  <AutoRefresh>0</AutoRefresh>
  <DataSources>${fontes}
  </DataSources>
  <DataSets>${datasets}
  </DataSets>
  <ReportSections>
    <ReportSection>
      <Body>
        <ReportItems>${corpo}
        </ReportItems>
        <Height>${alturaCorpo}</Height>
        <Style />
      </Body>
      <Width>${larguraCorpo}</Width>
      <Page>${cabecalho}${rodape}${pagina}
      </Page>
    </ReportSection>
  </ReportSections>
  <ReportParameters>${parametros}
  </ReportParameters>${layout}
</Report>
`;

/** Grava com BOM UTF-8 (como as ferramentas da Microsoft). */
const gravar = (fs, caminho, conteudo) => fs.writeFileSync(caminho, '﻿' + conteudo, 'utf8');

module.exports = {
  CORES, x, guid, fonteOdbcPostgres, dataset, criarTextbox, cell, vazia, row, textoSolto,
  parametro, layoutParametros, cabecalhoPagina, rodapePagina, paginaA4, relatorio, gravar,
};
