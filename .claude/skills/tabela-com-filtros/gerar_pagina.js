#!/usr/bin/env node
// Gera uma página PBIR padronizada: título + barra verde, filtros (slicers dropdown)
// na lateral esquerda e uma tabela (tableEx) com as colunas, sem totais.
//
// Uso: node gerar_pagina.js <spec.json>
//
// Spec (caminhos relativos ao ficheiro spec):
// {
//   "report": "../../clientes.Report",     // pasta .Report
//   "page": "Contatos",                    // displayName da página (cria se não existir)
//   "title": "Contatos",                   // opcional; por omissão = page
//   "table": "contatos",                   // tabela do modelo semântico
//   "columns": [
//     { "field": "id", "label": "ID", "search": true },
//     { "field": "cidade", "label": "Cidade", "search": false, "filter": true }
//   ]
// }
// - "filter": false  -> a coluna aparece na tabela mas não tem filtro lateral (por omissão true)
// - "search": true   -> o filtro tem caixa de pesquisa (use para colunas com muitos valores)
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const specPath = path.resolve(process.argv[2] || '');
if (!process.argv[2] || !fs.existsSync(specPath)) {
  console.error('Uso: node gerar_pagina.js <spec.json>');
  process.exit(1);
}
const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
for (const k of ['report', 'page', 'table', 'columns']) {
  if (!spec[k]) throw new Error(`spec sem "${k}"`);
}
const reportDir = path.resolve(path.dirname(specPath), spec.report);
const pagesDir = path.join(reportDir, 'definition', 'pages');
if (!fs.existsSync(pagesDir)) throw new Error(`Pasta de páginas não encontrada: ${pagesDir}`);

// ---------- Estilo padrão ----------
const VERDE = '#117865';
const PAGE_W = 1920, PAGE_H_MIN = 1080, M = 24;
const TITLE_H = 56, TOP = 88;
const SL_W = 320, SL_H = 80, GAP = 16;
const SCHEMAS = {
  visual: 'https://developer.microsoft.com/json-schemas/fabric/item/report/definition/visualContainer/2.9.0/schema.json',
  page: 'https://developer.microsoft.com/json-schemas/fabric/item/report/definition/page/2.1.0/schema.json',
  pbip: 'https://developer.microsoft.com/json-schemas/fabric/pbip/pbipProperties/1.0.0/schema.json',
  pbir: 'https://developer.microsoft.com/json-schemas/fabric/item/report/definitionProperties/2.0.0/schema.json',
};

// ---------- Helpers ----------
const readJson = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const writeJson = (f, o) => fs.writeFileSync(f, JSON.stringify(o, null, 2) + '\n');
const lit = v => ({ expr: { Literal: { Value: v } } });
const cor = h => ({ solid: { color: lit(`'${h}'`) } });
const pad = n => ({ top: lit(`${n}D`), bottom: lit(`${n}D`), left: lit(`${n}D`), right: lit(`${n}D`) });
const esc = s => String(s).replace(/'/g, "''");
const T = spec.table;
const col = (c, displayName) => ({
  ...(displayName ? { displayName } : {}),
  field: { Column: { Expression: { SourceRef: { Entity: T } }, Property: c } },
  queryRef: `${T}.${c}`,
  nativeQueryRef: c,
});
const hex20 = () => crypto.randomBytes(10).toString('hex');

// ---------- Página: localizar ou criar ----------
const pagesJsonPath = path.join(pagesDir, 'pages.json');
const pagesJson = readJson(pagesJsonPath);
let pageId = (pagesJson.pageOrder || []).find(id => {
  const f = path.join(pagesDir, id, 'page.json');
  return fs.existsSync(f) && readJson(f).displayName === spec.page;
});
const criada = !pageId;
const pageSchema = (() => {
  for (const id of pagesJson.pageOrder || []) {
    const f = path.join(pagesDir, id, 'page.json');
    if (fs.existsSync(f) && readJson(f).$schema) return readJson(f).$schema;
  }
  return SCHEMAS.page;
})();
if (criada) {
  pageId = hex20();
  fs.mkdirSync(path.join(pagesDir, pageId), { recursive: true });
  pagesJson.pageOrder = [...(pagesJson.pageOrder || []), pageId];
  if (!pagesJson.activePageName) pagesJson.activePageName = pageId;
  writeJson(pagesJsonPath, pagesJson);
}
const pageDir = path.join(pagesDir, pageId);
const visualsDir = path.join(pageDir, 'visuals');

// A página pertence a esta skill: os visuais antigos são substituídos.
fs.rmSync(visualsDir, { recursive: true, force: true });
fs.mkdirSync(visualsDir, { recursive: true });

// ---------- Layout ----------
const filtros = spec.columns.filter(c => c.filter !== false);
const altFiltros = TOP + filtros.length * SL_H + Math.max(0, filtros.length - 1) * GAP + M;
const PAGE_H = Math.max(PAGE_H_MIN, Math.ceil(altFiltros / 8) * 8);
const visuals = [];
let tab = 0;
const nome = k => crypto.createHash('sha1').update(`${pageId}:${k}`).digest('hex').slice(0, 20);

// Título
visuals.push({
  $schema: SCHEMAS.visual,
  name: nome('titulo'),
  position: { x: M, y: 16, z: 0, height: TITLE_H, width: PAGE_W - 2 * M, tabOrder: tab++ },
  visual: {
    visualType: 'textbox',
    objects: {
      general: [{ properties: { paragraphs: [{
        textRuns: [{ value: spec.title || spec.page, textStyle: { fontFamily: 'Segoe UI Semibold', fontSize: '28px', color: '#252423' } }],
        horizontalTextAlignment: 'left',
      }] } }],
    },
    visualContainerObjects: {
      background: [{ properties: { show: lit('false') } }],
      border: [{ properties: { show: lit('false') } }],
      padding: [{ properties: pad(0) }],
    },
  },
});

// Barra verde sob o título
visuals.push({
  $schema: SCHEMAS.visual,
  name: nome('barra_titulo'),
  position: { x: M, y: 68, z: 1, height: 4, width: 56, tabOrder: tab++ },
  visual: {
    visualType: 'shape',
    objects: {
      shape: [{ properties: { tileShape: lit("'rectangle'") } }],
      fill: [{ properties: { fillColor: cor(VERDE), transparency: lit('0D') }, selector: { id: 'default' } }],
      outline: [{ properties: { show: lit('false') }, selector: { id: 'default' } }],
    },
    visualContainerObjects: {
      background: [{ properties: { show: lit('false') } }],
      border: [{ properties: { show: lit('false') } }],
      padding: [{ properties: pad(0) }],
    },
  },
});

// Filtros laterais
filtros.forEach((c, i) => {
  visuals.push({
    $schema: SCHEMAS.visual,
    name: nome(`slicer_${i}_${c.field}`),
    position: { x: M, y: TOP + i * (SL_H + GAP), z: 1000 + i, height: SL_H, width: SL_W, tabOrder: tab++ },
    visual: {
      visualType: 'slicer',
      query: { queryState: { Values: { projections: [col(c.field)] } } },
      objects: {
        data: [{ properties: { mode: lit("'Dropdown'") } }],
        header: [{ properties: { show: lit('true'), text: lit(`'${esc(c.label || c.field)}'`) } }],
        ...(c.search ? { general: [{ properties: { selfFilterEnabled: lit('true') } }] } : {}),
      },
      visualContainerObjects: { padding: [{ properties: pad(8) }] },
    },
  });
});

// Tabela
const TB_X = filtros.length ? M + SL_W + M : M;
visuals.push({
  $schema: SCHEMAS.visual,
  name: nome('tabela'),
  position: { x: TB_X, y: TOP, z: 2000, height: PAGE_H - TOP - M, width: PAGE_W - TB_X - M, tabOrder: tab++ },
  visual: {
    visualType: 'tableEx',
    query: { queryState: { Values: { projections: spec.columns.map(c => col(c.field, c.label)) } } },
    objects: {
      total: [{ properties: { totals: lit('false') } }],
      grid: [{ properties: { outlineColor: cor(VERDE), outlineWeight: lit('2D') } }],
      columnHeaders: [{ properties: { columnAdjustment: lit("'growToFit'"), autoSizeColumnWidth: lit('true') } }],
    },
  },
});

for (const v of visuals) {
  const dir = path.join(visualsDir, v.name);
  fs.mkdirSync(dir, { recursive: true });
  writeJson(path.join(dir, 'visual.json'), v);
}

// ---------- page.json ----------
const pageFile = path.join(pageDir, 'page.json');
const page = fs.existsSync(pageFile) ? readJson(pageFile) : { $schema: pageSchema, name: pageId };
Object.assign(page, { displayName: spec.page, displayOption: 'FitToPage', height: PAGE_H, width: PAGE_W });
writeJson(pageFile, page);

// ---------- $schema que o Desktop remove ao gravar ----------
const garantirSchema = (f, s) => {
  if (!fs.existsSync(f)) return;
  const o = readJson(f);
  if (o.$schema) return;
  writeJson(f, { $schema: s, ...o });
};
garantirSchema(path.join(reportDir, 'definition.pbir'), SCHEMAS.pbir);
const pbipDir = path.dirname(reportDir);
const reportBase = path.basename(reportDir).replace(/\.Report$/, '');
garantirSchema(path.join(pbipDir, `${reportBase}.pbip`), SCHEMAS.pbip);

console.log(JSON.stringify({
  page: spec.page, pageId, criada, visuais: visuals.length,
  filtros: filtros.length, pesquisa: filtros.filter(c => c.search).map(c => c.field),
  altura: PAGE_H, pasta: pageDir,
}, null, 2));
