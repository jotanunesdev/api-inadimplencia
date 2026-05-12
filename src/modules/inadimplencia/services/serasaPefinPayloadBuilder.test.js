const {
  buildMainDebtPayload,
  buildGuarantorPayload,
  maskDocument,
  maskPayload,
  normalizeAddress,
  normalizeCurrency,
  normalizeDate,
  normalizeString,
  validateAddress,
  validateDateFormat,
  validatePreviewData,
  validateUatDocuments,
  validateValue,
  SERASA_CONSTANTS,
  UAT_TEST_DOCUMENTS,
} = require('./serasaPefinPayloadBuilder.js');

describe('serasaPefinPayloadBuilder', () => {
  describe('normalizeString', () => {
    it('should trim whitespace', () => {
      expect(normalizeString('  test  ')).toBe('test');
    });

    it('should handle null/undefined', () => {
      expect(normalizeString(null)).toBe('');
      expect(normalizeString(undefined)).toBe('');
    });

    it('should convert to string', () => {
      expect(normalizeString(123)).toBe('123');
    });
  });

  describe('normalizeCurrency', () => {
    it('should parse number string', () => {
      expect(normalizeCurrency('100.50')).toBe(100.5);
    });

    it('should parse number', () => {
      expect(normalizeCurrency(100.5)).toBe(100.5);
    });

    it('should return null for invalid values', () => {
      expect(normalizeCurrency(null)).toBe(null);
      expect(normalizeCurrency('')).toBe(null);
      expect(normalizeCurrency('invalid')).toBe(null);
    });
  });

  describe('normalizeDate', () => {
    it('should format Date object to YYYY-MM-DD', () => {
      const date = new Date('2026-05-11T12:00:00Z');
      expect(normalizeDate(date)).toBe('2026-05-11');
    });

    it('should handle YYYY-MM-DD string', () => {
      expect(normalizeDate('2026-05-11')).toBe('2026-05-11');
    });

    it('should handle YYYY/MM/DD string', () => {
      expect(normalizeDate('2026/05/11')).toBe('2026-05-11');
    });

    it('should handle DD/MM/YYYY string', () => {
      expect(normalizeDate('11/05/2026')).toBe('2026-05-11');
    });

    it('should return null for invalid dates', () => {
      expect(normalizeDate(null)).toBe(null);
      expect(normalizeDate('invalid')).toBe(null);
      expect(normalizeDate(new Date('invalid'))).toBe(null);
    });
  });

  describe('normalizeAddress', () => {
    it('should normalize address fields', () => {
      const address = {
        zipCode: '12345-678',
        addressLine: 'Rua Teste, 123',
        complement: 'Apto 1',
        district: 'Centro',
        city: 'São Paulo',
        state: 'SP',
        number: '123',
      };

      const normalized = normalizeAddress(address);
      expect(normalized).toEqual({
        zipCode: '12345-678',
        addressLine: 'Rua Teste, 123',
        complement: 'Apto 1',
        district: 'Centro',
        city: 'São Paulo',
        state: 'SP',
        number: '123',
      });
    });

    it('should handle uppercase field names', () => {
      const address = {
        CEP: '12345-678',
        logradouro: 'Rua Teste',
        bairro: 'Centro',
        cidade: 'São Paulo',
        UF: 'SP',
      };

      const normalized = normalizeAddress(address);
      expect(normalized).toEqual({
        zipCode: '12345-678',
        addressLine: 'Rua Teste',
        complement: '',
        district: 'Centro',
        city: 'São Paulo',
        state: 'SP',
        number: '',
      });
    });

    it('should return null for invalid address', () => {
      expect(normalizeAddress(null)).toBe(null);
      expect(normalizeAddress(undefined)).toBe(null);
      expect(normalizeAddress('string')).toBe(null);
    });
  });

  describe('validateDateFormat', () => {
    it('should validate YYYY-MM-DD format', () => {
      expect(validateDateFormat('2026-05-11')).toBe(true);
      expect(validateDateFormat('2026-12-31')).toBe(true);
    });

    it('should reject invalid formats', () => {
      expect(validateDateFormat('11/05/2026')).toBe(false);
      expect(validateDateFormat('2026/05/11')).toBe(false);
      expect(validateDateFormat('20260511')).toBe(false);
      expect(validateDateFormat('invalid')).toBe(false);
      expect(validateDateFormat(null)).toBe(false);
    });

    it('should reject invalid dates', () => {
      expect(validateDateFormat('2026-13-01')).toBe(false);
      expect(validateDateFormat('2026-02-30')).toBe(false);
    });
  });

  describe('validateValue', () => {
    it('should validate value >= 10.00', () => {
      expect(validateValue(10.0)).toBe(true);
      expect(validateValue(10.01)).toBe(true);
      expect(validateValue(1000.0)).toBe(true);
    });

    it('should reject value < 10.00', () => {
      expect(validateValue(9.99)).toBe(false);
      expect(validateValue(5.0)).toBe(false);
      expect(validateValue(0)).toBe(false);
    });

    it('should reject null/undefined', () => {
      expect(validateValue(null)).toBe(false);
      expect(validateValue(undefined)).toBe(false);
    });

    it('should reject invalid values', () => {
      expect(validateValue('invalid')).toBe(false);
      expect(validateValue(NaN)).toBe(false);
    });
  });

  describe('validateAddress', () => {
    it('should validate complete address', () => {
      const address = {
        zipCode: '12345-678',
        addressLine: 'Rua Teste, 123',
        district: 'Centro',
        city: 'São Paulo',
        state: 'SP',
      };

      const result = validateAddress(address);
      expect(result.valid).toBe(true);
      expect(result.missingFields).toEqual([]);
      expect(result.normalized).toMatchObject({
        zipCode: '12345-678',
        addressLine: 'Rua Teste, 123',
        district: 'Centro',
        city: 'São Paulo',
        state: 'SP',
      });
    });

    it('should return missing fields for incomplete address', () => {
      const address = {
        zipCode: '12345-678',
        addressLine: 'Rua Teste, 123',
      };

      const result = validateAddress(address);
      expect(result.valid).toBe(false);
      expect(result.missingFields).toContain('district');
      expect(result.missingFields).toContain('city');
      expect(result.missingFields).toContain('state');
    });

    it('should add prefix to missing fields', () => {
      const address = {
        zipCode: '12345-678',
      };

      const result = validateAddress(address, 'debtor.address.');
      expect(result.valid).toBe(false);
      expect(result.missingFields).toContain('debtor.address.addressLine');
      expect(result.missingFields).toContain('debtor.address.district');
    });

    it('should handle null address', () => {
      const result = validateAddress(null);
      expect(result.valid).toBe(false);
      expect(result.missingFields).toContain('address');
      expect(result.normalized).toBe(null);
    });
  });

  describe('validateUatDocuments', () => {
    it('should allow documents from UAT test mass when UAT enabled', () => {
      const result = validateUatDocuments('00001209523', true);
      expect(result.valid).toBe(true);
      expect(result.blockedDocuments).toEqual([]);
    });

    it('should block documents not in UAT test mass', () => {
      const result = validateUatDocuments('12345678901', true);
      expect(result.valid).toBe(false);
      expect(result.blockedDocuments).toContain('12345678901');
    });

    it('should allow all documents when UAT disabled', () => {
      const result = validateUatDocuments('12345678901', false);
      expect(result.valid).toBe(true);
      expect(result.blockedDocuments).toEqual([]);
    });

    it('should handle array of documents', () => {
      const result = validateUatDocuments(['00001209523', '12345678901'], true);
      expect(result.valid).toBe(false);
      expect(result.blockedDocuments).toContain('12345678901');
    });
  });

  describe('buildMainDebtPayload', () => {
    it('should build valid main debt payload', () => {
      const params = {
        value: 100.5,
        areaInformante: '1234',
        dueDate: '2026-05-11',
        categoryId: 'FI',
        debtor: {
          documentNumber: '00001209523',
          name: 'Cliente Teste',
          address: {
            zipCode: '12345-678',
            addressLine: 'Rua Teste, 123',
            district: 'Centro',
            city: 'São Paulo',
            state: 'SP',
          },
        },
        creditor: {
          documentNumber: '43557445000180',
        },
        contractNumber: '12345',
      };

      const payload = buildMainDebtPayload(params);
      expect(payload).toMatchObject({
        value: 100.5,
        areaInformante: '1234',
        dueDate: '2026-05-11',
        categoryId: 'FI',
        debtor: {
          documentNumber: '00001209523',
          name: 'Cliente Teste',
          address: {
            zipCode: '12345-678',
            addressLine: 'Rua Teste, 123',
            district: 'Centro',
            city: 'São Paulo',
            state: 'SP',
          },
        },
        creditor: {
          documentNumber: '43557445000180',
        },
        contractNumber: '12345',
        debtType: 'PEFIN',
      });
    });

    it('should throw error for missing required fields', () => {
      const params = {
        value: 100.5,
        debtor: {
          documentNumber: '00001209523',
        },
        creditor: {
          documentNumber: '43557445000180',
        },
      };

      expect(() => buildMainDebtPayload(params)).toThrow('SERASA_PEFIN_CAMPOS_OBRIGATORIOS_FALTANTES');
    });

    it('should throw error for incomplete address', () => {
      const params = {
        value: 100.5,
        areaInformante: '1234',
        dueDate: '2026-05-11',
        categoryId: 'FI',
        debtor: {
          documentNumber: '00001209523',
          name: 'Cliente Teste',
          address: {
            zipCode: '12345-678',
          },
        },
        creditor: {
          documentNumber: '43557445000180',
        },
        contractNumber: '12345',
      };

      const error = () => buildMainDebtPayload(params);
      expect(error).toThrow('SERASA_PEFIN_CAMPOS_OBRIGATORIOS_FALTANTES');
    });

    it('should throw error for value below minimum', () => {
      const params = {
        value: 5.0,
        areaInformante: '1234',
        dueDate: '2026-05-11',
        categoryId: 'FI',
        debtor: {
          documentNumber: '00001209523',
          name: 'Cliente Teste',
          address: {
            zipCode: '12345-678',
            addressLine: 'Rua Teste, 123',
            district: 'Centro',
            city: 'São Paulo',
            state: 'SP',
          },
        },
        creditor: {
          documentNumber: '43557445000180',
        },
        contractNumber: '12345',
      };

      expect(() => buildMainDebtPayload(params)).toThrow('SERASA_PEFIN_CAMPOS_OBRIGATORIOS_FALTANTES');
    });

    it('should throw error for invalid date format', () => {
      const params = {
        value: 100.5,
        areaInformante: '1234',
        dueDate: '11/05/2026',
        categoryId: 'FI',
        debtor: {
          documentNumber: '00001209523',
          name: 'Cliente Teste',
          address: {
            zipCode: '12345-678',
            addressLine: 'Rua Teste, 123',
            district: 'Centro',
            city: 'São Paulo',
            state: 'SP',
          },
        },
        creditor: {
          documentNumber: '43557445000180',
        },
        contractNumber: '12345',
      };

      expect(() => buildMainDebtPayload(params)).toThrow('SERASA_PEFIN_CAMPOS_OBRIGATORIOS_FALTANTES');
    });

    it('should use default categoryId when not provided', () => {
      const params = {
        value: 100.5,
        areaInformante: '1234',
        dueDate: '2026-05-11',
        debtor: {
          documentNumber: '00001209523',
          name: 'Cliente Teste',
          address: {
            zipCode: '12345-678',
            addressLine: 'Rua Teste, 123',
            district: 'Centro',
            city: 'São Paulo',
            state: 'SP',
          },
        },
        creditor: {
          documentNumber: '43557445000180',
        },
        contractNumber: '12345',
      };

      const payload = buildMainDebtPayload(params);
      expect(payload.categoryId).toBe('FI');
    });

    it('should include optional bankSlip when provided', () => {
      const params = {
        value: 100.5,
        areaInformante: '1234',
        dueDate: '2026-05-11',
        categoryId: 'FI',
        debtor: {
          documentNumber: '00001209523',
          name: 'Cliente Teste',
          address: {
            zipCode: '12345-678',
            addressLine: 'Rua Teste, 123',
            district: 'Centro',
            city: 'São Paulo',
            state: 'SP',
          },
        },
        creditor: {
          documentNumber: '43557445000180',
        },
        contractNumber: '12345',
        bankSlip: {
          bankName: 'Banco Teste',
        },
      };

      const payload = buildMainDebtPayload(params);
      expect(payload.bankSlip).toBeDefined();
      expect(payload.bankSlip.bankName).toBe('Banco Teste');
    });
  });

  describe('buildGuarantorPayload', () => {
    it('should build valid guarantor payload', () => {
      const params = {
        value: 100.5,
        dueDate: '2026-05-11',
        categoryId: 'FI',
        debtorDocument: '00001209523',
        contractNumber: '12345',
        guarantor: {
          documentNumber: '00008441448',
          name: 'Fiador Teste',
          address: {
            zipCode: '12345-678',
            addressLine: 'Rua Teste, 456',
            district: 'Centro',
            city: 'São Paulo',
            state: 'SP',
            number: '456',
          },
        },
        creditor: {
          documentNumber: '43557445000180',
        },
      };

      const payload = buildGuarantorPayload(params);
      expect(payload).toMatchObject({
        categoryId: 'FI',
        value: 100.5,
        dueDate: '2026-05-11',
        debtorDocument: '00001209523',
        contractNumber: '12345',
        guarantor: {
          documentNumber: '00008441448',
          name: 'Fiador Teste',
          address: {
            zipCode: '12345-678',
            addressLine: 'Rua Teste, 456',
            district: 'Centro',
            city: 'São Paulo',
            state: 'SP',
            number: '456',
          },
        },
        creditor: {
          documentNumber: '43557445000180',
        },
        debtType: 'PEFIN',
      });
    });

    it('should throw error for missing required fields', () => {
      const params = {
        value: 100.5,
        debtorDocument: '00001209523',
        creditor: {
          documentNumber: '43557445000180',
        },
      };

      expect(() => buildGuarantorPayload(params)).toThrow('SERASA_PEFIN_CAMPOS_OBRIGATORIOS_FALTANTES');
    });

    it('should throw error for incomplete guarantor address', () => {
      const params = {
        value: 100.5,
        dueDate: '2026-05-11',
        categoryId: 'FI',
        debtorDocument: '00001209523',
        contractNumber: '12345',
        guarantor: {
          documentNumber: '00008441448',
          name: 'Fiador Teste',
          address: {
            zipCode: '12345-678',
          },
        },
        creditor: {
          documentNumber: '43557445000180',
        },
      };

      expect(() => buildGuarantorPayload(params)).toThrow('SERASA_PEFIN_CAMPOS_OBRIGATORIOS_FALTANTES');
    });
  });

  describe('maskDocument', () => {
    it('should mask CPF', () => {
      expect(maskDocument('12345678901')).toBe('123.***.01');
    });

    it('should mask CNPJ', () => {
      expect(maskDocument('12345678000190')).toBe('12.***.90');
    });

    it('should handle short documents', () => {
      expect(maskDocument('123')).toBe('***');
    });

    it('should handle empty/null', () => {
      expect(maskDocument('')).toBe('');
      expect(maskDocument(null)).toBe('');
    });

    it('should remove formatting before masking', () => {
      expect(maskDocument('123.456.789-01')).toBe('123.***.01');
      expect(maskDocument('12.345.678/0001-90')).toBe('12.***.90');
    });
  });

  describe('maskPayload', () => {
    it('should mask documents in main debt payload', () => {
      const payload = {
        value: 100.5,
        debtor: {
          documentNumber: '12345678901',
        },
        creditor: {
          documentNumber: '12345678000190',
        },
      };

      const masked = maskPayload(payload, { maskDocuments: true });
      expect(masked.debtor.documentNumber).toBe('123.***.01');
      expect(masked.creditor.documentNumber).toBe('12.***.90');
    });

    it('should mask documents in guarantor payload', () => {
      const payload = {
        debtorDocument: '12345678901',
        guarantor: {
          documentNumber: '98765432100',
        },
        creditor: {
          documentNumber: '12345678000190',
        },
      };

      const masked = maskPayload(payload, { maskDocuments: true });
      expect(masked.debtorDocument).toBe('123.***.01');
      expect(masked.guarantor.documentNumber).toBe('987.***.00');
      expect(masked.creditor.documentNumber).toBe('12.***.90');
    });

    it('should mask financial data when requested', () => {
      const payload = {
        value: 100.5,
        bankSlip: {
          value: 50.25,
        },
      };

      const masked = maskPayload(payload, { maskFinancial: true });
      expect(masked.value).toBe('***.**');
      expect(masked.bankSlip.value).toBe('***.**');
    });

    it('should not mask when options are false', () => {
      const payload = {
        value: 100.5,
        debtor: {
          documentNumber: '12345678901',
        },
      };

      const masked = maskPayload(payload, { maskDocuments: false, maskFinancial: false });
      expect(masked.value).toBe(100.5);
      expect(masked.debtor.documentNumber).toBe('12345678901');
    });

    it('should handle null/undefined payload', () => {
      expect(maskPayload(null)).toBe(null);
      expect(maskPayload(undefined)).toBe(undefined);
    });
  });

  describe('validatePreviewData', () => {
    it('should validate complete inadimplencia data', () => {
      const data = {
        inadimplencia: {
          DOCUMENTO_DEVEDOR: '00001209523',
          VALOR: 100.5,
          DATA_VENCIMENTO: '2026-05-11',
          address: {
            zipCode: '12345-678',
            addressLine: 'Rua Teste, 123',
            district: 'Centro',
            city: 'São Paulo',
            state: 'SP',
          },
        },
        garantidores: [],
      };

      const result = validatePreviewData(data);
      expect(result.valid).toBe(true);
      expect(result.missingFields).toEqual([]);
    });

    it('should return missing fields for incomplete inadimplencia', () => {
      const data = {
        inadimplencia: {
          DOCUMENTO_DEVEDOR: '00001209523',
          VALOR: 5.0,
          DATA_VENCIMENTO: '2026-05-11',
          address: {
            zipCode: '12345-678',
          },
        },
        garantidores: [],
      };

      const result = validatePreviewData(data);
      expect(result.valid).toBe(false);
      expect(result.missingFields).toContain('VALOR');
      expect(result.missingFields).toContain('devedor.address.addressLine');
    });

    it('should validate guarantors', () => {
      const data = {
        inadimplencia: {
          DOCUMENTO_DEVEDOR: '00001209523',
          VALOR: 100.5,
          DATA_VENCIMENTO: '2026-05-11',
          address: {
            zipCode: '12345-678',
            addressLine: 'Rua Teste, 123',
            district: 'Centro',
            city: 'São Paulo',
            state: 'SP',
          },
        },
        garantidores: [
          {
            DOCUMENTO_GARANTIDOR: '00008441448',
            address: {
              zipCode: '12345-678',
              addressLine: 'Rua Teste, 456',
              district: 'Centro',
              city: 'São Paulo',
              state: 'SP',
            },
          },
        ],
      };

      const result = validatePreviewData(data);
      expect(result.valid).toBe(true);
      expect(result.validGuarantors).toHaveLength(1);
    });

    it('should return missing fields for incomplete guarantors', () => {
      const data = {
        inadimplencia: {
          DOCUMENTO_DEVEDOR: '00001209523',
          VALOR: 100.5,
          DATA_VENCIMENTO: '2026-05-11',
          address: {
            zipCode: '12345-678',
            addressLine: 'Rua Teste, 123',
            district: 'Centro',
            city: 'São Paulo',
            state: 'SP',
          },
        },
        garantidores: [
          {
            DOCUMENTO_GARANTIDOR: '00008441448',
            address: {
              zipCode: '12345-678',
            },
          },
        ],
      };

      const result = validatePreviewData(data);
      expect(result.valid).toBe(false);
      expect(result.principalValid).toBe(true);
      expect(result.principalMissingFields).toEqual([]);
      expect(result.guarantorValidations[0]).toMatchObject({
        valid: false,
        missingFields: expect.arrayContaining([
          'address.addressLine',
          'address.district',
          'address.city',
          'address.state',
        ]),
      });
      expect(result.missingFields).toContain('garantidores[0].address.addressLine');
    });

    it('should keep distinct missing fields for each guarantor', () => {
      const data = {
        inadimplencia: {
          DOCUMENTO_DEVEDOR: '00001209523',
          VALOR: 100.5,
          DATA_VENCIMENTO: '2026-05-11',
          address: {
            zipCode: '12345-678',
            addressLine: 'Rua Teste, 123',
            district: 'Centro',
            city: 'Sao Paulo',
            state: 'SP',
          },
        },
        garantidores: [
          {
            ID_ASSOCIADO: 'ASSOC001',
            DOCUMENTO_GARANTIDOR: '00008441448',
            address: {
              zipCode: '12345-678',
              district: 'Centro',
              city: 'Sao Paulo',
              state: 'SP',
            },
          },
          {
            ID_ASSOCIADO: 'ASSOC002',
            address: {
              zipCode: '12345-678',
              addressLine: 'Rua Teste, 789',
              district: 'Centro',
              city: 'Sao Paulo',
              state: 'SP',
            },
          },
        ],
      };

      const result = validatePreviewData(data);

      expect(result.principalValid).toBe(true);
      expect(result.guarantorValidations).toHaveLength(2);
      expect(result.guarantorValidations[0]).toMatchObject({
        idAssociado: 'ASSOC001',
        missingFields: ['address.addressLine'],
      });
      expect(result.guarantorValidations[1]).toMatchObject({
        idAssociado: 'ASSOC002',
        missingFields: ['DOCUMENTO_GARANTIDOR'],
      });
      expect(result.missingFields).toEqual([
        'garantidores[ASSOC001].address.addressLine',
        'garantidores[ASSOC002].DOCUMENTO_GARANTIDOR',
      ]);
    });

    it('should handle null inadimplencia', () => {
      const data = {
        inadimplencia: null,
        garantidores: [],
      };

      const result = validatePreviewData(data);
      expect(result.valid).toBe(false);
      expect(result.missingFields).toContain('inadimplencia');
    });
  });

  describe('SERASA_CONSTANTS', () => {
    it('should have correct constants', () => {
      expect(SERASA_CONSTANTS.CATEGORY_ID).toBe('FI');
      expect(SERASA_CONSTANTS.DEBT_TYPE).toBe('PEFIN');
      expect(SERASA_CONSTANTS.MIN_VALUE).toBe(10.0);
      expect(SERASA_CONSTANTS.MAX_VALUE_DIGITS).toBe(15);
      expect(SERASA_CONSTANTS.VALUE_DECIMALS).toBe(2);
    });
  });

  describe('UAT_TEST_DOCUMENTS', () => {
    it('should contain all UAT test documents', () => {
      expect(UAT_TEST_DOCUMENTS).toContain('00001209523');
      expect(UAT_TEST_DOCUMENTS).toContain('00008441448');
      expect(UAT_TEST_DOCUMENTS).toContain('07420565899');
      expect(UAT_TEST_DOCUMENTS).toContain('04236798484');
      expect(UAT_TEST_DOCUMENTS).toContain('43557445000180');
      expect(UAT_TEST_DOCUMENTS).toContain('00079854000105');
      expect(UAT_TEST_DOCUMENTS).toContain('16881670052');
      expect(UAT_TEST_DOCUMENTS).toContain('11572467886');
    });
  });
});
