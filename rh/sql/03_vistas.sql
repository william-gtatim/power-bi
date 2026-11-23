-- Vistas para o Power BI: substituem ids pelos nomes das tabelas relacionadas.

CREATE OR REPLACE VIEW rh.vw_colaboradores AS
SELECT
  c.id,
  c.nome,
  c.sobrenome,
  c.nome || ' ' || c.sobrenome || ' (' || c.id || ')' AS colaborador,  -- único (há homónimos)
  CASE c.sexo WHEN 'F' THEN 'Feminino' ELSE 'Masculino' END AS sexo,
  c.data_nascimento,
  c.distrito,
  d.nome      AS departamento,
  d.direcao,
  k.nome      AS cargo,
  k.nome_nivel AS nivel,
  ch.nome || ' ' || ch.sobrenome AS chefia,
  c.tipo_contrato,
  c.data_admissao,
  c.data_saida,
  c.motivo_saida
FROM rh.colaboradores c
JOIN rh.departamentos d ON d.id = c.departamento_id
JOIN rh.cargos k        ON k.id = c.cargo_id
LEFT JOIN rh.colaboradores ch ON ch.id = c.chefia_id;

-- Ausências (férias, baixas, faltas, licenças) com o colaborador por id (relação no modelo).
CREATE OR REPLACE VIEW rh.vw_ausencias AS
SELECT a.id, a.colaborador_id, a.tipo, a.data_inicio, a.data_fim, a.dias_uteis
FROM rh.ausencias a;
