"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RmController = void 0;
const Rm_1 = require("../types/Rm");
class RmController {
    rmService;
    constructor(rmService) {
        this.rmService = rmService;
    }
    health = (_req, res) => {
        res.status(200).json({ ok: true });
    };
    partitionOptions = async (req, res) => {
        const context = this.getInputValue(req, "context");
        try {
            const options = await this.rmService.getPartitionOptions({
                dataserver: this.toTrimmed(this.toSingleParam(req.params.dataserver)),
                context
            });
            res.status(200).json(options);
        }
        catch (error) {
            if (error instanceof Rm_1.ValidationError) {
                res.status(400).json({ error: error.message });
                return;
            }
            if (error instanceof Rm_1.RmGatewayError) {
                res.status(502).json({ error: "Falha ao chamar RM", details: error.details });
                return;
            }
            if (error instanceof Error) {
                res.status(502).json({ error: "Falha ao chamar RM", details: error.message });
                return;
            }
            res.status(502).json({ error: "Falha ao chamar RM", details: "Erro inesperado" });
        }
    };
    proxy = async (req, res) => {
        const context = this.getInputValue(req, "context");
        const filter = this.getInputValue(req, "filter");
        const page = this.getInputValue(req, "page");
        const primaryKey = this.getInputValue(req, "primaryKey");
        const xml = this.getInputValue(req, "xml");
        const rootTag = this.getInputValue(req, "rootTag");
        const record = this.getRecordInput(req);
        try {
            const resultJson = await this.rmService.execute({
                dataserver: this.toTrimmed(this.toSingleParam(req.params.dataserver)),
                operation: this.toTrimmed(this.toSingleParam(req.params.readvieworreadrecord)),
                context,
                filter,
                page,
                primaryKey,
                xml,
                rootTag,
                record
            });
            res.status(200).json(resultJson);
        }
        catch (error) {
            if (error instanceof Rm_1.ValidationError) {
                res.status(400).json({ error: error.message });
                return;
            }
            if (error instanceof Rm_1.RmGatewayError) {
                res.status(502).json({ error: "Falha ao chamar RM", details: error.details });
                return;
            }
            if (error instanceof Error) {
                res.status(502).json({ error: "Falha ao chamar RM", details: error.message });
                return;
            }
            res.status(502).json({ error: "Falha ao chamar RM", details: "Erro inesperado" });
        }
    };
    toSingleValue(value) {
        if (typeof value === "string") {
            return value;
        }
        if (typeof value === "number" || typeof value === "boolean") {
            return String(value);
        }
        if (Array.isArray(value) && value.length > 0) {
            return this.toSingleValue(value[0]);
        }
        return undefined;
    }
    toTrimmed(value) {
        if (value === undefined) {
            return undefined;
        }
        return value.trim();
    }
    toSingleParam(value) {
        if (typeof value === "string") {
            return value;
        }
        if (Array.isArray(value) && value.length > 0 && typeof value[0] === "string") {
            return value[0];
        }
        return undefined;
    }
    getInputValue(req, key) {
        const queryValue = this.toSingleValue(req.query[key]);
        const bodyValue = this.toSingleValue(req.body?.[key]);
        const canUseBody = req.method !== "GET";
        if (canUseBody && bodyValue !== undefined) {
            return bodyValue;
        }
        return queryValue ?? bodyValue;
    }
    getRecordInput(req) {
        const bodyRecord = this.parseRecordValue(req.body?.record);
        const queryRecord = this.parseRecordValue(req.query.record);
        if (req.method !== "GET" && bodyRecord) {
            return bodyRecord;
        }
        return bodyRecord ?? queryRecord;
    }
    parseRecordValue(value) {
        if (this.isPlainObject(value)) {
            return value;
        }
        const asSingle = this.toSingleValue(value);
        if (!asSingle) {
            return undefined;
        }
        try {
            const parsed = JSON.parse(asSingle);
            if (this.isPlainObject(parsed)) {
                return parsed;
            }
        }
        catch {
            return undefined;
        }
        return undefined;
    }
    isPlainObject(value) {
        return typeof value === "object" && value !== null && !Array.isArray(value);
    }
}
exports.RmController = RmController;
