// Durable asset data returned by a consumer-injected upload adapter. The
// document stores only this data — never a File/Blob, upload-progress state,
// or adapter internals. See design.md decision #9.

export interface VisualBuilderImageAsset {
  url: string;
  filename: string;
  mimeType: string;
  widthPx?: number;
  heightPx?: number;
}
