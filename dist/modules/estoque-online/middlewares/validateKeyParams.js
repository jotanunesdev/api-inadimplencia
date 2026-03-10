"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateKeyParams = void 0;
const validators_1 = require("../utils/validators");
const validateKeyParams = (req, _res, next) => {
    try {
        (0, validators_1.parseCompositeKey)(req.params);
        next();
    }
    catch (error) {
        next(error);
    }
};
exports.validateKeyParams = validateKeyParams;
