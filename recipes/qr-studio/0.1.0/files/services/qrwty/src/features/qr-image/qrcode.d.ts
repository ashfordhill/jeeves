// The installed qrcode package does not bundle TypeScript declarations.
declare module "qrcode" {
  const QRCode: {
    toBuffer(
      text: string,
      options: {
        type: "png";
        width: number;
        margin: number;
        errorCorrectionLevel: "M";
      },
    ): Promise<Buffer>;
  };
  export default QRCode;
}
