import { XMLBuilder, XMLParser } from "fast-xml-parser";
import { PartitionOption, RmMethod } from "../types/Rm";

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  trimValues: true,
  parseTagValue: false
});

const xmlBuilder = new XMLBuilder({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  format: false,
  suppressEmptyNode: true
});

export class Xml {
  public static escape(value: string): string {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  public static extractOperationResult(xml: string, method: RmMethod): string | null {
    const resultTag = this.resolveResultTag(method);
    const regex = new RegExp(
      `<(?:[A-Za-z_][\\w.-]*:)?${resultTag}\\b[^>]*>([\\s\\S]*?)</(?:[A-Za-z_][\\w.-]*:)?${resultTag}>`,
      "i"
    );

    const match = regex.exec(xml);
    if (!match) {
      return null;
    }

    return match[1];
  }

  public static extractSoapFaultMessage(xml: string): string | null {
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

  public static extractGetSchemaResult(xml: string): string | null {
    return this.extractTagContent(xml, "GetSchemaResult");
  }

  public static inferPartitionOptionsFromSchema(schemaResult: string): PartitionOption[] {
    const decodedSchema = this.decodeEntities(schemaResult);
    const elementRegex = /<xs:element\b([^>]*?)\/?>/gi;
    const optionsMap = new Map<string, { score: number; option: PartitionOption }>();

    let match: RegExpExecArray | null;
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
      const option: PartitionOption = {
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

  private static resolveResultTag(method: RmMethod): string {
    if (method === "ReadView") {
      return "ReadViewResult";
    }

    if (method === "ReadRecord") {
      return "ReadRecordResult";
    }

    return "SaveRecordResult";
  }

  private static extractTagContent(xml: string, tagName: string): string | null {
    const escapedTagName = tagName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(
      `<(?:[A-Za-z_][\\w.-]*:)?${escapedTagName}\\b[^>]*>([\\s\\S]*?)</(?:[A-Za-z_][\\w.-]*:)?${escapedTagName}>`,
      "i"
    );

    const match = regex.exec(xml);
    if (!match) {
      return null;
    }

    return match[1];
  }

  private static extractAttribute(attributes: string, attributeName: string): string | undefined {
    const escapedAttribute = attributeName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escapedAttribute}="([^"]*)"`, "i");
    const match = regex.exec(attributes);
    if (!match) {
      return undefined;
    }

    return this.decodeEntities(match[1]).trim();
  }

  private static isLikelyFieldName(name: string): boolean {
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

  private static scorePartitionField(field: string, type: string): number {
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

    if (
      normalizedField.includes("FILIAL") ||
      normalizedField.includes("SECAO") ||
      normalizedField.includes("TIPO")
    ) {
      score += 380;
    }

    if (normalizedField.includes("NOME") || normalizedField.includes("DESCR")) {
      score += 150;
    }

    if (this.isDateType(type)) {
      score += 240;
    } else if (this.isNumericType(type)) {
      score += 220;
    } else if (this.isStringType(type)) {
      score += 80;
    }

    return score;
  }

  private static resolvePartitionStrategies(field: string, type: string): string[] {
    const normalizedField = field.toUpperCase();
    if (this.isDateType(type) || this.isNumericType(type)) {
      return ["equals", "range"];
    }

    if (
      normalizedField.startsWith("COD") ||
      normalizedField.startsWith("ID") ||
      normalizedField.includes("CHAPA")
    ) {
      return ["equals"];
    }

    return ["equals", "contains"];
  }

  private static buildExampleFilter(field: string, type: string, strategies: string[]): string {
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

  private static isDateType(type: string): boolean {
    const normalizedType = type.toLowerCase();
    return normalizedType.includes("date");
  }

  private static isNumericType(type: string): boolean {
    const normalizedType = type.toLowerCase();
    return (
      normalizedType.includes("int") ||
      normalizedType.includes("decimal") ||
      normalizedType.includes("double") ||
      normalizedType.includes("float") ||
      normalizedType.includes("long") ||
      normalizedType.includes("short") ||
      normalizedType.includes("byte")
    );
  }

  private static isStringType(type: string): boolean {
    return type.toLowerCase().includes("string");
  }

  public static parseOperationResultToJson(result: string): unknown {
    const raw = result.trim();
    const decoded = this.decodeEntities(raw).trim();
    const primaryPayload = decoded.startsWith("<") ? decoded : raw;

    if (!primaryPayload.startsWith("<")) {
      return { value: decoded };
    }

    try {
      return xmlParser.parse(primaryPayload) as unknown;
    } catch (_error) {
      if (primaryPayload !== raw && raw.startsWith("<")) {
        try {
          return xmlParser.parse(raw) as unknown;
        } catch {
          // continue to common error below
        }
      }

      throw new Error("Nao foi possivel converter resultado XML para JSON");
    }
  }

  public static buildXmlFromRecord(
    record: Record<string, unknown>,
    rootTag: string
  ): string {
    const normalizedRootTag = rootTag.trim();
    if (!this.isValidXmlTag(normalizedRootTag)) {
      throw new Error('Parametro "rootTag" invalido para SaveRecord');
    }

    const wrappedRecord = this.wrapRecordWithRoot(record, normalizedRootTag);
    return xmlBuilder.build(wrappedRecord);
  }

  private static decodeEntities(value: string): string {
    return value.replace(/&(#x?[0-9A-Fa-f]+|[A-Za-z]+);/g, (fullMatch, entity: string) => {
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

  private static wrapRecordWithRoot(
    record: Record<string, unknown>,
    rootTag: string
  ): Record<string, unknown> {
    const keys = Object.keys(record);
    if (keys.length === 1 && keys[0] === rootTag) {
      return record;
    }

    return { [rootTag]: record };
  }

  private static isValidXmlTag(value: string): boolean {
    return /^[A-Za-z_][\w.-]*$/.test(value);
  }
}
