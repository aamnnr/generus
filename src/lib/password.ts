import "server-only";
import { randomInt } from "node:crypto";

// Tanpa huruf/angka yang mirip (0/O, 1/l/I) agar mudah dibacakan lewat WhatsApp.
const ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Password sementara untuk akun baru / reset. Pengguna wajib menggantinya saat login. */
export function generateTempPassword(length = 10): string {
  return Array.from({ length }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
}

export const MIN_PASSWORD_LENGTH = 8;
