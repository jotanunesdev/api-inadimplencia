"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureDatabaseStructure = ensureDatabaseStructure;
exports.getInitializationState = getInitializationState;
const db_1 = require("../config/db");
const env_1 = require("../config/env");
const state = {
    ready: false,
    initializing: false,
    lastError: null,
};
let initializationPromise = null;
function quoteIdentifier(identifier) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(identifier)) {
        throw new Error(`Identificador SQL invalido: ${identifier}`);
    }
    return `[${identifier}]`;
}
function tableName(suffix) {
    return `${quoteIdentifier(env_1.env.DB_SCHEMA)}.${quoteIdentifier(`${env_1.env.TABLE_PREFIX}_${suffix}`)}`;
}
function buildSchemaSql() {
    const schemaName = env_1.env.DB_SCHEMA;
    const entriesTable = tableName('entries');
    const purchaseOrdersTable = tableName('purchase_orders');
    const itemsTable = tableName('items');
    const apportionmentsTable = tableName('apportionments');
    const taxesTable = tableName('taxes');
    const paymentsTable = tableName('payments');
    return `
IF SCHEMA_ID('${schemaName}') IS NULL
BEGIN
  EXEC('CREATE SCHEMA ${quoteIdentifier(schemaName)}');
END;

IF OBJECT_ID('${schemaName}.${env_1.env.TABLE_PREFIX}_entries', 'U') IS NULL
BEGIN
  CREATE TABLE ${entriesTable} (
    [id] UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    [status] NVARCHAR(20) NOT NULL,
    [numero_mov] NVARCHAR(50) NULL,
    [serie] NVARCHAR(50) NULL,
    [cod_coligada] NVARCHAR(20) NULL,
    [cod_filial] NVARCHAR(20) NULL,
    [filial_description] NVARCHAR(255) NULL,
    [cod_col_cfo] NVARCHAR(20) NULL,
    [cod_cfo] NVARCHAR(50) NULL,
    [fornecedor_description] NVARCHAR(255) NULL,
    [cnpj_cpf] NVARCHAR(30) NULL,
    [data_emissao] DATE NULL,
    [data_saida] DATE NULL,
    [cod_tmv] NVARCHAR(50) NULL,
    [movimento_description] NVARCHAR(255) NULL,
    [serie_nf] NVARCHAR(50) NULL,
    [id_nat] NVARCHAR(50) NULL,
    [cod_nat] NVARCHAR(50) NULL,
    [natureza_description] NVARCHAR(255) NULL,
    [qualidade] INT NULL,
    [prazo] INT NULL,
    [atendimento] INT NULL,
    [valor_bruto] DECIMAL(18, 4) NULL,
    [valor_liquido] DECIMAL(18, 4) NULL,
    [valor_frete] DECIMAL(18, 4) NULL,
    [valor_desc] DECIMAL(18, 4) NULL,
    [valor_desp] DECIMAL(18, 4) NULL,
    [valor_outros] DECIMAL(18, 4) NULL,
    [chave_acesso_nfe] NVARCHAR(60) NULL,
    [gerar_frap] BIT NOT NULL CONSTRAINT DF_${env_1.env.TABLE_PREFIX}_entries_gerar_frap DEFAULT(0),
    [data_prev_baixa] DATE NULL,
    [historico] NVARCHAR(MAX) NULL,
    [observacao_avaliacao] NVARCHAR(MAX) NULL,
    [financeiro] BIT NOT NULL CONSTRAINT DF_${env_1.env.TABLE_PREFIX}_entries_financeiro DEFAULT(0),
    [possui_adiantamento] BIT NOT NULL CONSTRAINT DF_${env_1.env.TABLE_PREFIX}_entries_possui_adiantamento DEFAULT(0),
    [cod_cpg] NVARCHAR(50) NULL,
    [descricao_cod_cpg] NVARCHAR(255) NULL,
    [cod_cxa] NVARCHAR(50) NULL,
    [descricao_cod_cxa] NVARCHAR(255) NULL,
    [payload_json] NVARCHAR(MAX) NULL,
    [created_by] NVARCHAR(255) NULL,
    [updated_by] NVARCHAR(255) NULL,
    [created_at] DATETIME2 NOT NULL CONSTRAINT DF_${env_1.env.TABLE_PREFIX}_entries_created_at DEFAULT(SYSUTCDATETIME()),
    [updated_at] DATETIME2 NOT NULL CONSTRAINT DF_${env_1.env.TABLE_PREFIX}_entries_updated_at DEFAULT(SYSUTCDATETIME()),
    [deleted_at] DATETIME2 NULL
  );
END;

IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE name = 'UX_${env_1.env.TABLE_PREFIX}_entries_identity'
    AND object_id = OBJECT_ID('${schemaName}.${env_1.env.TABLE_PREFIX}_entries')
)
BEGIN
  CREATE UNIQUE INDEX UX_${env_1.env.TABLE_PREFIX}_entries_identity
    ON ${entriesTable} ([cod_coligada], [cod_filial], [cod_col_cfo], [cod_cfo], [numero_mov], [serie])
    WHERE [deleted_at] IS NULL;
END;

IF OBJECT_ID('${schemaName}.${env_1.env.TABLE_PREFIX}_purchase_orders', 'U') IS NULL
BEGIN
  CREATE TABLE ${purchaseOrdersTable} (
    [id] UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    [entry_id] UNIQUEIDENTIFIER NOT NULL,
    [line_number] INT NOT NULL,
    [seq_f] NVARCHAR(50) NULL,
    [id_mov] NVARCHAR(50) NULL,
    [numero_mov] NVARCHAR(50) NULL,
    [cod_tmv_oc] NVARCHAR(50) NULL,
    [tipo_movimento] NVARCHAR(255) NULL,
    [data_emissao] DATE NULL,
    [valor] DECIMAL(18, 4) NULL,
    [cgc_cfo] NVARCHAR(30) NULL,
    [fornecedor_nome] NVARCHAR(255) NULL,
    [movimento_destino_codigo] NVARCHAR(50) NULL,
    [movimento_destino_descricao] NVARCHAR(255) NULL,
    CONSTRAINT FK_${env_1.env.TABLE_PREFIX}_purchase_orders_entry
      FOREIGN KEY ([entry_id]) REFERENCES ${entriesTable}([id]) ON DELETE CASCADE
  );
END;

IF OBJECT_ID('${schemaName}.${env_1.env.TABLE_PREFIX}_items', 'U') IS NULL
BEGIN
  CREATE TABLE ${itemsTable} (
    [id] UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    [entry_id] UNIQUEIDENTIFIER NOT NULL,
    [line_number] INT NOT NULL,
    [seq_f] NVARCHAR(50) NULL,
    [nome_fantasia] NVARCHAR(255) NULL,
    [codigo_prd] NVARCHAR(100) NULL,
    [id_prd] NVARCHAR(100) NULL,
    [cod_und] NVARCHAR(20) NULL,
    [nseq_itm_mov] NVARCHAR(50) NULL,
    [id_nat] NVARCHAR(50) NULL,
    [cod_nat] NVARCHAR(50) NULL,
    [desc_nat] NVARCHAR(255) NULL,
    [cod_col_tborcamento] NVARCHAR(50) NULL,
    [cod_tborcamento] NVARCHAR(50) NULL,
    [desc_tborcamento] NVARCHAR(255) NULL,
    [id_mov_oc] NVARCHAR(50) NULL,
    [nseq_itm_mov_oc] NVARCHAR(50) NULL,
    [quantidade] DECIMAL(18, 4) NULL,
    [preco_unitario] DECIMAL(18, 4) NULL,
    [valor_bruto_item] DECIMAL(18, 4) NULL,
    [valor_total_item] DECIMAL(18, 4) NULL,
    [valor_liquido] DECIMAL(18, 4) NULL,
    CONSTRAINT FK_${env_1.env.TABLE_PREFIX}_items_entry
      FOREIGN KEY ([entry_id]) REFERENCES ${entriesTable}([id]) ON DELETE CASCADE
  );
END;

IF OBJECT_ID('${schemaName}.${env_1.env.TABLE_PREFIX}_apportionments', 'U') IS NULL
BEGIN
  CREATE TABLE ${apportionmentsTable} (
    [id] UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    [entry_id] UNIQUEIDENTIFIER NOT NULL,
    [line_number] INT NOT NULL,
    [seq_f] NVARCHAR(50) NULL,
    [item_seq_f] NVARCHAR(50) NULL,
    [nseq_itm_mov] NVARCHAR(50) NULL,
    [desc_custo] NVARCHAR(255) NULL,
    [cod_ccusto] NVARCHAR(100) NULL,
    [valor] DECIMAL(18, 4) NULL,
    CONSTRAINT FK_${env_1.env.TABLE_PREFIX}_apportionments_entry
      FOREIGN KEY ([entry_id]) REFERENCES ${entriesTable}([id]) ON DELETE CASCADE
  );
END;

IF OBJECT_ID('${schemaName}.${env_1.env.TABLE_PREFIX}_taxes', 'U') IS NULL
BEGIN
  CREATE TABLE ${taxesTable} (
    [id] UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    [entry_id] UNIQUEIDENTIFIER NOT NULL,
    [line_number] INT NOT NULL,
    [seq_f] NVARCHAR(50) NULL,
    [item_seq_f] NVARCHAR(50) NULL,
    [nseq_itm_mov] NVARCHAR(50) NULL,
    [cod_trb] NVARCHAR(50) NULL,
    [base_de_calculo] DECIMAL(18, 4) NULL,
    [aliquota] DECIMAL(18, 4) NULL,
    [tipo_recolhimento] NVARCHAR(100) NULL,
    [valor] DECIMAL(18, 4) NULL,
    CONSTRAINT FK_${env_1.env.TABLE_PREFIX}_taxes_entry
      FOREIGN KEY ([entry_id]) REFERENCES ${entriesTable}([id]) ON DELETE CASCADE
  );
END;

IF OBJECT_ID('${schemaName}.${env_1.env.TABLE_PREFIX}_payments', 'U') IS NULL
BEGIN
  CREATE TABLE ${paymentsTable} (
    [id] UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    [entry_id] UNIQUEIDENTIFIER NOT NULL,
    [line_number] INT NOT NULL,
    [seq_f] NVARCHAR(50) NULL,
    [cod_coligada] NVARCHAR(20) NULL,
    [id_mov] NVARCHAR(50) NULL,
    [id_seq_pagto] NVARCHAR(50) NULL,
    [data_vencimento] DATE NULL,
    [valor] DECIMAL(18, 4) NULL,
    [desc_forma_pagto] NVARCHAR(255) NULL,
    [id_forma_pagto] NVARCHAR(50) NULL,
    [desc_cod_cxa] NVARCHAR(255) NULL,
    [cod_cxa] NVARCHAR(50) NULL,
    [taxa_adm] DECIMAL(18, 4) NULL,
    CONSTRAINT FK_${env_1.env.TABLE_PREFIX}_payments_entry
      FOREIGN KEY ([entry_id]) REFERENCES ${entriesTable}([id]) ON DELETE CASCADE
  );
END;
`;
}
async function ensureDatabaseStructure() {
    if (!env_1.env.isConfigured) {
        state.ready = false;
        state.lastError = 'Modulo sem configuracao obrigatoria.';
        return;
    }
    if (!initializationPromise) {
        state.initializing = true;
        initializationPromise = (async () => {
            try {
                const pool = await (0, db_1.getPool)();
                await pool.request().batch(buildSchemaSql());
                state.ready = true;
                state.lastError = null;
            }
            catch (error) {
                state.ready = false;
                state.lastError = error instanceof Error ? error.message : 'Falha ao inicializar schema.';
                throw error;
            }
            finally {
                state.initializing = false;
            }
        })();
    }
    return initializationPromise;
}
function getInitializationState() {
    return { ...state };
}
