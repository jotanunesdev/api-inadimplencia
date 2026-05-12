import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const {
  SERASA_PEFIN_STATUS,
  SERASA_PEFIN_STATUS_VALUES,
  SERASA_PEFIN_TIPO_REGISTRO,
  SERASA_PEFIN_TIPO_REGISTRO_VALUES,
} = require('./serasaPefin.js');

describe('serasaPefin constants', () => {
  it('centraliza os status internos aceitos pela integracao', () => {
    expect(SERASA_PEFIN_STATUS).toEqual({
      PENDENTE_ENVIO: 'PENDENTE_ENVIO',
      ENVIADO_SERASA: 'ENVIADO_SERASA',
      AGUARDANDO_RETORNO: 'AGUARDANDO_RETORNO',
      NEGATIVADO_SUCESSO: 'NEGATIVADO_SUCESSO',
      NEGATIVADO_ERRO: 'NEGATIVADO_ERRO',
      BAIXA_ENVIADA: 'BAIXA_ENVIADA',
      BAIXA_AGUARDANDO_RETORNO: 'BAIXA_AGUARDANDO_RETORNO',
      BAIXADO_SUCESSO: 'BAIXADO_SUCESSO',
      BAIXADO_ERRO: 'BAIXADO_ERRO',
    });
    expect(SERASA_PEFIN_STATUS_VALUES).toEqual([
      'PENDENTE_ENVIO',
      'ENVIADO_SERASA',
      'AGUARDANDO_RETORNO',
      'NEGATIVADO_SUCESSO',
      'NEGATIVADO_ERRO',
      'BAIXA_ENVIADA',
      'BAIXA_AGUARDANDO_RETORNO',
      'BAIXADO_SUCESSO',
      'BAIXADO_ERRO',
    ]);
    expect(Object.isFrozen(SERASA_PEFIN_STATUS)).toBe(true);
    expect(Object.isFrozen(SERASA_PEFIN_STATUS_VALUES)).toBe(true);
  });

  it('centraliza os tipos de registro aceitos na tabela de solicitacoes', () => {
    expect(SERASA_PEFIN_TIPO_REGISTRO).toEqual({
      PRINCIPAL: 'PRINCIPAL',
      GARANTIDOR: 'GARANTIDOR',
    });
    expect(SERASA_PEFIN_TIPO_REGISTRO_VALUES).toEqual(['PRINCIPAL', 'GARANTIDOR']);
    expect(Object.isFrozen(SERASA_PEFIN_TIPO_REGISTRO)).toBe(true);
    expect(Object.isFrozen(SERASA_PEFIN_TIPO_REGISTRO_VALUES)).toBe(true);
  });
});
