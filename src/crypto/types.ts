export type Base64String = string & { readonly __brand: "Base64String" };
export type ConversationKey = Uint8Array & {
  readonly __brand: "ConversationKey";
};

export interface DeviceKeyPair {
  publicKey: Base64String;
  privateKey: Uint8Array;
}

export interface MessageAssociatedData {
  conversationId: string;
  senderId: string;
  messageId: string;
  encryptionVersion: 1;
}

export interface EncryptedMessage {
  ciphertext: Base64String;
  nonce: Base64String;
  encryptionVersion: 1;
}

export interface StoredDeviceKeys extends DeviceKeyPair {
  deviceId: string;
  createdAt: string;
}

export interface KeyStorage {
  save(keys: StoredDeviceKeys): Promise<void>;
  load(deviceId: string): Promise<StoredDeviceKeys | null>;
  remove(deviceId: string): Promise<void>;
  list(): Promise<StoredDeviceKeys[]>;
}