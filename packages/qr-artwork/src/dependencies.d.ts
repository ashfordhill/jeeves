// Narrow declarations for the pinned packages' used APIs. Public exports use our own types.
declare module "qrcode" {
  const QRCode: {
    create(
      text: string,
      options: { errorCorrectionLevel: "M" | "Q" | "H" },
    ): { modules: { size: number; data: Uint8Array } };
  };
  export default QRCode;
}
declare module "pngjs" {
  interface PngImage {
    width: number;
    height: number;
    data: Buffer;
  }
  const pngjs: {
    PNG: {
      new (options: { width: number; height: number }): PngImage;
      sync: {
        write(image: PngImage, options?: Record<string, number>): Buffer;
        read(bytes: Buffer): PngImage;
      };
    };
  };
  export default pngjs;
}
