#!/usr/bin/env node
// Testa uma consulta SQL no PostgreSQL do .env e mostra colunas, tipos e as primeiras linhas.
// Serve para confirmar o "contrato de dados" (nomes e tipos dos <Field>) antes de pôr a
// consulta no .rdl. O validador do RDL não verifica consultas nem nomes de campos.
// Uso (na raiz do projeto, que tem o .env e o pacote pg):
//   node .claude/skills/relatorio-paginado/testar_sql.js "SELECT ..."      [máx. linhas, por omissão 10]
//   node .claude/skills/relatorio-paginado/testar_sql.js ficheiro.sql
const fs = require('fs');
const path = require('path');
const { Client } = require(path.join(process.cwd(), 'node_modules', 'pg'));

const arg = process.argv[2];
const max = Number(process.argv[3] || 10);
if (!arg) { console.error('Uso: node testar_sql.js "<SQL>" | ficheiro.sql [máx. linhas]'); process.exit(1); }
const sql = fs.existsSync(arg) ? fs.readFileSync(arg, 'utf8') : arg;

const env = Object.fromEntries(fs.readFileSync(path.join(process.cwd(), '.env'), 'utf8')
  .split(/\r?\n/).filter(l => l.trim() && !l.trim().startsWith('#') && l.includes('='))
  .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));

// OIDs dos tipos mais comuns -> tipo .NET a usar em <rd:TypeName>
const TIPOS = { 16: 'System.Boolean', 20: 'System.Int64', 21: 'System.Int16 (usar System.Int32)', 23: 'System.Int32',
  25: 'System.String', 1043: 'System.String', 1082: 'System.DateTime', 1114: 'System.DateTime', 1184: 'System.DateTime',
  700: 'System.Single', 701: 'System.Double', 1700: 'System.Decimal' };

(async () => {
  const url = env.DATABASE_URL.replace(/[?&]channel_binding=[^&]*/, '').replace('sslmode=require', 'sslmode=verify-full');
  const c = new Client({ connectionString: url });
  await c.connect();
  try {
    const r = await c.query(sql);
    console.log(`${r.rowCount} linha(s)`);
    console.table(r.fields.map(f => ({ coluna: f.name, oid: f.dataTypeID, tipo_rdl: TIPOS[f.dataTypeID] || '?' })));
    console.table(r.rows.slice(0, max).map(o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v instanceof Date ? v.toISOString().slice(0, 10) : v]))));
  } finally { await c.end(); }
})().catch(e => { console.error('ERRO:', e.message); process.exit(1); });
