type LogLevel = 'INFO' | 'WARN' | 'ERROR';

function serializeMeta(meta: unknown): string {
  if (meta instanceof Error) {
    return JSON.stringify({
      name: meta.name,
      message: meta.message,
      stack: meta.stack,
    });
  }

  try {
    return JSON.stringify(meta);
  } catch (_error) {
    return String(meta);
  }
}

function writeLog(level: LogLevel, scope: string, message: string, meta?: unknown): void {
  const prefix = `[${new Date().toISOString()}] [${level}] [${scope}]`;

  if (meta === undefined) {
    console.log(`${prefix} ${message}`);
    return;
  }

  console.log(`${prefix} ${message} ${serializeMeta(meta)}`);
}

export const logger = {
  info(scope: string, message: string, meta?: unknown): void {
    writeLog('INFO', scope, message, meta);
  },
  warn(scope: string, message: string, meta?: unknown): void {
    writeLog('WARN', scope, message, meta);
  },
  error(scope: string, message: string, meta?: unknown): void {
    writeLog('ERROR', scope, message, meta);
  },
};
