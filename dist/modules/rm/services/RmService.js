"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RmService = void 0;
const Rm_1 = require("../types/Rm");
const Xml_1 = require("../utils/Xml");
const READ_VIEW_PAGE_SIZE = 20;
class RmService {
    rmDataServerClient;
    constructor(rmDataServerClient) {
        this.rmDataServerClient = rmDataServerClient;
    }
    async getPartitionOptions(request) {
        const dataserver = this.requireRouteParam("dataserver", request.dataserver);
        const context = this.requireInputParam("context", request.context);
        const soapResponse = await this.rmDataServerClient.getSchema(dataserver, context);
        const schemaResult = Xml_1.Xml.extractGetSchemaResult(soapResponse);
        if (schemaResult === null) {
            const faultMessage = Xml_1.Xml.extractSoapFaultMessage(soapResponse);
            if (faultMessage) {
                throw new Rm_1.RmGatewayError(faultMessage);
            }
            throw new Rm_1.RmGatewayError("Tag GetSchemaResult nao encontrada na resposta SOAP");
        }
        const partitionOptions = Xml_1.Xml.inferPartitionOptionsFromSchema(schemaResult);
        return {
            dataserver,
            partitionOptions
        };
    }
    async execute(request) {
        const method = this.parseMethod(request.operation);
        const dataserver = this.requireRouteParam("dataserver", request.dataserver);
        const context = this.requireInputParam("context", request.context);
        const page = this.parsePage(request.page);
        const soapRequest = {
            method,
            dataserver,
            context
        };
        if (method === "ReadView") {
            soapRequest.filter = this.requireInputParam("filter", request.filter);
        }
        else if (method === "ReadRecord") {
            soapRequest.primaryKey = this.requireInputParam("primaryKey", request.primaryKey);
        }
        else {
            soapRequest.xml = this.resolveSaveRecordXml(request, dataserver);
        }
        const soapResponse = await this.rmDataServerClient.call(soapRequest);
        const result = Xml_1.Xml.extractOperationResult(soapResponse, method);
        if (result === null) {
            const faultMessage = Xml_1.Xml.extractSoapFaultMessage(soapResponse);
            if (faultMessage) {
                throw new Rm_1.RmGatewayError(faultMessage);
            }
            throw new Rm_1.RmGatewayError(`Tag ${method}Result nao encontrada na resposta SOAP`);
        }
        try {
            const parsedResult = Xml_1.Xml.parseOperationResultToJson(result);
            if (method === "ReadView") {
                return this.paginateReadViewResult(parsedResult, page);
            }
            return parsedResult;
        }
        catch (error) {
            if (error instanceof Error) {
                throw new Rm_1.RmGatewayError(error.message);
            }
            throw new Rm_1.RmGatewayError("Nao foi possivel converter resultado XML para JSON");
        }
    }
    parseMethod(value) {
        if (!value || value.trim().length === 0) {
            throw new Rm_1.ValidationError('Parametro de rota "readvieworreadrecord" e obrigatorio');
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
        throw new Rm_1.ValidationError('Parametro "readvieworreadrecord" deve ser ReadView, ReadRecord ou SaveRecord');
    }
    requireRouteParam(name, value) {
        if (!value || value.trim().length === 0) {
            throw new Rm_1.ValidationError(`Parametro de rota "${name}" e obrigatorio`);
        }
        return value.trim();
    }
    requireInputParam(name, value) {
        if (!value || value.trim().length === 0) {
            throw new Rm_1.ValidationError(`Parametro "${name}" e obrigatorio`);
        }
        return value.trim();
    }
    parsePage(value) {
        if (!value || value.trim().length === 0) {
            return 1;
        }
        const parsed = Number(value);
        if (!Number.isInteger(parsed) || parsed < 1) {
            throw new Rm_1.ValidationError('Parametro "page" deve ser um inteiro maior ou igual a 1');
        }
        return parsed;
    }
    paginateReadViewResult(result, page) {
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
    findFirstArrayPath(value, currentPath = []) {
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
    getArrayByPath(value, path) {
        if (path.length === 0) {
            return Array.isArray(value) ? value : null;
        }
        let current = value;
        for (const key of path) {
            if (!this.isPlainObject(current)) {
                return null;
            }
            current = current[key];
        }
        return Array.isArray(current) ? current : null;
    }
    replaceArrayAtPath(value, path, replacement) {
        if (path.length === 0) {
            return replacement;
        }
        if (!this.isPlainObject(value)) {
            return value;
        }
        let current = value;
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
    appendNextPageFlag(result, nextPage) {
        if (this.isPlainObject(result)) {
            return { ...result, nextPage };
        }
        if (Array.isArray(result)) {
            return { data: result, nextPage };
        }
        return { data: result, nextPage };
    }
    isPlainObject(value) {
        return typeof value === "object" && value !== null && !Array.isArray(value);
    }
    resolveSaveRecordXml(request, dataserver) {
        const providedXml = request.xml?.trim();
        if (providedXml && providedXml.length > 0) {
            return providedXml;
        }
        const record = request.record;
        if (!record || Object.keys(record).length === 0) {
            throw new Rm_1.ValidationError('Para SaveRecord informe "xml" ou "record"');
        }
        const rootTag = this.resolveSaveRecordRootTag(request.rootTag, dataserver);
        try {
            return Xml_1.Xml.buildXmlFromRecord(record, rootTag);
        }
        catch (error) {
            if (error instanceof Error) {
                throw new Rm_1.ValidationError(error.message);
            }
            throw new Rm_1.ValidationError('Nao foi possivel converter "record" para XML');
        }
    }
    resolveSaveRecordRootTag(rootTag, dataserver) {
        if (rootTag && rootTag.trim().length > 0) {
            return rootTag.trim();
        }
        return dataserver;
    }
}
exports.RmService = RmService;
