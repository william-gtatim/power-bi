-- Esquema de Recursos Humanos (dados fictícios para testes de BI).
-- ATENÇÃO: apaga e recria o esquema "rh" por completo.

DROP SCHEMA IF EXISTS rh CASCADE;
CREATE SCHEMA rh;

-- Feriados nacionais (usados para calcular dias úteis)
CREATE TABLE rh.feriados (
  data  date PRIMARY KEY,
  nome  text NOT NULL
);

-- Calendário diário do período dos dados (dimensão de datas)
CREATE TABLE rh.calendario (
  data         date PRIMARY KEY,
  ano          smallint NOT NULL,
  trimestre    smallint NOT NULL,
  mes          smallint NOT NULL,
  nome_mes     text     NOT NULL,
  ano_mes      text     NOT NULL,      -- '2024-03'
  dia          smallint NOT NULL,
  dia_semana   smallint NOT NULL,      -- 1 = segunda ... 7 = domingo
  nome_dia     text     NOT NULL,
  e_feriado    boolean  NOT NULL,
  dia_util     boolean  NOT NULL
);

CREATE TABLE rh.departamentos (
  id        smallint PRIMARY KEY,
  nome      text NOT NULL UNIQUE,
  direcao   text NOT NULL
);

CREATE TABLE rh.cargos (
  id              smallint PRIMARY KEY,
  departamento_id smallint NOT NULL REFERENCES rh.departamentos(id),
  nome            text NOT NULL,
  nivel           smallint NOT NULL,   -- 1 Assistente ... 5 Diretor
  nome_nivel      text NOT NULL,
  salario_min     numeric(10,2) NOT NULL,
  salario_max     numeric(10,2) NOT NULL
);

CREATE TABLE rh.colaboradores (
  id               integer PRIMARY KEY,
  nome             text NOT NULL,
  sobrenome        text NOT NULL,
  sexo             char(1) NOT NULL CHECK (sexo IN ('F','M')),
  data_nascimento  date NOT NULL,
  distrito         text NOT NULL,
  departamento_id  smallint NOT NULL REFERENCES rh.departamentos(id),
  cargo_id         smallint NOT NULL REFERENCES rh.cargos(id),
  chefia_id        integer REFERENCES rh.colaboradores(id),
  tipo_contrato    text NOT NULL,
  data_admissao    date NOT NULL,
  data_saida       date,
  motivo_saida     text,
  CHECK (data_saida IS NULL OR data_saida >= data_admissao)
);

CREATE TABLE rh.historico_salarial (
  id              integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  colaborador_id  integer NOT NULL REFERENCES rh.colaboradores(id),
  data_inicio     date NOT NULL,
  data_fim        date,                -- NULL = salário em vigor
  salario         numeric(10,2) NOT NULL,
  motivo          text NOT NULL
);

CREATE TABLE rh.ausencias (
  id              integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  colaborador_id  integer NOT NULL REFERENCES rh.colaboradores(id),
  tipo            text NOT NULL,
  data_inicio     date NOT NULL,
  data_fim        date NOT NULL,
  dias_uteis      smallint NOT NULL DEFAULT 0,
  CHECK (data_fim >= data_inicio)
);

-- Um registo por colaborador e dia útil em que estava contratado
CREATE TABLE rh.registos_ponto (
  colaborador_id     integer  NOT NULL REFERENCES rh.colaboradores(id),
  data               date     NOT NULL,
  estado             text     NOT NULL,   -- Trabalho, Férias, Baixa médica, ...
  horas_trabalhadas  numeric(4,2) NOT NULL,
  horas_extra        numeric(4,2) NOT NULL,
  PRIMARY KEY (colaborador_id, data)
);
