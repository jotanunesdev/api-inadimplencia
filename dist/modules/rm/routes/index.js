"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const env_1 = require("../config/env");
const RmDataServerClient_1 = require("../clients/RmDataServerClient");
const RmEntryInvoiceLookupController_1 = require("../controllers/RmEntryInvoiceLookupController");
const RmController_1 = require("../controllers/RmController");
const entryInvoiceLookup_routes_1 = require("./entryInvoiceLookup.routes");
const rm_routes_1 = require("./rm.routes");
const RmEntryInvoiceLookupService_1 = require("../services/RmEntryInvoiceLookupService");
const RmService_1 = require("../services/RmService");
const controller = new RmController_1.RmController(new RmService_1.RmService(new RmDataServerClient_1.RmDataServerClient({
    dbTrustCert: env_1.env.DB_TRUST_CERT,
    readViewUrl: env_1.env.READVIEW_URL,
    readViewUser: env_1.env.READVIEW_USER,
    readViewPassword: env_1.env.READVIEW_PASSWORD,
    readViewAction: env_1.env.READVIEW_ACTION,
    readViewNamespace: env_1.env.READVIEW_NAMESPACE,
    getSchemaAction: env_1.env.GETSCHEMA_ACTION,
    readRecordAction: env_1.env.READRECORD_ACTION,
    saveRecordAction: env_1.env.SAVERECORD_ACTION,
})));
const entryInvoiceLookupController = new RmEntryInvoiceLookupController_1.RmEntryInvoiceLookupController(new RmEntryInvoiceLookupService_1.RmEntryInvoiceLookupService());
const router = (0, express_1.Router)();
router.use((0, rm_routes_1.createRmRoutes)(controller));
router.use('/entrada-nota-fiscal/lookups', (0, entryInvoiceLookup_routes_1.createRmEntryInvoiceLookupRoutes)(entryInvoiceLookupController));
exports.default = router;
