#!/usr/bin/env node
// Gera a página de detalhe (drillthrough) da skill tabela-com-filtros: seta de voltar ao lado
// do título (estilo app móvel), barra verde e um cartão multi-valor por secção.
// É chamada pelo gerar_pagina.js quando a especificação tem "detalhe"; também pode correr sozinha:
//   node gerar_detalhe.js <spec.json>   (spec com "report", "table" e os campos de "detalhe")
//
// "detalhe": {
//   "page": "Detalhe do colaborador",     // nome da página (fica escondida nos separadores)
//   "title": "Detalhe do colaborador",    // opcional; por omissão = page
//   "drillthrough": "id",                 // coluna que liga a página à linha escolhida
//   "sections": [ { "title": "Identificação", "fields": [ { "field": "id", "label": "ID" } ] } ]
// }
// Os valores usam Min() da coluna: com o drillthrough há uma só linha, por isso é o valor dela.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const VERDE = '#117865';
const W = 1920, H = 1080, M = 24, TOP = 104, CARD_H = 148, GAP = 24, BTN = 48;
const SCHEMA_VISUAL = 'https://developer.microsoft.com/json-schemas/fabric/item/report/definition/visualContainer/2.9.0/schema.json';

function gerarDetalhe(spec) {
const reportDir = spec.reportDir;
const T = spec.table;
const pagesDir = path.join(reportDir, 'definition', 'pages');


const readJson = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const writeJson = (f, o) => fs.writeFileSync(f, JSON.stringify(o, null, 2) + '\n');
const lit = v => ({ expr: { Literal: { Value: v } } });
const cor = h => ({ solid: { color: lit(`'${h}'`) } });
const pad = n => ({ top: lit(`${n}D`), bottom: lit(`${n}D`), left: lit(`${n}D`), right: lit(`${n}D`) });
const esc = s => String(s).replace(/'/g, "''");
const colRef = c => ({ Column: { Expression: { SourceRef: { Entity: T } }, Property: c } });
const hash = k => crypto.createHash('sha1').update(k).digest('hex');

// ---------- Página ----------
const pagesJsonPath = path.join(pagesDir, 'pages.json');
const pagesJson = readJson(pagesJsonPath);
const existentes = pagesJson.pageOrder || [];
let pageId = existentes.find(id => {
  const f = path.join(pagesDir, id, 'page.json');
  return fs.existsSync(f) && readJson(f).displayName === spec.page;
});
const pageSchema = existentes.map(id => path.join(pagesDir, id, 'page.json'))
  .filter(f => fs.existsSync(f)).map(f => readJson(f).$schema).find(Boolean);
if (!pageId) {
  pageId = hash(`${T}:${spec.page}`).slice(0, 20);
  fs.mkdirSync(path.join(pagesDir, pageId), { recursive: true });
  pagesJson.pageOrder = [...existentes, pageId];
  writeJson(pagesJsonPath, pagesJson);
}
const pageDir = path.join(pagesDir, pageId);
const visualsDir = path.join(pageDir, 'visuals');
fs.rmSync(visualsDir, { recursive: true, force: true });
fs.mkdirSync(visualsDir, { recursive: true });
const nome = k => hash(`${pageId}:${k}`).slice(0, 20);

const filtroNome = 'Filter' + hash(`${pageId}:drill:${spec.drillthrough}`).slice(0, 20);
writeJson(path.join(pageDir, 'page.json'), {
  $schema: pageSchema,
  name: pageId,
  displayName: spec.page,
  displayOption: 'FitToPage',
  height: H,
  width: W,
  visibility: 'HiddenInViewMode',
  filterConfig: {
    filters: [{ name: filtroNome, field: colRef(spec.drillthrough), type: 'Categorical', howCreated: 'Drillthrough' }],
  },
  pageBinding: {
    name: 'Pod',
    type: 'Drillthrough',
    parameters: [{ name: `Param_${filtroNome}`, boundFilter: filtroNome, fieldExpr: colRef(spec.drillthrough) }],
  },
});

// ---------- Visuais ----------
const visuals = [];
let tab = 0;

visuals.push({
  $schema: SCHEMA_VISUAL,
  name: nome('titulo'),
  position: { x: M + BTN, y: 16, z: 0, height: 56, width: W - 2 * M - BTN, tabOrder: tab++ },
  visual: {
    visualType: 'textbox',
    objects: { general: [{ properties: { paragraphs: [{
      textRuns: [{ value: spec.title || spec.page, textStyle: { fontFamily: 'Segoe UI Semibold', fontSize: '28px', color: '#252423' } }],
      horizontalTextAlignment: 'left',
    }] } }] },
    visualContainerObjects: {
      background: [{ properties: { show: lit('false') } }],
      border: [{ properties: { show: lit('false') } }],
      padding: [{ properties: pad(0) }],
    },
  },
});

visuals.push({
  $schema: SCHEMA_VISUAL,
  name: nome('barra_titulo'),
  position: { x: M + BTN, y: 68, z: 1, height: 4, width: 56, tabOrder: tab++ },
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

// Botão Voltar (obrigatório numa página de drillthrough): só a seta, à esquerda do título,
// como nas apps móveis.
visuals.push({
  $schema: SCHEMA_VISUAL,
  name: nome('btn_voltar'),
  position: { x: M - 8, y: 18, z: 2, height: 48, width: 48, tabOrder: tab++ },
  visual: {
    visualType: 'actionButton',
    objects: {
      text: [
        { properties: { show: lit('false') } },
      ],
      icon: [
        { properties: { show: lit('true') } },
        { properties: { shapeType: lit("'back'"), lineColor: cor(VERDE), iconSize: lit('28D'), lineWeight: lit('2L') }, selector: { id: 'default' } },
      ],
      fill: [
        { properties: { show: lit('false') } },
      ],
      outline: [
        { properties: { show: lit('false') } },
      ],
      shape: [
        { properties: { tileShape: lit("'rectangleRounded'"), roundEdge: lit('6L') } },
        { properties: { tileShape: lit("'rectangleRounded'") }, selector: { id: 'default' } },
      ],
    },
    visualContainerObjects: {
      background: [{ properties: { show: lit('false') } }],
      border: [{ properties: { show: lit('false') } }],
      visualLink: [{ properties: { show: lit('true'), type: lit("'Back'"), tooltip: lit("'Voltar à listagem'") } }],
    },
  },
  howCreated: 'InsertVisualButton',
});

// Um cartão (multi-valor) por secção; colunas de texto/data via Min (= o único valor da pessoa).
spec.sections.forEach((s, i) => {
  visuals.push({
    $schema: SCHEMA_VISUAL,
    name: nome(`secao_${i}`),
    position: { x: M, y: TOP + i * (CARD_H + GAP), z: 100 + i, height: CARD_H, width: W - 2 * M, tabOrder: tab++ },
    visual: {
      visualType: 'cardVisual',
      query: { queryState: { Data: { projections: s.fields.map(f => ({
        field: { Aggregation: { Expression: colRef(f.field), Function: 3 } },
        queryRef: `Min(${T}.${f.field})`,
        nativeQueryRef: f.label || f.field,
        displayName: f.label || f.field,
      })) } } },
      objects: {
        value: [{ properties: { fontSize: lit('18D'), horizontalAlignment: lit("'left'") }, selector: { id: 'default' } }],
        label: [{ properties: { fontSize: lit('13D'), horizontalAlignment: lit("'left'") }, selector: { id: 'default' } }],
        outline: [{ properties: { show: lit('false') }, selector: { id: 'default' } }],
        padding: [{ properties: { paddingUniform: lit('8D') }, selector: { id: 'default' } }],
        layout: [{ properties: { paddingUniform: lit('0D') }, selector: { id: 'default' } }],
      },
      visualContainerObjects: {
        title: [{ properties: {
          show: lit('true'), text: lit(`'${esc(s.title)}'`),
          fontSize: lit('14D'), fontFamily: lit("'Segoe UI Semibold'"), fontColor: cor(VERDE),
        } }],
        padding: [{ properties: pad(8) }],
      },
    },
  });
});

for (const v of visuals) {
  const dir = path.join(visualsDir, v.name);
  fs.mkdirSync(dir, { recursive: true });
  writeJson(path.join(dir, 'visual.json'), v);
}
return { page: spec.page, pageId, visuais: visuals.length, secoes: spec.sections.length };
}

module.exports = { gerarDetalhe };

if (require.main === module) {
  const specPath = path.resolve(process.argv[2] || '');
  if (!process.argv[2] || !fs.existsSync(specPath)) {
    console.error('Uso: node gerar_detalhe.js <spec.json>');
    process.exit(1);
  }
  const s = JSON.parse(fs.readFileSync(specPath, 'utf8'));
  const d = s.detalhe || s;
  const r = gerarDetalhe({ ...d, table: s.table, reportDir: path.resolve(path.dirname(specPath), s.report) });
  console.log(JSON.stringify(r, null, 2));
}
