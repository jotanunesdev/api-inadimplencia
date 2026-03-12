"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RmGatewayError = exports.ValidationError = void 0;
class ValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = "ValidationError";
    }
}
exports.ValidationError = ValidationError;
class RmGatewayError extends Error {
    details;
    constructor(details) {
        super("Falha ao chamar RM");
        this.name = "RmGatewayError";
        this.details = details;
    }
}
exports.RmGatewayError = RmGatewayError;
