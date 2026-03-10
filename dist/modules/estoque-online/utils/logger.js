"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
function serializeMeta(meta) {
    if (meta instanceof Error) {
        return JSON.stringify({
            name: meta.name,
            message: meta.message,
            stack: meta.stack,
        });
    }
    try {
        return JSON.stringify(meta);
    }
    catch (_error) {
        return String(meta);
    }
}
function writeLog(level, scope, message, meta) {
    const prefix = `[${new Date().toISOString()}] [${level}] [${scope}]`;
    if (meta === undefined) {
        console.log(`${prefix} ${message}`);
        return;
    }
    console.log(`${prefix} ${message} ${serializeMeta(meta)}`);
}
exports.logger = {
    info(scope, message, meta) {
        writeLog('INFO', scope, message, meta);
    },
    warn(scope, message, meta) {
        writeLog('WARN', scope, message, meta);
    },
    error(scope, message, meta) {
        writeLog('ERROR', scope, message, meta);
    },
};
