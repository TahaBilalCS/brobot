import { transports, format, createLogger } from 'winston';
const { combine, timestamp, ms, colorize, printf, errors, align } = format;
import { getCurrentDateEST } from './TimeUtil.js';

/**
 * Setup logger with custom format
 */
export const logger = createLogger({
    level: 'info',
    format: combine(
        errors({ stack: true }), // Stack trace for errors
        align(),
        timestamp({ format: getCurrentDateEST }), // Custom timestamp
        ms(), // Duration between logs
        colorize({ all: true }),
        printf(info => `${info.ms}: ${info.timestamp} ${info.message}`)
    ),
    transports: [new transports.Console({ stderrLevels: ['error'] })]
});

/**
 * Handle and log catch clause error messages
 * @param err
 * @param customMsg
 */
export const logError = (err: unknown, customMsg: string): void => {
    let msg;
    if (err instanceof Error) msg = err.message; // narrowed to Error
    else if (typeof err === 'string') msg = err; // narrowed to string
    else {
        logger.error('Could not determine type of error');
        msg = String(err);
    }
    logger.error(customMsg);
    logger.error(msg);
};
