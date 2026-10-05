// The consumer-injected asset adapter (task 13.1, design.md decision #9).
// The image inspector never talks to a host app, tenant headers, or the API
// fetcher directly — a consumer supplies this adapter through
// `BuilderProviderProps.assetAdapter` and the inspector maps its result into
// durable `VisualBuilderImageAsset` data. Only durable returned data may
// enter the document; File/Blob handles and upload progress never do.

import type {
  VisualBuilderImageAsset,
  VisualDocumentMode,
} from "../types/index.js";

export interface AssetUploadContext {
  /** The mode of the document the upload belongs to. */
  mode: VisualDocumentMode;
  /** The node the uploaded asset will be attached to. */
  nodeId: string;
}

export type AssetUploadResult =
  { ok: true; asset: VisualBuilderImageAsset } | { ok: false; error: string };

export interface AssetAdapter {
  /** Maximum accepted image size in bytes. Defaults to the builder's 1 MiB limit. */
  maxImageBytes?: number;

  /**
   * Optionally resolves a durable asset back to a browser `File` for editing.
   * Provide this when the asset host needs authenticated loading or does not
   * expose CORS headers. When omitted, the builder performs an anonymous CORS
   * fetch of `asset.url`.
   */
  loadImage?(asset: VisualBuilderImageAsset): Promise<File>;

  /**
   * Uploads an image file and resolves with durable asset data or a
   * consumer-facing error message. Must never throw for expected upload
   * failures — return `{ ok: false }` so the inspector can offer retry
   * while preserving the previous durable asset.
   *
   * Every successful upload MUST create a distinct immutable asset (normally
   * a unique filename/key and URL). Do not overwrite or delete an earlier
   * asset as part of replacement: undo/redo restores the prior asset object
   * and therefore depends on its URL continuing to resolve to the old bytes.
   * Storage garbage collection, if any, must account for document history and
   * persisted references outside this adapter call.
   */
  uploadImage(
    file: File,
    context: AssetUploadContext,
  ): Promise<AssetUploadResult>;
}
