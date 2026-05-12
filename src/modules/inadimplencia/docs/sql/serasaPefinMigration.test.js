import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const sqlPath = fileURLToPath(new URL('./2026-05-11-serasa-pefin.sql', import.meta.url));
const sql = readFileSync(sqlPath, 'utf8');

describe('2026-05-11-serasa-pefin.sql', () => {
  it('cria as tabelas Serasa PEFIN de forma idempotente', () => {
    expect(sql).toContain("IF OBJECT_ID('dbo.SERASA_PEFIN_SOLICITACOES', 'U') IS NULL");
    expect(sql).toContain("IF OBJECT_ID('dbo.SERASA_PEFIN_WEBHOOKS', 'U') IS NULL");
    expect(sql).toContain('CREATE TABLE dbo.SERASA_PEFIN_SOLICITACOES');
    expect(sql).toContain('CREATE TABLE dbo.SERASA_PEFIN_WEBHOOKS');
  });

  it('contem os campos exigidos pela tech spec para solicitacoes e webhooks', () => {
    [
      'NUM_VENDA_FK int NOT NULL',
      'TIPO_REGISTRO varchar(20) NOT NULL',
      'ID_SOLICITACAO_PRINCIPAL uniqueidentifier NULL',
      'DOCUMENTO_DEVEDOR varchar(20) NOT NULL',
      'DOCUMENTO_GARANTIDOR varchar(20) NULL',
      'DOCUMENTO_CREDOR varchar(20) NOT NULL',
      'CONTRACT_NUMBER varchar(20) NOT NULL',
      'AREA_INFORMANTE varchar(4) NOT NULL',
      'VALOR decimal(15,2) NOT NULL',
      'TRANSACTION_ID varchar(64) NULL',
      'PAYLOAD_AUDITORIA nvarchar(max) NOT NULL',
      'WEBHOOK_PAYLOAD nvarchar(max) NULL',
      'ERROR_MESSAGE nvarchar(1000) NULL',
      'EVENT_TYPE varchar(64) NOT NULL',
      'MATCHED_SOLICITACAO_ID uniqueidentifier NULL',
      'PROCESSADO bit NOT NULL',
      'MENSAGEM_ERRO nvarchar(1000) NULL',
    ].forEach((fragment) => {
      expect(sql).toContain(fragment);
    });
  });

  it('define constraints de dominio para tipos, status e payload JSON', () => {
    [
      'CK_SERASA_PEFIN_SOLICITACOES_TIPO_REGISTRO',
      "TIPO_REGISTRO IN ('PRINCIPAL', 'GARANTIDOR')",
      'CK_SERASA_PEFIN_SOLICITACOES_STATUS',
      "'PENDENTE_ENVIO'",
      "'ENVIADO_SERASA'",
      "'AGUARDANDO_RETORNO'",
      "'NEGATIVADO_SUCESSO'",
      "'NEGATIVADO_ERRO'",
      'CK_SERASA_PEFIN_SOLICITACOES_PAYLOAD_AUDITORIA_JSON',
      'ISJSON(PAYLOAD_AUDITORIA) = 1',
      'CK_SERASA_PEFIN_WEBHOOKS_PAYLOAD_JSON',
      'ISJSON(PAYLOAD) = 1',
    ].forEach((fragment) => {
      expect(sql).toContain(fragment);
    });
  });

  it('define indices para conciliacao, busca operacional e dedupe ativo', () => {
    [
      'IX_SERASA_PEFIN_SOLICITACOES_NUM_VENDA_FK',
      'UX_SERASA_PEFIN_SOLICITACOES_TRANSACTION_ID',
      'IX_SERASA_PEFIN_SOLICITACOES_CONTRACT_NUMBER',
      'IX_SERASA_PEFIN_SOLICITACOES_STATUS',
      'UX_SERASA_PEFIN_SOLICITACOES_ATIVA',
      "WHERE STATUS IN ('PENDENTE_ENVIO', 'ENVIADO_SERASA', 'AGUARDANDO_RETORNO')",
      'IX_SERASA_PEFIN_WEBHOOKS_TRANSACTION_ID',
      'IX_SERASA_PEFIN_WEBHOOKS_PROCESSADO',
      'IX_SERASA_PEFIN_WEBHOOKS_MATCHED_SOLICITACAO_ID',
    ].forEach((fragment) => {
      expect(sql).toContain(fragment);
    });
  });
});
