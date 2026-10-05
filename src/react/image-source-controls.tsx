// Image-source controls for the image inspector (tasks 13.1 + 13.2): a
// source-mode toggle between adapter upload and direct URL entry, the
// upload/retry/replacement state machine, and the optional pre-upload
// crop/rotate/resize editing step. The document only ever receives durable
// `VisualBuilderImageAsset` data through `commit`; a failed upload or a
// cancelled edit leaves the previous durable asset untouched.

import type { VisualBuilderImageAsset } from "../types/index.js";
import { Pencil, Trash2 } from "lucide-react";
import { useId, useRef, useState } from "react";
import type { AssetUploadResult } from "./asset-adapter.js";
import {
  DEFAULT_EDITED_IMAGE_MAX_BYTES,
  createImageEditState,
  isIdentityEdit,
  renderEditedImage,
  type ImageEditState,
} from "./image-edit.js";
import { ImageEditPanel } from "./image-edit-panel.js";
import type { FieldCommit } from "./inspector-fields.js";
import { useBuilderActions, useBuilderMeta } from "./provider.js";

type SourceMode = "upload" | "url";

type UploadPhase =
  | { kind: "idle" }
  | {
      kind: "editing";
      file: File;
      source: "local" | "asset";
      edit: ImageEditState;
      error: string | null;
    }
  | { kind: "loading-asset" }
  | { kind: "asset-error"; message: string }
  | { kind: "uploading" }
  | { kind: "error"; message: string; retryFile: File };

const EDITABLE_INPUT_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

async function defaultLoadDimensions(
  file: File,
): Promise<{ width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  const dimensions = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  return dimensions;
}

async function defaultLoadAssetFile(
  asset: VisualBuilderImageAsset,
): Promise<File> {
  const response = await fetch(asset.url, {
    credentials: "omit",
    mode: "cors",
    referrerPolicy: "no-referrer",
  });
  if (!response.ok) {
    throw new Error(`Download failed (${response.status}).`);
  }
  const blob = await response.blob();
  const mimeType = blob.type || asset.mimeType;
  if (!EDITABLE_INPUT_MIME_TYPES.has(mimeType)) {
    throw new Error(`Unsupported image type: ${mimeType || "unknown"}.`);
  }
  return new File([blob], asset.filename, { type: mimeType });
}

export interface ImageSourceControlsProps {
  nodeId: string;
  asset: VisualBuilderImageAsset | null;
  commit: FieldCommit;
  /** Test seams — jsdom ships no canvas/`createImageBitmap`. */
  renderImage?: typeof renderEditedImage;
  loadImageDimensions?: (
    file: File,
  ) => Promise<{ width: number; height: number }>;
  /** Downloads an existing durable asset for non-destructive replacement editing. */
  loadAssetFile?: (asset: VisualBuilderImageAsset) => Promise<File>;
}

export function ImageSourceControls({
  nodeId,
  asset,
  commit,
  renderImage = renderEditedImage,
  loadImageDimensions = defaultLoadDimensions,
  loadAssetFile,
}: ImageSourceControlsProps): React.JSX.Element {
  const { labels, assetAdapter, mode } = useBuilderMeta();
  const actions = useBuilderActions();
  const [sourceMode, setSourceMode] = useState<SourceMode>(
    assetAdapter ? "upload" : "url",
  );
  const [phase, setPhase] = useState<UploadPhase>({ kind: "idle" });
  const assetEditRequestRef = useRef(0);
  const groupId = useId();
  const maxImageBytes = Math.max(
    1,
    assetAdapter?.maxImageBytes ?? DEFAULT_EDITED_IMAGE_MAX_BYTES,
  );
  const resolveAssetFile =
    loadAssetFile ?? assetAdapter?.loadImage ?? defaultLoadAssetFile;

  const commitAsset = (nextAsset: VisualBuilderImageAsset | null): void => {
    // Asset changes are deliberate, atomic history steps. Sealing both sides
    // prevents them from merging with adjacent edits to this image block.
    actions.breakHistoryCoalescing();
    commit({ asset: nextAsset });
    actions.breakHistoryCoalescing();
  };

  const upload = async (file: File): Promise<void> => {
    if (!assetAdapter) return;
    setPhase({ kind: "uploading" });
    let result: AssetUploadResult;
    try {
      result = await assetAdapter.uploadImage(file, { mode, nodeId });
    } catch (error) {
      result = {
        ok: false,
        error: error instanceof Error ? error.message : "Upload failed.",
      };
    }
    if (result.ok) {
      // Only the adapter's durable data enters the document.
      commitAsset(result.asset);
      setPhase({ kind: "idle" });
    } else {
      // Previous durable asset stays untouched; expose the error and a retry.
      setPhase({ kind: "error", message: result.error, retryFile: file });
    }
  };

  const openFileEditor = async (
    file: File,
    source: "local" | "asset",
  ): Promise<void> => {
    try {
      const { width, height } = await loadImageDimensions(file);
      setPhase({
        kind: "editing",
        file,
        source,
        edit: createImageEditState(width, height),
        error: null,
      });
    } catch {
      setPhase(
        source === "asset"
          ? { kind: "asset-error", message: file.name }
          : {
              kind: "error",
              message: labels.uploadFailed(file.name),
              retryFile: file,
            },
      );
    }
  };

  const selectFile = (file: File): Promise<void> =>
    openFileEditor(file, "local");

  const editAsset = async (
    currentAsset: VisualBuilderImageAsset,
  ): Promise<void> => {
    const requestId = assetEditRequestRef.current + 1;
    assetEditRequestRef.current = requestId;
    setPhase({ kind: "loading-asset" });
    try {
      const file = await resolveAssetFile(currentAsset);
      if (assetEditRequestRef.current !== requestId) return;
      await openFileEditor(file, "asset");
    } catch (error) {
      if (assetEditRequestRef.current !== requestId) return;
      setPhase({
        kind: "asset-error",
        message: error instanceof Error ? error.message : currentAsset.filename,
      });
    }
  };

  const cancelPhase = (): void => {
    assetEditRequestRef.current += 1;
    setPhase({ kind: "idle" });
  };

  const confirmEdit = async (
    file: File,
    edit: ImageEditState,
    preparedFile?: File,
  ): Promise<void> => {
    if (isIdentityEdit(edit)) {
      await upload(file);
      return;
    }
    if (preparedFile) {
      await upload(preparedFile);
      return;
    }
    const rendered = await renderImage(file, edit, {
      maxBytes: maxImageBytes,
    });
    if (!rendered.ok) {
      // Oversized/failed re-encode keeps the editing state so the user can adjust.
      setPhase((current) => ({
        kind: "editing",
        file,
        source: current.kind === "editing" ? current.source : "local",
        edit,
        error: rendered.message,
      }));
      return;
    }
    await upload(rendered.file);
  };

  const prepareEditedOutput = async (
    file: File,
    edit: ImageEditState,
  ): Promise<File | null> => {
    const rendered = await renderImage(file, edit, {
      maxBytes: Number.MAX_SAFE_INTEGER,
    });
    return rendered.ok ? rendered.file : null;
  };

  return (
    <div className="donativus-vb-image-source">
      {assetAdapter ? (
        <fieldset
          className="donativus-vb-field"
          role="radiogroup"
          aria-label={labels.imageSourceLabel}
        >
          <label className="label">
            <span>{labels.imageSourceLabel}</span>
          </label>
          <div className="join w-full">
            {(["upload", "url"] as const).map((option) => (
              <label
                key={option}
                className={`btn btn-sm join-item flex-1 ${
                  sourceMode === option ? "btn-active" : ""
                }`}
              >
                <input
                  type="radio"
                  name={`${groupId}-source`}
                  className="donativus-vb-visually-hidden"
                  checked={sourceMode === option}
                  onChange={() => {
                    assetEditRequestRef.current += 1;
                    setSourceMode(option);
                    setPhase({ kind: "idle" });
                  }}
                />
                {option === "upload"
                  ? labels.imageSourceUpload
                  : labels.imageSourceUrl}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      {sourceMode === "url" || !assetAdapter ? (
        <UrlField asset={asset} commit={commit} />
      ) : (
        <UploadControls
          asset={asset}
          phase={phase}
          maxImageBytes={maxImageBytes}
          prepareOutput={prepareEditedOutput}
          onSelectFile={selectFile}
          onCancel={cancelPhase}
          onEditAsset={(currentAsset) => void editAsset(currentAsset)}
          onRemoveAsset={() => {
            assetEditRequestRef.current += 1;
            commitAsset(null);
            setPhase({ kind: "idle" });
          }}
          onSkip={(file) => void upload(file)}
          onConfirm={(file, edit, preparedFile) =>
            void confirmEdit(file, edit, preparedFile)
          }
          onRetry={(file) => void upload(file)}
          onEditChange={(file, edit) =>
            setPhase({
              kind: "editing",
              file,
              source: phase.kind === "editing" ? phase.source : "local",
              edit,
              error: null,
            })
          }
        />
      )}
    </div>
  );
}

/** URL entry (the pre-existing path): the committed asset is parsed/validated by the update command. */
function UrlField({
  asset,
  commit,
}: {
  asset: VisualBuilderImageAsset | null;
  commit: FieldCommit;
}): React.JSX.Element {
  const { labels } = useBuilderMeta();
  const id = useId();
  return (
    <div className="donativus-vb-field">
      <label className="label" htmlFor={id}>
        <span>{labels.fieldImageUrl}</span>
      </label>
      <input
        id={id}
        type="text"
        className="input input-sm w-full"
        value={asset?.url ?? ""}
        onChange={(event) =>
          commit({
            asset:
              event.target.value === ""
                ? null
                : {
                    url: event.target.value,
                    filename: event.target.value.split("/").pop() ?? "image",
                    mimeType: "image/png",
                  },
          })
        }
      />
    </div>
  );
}

function UploadControls({
  asset,
  phase,
  maxImageBytes,
  prepareOutput,
  onSelectFile,
  onCancel,
  onEditAsset,
  onRemoveAsset,
  onSkip,
  onConfirm,
  onRetry,
  onEditChange,
}: {
  asset: VisualBuilderImageAsset | null;
  phase: UploadPhase;
  maxImageBytes: number;
  prepareOutput: (file: File, edit: ImageEditState) => Promise<File | null>;
  onSelectFile: (file: File) => void;
  onCancel: () => void;
  onEditAsset: (asset: VisualBuilderImageAsset) => void;
  onRemoveAsset: () => void;
  onSkip: (file: File) => void;
  onConfirm: (file: File, edit: ImageEditState, preparedFile?: File) => void;
  onRetry: (file: File) => void;
  onEditChange: (file: File, edit: ImageEditState) => void;
}): React.JSX.Element {
  const { labels } = useBuilderMeta();
  const fileInputId = useId();

  return (
    <div className="donativus-vb-image-upload">
      {asset ? (
        <div
          className="donativus-vb-image-current bg-base-200 border-base-300"
          data-vb-current-asset
        >
          <img src={asset.url} alt="" />
          <p>
            <strong>{labels.currentImage(asset.filename)}</strong>
            {asset.widthPx && asset.heightPx ? (
              <span className="donativus-vb-image-dimensions">
                {labels.imageDimensions(asset.widthPx, asset.heightPx)}
              </span>
            ) : null}
          </p>
          <div className="donativus-vb-image-current-actions">
            <button
              type="button"
              className="btn btn-xs btn-ghost"
              disabled={phase.kind === "loading-asset"}
              onClick={() => onEditAsset(asset)}
            >
              <Pencil size={13} aria-hidden="true" />
              {labels.editCurrentImage}
            </button>
            <button
              type="button"
              className="btn btn-xs btn-ghost btn-square text-error tooltip tooltip-left"
              data-tip={labels.removeCurrentImage}
              aria-label={labels.removeCurrentImage}
              disabled={phase.kind === "loading-asset"}
              onClick={onRemoveAsset}
            >
              <Trash2 size={14} aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : null}

      {!asset && (phase.kind === "idle" || phase.kind === "error") ? (
        <div className="donativus-vb-field">
          <label className="label" htmlFor={fileInputId}>
            <span>{labels.chooseImageFile}</span>
          </label>
          <input
            id={fileInputId}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="file-input file-input-sm w-full"
            onChange={(event) => {
              const file = event.target.files?.[0];
              // Allow re-selecting the same file after cancel/error.
              event.target.value = "";
              if (file) onSelectFile(file);
            }}
          />
        </div>
      ) : null}

      {phase.kind === "uploading" ? (
        <p className="donativus-vb-image-uploading" role="status">
          {labels.uploadInProgress}
        </p>
      ) : null}

      {phase.kind === "loading-asset" ? (
        <p className="donativus-vb-image-uploading" role="status">
          <span
            className="loading loading-spinner loading-xs"
            aria-hidden="true"
          />
          {labels.loadingImageForEdit}
        </p>
      ) : null}

      {phase.kind === "asset-error" ? (
        <p className="alert alert-error donativus-vb-image-error" role="alert">
          {labels.editCurrentImageFailed(phase.message)}
        </p>
      ) : null}

      {phase.kind === "error" ? (
        <div
          className="alert alert-error donativus-vb-image-error"
          role="alert"
        >
          <span>{labels.uploadFailed(phase.message)}</span>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => onRetry(phase.retryFile)}
          >
            {labels.retryUpload}
          </button>
        </div>
      ) : null}

      {phase.kind === "editing" ? (
        <ImageEditPanel
          file={phase.file}
          edit={phase.edit}
          error={phase.error}
          maxBytes={maxImageBytes}
          prepareOutput={prepareOutput}
          onChange={(edit) => onEditChange(phase.file, edit)}
          onCancel={onCancel}
          onSkip={
            phase.source === "local" ? () => onSkip(phase.file) : undefined
          }
          onConfirm={(preparedFile) =>
            onConfirm(phase.file, phase.edit, preparedFile)
          }
        />
      ) : null}
    </div>
  );
}
