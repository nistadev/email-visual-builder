import {
  CircleCheck,
  Check,
  Crop,
  ImageIcon,
  Move,
  RotateCcw,
  RotateCw,
  TriangleAlert,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  ASPECT_RATIO_PRESETS,
  MAX_EDIT_DIMENSION_PX,
  MIN_EDIT_TARGET_WIDTH_PX,
  applyAspectRatioPreset,
  createImageEditState,
  editedOutputDimensions,
  isIdentityEdit,
  rotateCounterQuarterTurn,
  rotateQuarterTurn,
  rotatedDimensions,
  setCropRect,
  setTargetWidth,
  type AspectRatioPreset,
  type ImageCropRect,
  type ImageEditState,
} from "./image-edit.js";
import { useBuilderMeta } from "./provider.js";

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';
const HANDLE_CORNERS = [
  "northwest",
  "northeast",
  "southwest",
  "southeast",
] as const;
const MIN_CROP_EDGE_PX = 8;
const MAX_PREVIEW_WIDTH_PX = 1600;
const MAX_PREVIEW_HEIGHT_PX = 1200;
const MIN_PREVIEW_ZOOM = 0.25;
const MAX_PREVIEW_ZOOM = 2;
const PREVIEW_ZOOM_STEP = 0.25;

type CropHandle = (typeof HANDLE_CORNERS)[number];
type CropDragMode = "move" | CropHandle;

interface CropDragState {
  mode: CropDragMode;
  pointerId: number;
  clientX: number;
  clientY: number;
  crop: ImageCropRect;
}

export interface ImageEditPanelProps {
  file: File;
  edit: ImageEditState;
  error: string | null;
  maxBytes: number;
  prepareOutput: (file: File, edit: ImageEditState) => Promise<File | null>;
  onChange: (edit: ImageEditState) => void;
  onCancel: () => void;
  onSkip?: () => void;
  onConfirm: (preparedFile?: File) => void;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const BYTES_PER_MEBIBYTE = 1024 * 1024;
const SIZE_MEASUREMENT_DELAY_MS = 300;

function formatMegabytes(bytes: number): string {
  return (bytes / BYTES_PER_MEBIBYTE).toFixed(2);
}

/** Tracks the authoritative byte size of the debounced canvas encode. */
type OutputSizeMeasurement =
  | { key: string; kind: "measuring" }
  | { key: string; kind: "measured"; file: File }
  | { key: string; kind: "unavailable" };

function measurementKey(edit: ImageEditState): string {
  return [
    edit.rotation,
    edit.crop.x,
    edit.crop.y,
    edit.crop.width,
    edit.crop.height,
    edit.targetWidth ?? "original",
  ].join(":");
}

function resizeCropFromCorner(
  crop: ImageCropRect,
  bounds: { width: number; height: number },
  corner: CropHandle,
  deltaX: number,
  deltaY: number,
  ratio: number | null,
): ImageCropRect {
  const east = corner === "northeast" || corner === "southeast";
  const south = corner === "southwest" || corner === "southeast";
  const anchorX = east ? crop.x : crop.x + crop.width;
  const anchorY = south ? crop.y : crop.y + crop.height;
  const startX = east ? crop.x + crop.width : crop.x;
  const startY = south ? crop.y + crop.height : crop.y;
  const maxWidth = east ? bounds.width - anchorX : anchorX;
  const maxHeight = south ? bounds.height - anchorY : anchorY;
  const minWidth = Math.min(MIN_CROP_EDGE_PX, maxWidth);
  const minHeight = Math.min(MIN_CROP_EDGE_PX, maxHeight);

  let width = clamp(Math.abs(startX + deltaX - anchorX), minWidth, maxWidth);
  let height = clamp(Math.abs(startY + deltaY - anchorY), minHeight, maxHeight);

  if (ratio !== null) {
    if (width / height > ratio) {
      height = width / ratio;
    } else {
      width = height * ratio;
    }
    const fitScale = Math.min(1, maxWidth / width, maxHeight / height);
    width = Math.max(1, Math.round(width * fitScale));
    height = Math.max(1, Math.round(height * fitScale));
  } else {
    width = Math.round(width);
    height = Math.round(height);
  }

  return {
    x: Math.round(east ? anchorX : anchorX - width),
    y: Math.round(south ? anchorY : anchorY - height),
    width,
    height,
  };
}

function useLocalImageUrl(file: File): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    let reader: FileReader | null = null;
    let active = true;

    try {
      if (
        typeof URL !== "undefined" &&
        typeof URL.createObjectURL === "function"
      ) {
        objectUrl = URL.createObjectURL(file);
        setUrl(objectUrl);
      }
    } catch {
      objectUrl = null;
    }

    if (objectUrl === null && typeof FileReader !== "undefined") {
      reader = new FileReader();
      reader.addEventListener("load", () => {
        if (active && typeof reader?.result === "string") {
          setUrl(reader.result);
        }
      });
      reader.readAsDataURL(file);
    }

    return () => {
      active = false;
      if (reader?.readyState === 1) reader.abort();
      if (objectUrl !== null) URL.revokeObjectURL(objectUrl);
    };
  }, [file]);

  return url;
}

function ImageCropCanvas({
  previewUrl,
  edit,
  aspectRatio,
  onChange,
  onRotateLeft,
  onRotateRight,
}: {
  previewUrl: string | null;
  edit: ImageEditState;
  aspectRatio: number | null;
  onChange: (edit: ImageEditState) => void;
  onRotateLeft: () => void;
  onRotateRight: () => void;
}): React.JSX.Element {
  const { labels } = useBuilderMeta();
  const [zoom, setZoom] = useState(1);
  const stageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<CropDragState | null>(null);
  const bounds = rotatedDimensions(edit);
  const crop = edit.crop;
  const previewScale = Math.min(
    1,
    MAX_PREVIEW_WIDTH_PX / bounds.width,
    MAX_PREVIEW_HEIGHT_PX / bounds.height,
  );
  const previewWidth = Math.max(
    1,
    Math.round(bounds.width * previewScale * zoom),
  );
  const previewHeight = Math.max(
    1,
    Math.round(bounds.height * previewScale * zoom),
  );

  const beginDrag = useCallback(
    (event: ReactPointerEvent<HTMLElement>, mode: CropDragMode): void => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      dragRef.current = {
        mode,
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY,
        crop,
      };
      stageRef.current?.setPointerCapture?.(event.pointerId);
    },
    [crop],
  );

  const moveDrag = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const drag = dragRef.current;
    const stage = stageRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !stage) return;
    const rect = stage.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    event.preventDefault();
    const deltaX = ((event.clientX - drag.clientX) / rect.width) * bounds.width;
    const deltaY =
      ((event.clientY - drag.clientY) / rect.height) * bounds.height;
    const nextCrop =
      drag.mode === "move"
        ? {
            ...drag.crop,
            x: drag.crop.x + deltaX,
            y: drag.crop.y + deltaY,
          }
        : resizeCropFromCorner(
            drag.crop,
            bounds,
            drag.mode,
            deltaX,
            deltaY,
            aspectRatio,
          );
    onChange(setCropRect(edit, nextCrop));
  };

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    stageRef.current?.releasePointerCapture?.(event.pointerId);
    dragRef.current = null;
  };

  const moveCropWithKeyboard = (
    event: ReactKeyboardEvent<HTMLElement>,
  ): void => {
    const step = event.shiftKey ? 10 : 1;
    const offset =
      event.key === "ArrowLeft"
        ? { x: -step, y: 0 }
        : event.key === "ArrowRight"
          ? { x: step, y: 0 }
          : event.key === "ArrowUp"
            ? { x: 0, y: -step }
            : event.key === "ArrowDown"
              ? { x: 0, y: step }
              : null;
    if (!offset) return;
    event.preventDefault();
    onChange(
      setCropRect(edit, {
        ...crop,
        x: crop.x + offset.x,
        y: crop.y + offset.y,
      }),
    );
  };

  const resizeWithKeyboard = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    corner: CropHandle,
  ): void => {
    const step = event.shiftKey ? 10 : 1;
    const delta =
      event.key === "ArrowLeft"
        ? { x: -step, y: 0 }
        : event.key === "ArrowRight"
          ? { x: step, y: 0 }
          : event.key === "ArrowUp"
            ? { x: 0, y: -step }
            : event.key === "ArrowDown"
              ? { x: 0, y: step }
              : null;
    if (!delta) return;
    event.preventDefault();
    event.stopPropagation();
    onChange(
      setCropRect(
        edit,
        resizeCropFromCorner(
          crop,
          bounds,
          corner,
          delta.x,
          delta.y,
          aspectRatio,
        ),
      ),
    );
  };

  const imageStyle: CSSProperties = {
    width: `${(edit.sourceWidth / bounds.width) * 100}%`,
    height: `${(edit.sourceHeight / bounds.height) * 100}%`,
    transform: `translate(-50%, -50%) rotate(${edit.rotation}deg)`,
  };
  const cropStyle: CSSProperties = {
    left: `${(crop.x / bounds.width) * 100}%`,
    top: `${(crop.y / bounds.height) * 100}%`,
    width: `${(crop.width / bounds.width) * 100}%`,
    height: `${(crop.height / bounds.height) * 100}%`,
  };

  return (
    <div className="donativus-vb-image-crop-workspace">
      <div
        className="donativus-vb-image-canvas-toolbar bg-base-100 border-base-300"
        role="toolbar"
        aria-label={labels.imageCanvasControls}
      >
        <button
          type="button"
          className="btn btn-sm btn-ghost btn-square"
          aria-label={labels.zoomImageOut}
          disabled={zoom <= MIN_PREVIEW_ZOOM}
          onClick={() =>
            setZoom((value) =>
              Math.max(MIN_PREVIEW_ZOOM, value - PREVIEW_ZOOM_STEP),
            )
          }
        >
          <ZoomOut size={17} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="btn btn-sm btn-ghost donativus-vb-image-zoom-value"
          aria-label={`${labels.resetImageZoom}: ${Math.round(zoom * 100)}%`}
          onClick={() => setZoom(1)}
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          type="button"
          className="btn btn-sm btn-ghost btn-square"
          aria-label={labels.zoomImageIn}
          disabled={zoom >= MAX_PREVIEW_ZOOM}
          onClick={() =>
            setZoom((value) =>
              Math.min(MAX_PREVIEW_ZOOM, value + PREVIEW_ZOOM_STEP),
            )
          }
        >
          <ZoomIn size={17} aria-hidden="true" />
        </button>
        <span
          className="donativus-vb-image-toolbar-separator"
          aria-hidden="true"
        />
        <button
          type="button"
          className="btn btn-sm btn-ghost btn-square tooltip tooltip-bottom"
          data-tip={labels.rotateImageLeft}
          aria-label={labels.rotateImageLeft}
          onClick={onRotateLeft}
        >
          <RotateCcw size={17} aria-hidden="true" />
          <span className="donativus-vb-visually-hidden">
            {labels.rotateImageLeft}
          </span>
        </button>
        <button
          type="button"
          className="btn btn-sm btn-ghost btn-square tooltip tooltip-bottom"
          data-tip={labels.rotateImage}
          aria-label={labels.rotateImage}
          onClick={onRotateRight}
        >
          <RotateCw size={17} aria-hidden="true" />
          <span className="donativus-vb-visually-hidden">
            {labels.rotateImage}
          </span>
        </button>
      </div>

      <div className="donativus-vb-image-crop-scroll-viewport">
        <div className="donativus-vb-image-crop-scroll-content">
          <div
            ref={stageRef}
            className="donativus-vb-image-crop-stage"
            style={{
              width: `${previewWidth}px`,
              height: `${previewHeight}px`,
              aspectRatio: `${bounds.width} / ${bounds.height}`,
            }}
            onPointerMove={moveDrag}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            data-vb-image-preview
          >
            {previewUrl ? (
              <img
                src={previewUrl}
                alt=""
                className="donativus-vb-image-crop-source"
                style={imageStyle}
                draggable={false}
              />
            ) : (
              <div className="donativus-vb-image-crop-loading" role="status">
                <ImageIcon size={28} strokeWidth={1.5} aria-hidden="true" />
                <span>Preparing preview…</span>
              </div>
            )}

            <div
              className="donativus-vb-image-crop-frame"
              style={cropStyle}
              tabIndex={0}
              role="group"
              aria-label={labels.cropAreaLabel}
              onPointerDown={(event) => beginDrag(event, "move")}
              onKeyDown={moveCropWithKeyboard}
            >
              <span className="donativus-vb-image-crop-grid" aria-hidden="true">
                <i />
                <i />
                <i />
                <i />
              </span>
              <span className="donativus-vb-image-crop-move" aria-hidden="true">
                <Move size={16} />
              </span>
              {HANDLE_CORNERS.map((corner) => (
                <button
                  key={corner}
                  type="button"
                  className={`donativus-vb-image-crop-handle is-${corner}`}
                  aria-label={labels.cropHandleLabel(corner)}
                  onPointerDown={(event) => beginDrag(event, corner)}
                  onKeyDown={(event) => resizeWithKeyboard(event, corner)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Visual, keyboard-operable pre-upload image editor. */
export function ImageEditPanel({
  file,
  edit,
  error,
  maxBytes,
  prepareOutput,
  onChange,
  onCancel,
  onSkip,
  onConfirm,
}: ImageEditPanelProps): React.JSX.Element {
  const { labels } = useBuilderMeta();
  const [aspectKey, setAspectKey] = useState<AspectRatioPreset["key"]>("free");
  const previewUrl = useLocalImageUrl(file);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const output = editedOutputDimensions(edit);
  const currentMeasurementKey = measurementKey(edit);
  const [sizeMeasurement, setSizeMeasurement] = useState<OutputSizeMeasurement>(
    () => ({
      key: currentMeasurementKey,
      kind: "measured",
      file,
    }),
  );
  const currentSizeMeasurement: OutputSizeMeasurement =
    sizeMeasurement.key === currentMeasurementKey
      ? sizeMeasurement
      : { key: currentMeasurementKey, kind: "measuring" };
  const measuredBytes =
    currentSizeMeasurement.kind === "measured"
      ? currentSizeMeasurement.file.size
      : null;
  const measuredSizeIsValid =
    measuredBytes !== null && measuredBytes <= maxBytes;
  const measuredSizeIsTooLarge =
    measuredBytes !== null && measuredBytes > maxBytes;
  const activeAspect =
    ASPECT_RATIO_PRESETS.find((preset) => preset.key === aspectKey) ??
    ASPECT_RATIO_PRESETS[0]!;
  const maxOutputWidth = Math.min(edit.crop.width, MAX_EDIT_DIMENSION_PX);
  const minOutputWidth = Math.min(MIN_EDIT_TARGET_WIDTH_PX, maxOutputWidth);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusFrame = requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });
    return () => {
      cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, []);

  useEffect(() => {
    let active = true;
    if (isIdentityEdit(edit)) {
      setSizeMeasurement({
        key: currentMeasurementKey,
        kind: "measured",
        file,
      });
      return () => {
        active = false;
      };
    }

    setSizeMeasurement({ key: currentMeasurementKey, kind: "measuring" });
    const timer = window.setTimeout(() => {
      void prepareOutput(file, edit)
        .then((preparedFile) => {
          if (!active) return;
          setSizeMeasurement(
            preparedFile === null
              ? { key: currentMeasurementKey, kind: "unavailable" }
              : {
                  key: currentMeasurementKey,
                  kind: "measured",
                  file: preparedFile,
                },
          );
        })
        .catch(() => {
          if (active) {
            setSizeMeasurement({
              key: currentMeasurementKey,
              kind: "unavailable",
            });
          }
        });
    }, SIZE_MEASUREMENT_DELAY_MS);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [currentMeasurementKey, edit, file, prepareOutput]);

  const updateAspect = (preset: AspectRatioPreset): void => {
    setAspectKey(preset.key);
    onChange(applyAspectRatioPreset(edit, preset));
  };

  const rotate = (direction: "left" | "right"): void => {
    const rotated =
      direction === "left"
        ? rotateCounterQuarterTurn(edit)
        : rotateQuarterTurn(edit);
    onChange(
      activeAspect.ratio === null
        ? rotated
        : applyAspectRatioPreset(rotated, activeAspect),
    );
  };

  const reset = (): void => {
    setAspectKey("free");
    onChange(createImageEditState(edit.sourceWidth, edit.sourceHeight));
  };

  const handleDialogKeyDown = (event: ReactKeyboardEvent): void => {
    if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ??
        [],
    );
    const first = focusable[0];
    const last = focusable.at(-1);
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      className="donativus-vb-image-edit-overlay"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
      data-vb-image-edit
    >
      <div
        ref={dialogRef}
        className="donativus-vb-image-edit-modal bg-base-100"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={handleDialogKeyDown}
      >
        <header className="donativus-vb-image-edit-header border-base-300">
          <div className="donativus-vb-image-edit-heading">
            <span className="donativus-vb-image-edit-heading-icon bg-primary text-primary-content">
              <Crop size={17} aria-hidden="true" />
            </span>
            <div>
              <h2 id={titleId}>{labels.editImageTitle}</h2>
              <p>{file.name}</p>
            </div>
          </div>
          <div className="donativus-vb-image-edit-header-actions">
            <button
              ref={closeButtonRef}
              type="button"
              className="btn btn-sm btn-ghost btn-square"
              aria-label={labels.cancelEditing}
              onClick={onCancel}
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
        </header>

        <main className="donativus-vb-image-edit-body bg-base-200">
          <ImageCropCanvas
            previewUrl={previewUrl}
            edit={edit}
            aspectRatio={activeAspect.ratio}
            onChange={onChange}
            onRotateLeft={() => rotate("left")}
            onRotateRight={() => rotate("right")}
          />

          <aside className="donativus-vb-image-edit-sidebar bg-base-100 border-base-300">
            <section className="donativus-vb-image-edit-tool-section">
              <div className="donativus-vb-image-edit-tool-heading">
                <div>
                  <h3>{labels.aspectRatioLabel}</h3>
                  <p>{labels.editImageInstructions}</p>
                </div>
              </div>
              <div
                className="donativus-vb-image-aspect-grid"
                role="group"
                aria-label={labels.aspectRatioLabel}
              >
                {ASPECT_RATIO_PRESETS.map((preset) => {
                  const selected = preset.key === aspectKey;
                  return (
                    <button
                      key={preset.key}
                      type="button"
                      className={`btn btn-sm${selected ? " btn-primary" : " btn-ghost"}`}
                      aria-pressed={selected}
                      onClick={() => updateAspect(preset)}
                    >
                      <span
                        className={`donativus-vb-image-aspect-icon is-${preset.key}`}
                        aria-hidden="true"
                      />
                      {labels.aspectRatioNames[preset.key]}
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="donativus-vb-image-edit-tool-section">
              <div className="donativus-vb-image-edit-size-label">
                <div>
                  <h3>{labels.resizeWidth}</h3>
                  <p>{labels.resizeWidthHelp}</p>
                </div>
                <output htmlFor={`${titleId}-width`}>
                  {labels.imageDimensions(output.width, output.height)}
                </output>
              </div>
              <input
                id={`${titleId}-width`}
                type="range"
                className="range range-primary range-sm"
                min={minOutputWidth}
                max={maxOutputWidth}
                value={output.width}
                aria-label={labels.resizeWidth}
                onChange={(event) => {
                  const width = Number(event.target.value);
                  onChange(
                    setTargetWidth(
                      edit,
                      width >= maxOutputWidth ? null : width,
                    ),
                  );
                }}
              />
              <div
                className="donativus-vb-image-edit-range-ends"
                aria-hidden="true"
              >
                <span>{minOutputWidth}px</span>
                <span>{maxOutputWidth}px</span>
              </div>
            </section>

            <section
              className={`donativus-vb-image-edit-file-size ${
                currentSizeMeasurement.kind === "measuring"
                  ? "is-measuring"
                  : currentSizeMeasurement.kind === "unavailable"
                    ? "is-unavailable text-warning"
                    : measuredSizeIsValid
                      ? "is-valid text-success"
                      : "is-too-large text-error"
              }`}
              role="status"
              aria-live="polite"
            >
              {currentSizeMeasurement.kind === "measuring" ? (
                <span
                  className="loading loading-spinner loading-sm"
                  aria-hidden="true"
                />
              ) : measuredSizeIsValid ? (
                <CircleCheck size={18} aria-hidden="true" />
              ) : (
                <TriangleAlert size={18} aria-hidden="true" />
              )}
              <div>
                <strong>
                  {labels.imageFileSize(
                    measuredBytes === null
                      ? "—"
                      : formatMegabytes(measuredBytes),
                    formatMegabytes(maxBytes),
                  )}
                </strong>
                <span>
                  {currentSizeMeasurement.kind === "measuring"
                    ? labels.imageFileSizeMeasuring
                    : currentSizeMeasurement.kind === "unavailable"
                      ? labels.imageFileSizeUnavailable
                      : measuredSizeIsValid
                        ? labels.imageFileSizeOk
                        : labels.imageFileSizeTooLarge}
                </span>
              </div>
            </section>

            <section className="donativus-vb-image-edit-summary bg-base-200">
              <div>
                <span>{labels.originalImageLabel}</span>
                <strong>
                  {labels.imageDimensions(edit.sourceWidth, edit.sourceHeight)}
                </strong>
              </div>
              <div>
                <span>{labels.outputImageLabel}</span>
                <strong>
                  {labels.imageDimensions(output.width, output.height)}
                </strong>
              </div>
              <div>
                <span>{labels.aspectRatioLabel}</span>
                <strong>{labels.aspectRatioNames[aspectKey]}</strong>
              </div>
              <div>
                <span>Crop</span>
                <strong>
                  {labels.imageDimensions(edit.crop.width, edit.crop.height)}
                </strong>
              </div>
            </section>

            {error ? (
              <p
                className="alert alert-error donativus-vb-image-edit-error"
                role="alert"
              >
                {error}
              </p>
            ) : null}
          </aside>
        </main>

        <footer className="donativus-vb-image-edit-footer border-base-300">
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            onClick={reset}
          >
            {labels.resetEdits}
          </button>
          <div className="donativus-vb-image-edit-footer-actions">
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={onCancel}
            >
              {labels.cancelEditing}
            </button>
            {onSkip ? (
              <button
                type="button"
                className="btn btn-sm"
                disabled={file.size > maxBytes}
                onClick={onSkip}
              >
                {labels.skipEditing}
              </button>
            ) : null}
            <button
              type="button"
              className="btn btn-sm btn-primary"
              disabled={
                currentSizeMeasurement.kind === "measuring" ||
                measuredSizeIsTooLarge
              }
              onClick={() =>
                onConfirm(
                  currentSizeMeasurement.kind === "measured"
                    ? currentSizeMeasurement.file
                    : undefined,
                )
              }
            >
              <Check size={16} aria-hidden="true" />
              {labels.applyAndUpload}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
