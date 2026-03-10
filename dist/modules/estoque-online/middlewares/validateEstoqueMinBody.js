"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateEstoqueMinBody = void 0;
const validators_1 = require("../utils/validators");
const validateEstoqueMinBody = (req, _res, next) => {
    try {
        (0, validators_1.parseEstoqueMinPayload)(req.body);
        next();
    }
    catch (error) {
        next(error);
    }
};
exports.validateEstoqueMinBody = validateEstoqueMinBody;
