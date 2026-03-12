import { RmSoapRequest } from "../types/Rm";
import { Xml } from "./Xml";

export class SoapEnvelope {
  public static buildGetSchema(
    dataserver: string,
    context: string,
    namespace: string
  ): string {
    const escapedNamespace = Xml.escape(namespace);
    const body = [
      `<GetSchema xmlns="${escapedNamespace}">`,
      `<DataServerName>${Xml.escape(dataserver)}</DataServerName>`,
      `<Contexto>${Xml.escape(context)}</Contexto>`,
      `</GetSchema>`
    ].join("");

    return this.wrap(body);
  }

  public static build(request: RmSoapRequest, namespace: string): string {
    const escapedNamespace = Xml.escape(namespace);

    if (request.method === "ReadView") {
      if (request.filter === undefined) {
        throw new Error("Filtro e obrigatorio para ReadView");
      }

      const readViewBody = [
        `<ReadView xmlns="${escapedNamespace}">`,
        `<DataServerName>${Xml.escape(request.dataserver)}</DataServerName>`,
        `<Filtro>${Xml.escape(request.filter)}</Filtro>`,
        `<Contexto>${Xml.escape(request.context)}</Contexto>`,
        `</ReadView>`
      ].join("");

      return this.wrap(readViewBody);
    }

    if (request.method === "ReadRecord") {
      if (request.primaryKey === undefined) {
        throw new Error("PrimaryKey e obrigatorio para ReadRecord");
      }

      const readRecordBody = [
        `<ReadRecord xmlns="${escapedNamespace}">`,
        `<DataServerName>${Xml.escape(request.dataserver)}</DataServerName>`,
        `<PrimaryKey>${Xml.escape(request.primaryKey)}</PrimaryKey>`,
        `<Contexto>${Xml.escape(request.context)}</Contexto>`,
        `</ReadRecord>`
      ].join("");

      return this.wrap(readRecordBody);
    }

    if (request.xml === undefined) {
      throw new Error("XML e obrigatorio para SaveRecord");
    }

    const saveRecordBody = [
      `<SaveRecord xmlns="${escapedNamespace}">`,
      `<DataServerName>${Xml.escape(request.dataserver)}</DataServerName>`,
      `<XML>${Xml.escape(request.xml)}</XML>`,
      `<Contexto>${Xml.escape(request.context)}</Contexto>`,
      `</SaveRecord>`
    ].join("");

    return this.wrap(saveRecordBody);
  }

  private static wrap(body: string): string {
    return [
      `<?xml version="1.0" encoding="utf-8"?>`,
      `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">`,
      `<soapenv:Header/>`,
      `<soapenv:Body>`,
      body,
      `</soapenv:Body>`,
      `</soapenv:Envelope>`
    ].join("");
  }
}
