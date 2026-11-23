#!/usr/bin/env node
// Executa ficheiros .sql no banco definido em DATABASE_URL (.env na raiz do projeto).
// Uso: node scripts/executar_sql.js rh/sql/01_esquema.sql rh/sql/02_dados.sql
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const raiz = path.join(__dirname, '..');
const env = Object.fromEntries(
  fs.readFileSync(path.join(raiz, '.env'), 'utf8')
    .split(/\r?\n/)
    .filter(l => l.trim() && !l.trim().startsWith('#') && l.includes('='))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
);
if (!env.DATABASE_URL) throw new Error('DATABASE_URL não definido no .env');

const ficheiros = process.argv.slice(2);
if (!ficheiros.length) {
  console.error('Uso: node scripts/executar_sql.js <ficheiro.sql> [...]');
  process.exit(1);
}

(async () => {
  // channel_binding não é suportado pelo driver pg; o SSL continua obrigatório.
  const url = env.DATABASE_URL.replace(/[?&]channel_binding=[^&]*/, '').replace('sslmode=require', 'sslmode=verify-full');
  const client = new Client({ connectionString: url, statement_timeout: 0 });
  await client.connect();
  try {
    for (const f of ficheiros) {
      const sql = fs.readFileSync(path.resolve(f), 'utf8');
      const t0 = Date.now();
      process.stdout.write(`${f} ... `);
      await client.query(sql);
      console.log(`ok (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
    }
  } finally {
    await client.end();
  }
})().catch(e => {
  console.error('\nERRO:', e.message);
  process.exit(1);
});
