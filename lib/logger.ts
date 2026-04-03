export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogPayload {
    endpoint: string;
    requestId?: string;
    durationMs?: number;
    error?: unknown;
    metadata?: Record<string, unknown>;
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
            ...(durationMs !== undefined ? { durationMs: `${durationMs}ms` } : {}),
            ...(metadata ? { metadata } : {}),
            ...(error != null ? {
                error: (error instanceof Error ? error.message : String(error)),
                stack: (error instanceof Error ? error.stack : undefined)
            } : {})
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
            info: (message: string, metadata?: Record<string, unknown>) =>
                this.info({ endpoint, requestId, message, metadata }),
            warn: (message: string, metadata?: Record<string, unknown>) =>
                this.warn({ endpoint, requestId, message, metadata }),
            error: (message: string, error?: unknown, metadata?: Record<string, unknown>) =>
                this.error({ endpoint, requestId, message, error, metadata }),
            debug: (message: string, metadata?: Record<string, unknown>) =>
                this.debug({ endpoint, requestId, message, metadata }),
            end: (message: string, metadata?: Record<string, unknown>) => {
                const durationMs = Date.now() - startTime;
                this.info({ endpoint, requestId, message, durationMs, metadata });
            }
        };
    }
}

export const logger = new BackendLogger();
