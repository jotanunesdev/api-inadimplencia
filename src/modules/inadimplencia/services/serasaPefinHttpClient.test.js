const { createSerasaPefinHttpClient } = require('./serasaPefinHttpClient.js');
const { env } = require('../config/env.js');

describe('serasaPefinHttpClient', () => {
  let mockFetch;
  let client;
  let mockAbortController;

  beforeEach(() => {
    mockFetch = jest.fn();
    mockAbortController = {
      signal: {},
      abort: jest.fn(),
    };
    global.AbortController = jest.fn(() => mockAbortController);
    client = createSerasaPefinHttpClient({
      fetch: mockFetch,
      env: {
        SERASA_IS_CONFIGURED: true,
        SERASA_AUTH_URL: 'https://uat-api.serasaexperian.com.br/security/iam/v1/client-identities/login',
        SERASA_DEBT_URL: 'https://api.serasa.dev/collection/debt/',
        SERASA_GUARANTOR_URL: 'https://api.serasa.dev/collection/debt/guarantor',
        SERASA_CLIENT_ID: 'test-client-id',
        SERASA_CLIENT_SECRET: 'test-client-secret',
        SERASA_MISSING_REQUIRED: [],
      },
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getBearerToken', () => {
    it('deve autenticar com Basic e retornar Bearer token no contrato documentado', async () => {
      const mockTokenResponse = {
        ok: true,
        json: async () => ({
          accessToken: 'test-bearer-token',
          tokenType: 'Bearer',
          expiresIn: String(Math.floor(Date.now() / 1000) + 3600),
        }),
      };
      mockFetch.mockResolvedValueOnce(mockTokenResponse);

      const token = await client.getBearerToken();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        env.SERASA_AUTH_URL,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: expect.stringMatching(/^Basic /),
          }),
        })
      );
      expect(token).toBe('test-bearer-token');
    });

    it('deve manter fallback controlado para access_token e expires_in', async () => {
      const mockTokenResponse = {
        ok: true,
        json: async () => ({ access_token: 'legacy-bearer-token', expires_in: 3600 }),
      };
      mockFetch.mockResolvedValueOnce(mockTokenResponse);

      const token = await client.getBearerToken();

      expect(token).toBe('legacy-bearer-token');
    });

    it('deve cachear token e reutilizar se ainda válido', async () => {
      const mockTokenResponse = {
        ok: true,
        json: async () => ({ access_token: 'test-bearer-token', expires_in: 3600 }),
      };
      mockFetch.mockResolvedValueOnce(mockTokenResponse);

      const token1 = await client.getBearerToken();
      const token2 = await client.getBearerToken();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(token1).toBe('test-bearer-token');
      expect(token2).toBe('test-bearer-token');
    });

    it('deve forçar refresh com forceRefresh=true', async () => {
      const mockTokenResponse = {
        ok: true,
        json: async () => ({ access_token: 'test-bearer-token', expires_in: 3600 }),
      };
      mockFetch.mockResolvedValue(mockTokenResponse);

      await client.getBearerToken();
      await client.getBearerToken({ forceRefresh: true });

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('deve renovar token se expirado', async () => {
      const mockTokenResponse = {
        ok: true,
        json: async () => ({ access_token: 'test-bearer-token', expires_in: 1 }),
      };
      mockFetch.mockResolvedValue(mockTokenResponse);

      await client.getBearerToken();
      await new Promise((resolve) => setTimeout(resolve, 10));
      await client.getBearerToken();

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('deve lançar erro se autenticação falhar', async () => {
      const mockErrorResponse = {
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      };
      mockFetch.mockResolvedValueOnce(mockErrorResponse);

      await expect(client.getBearerToken()).rejects.toThrow('SERASA_PEFIN_AUTH_FAILED');
    });

    it('deve lançar erro se a autenticação não retornar token em nenhum formato aceito', async () => {
      const mockTokenResponse = {
        ok: true,
        json: async () => ({ expiresIn: 3600 }),
      };
      mockFetch.mockResolvedValueOnce(mockTokenResponse);

      await expect(client.getBearerToken()).rejects.toThrow('No access token returned');
    });

    it('deve lançar erro se credenciais não configuradas', async () => {
      const clientNoConfig = createSerasaPefinHttpClient({
        fetch: mockFetch,
        env: { SERASA_CLIENT_ID: '', SERASA_CLIENT_SECRET: '' },
      });

      await expect(clientNoConfig.getBearerToken()).rejects.toThrow('SERASA_PEFIN_NOT_CONFIGURED');
    });
  });

  describe('postDebt', () => {
    it('deve enviar POST para debt URL com Bearer token e timeout', async () => {
      const mockTokenResponse = {
        ok: true,
        json: async () => ({ access_token: 'test-bearer-token', expires_in: 3600 }),
      };
      const mockDebtResponse = {
        ok: true,
        json: async () => ({ transactionId: 'txn-123' }),
      };
      mockFetch
        .mockResolvedValueOnce(mockTokenResponse)
        .mockResolvedValueOnce(mockDebtResponse);

      const payload = { value: 100.0, contractNumber: '123' };
      const result = await client.postDebt(payload);

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        env.SERASA_DEBT_URL,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-bearer-token',
          }),
          body: JSON.stringify(payload),
          signal: mockAbortController.signal,
        })
      );
      expect(result).toEqual({ transactionId: 'txn-123' });
    });

    it('deve aplicar timeout com AbortController', async () => {
      const mockTokenResponse = {
        ok: true,
        json: async () => ({ access_token: 'test-bearer-token', expires_in: 3600 }),
      };
      const mockDebtResponse = {
        ok: true,
        json: async () => ({ transactionId: 'txn-123' }),
      };
      mockFetch
        .mockResolvedValueOnce(mockTokenResponse)
        .mockResolvedValueOnce(mockDebtResponse);

      client = createSerasaPefinHttpClient({
        fetch: mockFetch,
        timeoutMs: 5000,
        env: {
          SERASA_IS_CONFIGURED: true,
          SERASA_AUTH_URL: 'https://uat-api.serasaexperian.com.br/security/iam/v1/client-identities/login',
          SERASA_DEBT_URL: 'https://api.serasa.dev/collection/debt/',
          SERASA_GUARANTOR_URL: 'https://api.serasa.dev/collection/debt/guarantor',
          SERASA_CLIENT_ID: 'test-client-id',
          SERASA_CLIENT_SECRET: 'test-client-secret',
          SERASA_MISSING_REQUIRED: [],
        },
      });

      await client.postDebt({ value: 100.0 });

      expect(AbortController).toHaveBeenCalled();
    });

    it('deve renovar token em 401 e tentar uma vez', async () => {
      const mockTokenResponse1 = {
        ok: true,
        json: async () => ({ access_token: 'expired-token', expires_in: 3600 }),
      };
      const mockDebtResponse401 = {
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      };
      const mockTokenResponse2 = {
        ok: true,
        json: async () => ({ access_token: 'new-token', expires_in: 3600 }),
      };
      const mockDebtResponse200 = {
        ok: true,
        json: async () => ({ transactionId: 'txn-123' }),
      };

      mockFetch
        .mockResolvedValueOnce(mockTokenResponse1)
        .mockResolvedValueOnce(mockDebtResponse401)
        .mockResolvedValueOnce(mockTokenResponse2)
        .mockResolvedValueOnce(mockDebtResponse200);

      const result = await client.postDebt({ value: 100.0 });

      expect(mockFetch).toHaveBeenCalledTimes(4);
      expect(result).toEqual({ transactionId: 'txn-123' });
    });

    it('não deve retry em timeout', async () => {
      const mockTokenResponse = {
        ok: true,
        json: async () => ({ access_token: 'test-bearer-token', expires_in: 3600 }),
      };
      const timeoutError = new Error('Timeout');
      timeoutError.name = 'AbortError';
      mockFetch.mockResolvedValueOnce(mockTokenResponse);
      mockFetch.mockRejectedValueOnce(timeoutError);

      await expect(client.postDebt({ value: 100.0 })).rejects.toThrow('SERASA_PEFIN_HTTP_TIMEOUT');

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('não deve retry em erro 5xx', async () => {
      const mockTokenResponse = {
        ok: true,
        json: async () => ({ access_token: 'test-bearer-token', expires_in: 3600 }),
      };
      const mockDebtResponse500 = {
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      };
      mockFetch
        .mockResolvedValueOnce(mockTokenResponse)
        .mockResolvedValueOnce(mockDebtResponse500);

      await expect(client.postDebt({ value: 100.0 })).rejects.toThrow('SERASA_PEFIN_HTTP_ERROR');

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('deve lançar erro com statusCode e código de integração', async () => {
      const mockTokenResponse = {
        ok: true,
        json: async () => ({ access_token: 'test-bearer-token', expires_in: 3600 }),
      };
      const mockDebtResponse400 = {
        ok: false,
        status: 400,
        text: async () => 'Invalid payload',
        json: async () => ({ error: 'Invalid payload' }),
      };
      mockFetch
        .mockResolvedValueOnce(mockTokenResponse)
        .mockResolvedValueOnce(mockDebtResponse400);

      const error = await client.postDebt({ value: 100.0 }).catch((e) => e);

      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('SERASA_PEFIN_HTTP_ERROR');
    });
  });

  describe('postGuarantor', () => {
    it('deve enviar POST para guarantor URL com Bearer token e timeout', async () => {
      const mockTokenResponse = {
        ok: true,
        json: async () => ({ access_token: 'test-bearer-token', expires_in: 3600 }),
      };
      const mockGuarantorResponse = {
        ok: true,
        json: async () => ({ transactionId: 'txn-456' }),
      };
      mockFetch
        .mockResolvedValueOnce(mockTokenResponse)
        .mockResolvedValueOnce(mockGuarantorResponse);

      const payload = { value: 100.0, contractNumber: '123' };
      const result = await client.postGuarantor(payload);

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        env.SERASA_GUARANTOR_URL,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-bearer-token',
          }),
          body: JSON.stringify(payload),
          signal: mockAbortController.signal,
        })
      );
      expect(result).toEqual({ transactionId: 'txn-456' });
    });

    it('deve renovar token em 401 e tentar uma vez', async () => {
      const mockTokenResponse1 = {
        ok: true,
        json: async () => ({ access_token: 'expired-token', expires_in: 3600 }),
      };
      const mockGuarantorResponse401 = {
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      };
      const mockTokenResponse2 = {
        ok: true,
        json: async () => ({ access_token: 'new-token', expires_in: 3600 }),
      };
      const mockGuarantorResponse200 = {
        ok: true,
        json: async () => ({ transactionId: 'txn-456' }),
      };

      mockFetch
        .mockResolvedValueOnce(mockTokenResponse1)
        .mockResolvedValueOnce(mockGuarantorResponse401)
        .mockResolvedValueOnce(mockTokenResponse2)
        .mockResolvedValueOnce(mockGuarantorResponse200);

      const result = await client.postGuarantor({ value: 100.0 });

      expect(mockFetch).toHaveBeenCalledTimes(4);
      expect(result).toEqual({ transactionId: 'txn-456' });
    });
  });

  describe('sanitização de logs', () => {
    it('não deve logar clientSecret em erro de autenticação', async () => {
      const mockErrorResponse = {
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      };
      mockFetch.mockResolvedValueOnce(mockErrorResponse);

      const error = await client.getBearerToken().catch((e) => e);

      expect(error.message).not.toContain(env.SERASA_CLIENT_SECRET);
    });

    it('não deve logar Bearer token em erro de HTTP', async () => {
      const mockTokenResponse = {
        ok: true,
        json: async () => ({ access_token: 'test-bearer-token', expires_in: 3600 }),
      };
      const mockDebtResponse500 = {
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      };
      mockFetch
        .mockResolvedValueOnce(mockTokenResponse)
        .mockResolvedValueOnce(mockDebtResponse500);

      const error = await client.postDebt({ value: 100.0 }).catch((e) => e);

      expect(error.message).not.toContain('test-bearer-token');
    });
  });
});
