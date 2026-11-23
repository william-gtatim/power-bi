-- Gera os dados fictícios de RH dentro do PostgreSQL.
-- Período: 2023-01-01 a 2026-10-31. Semente fixa: os dados são sempre os mesmos.
-- Corre numa só transação (necessário para setseed e tabelas temporárias com o pooler).

BEGIN;
SELECT setseed(0.42);

-- ---------------------------------------------------------------- Feriados
INSERT INTO rh.feriados (data, nome)
SELECT make_date(a, f.m, f.d), f.nome
FROM generate_series(2023, 2026) a
CROSS JOIN (VALUES
  (1, 1, 'Ano Novo'), (4, 25, 'Dia da Liberdade'), (5, 1, 'Dia do Trabalhador'),
  (6, 10, 'Dia de Portugal'), (8, 15, 'Assunção de Nossa Senhora'),
  (10, 5, 'Implantação da República'), (11, 1, 'Dia de Todos os Santos'),
  (12, 1, 'Restauração da Independência'), (12, 8, 'Imaculada Conceição'),
  (12, 25, 'Natal')
) AS f(m, d, nome)
UNION ALL
SELECT d::date, n FROM (VALUES
  ('2023-04-07', 'Sexta-feira Santa'), ('2024-03-29', 'Sexta-feira Santa'),
  ('2025-04-18', 'Sexta-feira Santa'), ('2026-04-03', 'Sexta-feira Santa'),
  ('2023-04-09', 'Páscoa'), ('2024-03-31', 'Páscoa'),
  ('2025-04-20', 'Páscoa'), ('2026-04-05', 'Páscoa'),
  ('2023-06-08', 'Corpo de Deus'), ('2024-05-30', 'Corpo de Deus'),
  ('2025-06-19', 'Corpo de Deus'), ('2026-06-04', 'Corpo de Deus')
) AS m(d, n);

-- ---------------------------------------------------------------- Calendário
INSERT INTO rh.calendario
SELECT d::date,
       extract(year FROM d), extract(quarter FROM d), extract(month FROM d),
       (ARRAY['janeiro','fevereiro','março','abril','maio','junho','julho',
              'agosto','setembro','outubro','novembro','dezembro'])[extract(month FROM d)],
       to_char(d, 'YYYY-MM'),
       extract(day FROM d), extract(isodow FROM d),
       (ARRAY['segunda-feira','terça-feira','quarta-feira','quinta-feira',
              'sexta-feira','sábado','domingo'])[extract(isodow FROM d)],
       f.data IS NOT NULL,
       extract(isodow FROM d) < 6 AND f.data IS NULL
FROM generate_series(date '2023-01-01', date '2026-10-31', interval '1 day') d
LEFT JOIN rh.feriados f ON f.data = d::date;

-- ---------------------------------------------------------------- Departamentos e cargos
INSERT INTO rh.departamentos VALUES
  (1, 'Direção Geral', 'Administração'), (2, 'Recursos Humanos', 'Corporativo'),
  (3, 'Financeiro', 'Corporativo'), (4, 'Tecnologia', 'Operações'),
  (5, 'Comercial', 'Negócio'), (6, 'Marketing', 'Negócio'),
  (7, 'Operações', 'Operações'), (8, 'Logística', 'Operações'),
  (9, 'Apoio ao Cliente', 'Negócio'), (10, 'Jurídico', 'Corporativo');

INSERT INTO rh.cargos
SELECT (d.id - 1) * 5 + n.nivel, d.id, n.nome || ' – ' || d.nome, n.nivel, n.nome, n.smin, n.smax
FROM rh.departamentos d
CROSS JOIN (VALUES
  (1, 'Assistente',    870, 1100), (2, 'Técnico',     1100, 1700),
  (3, 'Especialista', 1700, 2600), (4, 'Coordenador', 2600, 3800),
  (5, 'Diretor',      4000, 6500)
) AS n(nivel, nome, smin, smax);

-- ---------------------------------------------------------------- Colaboradores
-- 2000 pessoas: 1450 já na empresa em 2023-01-01 (ids 1-10 são os diretores),
-- 550 admitidas durante o período; cerca de 27% saem durante o período.
INSERT INTO rh.colaboradores
  (id, nome, sobrenome, sexo, data_nascimento, distrito, departamento_id, cargo_id,
   tipo_contrato, data_admissao, data_saida, motivo_saida)
WITH b AS (
  SELECT g AS id, random() r_dep, random() r_lvl, random() r_sex, random() r_nome,
         random() r_sob, random() r_dist, random() r_nasc, random() r_adm,
         random() r_sai, random() r_sai2, random() r_mot, random() r_ctr
  FROM generate_series(1, 2000) g
), d AS (
  SELECT b.*,
    CASE WHEN id <= 10 THEN id
         WHEN r_dep < 0.02 THEN 1  WHEN r_dep < 0.07 THEN 2  WHEN r_dep < 0.14 THEN 3
         WHEN r_dep < 0.29 THEN 4  WHEN r_dep < 0.44 THEN 5  WHEN r_dep < 0.50 THEN 6
         WHEN r_dep < 0.72 THEN 7  WHEN r_dep < 0.86 THEN 8  WHEN r_dep < 0.98 THEN 9
         ELSE 10 END AS dep,
    CASE WHEN id <= 10 THEN 5
         WHEN r_lvl < 0.30 THEN 1 WHEN r_lvl < 0.70 THEN 2 WHEN r_lvl < 0.90 THEN 3
         ELSE 4 END AS nivel,
    CASE WHEN r_sex < 0.52 THEN 'F' ELSE 'M' END AS sexo,
    date '2023-01-01' - (20 * 365 + floor(r_nasc * 44 * 365))::int AS nasc
  FROM b
), e AS (
  SELECT d.*,
    CASE WHEN id <= 1450
         THEN greatest(date '2005-01-01' + floor(r_adm * (date '2022-12-31' - date '2005-01-01'))::int,
                       (nasc + interval '18 years')::date)
         ELSE date '2023-01-01' + floor(r_adm * (date '2026-10-31' - date '2023-01-01'))::int
    END AS adm
  FROM d
), s AS (
  SELECT e.*, greatest(adm, date '2023-01-01') + 30 AS ini_saida FROM e
)
SELECT id,
  CASE WHEN sexo = 'F'
    THEN (ARRAY['Maria','Ana','Francisca','Beatriz','Inês','Sofia','Mariana','Catarina','Rita','Joana',
                'Carolina','Leonor','Matilde','Marta','Sara','Patrícia','Teresa','Helena','Cláudia','Raquel',
                'Lúcia','Isabel','Filipa','Margarida','Lara'])[1 + floor(r_nome * 25)::int]
    ELSE (ARRAY['João','José','António','Manuel','Pedro','Rui','Carlos','Miguel','Tiago','Luís',
                'Paulo','Ricardo','Bruno','André','Diogo','Nuno','Hugo','Gonçalo','Rafael','Duarte',
                'Fernando','Vítor','Sérgio','Daniel','Martim'])[1 + floor(r_nome * 25)::int]
  END,
  (ARRAY['Silva','Santos','Ferreira','Pereira','Oliveira','Costa','Rodrigues','Martins','Jesus','Sousa',
         'Fernandes','Gonçalves','Gomes','Lopes','Marques','Alves','Almeida','Ribeiro','Pinto','Carvalho',
         'Teixeira','Moreira','Correia','Mendes','Nunes','Soares','Vieira','Monteiro','Cardoso','Rocha',
         'Neves','Coelho','Cruz','Cunha','Pires','Ramos','Reis','Simões','Antunes','Matos',
         'Fonseca','Machado','Araújo','Barbosa','Tavares','Lourenço','Castro','Figueiredo','Azevedo','Freitas'])
    [1 + floor(r_sob * 50)::int],
  sexo, nasc,
  (ARRAY['Lisboa','Lisboa','Lisboa','Lisboa','Lisboa','Lisboa','Porto','Porto','Porto','Porto','Porto',
         'Braga','Braga','Setúbal','Setúbal','Aveiro','Aveiro','Coimbra','Coimbra','Leiria','Faro',
         'Viseu','Santarém','Viana do Castelo','Vila Real','Évora','Castelo Branco','Guarda',
         'Bragança','Beja'])[1 + floor(r_dist * 30)::int],
  dep, (dep - 1) * 5 + nivel,
  CASE WHEN r_ctr < 0.75 THEN 'Sem termo' WHEN r_ctr < 0.95 THEN 'Termo certo' ELSE 'Estágio' END,
  adm,
  CASE WHEN id > 10 AND r_sai < 0.27 AND ini_saida < date '2026-10-31'
       THEN ini_saida + floor(r_sai2 * (date '2026-10-31' - ini_saida))::int END,
  CASE WHEN id > 10 AND r_sai < 0.27 AND ini_saida < date '2026-10-31' THEN
    CASE WHEN r_mot < 0.60 THEN 'Demissão voluntária' WHEN r_mot < 0.75 THEN 'Despedimento'
         WHEN r_mot < 0.90 THEN 'Fim de contrato' ELSE 'Reforma' END END
FROM s;

-- Chefias: diretores sem chefia; coordenadores reportam ao diretor do departamento;
-- restantes reportam a um coordenador do departamento (ou ao diretor, se não houver).
UPDATE rh.colaboradores c
SET chefia_id = CASE
  WHEN k.nivel = 5 THEN NULL
  WHEN k.nivel = 4 THEN c.departamento_id
  ELSE coalesce((
    SELECT c2.id FROM rh.colaboradores c2 JOIN rh.cargos k2 ON k2.id = c2.cargo_id
    WHERE c2.departamento_id = c.departamento_id AND k2.nivel = 4 AND c2.id <> c.id
    ORDER BY abs(hashint4(c.id + c2.id)) LIMIT 1), c.departamento_id)
END
FROM rh.cargos k
WHERE k.id = c.cargo_id;

-- ---------------------------------------------------------------- Histórico salarial
-- Salário inicial na admissão; aumentos anuais a 1 de janeiro (2023-2026) enquanto contratado.
INSERT INTO rh.historico_salarial (colaborador_id, data_inicio, data_fim, salario, motivo)
WITH eventos AS (
  SELECT c.id, c.data_admissao AS dt, 0::float AS pct, 'Admissão' AS motivo,
         k.salario_min + random() * (k.salario_max - k.salario_min) AS base
  FROM rh.colaboradores c JOIN rh.cargos k ON k.id = c.cargo_id
  UNION ALL
  SELECT id, dt, pct, CASE WHEN pct >= 0.07 THEN 'Mérito' ELSE 'Aumento anual' END, NULL
  FROM (
    SELECT c.id, make_date(a, 1, 1) AS dt,
           CASE WHEN random() < 0.10 THEN 0.07 + random() * 0.05
                ELSE 0.02 + random() * 0.03 END AS pct
    FROM rh.colaboradores c
    CROSS JOIN generate_series(2023, 2026) a
    WHERE c.data_admissao < make_date(a, 1, 1)
      AND (c.data_saida IS NULL OR c.data_saida >= make_date(a, 1, 1))
  ) aumentos
), calc AS (
  SELECT id, dt, motivo,
         max(base) OVER (PARTITION BY id) * exp(sum(ln(1 + pct)) OVER (PARTITION BY id ORDER BY dt)) AS salario,
         lead(dt) OVER (PARTITION BY id ORDER BY dt) - 1 AS fim
  FROM eventos
)
SELECT id, dt, fim, round(salario::numeric, 2), motivo FROM calc;

-- ---------------------------------------------------------------- Ausências
-- Geradas por colaborador e ano, depois cortadas à janela em que estava contratado.
INSERT INTO rh.ausencias (colaborador_id, tipo, data_inicio, data_fim)
WITH anos AS (
  SELECT c.id, c.data_admissao, c.data_saida, a
  FROM rh.colaboradores c CROSS JOIN generate_series(2023, 2026) a
  WHERE c.data_admissao <= make_date(a, 12, 31)
    AND (c.data_saida IS NULL OR c.data_saida >= make_date(a, 1, 1))
), cand AS (
  -- Férias: bloco de verão (~10 dias úteis) e um segundo bloco (~8 dias úteis)
  SELECT id, data_admissao, data_saida, 'Férias' AS tipo,
         make_date(a, 7, 1) + floor(random() * 45)::int AS ini, 13 AS dur FROM anos
  UNION ALL
  SELECT id, data_admissao, data_saida, 'Férias',
         make_date(a, 1, 2) + floor(random() * 330)::int, 9 FROM anos
  UNION ALL  -- Baixa médica curta (35% por ano)
  SELECT id, data_admissao, data_saida, 'Baixa médica',
         make_date(a, 1, 1) + floor(random() * 360)::int, 1 + floor(random() * 20)::int
  FROM anos WHERE random() < 0.35
  UNION ALL  -- Baixa médica longa (3% por ano)
  SELECT id, data_admissao, data_saida, 'Baixa médica',
         make_date(a, 1, 1) + floor(random() * 300)::int, 60 + floor(random() * 60)::int
  FROM anos WHERE random() < 0.03
  UNION ALL  -- Faltas justificadas (até 3 por ano, um dia cada)
  SELECT id, data_admissao, data_saida, 'Falta justificada',
         make_date(a, 1, 1) + floor(random() * 364)::int, 0
  FROM anos CROSS JOIN generate_series(1, 3) WHERE random() < 0.30
  UNION ALL  -- Falta injustificada (8% por ano)
  SELECT id, data_admissao, data_saida, 'Falta injustificada',
         make_date(a, 1, 1) + floor(random() * 364)::int, 0
  FROM anos WHERE random() < 0.08
  UNION ALL  -- Licença parental (1,5% por ano, 120 dias)
  SELECT id, data_admissao, data_saida, 'Licença parental',
         make_date(a, 1, 1) + floor(random() * 300)::int, 119
  FROM anos WHERE random() < 0.015
)
SELECT id, tipo,
       greatest(ini, data_admissao, date '2023-01-01'),
       least(ini + dur, coalesce(data_saida, date '2026-10-31'), date '2026-10-31')
FROM cand
WHERE greatest(ini, data_admissao, date '2023-01-01')
   <= least(ini + dur, coalesce(data_saida, date '2026-10-31'), date '2026-10-31');

UPDATE rh.ausencias a
SET dias_uteis = (SELECT count(*) FROM rh.calendario c
                  WHERE c.dia_util AND c.data BETWEEN a.data_inicio AND a.data_fim);
DELETE FROM rh.ausencias WHERE dias_uteis = 0;

-- ---------------------------------------------------------------- Registos de ponto
-- Dia de ausência: prevalece Licença parental > Baixa médica > Férias > Faltas.
CREATE TEMP TABLE ausencia_dias ON COMMIT DROP AS
SELECT DISTINCT ON (a.colaborador_id, c.data) a.colaborador_id, c.data, a.tipo
FROM rh.ausencias a
JOIN rh.calendario c ON c.dia_util AND c.data BETWEEN a.data_inicio AND a.data_fim
ORDER BY a.colaborador_id, c.data,
  CASE a.tipo WHEN 'Licença parental' THEN 1 WHEN 'Baixa médica' THEN 2 WHEN 'Férias' THEN 3
              WHEN 'Falta justificada' THEN 4 ELSE 5 END;
CREATE INDEX ON ausencia_dias (colaborador_id, data);

INSERT INTO rh.registos_ponto (colaborador_id, data, estado, horas_trabalhadas, horas_extra)
SELECT co.id, c.data, coalesce(ad.tipo, 'Trabalho'),
       CASE WHEN ad.tipo IS NULL THEN CASE WHEN random() < 0.03 THEN 4 ELSE 8 END ELSE 0 END,
       CASE WHEN ad.tipo IS NULL AND random() <
              CASE co.departamento_id WHEN 4 THEN 0.20 WHEN 7 THEN 0.18 WHEN 8 THEN 0.16 ELSE 0.08 END
            THEN round((0.5 + random() * 2.5)::numeric * 2) / 2 ELSE 0 END
FROM rh.colaboradores co
JOIN rh.calendario c
  ON c.dia_util
 AND c.data BETWEEN greatest(co.data_admissao, date '2023-01-01')
                AND least(coalesce(co.data_saida, date '2026-10-31'), date '2026-10-31')
LEFT JOIN ausencia_dias ad ON ad.colaborador_id = co.id AND ad.data = c.data;

-- ---------------------------------------------------------------- Índices
CREATE INDEX ON rh.registos_ponto (data);
CREATE INDEX ON rh.ausencias (colaborador_id);
CREATE INDEX ON rh.historico_salarial (colaborador_id);
CREATE INDEX ON rh.colaboradores (departamento_id);

COMMIT;

ANALYZE rh.feriados, rh.calendario, rh.departamentos, rh.cargos, rh.colaboradores,
        rh.historico_salarial, rh.ausencias, rh.registos_ponto;
