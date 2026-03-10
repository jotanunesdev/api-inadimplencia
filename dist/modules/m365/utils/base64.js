"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.arrayBufferToBase64 = arrayBufferToBase64;
function arrayBufferToBase64(buffer) {
    return Buffer.from(buffer).toString('base64');
}
