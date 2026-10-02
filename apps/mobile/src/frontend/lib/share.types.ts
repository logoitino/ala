/**
 * Shape of a gift link QR target (athlete handle, shareable URL, display name).
 * Shared by the native and web ShareQrModal implementations.
 */

export type GiftQrTarget = {
  handle: string;
  url: string;
  athleteName: string;
};
