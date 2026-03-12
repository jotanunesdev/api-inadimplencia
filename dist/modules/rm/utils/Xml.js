"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Xml = void 0;
const fast_xml_parser_1 = require("fast-xml-parser");
const xmlParser = new fast_xml_parser_1.XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    textNodeName: "#text",
    trimValues: true,
    parseTagValue: false
});
const xmlBuilder = new fast_xml_parser_1.XMLBuilder({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    format: false,
    suppressEmptyNode: true
});
class Xml {
    static escape(value) {
        return value
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&apos;");
    }
    static extractOperationResult(xml, method) {
        const resultTag = this.resolveResultTag(method);
        const regex = new RegExp(`<(?:[A-Za-z_][\\w.-]*:)?${resultTag}\\b[^>]*>([\\s\\S]*?)</(?:[A-Za-z_][\\w.-]*:)?${resultTag}>`, "i");
        const match = regex.exec(xml);
        if (!match) {
            return null;
        }
        return match[1];
    }
    static extractSoapFaultMessage(xml) {
        const faultString = this.extractTagContent(xml, "faultstring");
        const detailMessage = this.extractTagContent(xml, "Message");
        const reasonText = this.extractTagContent(xml, "Text");
        const candidates = [faultString, detailMessage, reasonText]
            .map((value) => (value ? this.decodeEntities(value).trim() : ""))
            .filter((value) => value.length > 0);
        if (candidates.length === 0) {
            return null;
        }
        return candidates[0];
    }
    static extractGetSchemaResult(xml) {
        return this.extractTagContent(xml, "GetSchemaResult");
    }
    static inferPartitionOptionsFromSchema(schemaResult) {
        const decodedSchema = this.decodeEntities(schemaResult);
        const elementRegex = /<xs:element\b([^>]*?)\/?>/gi;
        const optionsMap = new Map();
        let match;
        while ((match = elementRegex.exec(decodedSchema)) !== null) {
            const attributes = match[1];
            const field = this.extractAttribute(attributes, "name");
            if (!field || !this.isLikelyFieldName(field)) {
                continue;
            }
            const explicitType = this.extractAttribute(attributes, "type");
            const caption = this.extractAttribute(attributes, "msdata:Caption");
            if (!explicitType && !caption) {
                continue;
            }
            const type = explicitType ?? "xs:string";
            const strategies = this.resolvePartitionStrategies(field, type);
            const option = {
                field,
                caption,
                type,
                strategies,
                exampleFilter: this.buildExampleFilter(field, type, strategies)
            };
            const score = this.scorePartitionField(field, type);
            const current = optionsMap.get(field);
            if (!current || score > current.score) {
                optionsMap.set(field, { score, option });
            }
        }
        return [...optionsMap.values()]
            .sort((left, right) => right.score - left.score || left.option.field.localeCompare(right.option.field))
            .slice(0, 12)
            .map((item) => item.option);
    }
    static resolveResultTag(method) {
        if (method === "ReadView") {
            return "ReadViewResult";
        }
        if (method === "ReadRecord") {
            return "ReadRecordResult";
        }
        return "SaveRecordResult";
    }
    static extractTagContent(xml, tagName) {
        const escapedTagName = tagName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(`<(?:[A-Za-z_][\\w.-]*:)?${escapedTagName}\\b[^>]*>([\\s\\S]*?)</(?:[A-Za-z_][\\w.-]*:)?${escapedTagName}>`, "i");
        const match = regex.exec(xml);
        if (!match) {
            return null;
        }
        return match[1];
    }
    static extractAttribute(attributes, attributeName) {
        const escapedAttribute = attributeName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(`\\b${escapedAttribute}="([^"]*)"`, "i");
        const match = regex.exec(attributes);
        if (!match) {
            return undefined;
        }
        return this.decodeEntities(match[1]).trim();
    }
    static isLikelyFieldName(name) {
        if (!/^[A-Za-z_][\w.-]*$/.test(name)) {
            return false;
        }
        const blockedNames = new Set([
            "NewDataSet",
            "DocumentElement",
            "diffgr:diffgram",
            "xs:schema",
            "msdata"
        ]);
        if (blockedNames.has(name)) {
            return false;
        }
        return true;
    }
    static scorePartitionField(field, type) {
        const normalizedField = field.toUpperCase();
        let score = 0;
        if (normalizedField === "CODCOLIGADA") {
            score += 1000;
        }
        if (normalizedField.startsWith("COD")) {
            score += 600;
        }
        if (normalizedField.startsWith("ID")) {
            score += 550;
        }
        if (normalizedField.includes("CHAPA")) {
            score += 520;
        }
        if (normalizedField.includes("DATA") || normalizedField.startsWith("DT")) {
            score += 500;
        }
        if (normalizedField.includes("ANO") || normalizedField.includes("MES")) {
            score += 420;
        }
        if (normalizedField.includes("FILIAL") ||
            normalizedField.includes("SECAO") ||
            normalizedField.includes("TIPO")) {
            score += 380;
        }
        if (normalizedField.includes("NOME") || normalizedField.includes("DESCR")) {
            score += 150;
        }
        if (this.isDateType(type)) {
            score += 240;
        }
        else if (this.isNumericType(type)) {
            score += 220;
        }
        else if (this.isStringType(type)) {
            score += 80;
        }
        return score;
    }
    static resolvePartitionStrategies(field, type) {
        const normalizedField = field.toUpperCase();
        if (this.isDateType(type) || this.isNumericType(type)) {
            return ["equals", "range"];
        }
        if (normalizedField.startsWith("COD") ||
            normalizedField.startsWith("ID") ||
            normalizedField.includes("CHAPA")) {
            return ["equals"];
        }
        return ["equals", "contains"];
    }
    static buildExampleFilter(field, type, strategies) {
        if (strategies.includes("range")) {
            if (this.isDateType(type)) {
                return `${field} >= '2026-01-01' AND ${field} < '2026-02-01'`;
            }
            return `${field} >= 1 AND ${field} <= 1000`;
        }
        if (strategies.includes("contains")) {
            return `${field} LIKE '%VALOR%'`;
        }
        if (this.isNumericType(type)) {
            return `${field}=1`;
        }
        return `${field}='VALOR'`;
    }
    static isDateType(type) {
        const normalizedType = type.toLowerCase();
        return normalizedType.includes("date");
    }
    static isNumericType(type) {
        const normalizedType = type.toLowerCase();
        return (normalizedType.includes("int") ||
            normalizedType.includes("decimal") ||
            normalizedType.includes("double") ||
            normalizedType.includes("float") ||
            normalizedType.includes("long") ||
            normalizedType.includes("short") ||
            normalizedType.includes("byte"));
    }
    static isStringType(type) {
        return type.toLowerCase().includes("string");
    }
    static parseOperationResultToJson(result) {
        const raw = result.trim();
        const decoded = this.decodeEntities(raw).trim();
        const primaryPayload = decoded.startsWith("<") ? decoded : raw;
        if (!primaryPayload.startsWith("<")) {
            return { value: decoded };
        }
        try {
            return xmlParser.parse(primaryPayload);
        }
        catch (_error) {
            if (primaryPayload !== raw && raw.startsWith("<")) {
                try {
                    return xmlParser.parse(raw);
                }
                catch {
                    // continue to common error below
                }
            }
            throw new Error("Nao foi possivel converter resultado XML para JSON");
        }
    }
    static buildXmlFromRecord(record, rootTag) {
        const normalizedRootTag = rootTag.trim();
        if (!this.isValidXmlTag(normalizedRootTag)) {
            throw new Error('Parametro "rootTag" invalido para SaveRecord');
        }
        const wrappedRecord = this.wrapRecordWithRoot(record, normalizedRootTag);
        return xmlBuilder.build(wrappedRecord);
    }
    static decodeEntities(value) {
        return value.replace(/&(#x?[0-9A-Fa-f]+|[A-Za-z]+);/g, (fullMatch, entity) => {
            if (entity.startsWith("#")) {
                const isHex = entity[1]?.toLowerCase() === "x";
                const numberPart = isHex ? entity.slice(2) : entity.slice(1);
                const codePoint = Number.parseInt(numberPart, isHex ? 16 : 10);
                if (!Number.isInteger(codePoint) || codePoint < 0 || codePoint > 0x10ffff) {
                    return fullMatch;
                }
                return String.fromCodePoint(codePoint);
            }
            switch (entity.toLowerCase()) {
                case "amp":
                    return "&";
                case "lt":
                    return "<";
                case "gt":
                    return ">";
                case "quot":
                    return '"';
                case "apos":
                    return "'";
                default:
                    return fullMatch;
            }
        });
    }
    static wrapRecordWithRoot(record, rootTag) {
        const keys = Object.keys(record);
        if (keys.length === 1 && keys[0] === rootTag) {
            return record;
        }
        return { [rootTag]: record };
    }
    static isValidXmlTag(value) {
        return /^[A-Za-z_][\w.-]*$/.test(value);
    }
}
exports.Xml = Xml;
