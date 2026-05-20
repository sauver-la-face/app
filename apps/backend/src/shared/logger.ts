import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import pino from 'pino';

export const auditLogFilePath = resolve(
  process.env.AUDIT_LOG_FILE_PATH ?? '.logs/backend-audit.log',
);

mkdirSync(dirname(auditLogFilePath), { recursive: true });

const fileDestination = pino.destination({
  dest: auditLogFilePath,
  sync: false,
});

export const logger = pino(
  {
    level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  },
  pino.multistream([{ stream: process.stdout }, { stream: fileDestination }]),
);
