export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: any;
  error?: Error;
}

export class Logger {
  private logs: LogEntry[] = [];
  private maxLogs: number = 1000;
  private enabled: boolean;

  constructor(enabled: boolean = true, maxLogs: number = 1000) {
    this.enabled = enabled;
    this.maxLogs = maxLogs;
  }

  private log(level: LogLevel, message: string, data?: any, error?: Error): void {
    if (!this.enabled) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data,
      error
    };

    this.logs.push(entry);
    
    // Trim logs if we exceed maxLogs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Console output with colors
    this.outputToConsole(entry);
  }

  private outputToConsole(entry: LogEntry): void {
    const colors = {
      debug: '\x1b[36m', // Cyan
      info: '\x1b[32m',  // Green
      warn: '\x1b[33m',  // Yellow
      error: '\x1b[31m', // Red
      reset: '\x1b[0m'   // Reset
    };

    const timestamp = entry.timestamp.substring(11, 19); // HH:MM:SS
    const colorCode = colors[entry.level];
    const resetCode = colors.reset;
    
    let output = `${colorCode}[${timestamp}] ${entry.level.toUpperCase()}${resetCode}: ${entry.message}`;

    if (entry.data) {
      output += `\n${colorCode}Data:${resetCode} ${JSON.stringify(entry.data, null, 2)}`;
    }

    if (entry.error) {
      output += `\n${colorCode}Error:${resetCode} ${entry.error.message}`;
      if (entry.error.stack) {
        output += `\n${colorCode}Stack:${resetCode} ${entry.error.stack}`;
      }
    }

    switch (entry.level) {
      case 'debug':
        console.debug(output);
        break;
      case 'info':
        console.info(output);
        break;
      case 'warn':
        console.warn(output);
        break;
      case 'error':
        console.error(output);
        break;
    }
  }

  debug(message: string, data?: any): void {
    this.log('debug', message, data);
  }

  info(message: string, data?: any): void {
    this.log('info', message, data);
  }

  warn(message: string, data?: any, error?: Error): void {
    this.log('warn', message, data, error);
  }

  error(message: string, error?: any): void {
    let errorObj: Error | undefined;
    let data: any;

    if (error instanceof Error) {
      errorObj = error;
    } else if (error) {
      data = error;
    }

    this.log('error', message, data, errorObj);
  }

  // Get logs with optional filtering
  getLogs(options?: {
    level?: LogLevel;
    limit?: number;
    since?: Date;
  }): LogEntry[] {
    let filteredLogs = [...this.logs];

    if (options?.level) {
      const levelPriority = { debug: 0, info: 1, warn: 2, error: 3 };
      const minPriority = levelPriority[options.level];
      filteredLogs = filteredLogs.filter(log => levelPriority[log.level] >= minPriority);
    }

    if (options?.since) {
      filteredLogs = filteredLogs.filter(log => new Date(log.timestamp) >= options.since!);
    }

    if (options?.limit) {
      filteredLogs = filteredLogs.slice(-options.limit);
    }

    return filteredLogs;
  }

  // Clear all logs
  clear(): void {
    this.logs = [];
  }

  // Get log statistics
  getStats(): {
    total: number;
    byLevel: Record<LogLevel, number>;
    oldestLog?: string;
    newestLog?: string;
  } {
    const stats = {
      total: this.logs.length,
      byLevel: {
        debug: 0,
        info: 0,
        warn: 0,
        error: 0
      } as Record<LogLevel, number>,
      oldestLog: this.logs[0]?.timestamp,
      newestLog: this.logs[this.logs.length - 1]?.timestamp
    };

    this.logs.forEach(log => {
      stats.byLevel[log.level]++;
    });

    return stats;
  }

  // Enable/disable logging
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (enabled) {
      this.info('Logging enabled');
    }
  }

  // Set maximum number of logs to keep
  setMaxLogs(maxLogs: number): void {
    this.maxLogs = maxLogs;
    if (this.logs.length > maxLogs) {
      this.logs = this.logs.slice(-maxLogs);
    }
    this.info(`Max logs set to ${maxLogs}`);
  }

  // Export logs as JSON
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  // Performance logging helper
  time<T>(label: string, fn: () => T): T;
  time<T>(label: string, fn: () => Promise<T>): Promise<T>;
  time<T>(label: string, fn: () => T | Promise<T>): T | Promise<T> {
    const startTime = Date.now();
    this.debug(`Starting: ${label}`);

    const result = fn();

    if (result instanceof Promise) {
      return result.then((res) => {
        const duration = Date.now() - startTime;
        this.debug(`Completed: ${label}`, { duration: `${duration}ms` });
        return res;
      }).catch((error) => {
        const duration = Date.now() - startTime;
        this.error(`Failed: ${label}`, error);
        this.debug(`Duration before failure: ${duration}ms`);
        throw error;
      });
    } else {
      const duration = Date.now() - startTime;
      this.debug(`Completed: ${label}`, { duration: `${duration}ms` });
      return result;
    }
  }

  // Create a child logger with a prefix
  child(prefix: string): Logger {
    const childLogger = new Logger(this.enabled, this.maxLogs);
    
    // Override log method to add prefix
    const originalLog = childLogger.log.bind(childLogger);
    childLogger.log = (level: LogLevel, message: string, data?: any, error?: Error) => {
      originalLog(level, `[${prefix}] ${message}`, data, error);
    };

    return childLogger;
  }
}