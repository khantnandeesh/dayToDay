// Web Crypto API utilities for Zero-Knowledge Architecture

const PBKDF2_ITERATIONS = 600000; // High iterations for security
const KEY_LENGTH = 256;
const SALT_LENGTH = 16;
const IV_LENGTH = 12; // Standard for AES-GCM

// Generate random salt
export const generateSalt = () => {
  return arrayBufferToHex(window.crypto.getRandomValues(new Uint8Array(SALT_LENGTH)));
};

// Generate random IV
export const generateIV = () => {
  return arrayBufferToHex(window.crypto.getRandomValues(new Uint8Array(IV_LENGTH)));
};

// Derive Key from Password (PBKDF2)
export const deriveKey = async (password, saltHex) => {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  const salt = hexToArrayBuffer(saltHex);

  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: KEY_LENGTH },
    false, // Key extracts are not allowed (Zero-Knowledge)
    ["encrypt", "decrypt"]
  );
};

// Encrypt Content
export const encryptSync = async (dataObj, key) => {
  const enc = new TextEncoder();
  const encodedData = enc.encode(JSON.stringify(dataObj));
  
  const iv = window.crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  
  const ciphertext = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv,
    },
    key,
    encodedData
  );

  return {
    encryptedData: arrayBufferToBase64(ciphertext),
    iv: arrayBufferToHex(iv)
  };
};

// Decrypt Content
export const decryptSync = async (encryptedDataB64, ivHex, key) => {
  try {
    const ciphertext = base64ToArrayBuffer(encryptedDataB64);
    const iv = hexToArrayBuffer(ivHex);

    const decrypted = await window.crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: iv,
      },
      key,
      ciphertext
    );

    const dec = new TextDecoder();
    return JSON.parse(dec.decode(decrypted));
  } catch (e) {
    console.error("Decryption failure:", e);
    throw new Error("Failed to decrypt data (Invalid Key/Data integrity)");
  }
};

// Helpers
const arrayBufferToHex = (buffer) => {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
};

const hexToArrayBuffer = (hex) => {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes.buffer;
};

const arrayBufferToBase64 = (buffer) => {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
};

const base64ToArrayBuffer = (base64) => {
  const binary_string = window.atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes.buffer;
};
