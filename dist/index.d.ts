/// <reference types="node" />
import { IncomingMessage } from "http";
export declare function startServer(): Promise<void>;
export declare class XCon {
    request: IncomingMessage;
    headers: Record<string, any>;
    statusCode: number;
    constructor(request: IncomingMessage, headers: Record<string, any>, statusCode: number);
    error(code: number, message: string): string;
}
