import { transports, format, createLogger } from 'winston';
const { combine, timestamp, ms, colorize, printf, align } = format;
import { getCurrentDateEST } from './TimeUtil.js';

/**
 * Setup logger with custom format
 */
export const logger = createLogger({
    level: 'info',
    format: combine(
        align(),
        timestamp({ format: getCurrentDateEST }), // Custom timestamp
        ms(), // Duration between logs
        colorize({ all: true }),
        printf(info => `${info.ms}: ${info.timestamp} ${info.message}`)
    ),
    transports: [new transports.Console()]
});
