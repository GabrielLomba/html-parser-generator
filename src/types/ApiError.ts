export class ApiError extends Error {
    public readonly statusCode: number;
    public readonly payload: any;

    constructor(statusCode: number, payload: any) {
        super(typeof payload === 'string' ? payload : payload.message || 'API Error');
        this.name = 'ApiError';
        this.statusCode = statusCode;
        this.payload = payload;

        // Maintains proper stack trace for where our error was thrown (only available on V8)
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, ApiError);
        }
    }
}
