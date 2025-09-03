export interface ParserRequest {
    url: string;
    html: string;
}

export interface ParserResponse {
    parser: string;
    cached: boolean;
    urlPattern: string;
    createdAt: Date;
}

export interface StoredParser {
    urlPattern: string;
    parser: string;
    createdAt: Date;
}

export interface ParserStorage {
    get(urlPattern: string): Promise<StoredParser | null>;
    set(urlPattern: string, parser: string): Promise<StoredParser>;
    has(urlPattern: string): Promise<boolean>;
    getAll(): Promise<StoredParser[]>;
    delete(urlPattern: string): Promise<boolean>;
}
