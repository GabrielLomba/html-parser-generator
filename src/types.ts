export interface ParserRequest {
    url: string;
    html: string;
}

export interface ParserResponse {
    parser: string;
    cached: boolean;
    urlPattern: string;
}

export interface StoredParser {
    urlPattern: string;
    parser: string;
    createdAt: Date;
}

export interface ParserStorage {
    get(urlPattern: string): StoredParser | null;
    set(urlPattern: string, parser: string): void;
    has(urlPattern: string): boolean;
    getAll(): StoredParser[];
}
