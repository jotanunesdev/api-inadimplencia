"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readView = readView;
exports.extractPFunc = extractPFunc;
exports.extractPFuncRows = extractPFuncRows;
const fast_xml_parser_1 = require("fast-xml-parser");
const env_1 = require("../config/env");
const httpError_1 = require("../utils/httpError");
const parser = new fast_xml_parser_1.XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
    removeNSPrefix: true,
    trimValues: true,
    parseTagValue: false,
    parseAttributeValue: false,
});
function escapeXml(value) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&apos;");
}
function buildEnvelope({ dataServerName, filter, context }) {
    const dataServer = escapeXml(dataServerName);
    const filterValue = filter ? escapeXml(filter) : "";
    const contextValue = context ? escapeXml(context) : "";
    return [
        "<?xml version=\"1.0\" encoding=\"utf-8\"?>",
        `<soapenv:Envelope xmlns:soapenv=\"http://schemas.xmlsoap.org/soap/envelope/\" xmlns:tot=\"${env_1.env.READVIEW_NAMESPACE}\">`,
        "<soapenv:Header/>",
        "<soapenv:Body>",
        "<tot:ReadView>",
        `<tot:DataServerName>${dataServer}</tot:DataServerName>`,
        filterValue ? `<tot:Filtro>${filterValue}</tot:Filtro>` : "",
        contextValue ? `<tot:Contexto>${contextValue}</tot:Contexto>` : "",
        "</tot:ReadView>",
        "</soapenv:Body>",
        "</soapenv:Envelope>",
    ].join("");
}
function findByKey(value, key) {
    if (!value || typeof value !== "object") {
        return null;
    }
    if (Array.isArray(value)) {
        for (const item of value) {
            const found = findByKey(item, key);
            if (found) {
                return found;
            }
        }
        return null;
    }
    const record = value;
    if (record[key] !== undefined) {
        return record[key];
    }
    for (const child of Object.values(record)) {
        const found = findByKey(child, key);
        if (found) {
            return found;
        }
    }
    return null;
}
function normalizeResult(result) {
    if (!result) {
        return null;
    }
    if (typeof result === "string") {
        const trimmed = result.trim();
        if (trimmed.startsWith("<")) {
            return parser.parse(trimmed);
        }
        return trimmed;
    }
    return result;
}
async function readView(params) {
    const body = buildEnvelope(params);
    const basicAuth = Buffer.from(`${env_1.env.READVIEW_USER}:${env_1.env.READVIEW_PASSWORD}`).toString("base64");
    const headers = {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "text/xml; charset=utf-8",
        Accept: "text/xml, application/xml",
    };
    if (env_1.env.READVIEW_ACTION) {
        headers.SOAPAction = env_1.env.READVIEW_ACTION;
    }
    const response = await fetch(env_1.env.READVIEW_URL, {
        method: "POST",
        headers,
        body,
    });
    const text = await response.text();
    if (!response.ok) {
        throw new httpError_1.HttpError(response.status, `ReadView falhou: ${response.status} ${response.statusText}`);
    }
    const parsed = parser.parse(text);
    const fault = findByKey(parsed, "Fault");
    if (fault) {
        throw new httpError_1.HttpError(502, "ReadView retornou erro");
    }
    const resultNode = findByKey(parsed, "ReadViewResult");
    return normalizeResult(resultNode);
}
function extractPFunc(result) {
    if (!result || typeof result !== "object") {
        return null;
    }
    const pfunc = findByKey(result, "PFunc");
    if (!pfunc) {
        return null;
    }
    if (Array.isArray(pfunc)) {
        return pfunc[0];
    }
    return pfunc;
}
function toStringRecord(value) {
    if (!value || typeof value !== "object") {
        return null;
    }
    const source = value;
    const record = {};
    for (const [key, raw] of Object.entries(source)) {
        if (raw === null || raw === undefined)
            continue;
        if (typeof raw === "object")
            continue;
        const text = String(raw).trim();
        if (!text)
            continue;
        record[key] = text;
    }
    return Object.keys(record).length > 0 ? record : null;
}
function extractPFuncRows(result) {
    if (!result || typeof result !== "object") {
        return [];
    }
    const pfunc = findByKey(result, "PFunc");
    if (!pfunc) {
        return [];
    }
    if (Array.isArray(pfunc)) {
        return pfunc
            .map((item) => toStringRecord(item))
            .filter((item) => Boolean(item));
    }
    const single = toStringRecord(pfunc);
    return single ? [single] : [];
}
