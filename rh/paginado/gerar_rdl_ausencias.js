#!/usr/bin/env node
// Gera rh/paginado/ausencias_colaborador.rdl: relatório paginado (Power BI Report Builder)
// com uma página por colaborador e as ausências do mês escolhido, ligado ao PostgreSQL (Neon)
// por ODBC. As credenciais são pedidas ao executar (não ficam no ficheiro).
// Usa as funções da skill relatorio-paginado (.claude/skills/relatorio-paginado/rdl.js).
// Uso: node rh/paginado/gerar_rdl_ausencias.js
const fs = require('fs');
const path = require('path');
const R = require('../../.claude/skills/relatorio-paginado/rdl.js');

const SAIDA = path.join(__dirname, 'ausencias_colaborador.rdl');
const REPORT_ID = '9327dbe9-0536-4782-8eb1-7ebf445e6ba1';      // fixo para este relatório
const DATASOURCE_ID = 'bd782221-4039-4f28-a879-a67d0aab4011';
const { VERDE, CINZA } = R.CORES;
const textbox = R.criarTextbox();
const { cell, vazia, row } = R;

// ---------- Consultas (expressões VB: o ODBC não expande parâmetros multi-valor) ----------
const filtroMes = `to_char(a.data_inicio, 'YYYY-MM') = '" & Replace(Parameters!Mes.Value, "'", "''") & "'`;
const SQL_MESES = `SELECT DISTINCT c.ano_mes, c.nome_mes || ' de ' || c.ano AS rotulo
FROM rh.calendario c
WHERE EXISTS (SELECT 1 FROM rh.ausencias a WHERE to_char(a.data_inicio, 'YYYY-MM') = c.ano_mes)
ORDER BY c.ano_mes DESC`;
const SQL_COLABORADORES = `="SELECT DISTINCT c.id, c.colaborador FROM rh.vw_colaboradores c JOIN rh.ausencias a ON a.colaborador_id = c.id WHERE ${filtroMes} ORDER BY c.colaborador"`;
const SQL_PADRAO = `="SELECT c.id FROM rh.vw_colaboradores c JOIN rh.ausencias a ON a.colaborador_id = c.id WHERE ${filtroMes} GROUP BY c.id, c.colaborador ORDER BY count(*) DESC, c.colaborador LIMIT 3"`;
const SQL_AUSENCIAS = `="SELECT c.id AS colaborador_id, c.colaborador, c.departamento, c.cargo, a.tipo, a.data_inicio, a.data_fim, a.dias_uteis FROM rh.ausencias a JOIN rh.vw_colaboradores c ON c.id = a.colaborador_id WHERE ${filtroMes} AND c.id IN (" & Join(Parameters!Colaboradores.Value, ",") & ") ORDER BY c.colaborador, a.tipo, a.data_inicio"`;

// Colunas: Tipo | Início | Fim | Dias úteis  (18 cm = A4 21 cm - 2 x 1,5 cm)
const larguras = ['8cm', '3.5cm', '3.5cm', '3cm'];
const linhas = [
  // 0: nome do colaborador (cabeçalho do grupo)
  row('0.9cm', [cell(textbox('=Fields!colaborador.Value', { nome: 'Colaborador', bold: true, size: '16pt', color: VERDE, borda: false, padTop: '6pt' }), 4), vazia, vazia, vazia]),
  // 1: departamento e cargo
  row('0.7cm', [cell(textbox('=Fields!departamento.Value & "  ·  " & Fields!cargo.Value', { nome: 'DeptCargo', color: CINZA, borda: false }), 4), vazia, vazia, vazia]),
  // 2: cabeçalhos das colunas. Não usar RepeatOnNewPage só nesta linha: o Report Builder exige
  //    o mesmo valor em todas as linhas fixas à volta do grupo dinâmico (erro "invalid TablixMember").
  row('0.7cm', [
    cell(textbox('Tipo', { nome: 'HdrTipo', bold: true, color: '#FFFFFF', bg: VERDE, borda: false })),
    cell(textbox('Início', { nome: 'HdrInicio', bold: true, color: '#FFFFFF', bg: VERDE, borda: false })),
    cell(textbox('Fim', { nome: 'HdrFim', bold: true, color: '#FFFFFF', bg: VERDE, borda: false })),
    cell(textbox('Dias úteis', { nome: 'HdrDias', bold: true, color: '#FFFFFF', bg: VERDE, borda: false, align: 'Right' })),
  ]),
  // 3: detalhe (uma ausência)
  row('0.6cm', [
    cell(textbox('=Fields!tipo.Value', { nome: 'Tipo' })),
    cell(textbox('=Fields!data_inicio.Value', { nome: 'Inicio', format: 'dd/MM/yyyy' })),
    cell(textbox('=Fields!data_fim.Value', { nome: 'Fim', format: 'dd/MM/yyyy' })),
    cell(textbox('=Fields!dias_uteis.Value', { nome: 'Dias', align: 'Right', format: '#,0' })),
  ]),
  // 4: subtotal por tipo
  row('0.6cm', [
    cell(textbox('="Subtotal " & Fields!tipo.Value', { nome: 'SubTipo', bold: true, color: CINZA }), 3), vazia, vazia,
    cell(textbox('=Sum(Fields!dias_uteis.Value)', { nome: 'SubDias', bold: true, color: CINZA, align: 'Right', format: '#,0' })),
  ]),
  // 5: total do colaborador
  row('0.8cm', [
    cell(textbox('Total do colaborador', { nome: 'TotColab', bold: true, size: '11pt', color: VERDE, borda: false, padTop: '6pt' }), 3), vazia, vazia,
    cell(textbox('=Sum(Fields!dias_uteis.Value)', { nome: 'TotDias', bold: true, size: '11pt', color: VERDE, borda: false, align: 'Right', format: '#,0', padTop: '6pt' })),
  ]),
];

// Hierarquia de linhas: grupo Colaborador (quebra de página entre grupos) → linhas 0-2 fixas
// → grupo Tipo → Detalhe + subtotal → linha 5 (total). Membros-folha = 6 = n.º de linhas.
const tablix = `
          <Tablix Name="AusenciasPorColaborador">
            <TablixBody>
              <TablixColumns>${larguras.map(w => `
                <TablixColumn><Width>${w}</Width></TablixColumn>`).join('')}
              </TablixColumns>
              <TablixRows>${linhas.join('')}
              </TablixRows>
            </TablixBody>
            <TablixColumnHierarchy>
              <TablixMembers>${larguras.map(() => `
                <TablixMember />`).join('')}
              </TablixMembers>
            </TablixColumnHierarchy>
            <TablixRowHierarchy>
              <TablixMembers>
                <TablixMember>
                  <Group Name="PorColaborador">
                    <GroupExpressions><GroupExpression>=Fields!colaborador_id.Value</GroupExpression></GroupExpressions>
                    <PageBreak><BreakLocation>Between</BreakLocation></PageBreak>
                  </Group>
                  <SortExpressions><SortExpression><Value>=Fields!colaborador.Value</Value></SortExpression></SortExpressions>
                  <TablixMembers>
                    <TablixMember><KeepWithGroup>After</KeepWithGroup></TablixMember>
                    <TablixMember><KeepWithGroup>After</KeepWithGroup></TablixMember>
                    <TablixMember><KeepWithGroup>After</KeepWithGroup></TablixMember>
                    <TablixMember>
                      <Group Name="PorTipo">
                        <GroupExpressions><GroupExpression>=Fields!tipo.Value</GroupExpression></GroupExpressions>
                      </Group>
                      <SortExpressions><SortExpression><Value>=Fields!tipo.Value</Value></SortExpression></SortExpressions>
                      <TablixMembers>
                        <TablixMember>
                          <Group Name="Detalhe" />
                          <SortExpressions><SortExpression><Value>=Fields!data_inicio.Value</Value></SortExpression></SortExpressions>
                        </TablixMember>
                        <TablixMember><KeepWithGroup>Before</KeepWithGroup></TablixMember>
                      </TablixMembers>
                    </TablixMember>
                    <TablixMember><KeepWithGroup>Before</KeepWithGroup></TablixMember>
                  </TablixMembers>
                </TablixMember>
              </TablixMembers>
            </TablixRowHierarchy>
            <NoRowsMessage>Sem ausências para os colaboradores e o mês escolhidos.</NoRowsMessage>
            <DataSetName>Ausencias</DataSetName>
            <Top>0cm</Top>
            <Left>0cm</Left>
            <Height>4.3cm</Height>
            <Width>18cm</Width>
            <Style><Border><Style>None</Style></Border></Style>
          </Tablix>`;

const rdl = R.relatorio({
  reportId: REPORT_ID,
  descricao: 'Ausências por colaborador num mês (uma página por colaborador). Gerado por rh/paginado/gerar_rdl_ausencias.js.',
  fontes: R.fonteOdbcPostgres({
    nome: 'Neon', servidor: 'ep-blue-pond-beysn29j-pooler.c-9.us-east-2.aws.neon.tech', base: 'neondb',
    id: DATASOURCE_ID, prompt: 'Utilizador e password do PostgreSQL (Neon):',
  }),
  datasets: [
    R.dataset('dsMeses', SQL_MESES, [['ano_mes', 'System.String'], ['rotulo', 'System.String']]),
    R.dataset('dsColaboradores', SQL_COLABORADORES, [['id', 'System.Int32'], ['colaborador', 'System.String']]),
    R.dataset('dsColaboradoresPadrao', SQL_PADRAO, [['id', 'System.Int32']]),
    R.dataset('Ausencias', SQL_AUSENCIAS, [
      ['colaborador_id', 'System.Int32'], ['colaborador', 'System.String'], ['departamento', 'System.String'],
      ['cargo', 'System.String'], ['tipo', 'System.String'], ['data_inicio', 'System.DateTime'],
      ['data_fim', 'System.DateTime'], ['dias_uteis', 'System.Int32']]),
  ].join(''),
  corpo: tablix,
  alturaCorpo: '4.3cm',
  cabecalho: R.cabecalhoPagina('Relatório de ausências', '="Mês: " & Parameters!Mes.Label'),
  rodape: R.rodapePagina(),
  parametros: [
    R.parametro('Mes', 'String', 'Mês', ['dsMeses', 'ano_mes', 'rotulo'], ['dsMeses', 'ano_mes'], false),
    R.parametro('Colaboradores', 'Integer', 'Colaboradores', ['dsColaboradores', 'id', 'colaborador'], ['dsColaboradoresPadrao', 'id'], true),
  ].join(''),
  layout: R.layoutParametros(['Mes', 'Colaboradores']),
});

R.gravar(fs, SAIDA, rdl);
console.log('Gerado:', SAIDA);
