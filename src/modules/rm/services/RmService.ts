import { RmDataServerClient } from "../clients/RmDataServerClient";
import {
  RmGatewayError,
  RmMethod,
  RmProxyRequest,
  RmSoapRequest,
  ValidationError
} from "../types/Rm";
import { Xml } from "../utils/Xml";

const READ_VIEW_PAGE_SIZE = 20;

export class RmService {
  constructor(private readonly rmDataServerClient: RmDataServerClient) {}

  public async getPartitionOptions(request: RmProxyRequest): Promise<unknown> {
    const dataserver = this.requireRouteParam("dataserver", request.dataserver);
    const context = this.requireInputParam("context", request.context);
    const soapResponse = await this.rmDataServerClient.getSchema(dataserver, context);
    const schemaResult = Xml.extractGetSchemaResult(soapResponse);

    if (schemaResult === null) {
      const faultMessage = Xml.extractSoapFaultMessage(soapResponse);
      if (faultMessage) {
        throw new RmGatewayError(faultMessage);
      }

      throw new RmGatewayError("Tag GetSchemaResult nao encontrada na resposta SOAP");
    }

    const partitionOptions = Xml.inferPartitionOptionsFromSchema(schemaResult);

    return {
      dataserver,
      partitionOptions
    };
  }

  public async execute(request: RmProxyRequest): Promise<unknown> {
    const method = this.parseMethod(request.operation);
    const dataserver = this.requireRouteParam("dataserver", request.dataserver);
    const context = this.requireInputParam("context", request.context);
    const page = this.parsePage(request.page);

    const soapRequest: RmSoapRequest = {
      method,
      dataserver,
      context
    };

    if (method === "ReadView") {
      soapRequest.filter = this.requireInputParam("filter", request.filter);
    } else if (method === "ReadRecord") {
      soapRequest.primaryKey = this.requireInputParam("primaryKey", request.primaryKey);
    } else {
      soapRequest.xml = this.resolveSaveRecordXml(request, dataserver);
    }

    const soapResponse = await this.rmDataServerClient.call(soapRequest);
    const result = Xml.extractOperationResult(soapResponse, method);

    if (result === null) {
      const faultMessage = Xml.extractSoapFaultMessage(soapResponse);
      if (faultMessage) {
        throw new RmGatewayError(faultMessage);
      }

      throw new RmGatewayError(`Tag ${method}Result nao encontrada na resposta SOAP`);
    }

    try {
      const parsedResult = Xml.parseOperationResultToJson(result);

      if (method === "ReadView") {
        return this.paginateReadViewResult(parsedResult, page);
      }

      return parsedResult;
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new RmGatewayError(error.message);
      }

      throw new RmGatewayError("Nao foi possivel converter resultado XML para JSON");
    }
  }

  private parseMethod(value?: string): RmMethod {
    if (!value || value.trim().length === 0) {
      throw new ValidationError('Parametro de rota "readvieworreadrecord" e obrigatorio');
    }

    const normalized = value.trim().toLowerCase();
    if (normalized === "readview") {
      return "ReadView";
    }

    if (normalized === "readrecord") {
      return "ReadRecord";
    }

    if (normalized === "saverecord") {
      return "SaveRecord";
    }

    throw new ValidationError(
      'Parametro "readvieworreadrecord" deve ser ReadView, ReadRecord ou SaveRecord'
    );
  }

  private requireRouteParam(name: string, value?: string): string {
    if (!value || value.trim().length === 0) {
      throw new ValidationError(`Parametro de rota "${name}" e obrigatorio`);
    }

    return value.trim();
  }

  private requireInputParam(name: string, value?: string): string {
    if (!value || value.trim().length === 0) {
      throw new ValidationError(`Parametro "${name}" e obrigatorio`);
    }

    return value.trim();
  }

  private parsePage(value?: string): number {
    if (!value || value.trim().length === 0) {
      return 1;
    }

    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1) {
      throw new ValidationError('Parametro "page" deve ser um inteiro maior ou igual a 1');
    }

    return parsed;
  }

  private paginateReadViewResult(result: unknown, page: number): unknown {
    const arrayPath = this.findFirstArrayPath(result);
    if (!arrayPath) {
      return this.appendNextPageFlag(result, false);
    }

    const sourceArray = this.getArrayByPath(result, arrayPath);
    if (!sourceArray) {
      return this.appendNextPageFlag(result, false);
    }

    const start = (page - 1) * READ_VIEW_PAGE_SIZE;
    const end = start + READ_VIEW_PAGE_SIZE;
    const paginatedItems = sourceArray.slice(start, end);
    const nextPage = end < sourceArray.length;
    const paginatedResult = this.replaceArrayAtPath(result, arrayPath, paginatedItems);

    return this.appendNextPageFlag(paginatedResult, nextPage);
  }

  private findFirstArrayPath(value: unknown, currentPath: string[] = []): string[] | null {
    if (Array.isArray(value)) {
      return currentPath;
    }

    if (!this.isPlainObject(value)) {
      return null;
    }

    for (const key of Object.keys(value)) {
      const nestedPath = this.findFirstArrayPath(value[key], [...currentPath, key]);
      if (nestedPath) {
        return nestedPath;
      }
    }

    return null;
  }

  private getArrayByPath(value: unknown, path: string[]): unknown[] | null {
    if (path.length === 0) {
      return Array.isArray(value) ? value : null;
    }

    let current: unknown = value;
    for (const key of path) {
      if (!this.isPlainObject(current)) {
        return null;
      }

      current = current[key];
    }

    return Array.isArray(current) ? current : null;
  }

  private replaceArrayAtPath(value: unknown, path: string[], replacement: unknown[]): unknown {
    if (path.length === 0) {
      return replacement;
    }

    if (!this.isPlainObject(value)) {
      return value;
    }

    let current: unknown = value;
    for (let index = 0; index < path.length - 1; index += 1) {
      const key = path[index];
      if (!this.isPlainObject(current)) {
        return value;
      }

      current = current[key];
    }

    if (!this.isPlainObject(current)) {
      return value;
    }

    const targetKey = path[path.length - 1];
    current[targetKey] = replacement;

    return value;
  }

  private appendNextPageFlag(result: unknown, nextPage: boolean): unknown {
    if (this.isPlainObject(result)) {
      return { ...result, nextPage };
    }

    if (Array.isArray(result)) {
      return { data: result, nextPage };
    }

    return { data: result, nextPage };
  }

  private isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  private resolveSaveRecordXml(request: RmProxyRequest, dataserver: string): string {
    const providedXml = request.xml?.trim();
    if (providedXml && providedXml.length > 0) {
      return providedXml;
    }

    const record = request.record;
    if (!record || Object.keys(record).length === 0) {
      throw new ValidationError('Para SaveRecord informe "xml" ou "record"');
    }

    const rootTag = this.resolveSaveRecordRootTag(request.rootTag, dataserver);

    try {
      return Xml.buildXmlFromRecord(record, rootTag);
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new ValidationError(error.message);
      }

      throw new ValidationError('Nao foi possivel converter "record" para XML');
    }
  }

  private resolveSaveRecordRootTag(rootTag: string | undefined, dataserver: string): string {
    if (rootTag && rootTag.trim().length > 0) {
      return rootTag.trim();
    }

    return dataserver;
  }
}
