import { openDB, type DBSchema } from "idb";
import type { KeyStorage, StoredDeviceKeys } from "@/crypto/types";

const DEFAULT_DATABASE_NAME = "broomer-e2ee-keys";
const STORE_NAME = "deviceKeys";

interface CryptoKeyDatabase extends DBSchema {
  deviceKeys: {
    key: string;
    value: StoredDeviceKeys;
  };
}

function cloneStoredKeys(keys: StoredDeviceKeys): StoredDeviceKeys {
  return {
    ...keys,
    privateKey: Uint8Array.from(keys.privateKey),
  };
}

export function createIndexedDbKeyStorage(
  databaseName = DEFAULT_DATABASE_NAME,
): KeyStorage {
  const getDatabase = () =>
    openDB<CryptoKeyDatabase>(databaseName, 1, {
      upgrade(database) {
        if (!database.objectStoreNames.contains(STORE_NAME)) {
          database.createObjectStore(STORE_NAME, { keyPath: "deviceId" });
        }
      },
    });

  return {
    async save(keys) {
      const database = await getDatabase();
      await database.put(STORE_NAME, cloneStoredKeys(keys));
      database.close();
    },

    async load(deviceId) {
      const database = await getDatabase();
      const keys = await database.get(STORE_NAME, deviceId);
      database.close();
      return keys ?? null;
    },

    async remove(deviceId) {
      const database = await getDatabase();
      const keys = await database.get(STORE_NAME, deviceId);
      if (keys) keys.privateKey.fill(0);
      await database.delete(STORE_NAME, deviceId);
      database.close();
    },

    async list() {
      const database = await getDatabase();
      const keys = await database.getAll(STORE_NAME);
      database.close();
      return keys;
    },
  };
}

export async function withStoredDeviceKeys<T>(
  storage: KeyStorage,
  deviceId: string,
  operation: (keys: StoredDeviceKeys) => Promise<T>,
): Promise<T> {
  const keys = await storage.load(deviceId);
  if (!keys) throw new Error("Device keys not found");
  try {
    return await operation(keys);
  } finally {
    keys.privateKey.fill(0);
  }
}