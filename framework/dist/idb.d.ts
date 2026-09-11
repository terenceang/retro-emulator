export declare function idbRequest<T>(request: IDBRequest<T>): Promise<T>;
export declare function idbTx(tx: IDBTransaction): Promise<void>;
export declare function openDb(name: string, storeName: string, storeOptions?: IDBObjectStoreParameters): Promise<IDBDatabase>;
export declare function deleteDb(name: string): Promise<void>;
//# sourceMappingURL=idb.d.ts.map