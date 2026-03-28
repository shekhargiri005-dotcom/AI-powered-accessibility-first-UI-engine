export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogPayload {
    endpoint: string;
    requestId?: string;
    durationMs?: number;
    error?: any;
    metadata?: Record<string, any>;
    message: string;
}

class BackendLogger {
    private formatLog(level: LogLevel, payload: LogPayload) {
        const timestamp = new Date().toISOString();
        const { endpoint, requestId, durationMs, error, metadata, message } = payload;

        // Structure optimized for Render logs
        const logEntry = {
            timestamp,
            level: level.toUpperCase(),
            endpoint,
            requestId: requestId || 'N/A',
            message,
            ...(durationMs !== undefined && { durationMs: `${durationMs}ms` }),
            ...(metadata && { metadata }),
            ...(error && {
                error: error.message || error.toString(),
                stack: error.stack
            })
        };

        // Output as a single line JSON string for robust parsing on Render
        return JSON.stringify(logEntry);
    }

    info(payload: LogPayload) {
        console.log(this.formatLog('info', payload));
    }

    warn(payload: LogPayload) {
        console.warn(this.formatLog('warn', payload));
    }

    error(payload: LogPayload) {
        console.error(this.formatLog('error', payload));
    }

    debug(payload: LogPayload) {
        if (process.env.NODE_ENV === 'development' || process.env.DEBUG === 'true') {
            console.debug(this.formatLog('debug', payload));
        }
    }

    // Create a request-scoped logger wrapper
    createRequestLogger(endpoint: string) {
        const requestId = crypto.randomUUID();
        const startTime = Date.now();

        return {
            requestId,
            info: (message: string, metadata?: Record<string, any>) =>
                this.info({ endpoint, requestId, message, metadata }),
            warn: (message: string, metadata?: Record<string, any>) =>
                this.warn({ endpoint, requestId, message, metadata }),
            error: (message: string, error?: any, metadata?: Record<string, any>) =>
                this.error({ endpoint, requestId, message, error, metadata }),
            debug: (message: string, metadata?: Record<string, any>) =>
                this.debug({ endpoint, requestId, message, metadata }),
            end: (message: string, metadata?: Record<string, any>) => {
                const durationMs = Date.now() - startTime;
                this.info({ endpoint, requestId, message, durationMs, metadata });
            }
        };
    }
}

export const logger = new BackendLogger();
