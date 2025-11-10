"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = exports.Logger = void 0;
class Logger {
    formatMessage(level, message, ...args) {
        const timestamp = new Date().toISOString();
        const formattedArgs = args.length > 0 ? ' ' + args.map(arg => {
            if (arg instanceof Error) {
                return `${arg.name}: ${arg.message}\n${arg.stack || ''}`;
            }
            else if (typeof arg === 'object' && arg !== null) {
                // For objects, try to stringify with error handling
                try {
                    return JSON.stringify(arg, null, 2);
                }
                catch {
                    return String(arg);
                }
            }
            return String(arg);
        }).join(' ') : '';
        return `[${timestamp}] [${level.toUpperCase()}] ${message}${formattedArgs}`;
    }
    info(message, ...args) {
        console.log(this.formatMessage('info', message, ...args));
    }
    error(message, ...args) {
        console.error(this.formatMessage('error', message, ...args));
    }
    warn(message, ...args) {
        console.warn(this.formatMessage('warn', message, ...args));
    }
    debug(message, ...args) {
        if (process.env.NODE_ENV === 'development') {
            console.debug(this.formatMessage('debug', message, ...args));
        }
    }
}
exports.Logger = Logger;
exports.logger = new Logger();
//# sourceMappingURL=logger.js.map