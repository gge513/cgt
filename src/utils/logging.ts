/**
 * Unified logging system for console and file output
 */

import * as fs from "fs";
import * as path from "path";
import { LogLevel } from "../types";

const LOG_FILE = ".pipeline.log";
const LOG_LEVELS: Record<string, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class Logger {
  private logLevel: LogLevel;
  private logFilePath: string;

  constructor(level: LogLevel = LogLevel.INFO) {
    this.logLevel = level;
    this.logFilePath = path.join(process.cwd(), LOG_FILE);
    this.initLogFile();
  }

  private initLogFile(): void {
    try {
      if (!fs.existsSync(this.logFilePath)) {
        fs.writeFileSync(this.logFilePath, "");
      }
    } catch (error) {
      console.warn(`Warning: Could not initialize log file at ${this.logFilePath}`);
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.logLevel];
  }

  private formatMessage(level: LogLevel, message: string, context?: Record<string, any>): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` ${JSON.stringify(context)}` : "";
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`;
  }

  private writeToFile(formattedMessage: string): void {
    try {
      fs.appendFileSync(this.logFilePath, formattedMessage + "\n");
    } catch (error) {
      // Silent fail - don't disrupt main flow if logging fails
    }
  }

  debug(message: string, context?: Record<string, any>): void {
    if (!this.shouldLog(LogLevel.DEBUG)) return;
    const formatted = this.formatMessage(LogLevel.DEBUG, message, context);
    this.writeToFile(formatted);
  }

  info(message: string, context?: Record<string, any>): void {
    if (!this.shouldLog(LogLevel.INFO)) return;
    const formatted = this.formatMessage(LogLevel.INFO, message, context);
    console.log(formatted);
    this.writeToFile(formatted);
  }

  warn(message: string, context?: Record<string, any>): void {
    if (!this.shouldLog(LogLevel.WARN)) return;
    const formatted = this.formatMessage(LogLevel.WARN, message, context);
    console.warn(formatted);
    this.writeToFile(formatted);
  }

  error(message: string, context?: Record<string, any>): void {
    if (!this.shouldLog(LogLevel.ERROR)) return;
    const formatted = this.formatMessage(LogLevel.ERROR, message, context);
    console.error(formatted);
    this.writeToFile(formatted);
  }

  setLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  getLogFilePath(): string {
    return this.logFilePath;
  }
}

// Global logger instance
let logger: Logger | null = null;

export function getLogger(level?: LogLevel): Logger {
  if (!logger) {
    const configLevel = (process.env.LOG_LEVEL as LogLevel) || LogLevel.INFO;
    logger = new Logger(level || configLevel);
  }
  return logger;
}

export function setLogLevel(level: LogLevel): void {
  getLogger().setLevel(level);
}

export { Logger, LogLevel };
