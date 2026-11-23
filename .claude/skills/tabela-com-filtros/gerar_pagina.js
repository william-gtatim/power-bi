#!/usr/bin/env node
// Gera uma página PBIR padronizada de listagem: título + barra verde, cartão com o total
// à direita, filtros (listas suspensas) na lateral esquerda, tabela (tableEx) sem totais e,
// opcionalmente, uma página de detalhe (drillthrough).
//
// Uso: node gerar_pagina.js <spec.json>
//
// Spec (caminhos relativos ao ficheiro spec):
// {
//   "report": "../../rh/rh.Report",        // pasta .Report
//   "page": "Colaboradores",               // displayName da página (cria se não existir)
//   "title": "Colaboradores",              // opcional; por omissão = page
//   "table": "colaboradores",              // tabela do modelo semântico
//   "columns": [
//     { "field": "id", "label": "ID", "filter": "painel" },
//     { "field": "nome", "label": "Nome", "search": true },
//     { "field": "departamento", "label": "Departamento", "table": false }
//   ],
//   "detalhe": {                           // opcional: página de detalhe (ver gerar_detalhe.js)
//     "page": "Detalhe do colaborador", "drillthrough": "id",
//     "sections": [ { "title": "Identificação", "fields": [ { "field": "id", "label": "ID" } ] } ]
//   }
// }
//
// Por coluna:
// - "search": true   -> o filtro tem caixa de pesquisa (colunas com muitos valores)
// - "filter": false  -> sem filtro (só aparece na tabela)
// - "filter": "painel" -> filtro no painel Filtros do Power BI em vez da lateral
// - "table": false   -> não aparece na tabela (só como filtro)
// - "tipo": "texto"  -> CASO ESPECIAL: filtro de texto (não carrega lista). Só colunas de texto.
//
// Opções da página (os valores indicados são o padrão):
// - "total": { "field": <1.ª coluna>, "label": "Total de <título>" }  ou  false para não ter cartão
// - "larguraFiltros": 240                                   largura da lateral em px
// - "fonte": { "tabela": 14, "cabecalho": 14, "filtros": 12 }   tamanhos em pt (false = tema)
// - "maxFiltrosLateral": 10   acima disto, os filtros a mais vão para o painel Filtros (com aviso)
// - "aplicar": true   -> CASO ESPECIAL: botões "Aplicar filtros" / "Limpar filtros"
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
const TITLE_H = 56, TOP = 88, TOTAL_W = 280;
const FONTE = spec.fonte === false ? {} : { tabela: 14, cabecalho: 14, filtros: 12, ...(spec.fonte || {}) };
const SL_W = spec.larguraFiltros || 240;
const MAX_LATERAL = spec.maxFiltrosLateral || 10;
const TOTAL = spec.total === false ? null : {
  field: (spec.total && spec.total.field) || spec.columns[0].field,
  label: (spec.total && spec.total.label) || `Total de ${(spec.title || spec.page).toLowerCase()}`,
};
// Altura do filtro (lista suspensa): 60px de cabeçalho+caixa a 10pt, +8px por pt acima, +16 de padding.
const SL_H = FONTE.filtros ? Math.ceil((60 + 8 * Math.max(0, FONTE.filtros - 10) + 16) / 8) * 8 : 80;
const GAP = FONTE.filtros ? 8 : 16, BTN_H = 40;
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
let filtros = spec.columns.filter(c => c.filter !== false && c.filter !== 'painel');
const filtrosPainel = spec.columns.filter(c => c.filter === 'painel');
const avisos = [];
if (filtros.length > MAX_LATERAL) {
  const excesso = filtros.slice(MAX_LATERAL);
  filtros = filtros.slice(0, MAX_LATERAL);
  filtrosPainel.push(...excesso);
  avisos.push(`Mais de ${MAX_LATERAL} filtros na lateral: ${excesso.map(c => c.field).join(', ')} foram para o painel Filtros. Marque-os com "filter": "painel" na especificação (ou escolha outros para a lateral).`);
}
const colunasTabela = spec.columns.filter(c => c.table !== false);
const comBotoes = !!spec.aplicar && filtros.length > 0;
const altFiltros = TOP + filtros.length * SL_H + Math.max(0, filtros.length - 1) * GAP
  + (comBotoes ? GAP + BTN_H : 0) + M;
const PAGE_H = Math.max(PAGE_H_MIN, Math.ceil(altFiltros / 8) * 8);
const visuals = [];
let tab = 0;
const nome = k => crypto.createHash('sha1').update(`${pageId}:${k}`).digest('hex').slice(0, 20);

// Título
visuals.push({
  $schema: SCHEMAS.visual,
  name: nome('titulo'),
  position: { x: M, y: 16, z: 0, height: TITLE_H, width: PAGE_W - 2 * M - (TOTAL ? TOTAL_W + M : 0), tabOrder: tab++ },
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

// Cartão com o total de linhas (opcional), alinhado à direita do título
if (TOTAL) {
  const campo = TOTAL.field;
  visuals.push({
    $schema: SCHEMAS.visual,
    name: nome('total'),
    position: { x: PAGE_W - M - TOTAL_W, y: 4, z: 3, height: 76, width: TOTAL_W, tabOrder: tab++ },
    visual: {
      visualType: 'cardVisual',
      query: { queryState: { Data: { projections: [{
        field: { Aggregation: { Expression: { Column: { Expression: { SourceRef: { Entity: T } }, Property: campo } }, Function: 5 } },
        queryRef: `CountNonNull(${T}.${campo})`,
        nativeQueryRef: TOTAL.label,
        displayName: TOTAL.label,
      }] } } },
      objects: {
        // labelDisplayUnits 1 = "Nenhum": mostra 2.000 em vez de "2 Mil".
        value: [{ properties: { fontSize: lit('22D'), fontColor: cor(VERDE), horizontalAlignment: lit("'right'"),
          labelDisplayUnits: lit('1D'), labelPrecision: lit('0L') }, selector: { id: 'default' } }],
        label: [{ properties: { show: lit('true'), text: lit(`'${esc(TOTAL.label)}'`), fontSize: lit('11D'), horizontalAlignment: lit("'right'") }, selector: { id: 'default' } }],
        outline: [{ properties: { show: lit('false') }, selector: { id: 'default' } }],
        padding: [{ properties: { paddingUniform: lit('4D') }, selector: { id: 'default' } }],
        layout: [{ properties: { paddingUniform: lit('0D') }, selector: { id: 'default' } }],
      },
      visualContainerObjects: {
        background: [{ properties: { show: lit('false') } }],
        border: [{ properties: { show: lit('false') } }],
        padding: [{ properties: pad(4) }],
      },
    },
  });
}

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
  const position = { x: M, y: TOP + i * (SL_H + GAP), z: 1000 + i, height: SL_H, width: SL_W, tabOrder: tab++ };
  if (c.tipo === 'texto') {
    // Filtro de texto: título no VCO (o textSlicer não tem "header").
    visuals.push({
      $schema: SCHEMAS.visual,
      name: nome(`slicer_${i}_${c.field}`),
      position,
      visual: {
        visualType: 'textSlicer',
        query: { queryState: { Values: { projections: [col(c.field)] } } },
        objects: {
          inputText: [{ properties: { placeholder: lit(`'Pesquisar ${esc((c.label || c.field).toLowerCase())}…'`) } }],
        },
        // Aparência alinhada com os filtros em lista: sem cartão, sem subtítulo,
        // título pequeno em Semibold.
        visualContainerObjects: {
          title: [{ properties: {
            show: lit('true'), text: lit(`'${esc(c.label || c.field)}'`),
            fontSize: lit(`${FONTE.filtros || 10}D`), fontFamily: lit("'Segoe UI Semibold'"), bold: lit('false'),
          } }],
          subTitle: [{ properties: { show: lit('false') } }],
          background: [{ properties: { show: lit('false') } }],
          border: [{ properties: { show: lit('false') } }],
          dropShadow: [{ properties: { show: lit('false') } }],
          padding: [{ properties: pad(8) }],
        },
      },
    });
    return;
  }
  visuals.push({
    $schema: SCHEMAS.visual,
    name: nome(`slicer_${i}_${c.field}`),
    position,
    visual: {
      visualType: 'slicer',
      query: { queryState: { Values: { projections: [col(c.field)] } } },
      objects: {
        data: [{ properties: { mode: lit("'Dropdown'") } }],
        // Com tamanho próprio, o rótulo vai para o título do visual: o header.textSize do
        // slicer é ignorado pelo Desktop (confirmado por captura).
        header: [{ properties: FONTE.filtros
          ? { show: lit('false') }
          : { show: lit('true'), text: lit(`'${esc(c.label || c.field)}'`) } }],
        ...(FONTE.filtros ? { items: [{ properties: { textSize: lit(`${FONTE.filtros}D`) } }] } : {}),
        // Com tamanhos próprios, desliga o "responsivo" do tema (que reajusta o texto do filtro).
        ...((c.search || FONTE.filtros) ? { general: [{ properties: {
          ...(c.search ? { selfFilterEnabled: lit('true') } : {}),
          ...(FONTE.filtros ? { responsive: lit('false') } : {}),
        } }] } : {}),
      },
      visualContainerObjects: {
        padding: [{ properties: pad(8) }],
        ...(FONTE.filtros ? { title: [{ properties: {
          show: lit('true'), text: lit(`'${esc(c.label || c.field)}'`),
          fontSize: lit(`${FONTE.filtros}D`), fontFamily: lit("'Segoe UI Semibold'"),
        } }] } : {}),
      },
    },
  });
});

// Botões "Aplicar filtros" (verde) e "Limpar filtros" (contorno) por baixo dos filtros
if (comBotoes) {
  const y = TOP + filtros.length * (SL_H + GAP);
  const w = (SL_W - GAP) / 2;
  const botao = (chave, x, texto, acao, dica, primario) => ({
    $schema: SCHEMAS.visual,
    name: nome(chave),
    position: { x, y, z: 1500, height: BTN_H, width: w, tabOrder: tab++ },
    visual: {
      visualType: 'actionButton',
      objects: {
        text: [
          { properties: { show: lit('true') } },
          { properties: { text: lit(`'${texto}'`), fontSize: lit('11D'), fontColor: cor(primario ? '#FFFFFF' : VERDE), horizontalAlignment: lit("'center'") }, selector: { id: 'default' } },
        ],
        icon: [
          { properties: { show: lit('false') } },
          { properties: { placement: lit("'left'") }, selector: { id: 'default' } },
        ],
        fill: [
          { properties: { show: lit(primario ? 'true' : 'false') } },
          { properties: { fillColor: cor(VERDE) }, selector: { id: 'default' } },
        ],
        outline: [
          { properties: { show: lit(primario ? 'false' : 'true') } },
          { properties: { lineColor: cor(VERDE), weight: lit('1D') }, selector: { id: 'default' } },
        ],
        shape: [
          { properties: { tileShape: lit("'rectangleRounded'"), roundEdge: lit('6L') } },
          { properties: { tileShape: lit("'rectangleRounded'") }, selector: { id: 'default' } },
        ],
      },
      visualContainerObjects: {
        background: [{ properties: { show: lit('false') } }],
        border: [{ properties: { show: lit('false') } }],
        visualLink: [{ properties: { show: lit('true'), type: lit(`'${acao}'`), tooltip: lit(`'${dica}'`) } }],
      },
    },
    howCreated: 'InsertVisualButton',
  });
  visuals.push(botao('btn_aplicar', M, 'Aplicar filtros', 'ApplyAllSlicers', 'Aplicar as seleções dos filtros', true));
  visuals.push(botao('btn_limpar', M + w + GAP, 'Limpar filtros', 'ClearAllSlicers', 'Limpar todos os filtros da página', false));
}

// Tabela
const TB_X = filtros.length ? M + SL_W + M : M;
visuals.push({
  $schema: SCHEMAS.visual,
  name: nome('tabela'),
  position: { x: TB_X, y: TOP, z: 2000, height: PAGE_H - TOP - M, width: PAGE_W - TB_X - M, tabOrder: tab++ },
  visual: {
    visualType: 'tableEx',
    query: { queryState: { Values: { projections: colunasTabela.map(c => col(c.field, c.label)) } } },
    objects: {
      total: [{ properties: { totals: lit('false') } }],
      grid: [{ properties: { outlineColor: cor(VERDE), outlineWeight: lit('2D') } }],
      columnHeaders: [{ properties: { columnAdjustment: lit("'growToFit'"), autoSizeColumnWidth: lit('true'),
        ...(FONTE.cabecalho ? { fontSize: lit(`${FONTE.cabecalho}D`) } : {}) } }],
      ...(FONTE.tabela ? { values: [{ properties: { fontSize: lit(`${FONTE.tabela}D`) } }] } : {}),
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
// Filtros do painel (sem seleção): substituem os filtros de página anteriores.
if (filtrosPainel.length) {
  page.filterConfig = {
    filters: filtrosPainel.map((c, i) => ({
      name: 'Filter' + crypto.createHash('sha1').update(`${pageId}:painel_${i}_${c.field}`).digest('hex').slice(0, 20),
      displayName: c.label || c.field,
      field: { Column: { Expression: { SourceRef: { Entity: T } }, Property: c.field } },
      type: 'Categorical',
      howCreated: 'User',
    })),
  };
} else {
  delete page.filterConfig;
}
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

// ---------- Página de detalhe (drillthrough) ----------
let detalhe = null;
if (spec.detalhe) {
  detalhe = require('./gerar_detalhe.js').gerarDetalhe({ reportDir, table: T, ...spec.detalhe });
}

console.log(JSON.stringify({
  page: spec.page, pageId, criada, visuais: visuals.length,
  filtros: filtros.length,
  filtrosPainel: filtrosPainel.map(c => c.field),
  colunasTabela: colunasTabela.length,
  pesquisa: filtros.filter(c => c.search && c.tipo !== 'texto').map(c => c.field),
  texto: filtros.filter(c => c.tipo === 'texto').map(c => c.field),
  botoesAplicar: comBotoes,
  total: TOTAL && TOTAL.label,
  detalhe: detalhe && detalhe.page,
  altura: PAGE_H, pasta: pageDir,
  ...(avisos.length ? { avisos } : {}),
}, null, 2));
