export class Logger {
  private formatMessage(level: string, message: string, ...args: any[]): string {
    const timestamp = new Date().toISOString();
    const formattedArgs = args.length > 0 ? ' ' + args.map(arg => {
      if (arg instanceof Error) {
        return `${arg.name}: ${arg.message}\n${arg.stack || ''}`;
      } else if (typeof arg === 'object' && arg !== null) {
        // For objects, try to stringify with error handling
        try {
          return JSON.stringify(arg, null, 2);
        } catch {
          return String(arg);
        }
      }
      return String(arg);
    }).join(' ') : '';
    
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${formattedArgs}`;
  }

  info(message: string, ...args: any[]): void {
    console.log(this.formatMessage('info', message, ...args));
  }

  error(message: string, ...args: any[]): void {
    console.error(this.formatMessage('error', message, ...args));
  }

  warn(message: string, ...args: any[]): void {
    console.warn(this.formatMessage('warn', message, ...args));
  }

  debug(message: string, ...args: any[]): void {
    if (process.env.NODE_ENV === 'development') {
      console.debug(this.formatMessage('debug', message, ...args));
    }
  }
}

export const logger = new Logger();
