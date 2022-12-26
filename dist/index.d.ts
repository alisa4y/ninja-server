/// <reference types="node" />
import { IncomingMessage } from "http";
export declare function startServer(): Promise<void>;
export declare type XParam = {
    req: IncomingMessage;
    headers: Record<string, any>;
    statusCode: number;
};
