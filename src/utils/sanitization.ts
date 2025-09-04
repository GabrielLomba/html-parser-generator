export const removeWhiteSpace = (html: string): string => {
    return html
        .replace(/\s+/g, ' ')
        .replace(/([\n\t]\s*[\n\t])+/g, '\n')
        .trim();
};

export const sanitizeParserCode = (code: string): string => {
    const codeBlockRegex = /```(?:javascript|js|typescript|ts)?\s*\n([\s\S]*?)\n```/;
    const match = code.match(codeBlockRegex);

    const runnableFunction = match && match[1] ? match[1].trim() : code.trim();

    if (runnableFunction.startsWith('function')) {
        const functionBodyRegex = /function\s+\w+\s*\([^)]*\)\s*\{([\s\S]*)\}/;
        const bodyMatch = runnableFunction.match(functionBodyRegex);

        if (bodyMatch && bodyMatch[1]) {
            return bodyMatch[1].trim();
        }
    }

    if (runnableFunction.includes('=>')) {
        const arrowFunctionRegex = /(?:const|let|var)?\s*\w+\s*=\s*\([^)]*\)\s*=>\s*\{([\s\S]*)\}/;
        const arrowMatch = runnableFunction.match(arrowFunctionRegex);

        if (arrowMatch && arrowMatch[1]) {
            return arrowMatch[1].trim();
        }
    }

    return runnableFunction;
};

export const sanitizeParseResult = (result: unknown): unknown => {
    if (!result) {
        return result;
    }

    if (typeof result === 'string') {
        return removeWhiteSpace(result);
    }

    if (Array.isArray(result)) {
        return result.map(item => sanitizeParseResult(item));
    }

    if (typeof result === 'object') {
        const sanitized: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(result)) {
            sanitized[key] = sanitizeParseResult(value);
        }
        return sanitized;
    }

    return result;
};
