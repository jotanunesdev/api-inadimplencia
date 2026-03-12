"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SoapEnvelope = void 0;
const Xml_1 = require("./Xml");
class SoapEnvelope {
    static buildGetSchema(dataserver, context, namespace) {
        const escapedNamespace = Xml_1.Xml.escape(namespace);
        const body = [
            `<GetSchema xmlns="${escapedNamespace}">`,
            `<DataServerName>${Xml_1.Xml.escape(dataserver)}</DataServerName>`,
            `<Contexto>${Xml_1.Xml.escape(context)}</Contexto>`,
            `</GetSchema>`
        ].join("");
        return this.wrap(body);
    }
    static build(request, namespace) {
        const escapedNamespace = Xml_1.Xml.escape(namespace);
        if (request.method === "ReadView") {
            if (request.filter === undefined) {
                throw new Error("Filtro e obrigatorio para ReadView");
            }
            const readViewBody = [
                `<ReadView xmlns="${escapedNamespace}">`,
                `<DataServerName>${Xml_1.Xml.escape(request.dataserver)}</DataServerName>`,
                `<Filtro>${Xml_1.Xml.escape(request.filter)}</Filtro>`,
                `<Contexto>${Xml_1.Xml.escape(request.context)}</Contexto>`,
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
                `<DataServerName>${Xml_1.Xml.escape(request.dataserver)}</DataServerName>`,
                `<PrimaryKey>${Xml_1.Xml.escape(request.primaryKey)}</PrimaryKey>`,
                `<Contexto>${Xml_1.Xml.escape(request.context)}</Contexto>`,
                `</ReadRecord>`
            ].join("");
            return this.wrap(readRecordBody);
        }
        if (request.xml === undefined) {
            throw new Error("XML e obrigatorio para SaveRecord");
        }
        const saveRecordBody = [
            `<SaveRecord xmlns="${escapedNamespace}">`,
            `<DataServerName>${Xml_1.Xml.escape(request.dataserver)}</DataServerName>`,
            `<XML>${Xml_1.Xml.escape(request.xml)}</XML>`,
            `<Contexto>${Xml_1.Xml.escape(request.context)}</Contexto>`,
            `</SaveRecord>`
        ].join("");
        return this.wrap(saveRecordBody);
    }
    static wrap(body) {
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
exports.SoapEnvelope = SoapEnvelope;
