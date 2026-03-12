export type RmMethod = "ReadView" | "ReadRecord" | "SaveRecord";

export interface RmConfig {
  dbTrustCert: boolean;
  readViewUrl: string;
  readViewUser: string;
  readViewPassword: string;
  readViewAction: string;
  readViewNamespace: string;
  getSchemaAction?: string;
  readRecordAction?: string;
  saveRecordAction?: string;
}

export interface RmProxyRequest {
  dataserver?: string;
  operation?: string;
  context?: string;
  filter?: string;
  page?: string;
  primaryKey?: string;
  xml?: string;
  rootTag?: string;
  record?: Record<string, unknown>;
}

export interface RmSoapRequest {
  method: RmMethod;
  dataserver: string;
  context: string;
  filter?: string;
  primaryKey?: string;
  xml?: string;
}

export interface PartitionOption {
  field: string;
  caption?: string;
  type: string;
  strategies: string[];
  exampleFilter: string;
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export class RmGatewayError extends Error {
  public readonly details: string;

  constructor(details: string) {
    super("Falha ao chamar RM");
    this.name = "RmGatewayError";
    this.details = details;
  }
}
