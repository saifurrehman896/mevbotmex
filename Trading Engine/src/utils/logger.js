import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Define custom log format
const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, stack }) => {
    if (stack) {
      return `[${timestamp}] ${level.toUpperCase()}: ${message}\n${stack}`;
    }
    return `[${timestamp}] ${level.toUpperCase()}: ${message}`;
  })
);

// Console format with colors
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message }) => {
    return `[${timestamp}] ${level}: ${message}`;
  })
);

// Create daily rotate file transport for combined logs
const combinedRotateTransport = new DailyRotateFile({
  filename: join(__dirname, '../../logs/combined-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '14d', // Keep logs for 14 days
  format: customFormat,
  level: 'info'
});

// Create daily rotate file transport for error logs
const errorRotateTransport = new DailyRotateFile({
  filename: join(__dirname, '../../logs/error-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '30d', // Keep error logs for 30 days
  format: customFormat,
  level: 'error'
});

// Create daily rotate file transport for trade logs
const tradeRotateTransport = new DailyRotateFile({
  filename: join(__dirname, '../../logs/trades-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '90d', // Keep trade logs for 90 days
  format: customFormat,
  level: 'info'
});

// Create the logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  transports: [
    // Console transport
    new winston.transports.Console({
      format: consoleFormat
    }),
    // File transports with rotation
    combinedRotateTransport,
    errorRotateTransport
  ]
});

// Create specialized trade logger
const tradeLogger = winston.createLogger({
  level: 'info',
  transports: [
    new winston.transports.Console({
      format: consoleFormat
    }),
    tradeRotateTransport
  ]
});

// Event listeners for rotation
combinedRotateTransport.on('rotate', (oldFilename, newFilename) => {
  logger.info(`Log rotation: ${oldFilename} -> ${newFilename}`);
});

errorRotateTransport.on('rotate', (oldFilename, newFilename) => {
  logger.info(`Error log rotation: ${oldFilename} -> ${newFilename}`);
});

tradeRotateTransport.on('rotate', (oldFilename, newFilename) => {
  logger.info(`Trade log rotation: ${oldFilename} -> ${newFilename}`);
});

export { logger, tradeLogger };
export default logger;
