"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RmDataServerClient = void 0;
const axios_1 = __importDefault(require("axios"));
const https_1 = __importDefault(require("https"));
const Rm_1 = require("../types/Rm");
const SoapEnvelope_1 = require("../utils/SoapEnvelope");
class RmDataServerClient {
    config;
    constructor(config) {
        this.config = config;
    }
    async call(request) {
        const soapEnvelope = SoapEnvelope_1.SoapEnvelope.build(request, this.config.readViewNamespace);
        const soapAction = this.resolveSoapAction(request.method);
        return this.requestSoap(soapEnvelope, soapAction);
    }
    async getSchema(dataserver, context) {
        const soapEnvelope = SoapEnvelope_1.SoapEnvelope.buildGetSchema(dataserver, context, this.config.readViewNamespace);
        const soapAction = this.resolveGetSchemaAction();
        return this.requestSoap(soapEnvelope, soapAction);
    }
    async requestSoap(soapEnvelope, soapAction) {
        const axiosConfig = {
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
            const response = await axios_1.default.request(axiosConfig);
            return typeof response.data === "string" ? response.data : String(response.data);
        }
        catch (error) {
            throw this.toGatewayError(error);
        }
    }
    resolveGetSchemaAction() {
        if (this.config.getSchemaAction && this.config.getSchemaAction.trim().length > 0) {
            return this.config.getSchemaAction;
        }
        return this.config.readViewAction.replace(/ReadView/gi, "GetSchema");
    }
    resolveSoapAction(method) {
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
    buildHttpsAgent() {
        const isHttps = this.config.readViewUrl.toLowerCase().startsWith("https://");
        if (!isHttps || !this.config.dbTrustCert) {
            return undefined;
        }
        return new https_1.default.Agent({ rejectUnauthorized: false });
    }
    toGatewayError(error) {
        if (axios_1.default.isAxiosError(error)) {
            if (error.response) {
                const statusText = error.response.statusText ? ` ${error.response.statusText}` : "";
                return new Rm_1.RmGatewayError(`HTTP ${error.response.status}${statusText}`);
            }
            return new Rm_1.RmGatewayError(error.message);
        }
        if (error instanceof Error) {
            return new Rm_1.RmGatewayError(error.message);
        }
        return new Rm_1.RmGatewayError("Erro desconhecido ao chamar WSDataServer");
    }
}
exports.RmDataServerClient = RmDataServerClient;
