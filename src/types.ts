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
    get(_urlPattern: string): Promise<StoredParser | null>;
    set(_urlPattern: string, _parser: string): Promise<StoredParser>;
    has(_urlPattern: string): Promise<boolean>;
    getAll(): Promise<StoredParser[]>;
    delete(_urlPattern: string): Promise<boolean>;
}
