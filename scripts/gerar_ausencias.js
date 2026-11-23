#!/usr/bin/env node
// Gera a página "Ausências por colaborador" do relatório rh: filtros na lateral (Ano, Mês,
// Departamento, Colaborador, Tipo), cartão com totais e uma matriz Colaborador → Tipo → Início
// com Fim e Dias úteis, subtotais por tipo e por colaborador e total geral.
// Usa o mesmo estilo da skill tabela-com-filtros.
// Uso: node scripts/gerar_ausencias.js
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const reportDir = path.join(__dirname, '..', 'rh', 'rh.Report');
const pagesDir = path.join(reportDir, 'definition', 'pages');
const PAGINA = 'Ausências por colaborador';

const VERDE = '#117865';
const W = 1920, H = 1080, M = 24, TOP = 88, SL_W = 240, SL_H = 96, GAP = 8, CARD_W = 440;
const F_FILTROS = 12, F_TABELA = 14;
const SCHEMA_VISUAL = 'https://developer.microsoft.com/json-schemas/fabric/item/report/definition/visualContainer/2.9.0/schema.json';

const readJson = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const writeJson = (f, o) => fs.writeFileSync(f, JSON.stringify(o, null, 2) + '\n');
const lit = v => ({ expr: { Literal: { Value: v } } });
const cor = h => ({ solid: { color: lit(`'${h}'`) } });
const pad = n => ({ top: lit(`${n}D`), bottom: lit(`${n}D`), left: lit(`${n}D`), right: lit(`${n}D`) });
const hash = k => crypto.createHash('sha1').update(k).digest('hex');
const colExpr = (t, c) => ({ Column: { Expression: { SourceRef: { Entity: t } }, Property: c } });
const col = (t, c, displayName) => ({ field: colExpr(t, c), queryRef: `${t}.${c}`, nativeQueryRef: c, ...(displayName ? { displayName } : {}) });
const med = (t, m, displayName) => ({ field: { Measure: { Expression: { SourceRef: { Entity: t } }, Property: m } }, queryRef: `${t}.${m}`, nativeQueryRef: m, ...(displayName ? { displayName } : {}) });

// ---------- Página ----------
const pagesJsonPath = path.join(pagesDir, 'pages.json');
const pagesJson = readJson(pagesJsonPath);
const existentes = pagesJson.pageOrder || [];
let pageId = existentes.find(id => {
  const f = path.join(pagesDir, id, 'page.json');
  return fs.existsSync(f) && readJson(f).displayName === PAGINA;
});
const pageSchema = existentes.map(id => path.join(pagesDir, id, 'page.json'))
  .filter(f => fs.existsSync(f)).map(f => readJson(f).$schema).find(Boolean);
if (!pageId) {
  pageId = hash(`rh:${PAGINA}`).slice(0, 20);
  fs.mkdirSync(path.join(pagesDir, pageId), { recursive: true });
  // Logo a seguir à listagem (antes do detalhe, que está escondido)
  const pos = Math.max(1, existentes.length - 1);
  pagesJson.pageOrder = [...existentes.slice(0, pos), pageId, ...existentes.slice(pos)];
  writeJson(pagesJsonPath, pagesJson);
}
const pageDir = path.join(pagesDir, pageId);
const visualsDir = path.join(pageDir, 'visuals');
fs.rmSync(visualsDir, { recursive: true, force: true });
fs.mkdirSync(visualsDir, { recursive: true });
writeJson(path.join(pageDir, 'page.json'), {
  $schema: pageSchema, name: pageId, displayName: PAGINA, displayOption: 'FitToPage', height: H, width: W,
});
const nome = k => hash(`${pageId}:${k}`).slice(0, 20);
const visuals = [];
let tab = 0;

// ---------- Título, barra e cartão ----------
visuals.push({
  $schema: SCHEMA_VISUAL, name: nome('titulo'),
  position: { x: M, y: 16, z: 0, height: 56, width: W - 3 * M - CARD_W, tabOrder: tab++ },
  visual: {
    visualType: 'textbox',
    objects: { general: [{ properties: { paragraphs: [{
      textRuns: [{ value: PAGINA, textStyle: { fontFamily: 'Segoe UI Semibold', fontSize: '28px', color: '#252423' } }],
      horizontalTextAlignment: 'left',
    }] } }] },
    visualContainerObjects: { background: [{ properties: { show: lit('false') } }], border: [{ properties: { show: lit('false') } }], padding: [{ properties: pad(0) }] },
  },
});
visuals.push({
  $schema: SCHEMA_VISUAL, name: nome('barra_titulo'),
  position: { x: M, y: 68, z: 1, height: 4, width: 56, tabOrder: tab++ },
  visual: {
    visualType: 'shape',
    objects: {
      shape: [{ properties: { tileShape: lit("'rectangle'") } }],
      fill: [{ properties: { fillColor: cor(VERDE), transparency: lit('0D') }, selector: { id: 'default' } }],
      outline: [{ properties: { show: lit('false') }, selector: { id: 'default' } }],
    },
    visualContainerObjects: { background: [{ properties: { show: lit('false') } }], border: [{ properties: { show: lit('false') } }], padding: [{ properties: pad(0) }] },
  },
});
visuals.push({
  $schema: SCHEMA_VISUAL, name: nome('totais'),
  position: { x: W - M - CARD_W, y: 4, z: 3, height: 76, width: CARD_W, tabOrder: tab++ },
  visual: {
    visualType: 'cardVisual',
    query: { queryState: { Data: { projections: [
      med('ausencias', 'Colaboradores com ausências', 'Colaboradores'),
      med('ausencias', 'Ausências'),
      med('ausencias', 'Dias úteis'),
    ] } } },
    objects: {
      value: [{ properties: { fontSize: lit('22D'), fontColor: cor(VERDE), horizontalAlignment: lit("'right'"), labelDisplayUnits: lit('1D'), labelPrecision: lit('0L') }, selector: { id: 'default' } }],
      label: [{ properties: { fontSize: lit('11D'), horizontalAlignment: lit("'right'") }, selector: { id: 'default' } }],
      outline: [{ properties: { show: lit('false') }, selector: { id: 'default' } }],
      padding: [{ properties: { paddingUniform: lit('4D') }, selector: { id: 'default' } }],
      layout: [{ properties: { paddingUniform: lit('0D') }, selector: { id: 'default' } }],
    },
    visualContainerObjects: { background: [{ properties: { show: lit('false') } }], border: [{ properties: { show: lit('false') } }], padding: [{ properties: pad(4) }] },
  },
});

// ---------- Filtros ----------
const filtros = [
  ['calendario', 'ano', 'Ano', false],
  ['calendario', 'nome_mes', 'Mês', false],
  ['colaboradores', 'departamento', 'Departamento', false],
  ['colaboradores', 'colaborador', 'Colaborador', true],
  ['ausencias', 'tipo', 'Tipo de ausência', false],
];
filtros.forEach(([t, c, label, search], i) => {
  visuals.push({
    $schema: SCHEMA_VISUAL, name: nome(`slicer_${i}_${c}`),
    position: { x: M, y: TOP + i * (SL_H + GAP), z: 1000 + i, height: SL_H, width: SL_W, tabOrder: tab++ },
    visual: {
      visualType: 'slicer',
      query: { queryState: { Values: { projections: [col(t, c)] } } },
      objects: {
        data: [{ properties: { mode: lit("'Dropdown'") } }],
        header: [{ properties: { show: lit('false') } }],
        items: [{ properties: { textSize: lit(`${F_FILTROS}D`) } }],
        general: [{ properties: { ...(search ? { selfFilterEnabled: lit('true') } : {}), responsive: lit('false') } }],
      },
      visualContainerObjects: {
        padding: [{ properties: pad(8) }],
        title: [{ properties: { show: lit('true'), text: lit(`'${label}'`), fontSize: lit(`${F_FILTROS}D`), fontFamily: lit("'Segoe UI Semibold'") } }],
      },
    },
  });
});

// ---------- Matriz ----------
// "active": true em cada nível = matriz expandida em todos os níveis (formato que o Desktop
// grava com "Expandir → Tudo"; confirmado lendo o ficheiro gravado pelo Desktop).
const linhas = [
  col('colaboradores', 'colaborador', 'Colaborador'),
  col('ausencias', 'tipo', 'Tipo'),
  col('ausencias', 'data_inicio', 'Início'),
].map(p => ({ ...p, active: true }));
const TB_X = M + SL_W + M;
visuals.push({
  $schema: SCHEMA_VISUAL, name: nome('matriz'),
  position: { x: TB_X, y: TOP, z: 2000, height: H - TOP - M, width: W - TB_X - M, tabOrder: tab++ },
  visual: {
    visualType: 'pivotTable',
    query: { queryState: {
      Rows: { projections: linhas },
      Values: { projections: [med('ausencias', 'Data de fim', 'Fim'), med('ausencias', 'Dias úteis')] },
    } },
    // Todos os níveis expandidos (Colaborador e Tipo abertos por defeito)
    expansionStates: [{
      roles: ['Rows'],
      // Uma entrada por nível; só o primeiro leva identityKeys (como o Desktop grava).
      levels: linhas.map((p, i) => ({
        queryRefs: [p.queryRef],
        ...(i === 0 ? { identityKeys: [p.field] } : {}),
        isPinned: true,
      })),
      root: {},
    }],
    objects: {
      rowHeaders: [{ properties: { stepped: lit('false'), fontSize: lit(`${F_TABELA}D`), showExpandCollapseButtons: lit('false') } }],
      columnHeaders: [{ properties: { fontSize: lit(`${F_TABELA}D`), columnAdjustment: lit("'growToFit'"), autoSizeColumnWidth: lit('true') } }],
      values: [{ properties: { fontSize: lit(`${F_TABELA}D`) } }],
      subTotals: [{ properties: { rowSubtotals: lit('true'), rowSubtotalsLabel: lit("'Total'"), fontSize: lit(`${F_TABELA}D`), bold: lit('true') }, selector: { id: 'Row' } }],
      grid: [{ properties: { outlineColor: cor(VERDE), outlineWeight: lit('2D') } }],
    },
  },
});

for (const v of visuals) {
  const dir = path.join(visualsDir, v.name);
  fs.mkdirSync(dir, { recursive: true });
  writeJson(path.join(dir, 'visual.json'), v);
}
// $schema que o Desktop remove ao gravar (sem ele a validação falha)
for (const [f, s] of [
  [path.join(reportDir, 'definition.pbir'), 'https://developer.microsoft.com/json-schemas/fabric/item/report/definitionProperties/2.0.0/schema.json'],
  [path.join(reportDir, '..', 'rh.pbip'), 'https://developer.microsoft.com/json-schemas/fabric/pbip/pbipProperties/1.0.0/schema.json'],
]) {
  const o = readJson(f);
  if (!o.$schema) writeJson(f, { $schema: s, ...o });
}

console.log(JSON.stringify({ page: PAGINA, pageId, visuais: visuals.length }, null, 2));
