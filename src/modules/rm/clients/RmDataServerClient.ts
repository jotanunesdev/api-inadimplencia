import axios, { AxiosRequestConfig } from "axios";
import https from "https";
import { RmConfig, RmGatewayError, RmMethod, RmSoapRequest } from "../types/Rm";
import { SoapEnvelope } from "../utils/SoapEnvelope";

export class RmDataServerClient {
  constructor(private readonly config: RmConfig) {}

  public async call(request: RmSoapRequest): Promise<string> {
    const soapEnvelope = SoapEnvelope.build(request, this.config.readViewNamespace);
    const soapAction = this.resolveSoapAction(request.method);

    return this.requestSoap(soapEnvelope, soapAction);
  }

  public async getSchema(dataserver: string, context: string): Promise<string> {
    const soapEnvelope = SoapEnvelope.buildGetSchema(
      dataserver,
      context,
      this.config.readViewNamespace
    );
    const soapAction = this.resolveGetSchemaAction();

    return this.requestSoap(soapEnvelope, soapAction);
  }

  private async requestSoap(soapEnvelope: string, soapAction: string): Promise<string> {
    
    const axiosConfig: AxiosRequestConfig<string> = {
      method: "POST",
      url: this.config.readViewUrl,
      data: soapEnvelope,
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: soapAction
      },
      auth: {
        username: this.config.readViewUser,
        password: this.config.readViewPassword
      },
      responseType: "text",
      timeout: 30000
    };

    const httpsAgent = this.buildHttpsAgent();
    if (httpsAgent) {
      axiosConfig.httpsAgent = httpsAgent;
    }

    try {
      const response = await axios.request<string>(axiosConfig);
      return typeof response.data === "string" ? response.data : String(response.data);
    } catch (error: unknown) {
      throw this.toGatewayError(error);
    }
  }

  private resolveGetSchemaAction(): string {
    if (this.config.getSchemaAction && this.config.getSchemaAction.trim().length > 0) {
      return this.config.getSchemaAction;
    }

    return this.config.readViewAction.replace(/ReadView/gi, "GetSchema");
  }

  private resolveSoapAction(method: RmMethod): string {
    if (method === "ReadView") {
      return this.config.readViewAction;
    }

    if (method === "ReadRecord") {
      if (this.config.readRecordAction && this.config.readRecordAction.trim().length > 0) {
        return this.config.readRecordAction;
      }

      return this.config.readViewAction.replace(/ReadView/gi, "ReadRecord");
    }

    if (this.config.saveRecordAction && this.config.saveRecordAction.trim().length > 0) {
      return this.config.saveRecordAction;
    }

    return this.config.readViewAction.replace(/ReadView/gi, "SaveRecord");
  }

  private buildHttpsAgent(): https.Agent | undefined {
    const isHttps = this.config.readViewUrl.toLowerCase().startsWith("https://");
    if (!isHttps || !this.config.dbTrustCert) {
      return undefined;
    }

    return new https.Agent({ rejectUnauthorized: false });
  }

  private toGatewayError(error: unknown): RmGatewayError {
    if (axios.isAxiosError(error)) {
      if (error.response) {
        const statusText = error.response.statusText ? ` ${error.response.statusText}` : "";
        return new RmGatewayError(`HTTP ${error.response.status}${statusText}`);
      }

      return new RmGatewayError(error.message);
    }

    if (error instanceof Error) {
      return new RmGatewayError(error.message);
    }

    return new RmGatewayError("Erro desconhecido ao chamar WSDataServer");
  }
}
