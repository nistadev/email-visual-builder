// Pre-upload image editing model (task 13.2, design.md decision #9): crop
// with free and preset aspect ratios, 90-degree rotation, and bounded
// dimension resize over the *locally selected* file. All geometry here is
// pure and Node-testable; the canvas re-encode lives in
// `renderEditedImage` behind injectable deps so jsdom tests can stub it.
// The pipeline is rotate -> crop -> resize, and the output is re-encoded
// only into the already-allowed raster formats within the configured size
// limit. A previously uploaded durable asset is never touched — only the
// confirmed re-encoded local file reaches the asset adapter.

export interface ImageCropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type ImageRotation = 0 | 90 | 180 | 270;

export interface ImageEditState {
  /** Intrinsic dimensions of the selected file (before any edit). */
  sourceWidth: number;
  sourceHeight: number;
  /** Quarter-turn rotation applied before cropping. */
  rotation: ImageRotation;
  /** Crop rectangle in rotated-image coordinates. */
  crop: ImageCropRect;
  /** Output width in px; the height follows the crop aspect. `null` keeps the crop size. */
  targetWidth: number | null;
}

/** Raster formats the pre-upload editor may emit (matches the API validator's allowlist minus GIF, which canvas cannot re-encode). */
export const EDITABLE_OUTPUT_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

/** Smallest allowed resize width. */
export const MIN_EDIT_TARGET_WIDTH_PX = 16;
/** Largest dimension the editor will emit. */
export const MAX_EDIT_DIMENSION_PX = 4096;
/**
 * Default byte cap the editor re-encodes down to. Deliberately stricter than
 * the API's upload limit: images the editor produces are embedded in emails,
 * where 1MB is already generous.
 */
export const DEFAULT_EDITED_IMAGE_MAX_BYTES = 1024 * 1024;

export interface AspectRatioPreset {
  key: "free" | "square" | "landscape-4-3" | "wide-16-9";
  /** width / height, or null for free-form cropping. */
  ratio: number | null;
}

export const ASPECT_RATIO_PRESETS: readonly AspectRatioPreset[] = [
  { key: "free", ratio: null },
  { key: "square", ratio: 1 },
  { key: "landscape-4-3", ratio: 4 / 3 },
  { key: "wide-16-9", ratio: 16 / 9 },
];

const round = (value: number): number => Math.round(value);

/** Dimensions of the source after applying the state's rotation. */
export function rotatedDimensions(state: ImageEditState): {
  width: number;
  height: number;
} {
  const swapped = state.rotation === 90 || state.rotation === 270;
  return {
    width: swapped ? state.sourceHeight : state.sourceWidth,
    height: swapped ? state.sourceWidth : state.sourceHeight,
  };
}

/** Initial state: no rotation, full-image crop, no resize. */
export function createImageEditState(
  sourceWidth: number,
  sourceHeight: number,
): ImageEditState {
  const width = Math.max(1, round(sourceWidth));
  const height = Math.max(1, round(sourceHeight));
  return {
    sourceWidth: width,
    sourceHeight: height,
    rotation: 0,
    crop: { x: 0, y: 0, width, height },
    targetWidth: null,
  };
}

/** True when the state performs no edit at all — the original file can be uploaded as-is. */
export function isIdentityEdit(state: ImageEditState): boolean {
  return (
    state.rotation === 0 &&
    state.targetWidth === null &&
    state.crop.x === 0 &&
    state.crop.y === 0 &&
    state.crop.width === state.sourceWidth &&
    state.crop.height === state.sourceHeight
  );
}

/** Rotates a quarter turn clockwise. The crop resets to the full rotated area so the crop never lands outside the image. */
export function rotateQuarterTurn(state: ImageEditState): ImageEditState {
  const rotation = ((state.rotation + 90) % 360) as ImageRotation;
  const next: ImageEditState = { ...state, rotation };
  const { width, height } = rotatedDimensions(next);
  return {
    ...next,
    crop: { x: 0, y: 0, width, height },
    targetWidth: clampTargetWidth(state.targetWidth, width),
  };
}

/** Rotates a quarter turn counter-clockwise and resets the crop to the new bounds. */
export function rotateCounterQuarterTurn(
  state: ImageEditState,
): ImageEditState {
  const rotation = ((state.rotation + 270) % 360) as ImageRotation;
  const next: ImageEditState = { ...state, rotation };
  const { width, height } = rotatedDimensions(next);
  return {
    ...next,
    crop: { x: 0, y: 0, width, height },
    targetWidth: clampTargetWidth(state.targetWidth, width),
  };
}

/** Clamps an arbitrary crop rectangle inside the rotated image bounds (minimum 1x1). */
export function clampCropRect(
  state: ImageEditState,
  rect: ImageCropRect,
): ImageCropRect {
  const bounds = rotatedDimensions(state);
  const width = Math.min(bounds.width, Math.max(1, round(rect.width)));
  const height = Math.min(bounds.height, Math.max(1, round(rect.height)));
  const x = Math.min(bounds.width - width, Math.max(0, round(rect.x)));
  const y = Math.min(bounds.height - height, Math.max(0, round(rect.y)));
  return { x, y, width, height };
}

/** Applies a crop rectangle, clamped to bounds; the resize target is re-clamped to the new crop width. */
export function setCropRect(
  state: ImageEditState,
  rect: ImageCropRect,
): ImageEditState {
  const crop = clampCropRect(state, rect);
  return {
    ...state,
    crop,
    targetWidth: clampTargetWidth(state.targetWidth, crop.width),
  };
}

/** Replaces the crop with the largest centered rectangle of the preset's ratio (or the full image for free). */
export function applyAspectRatioPreset(
  state: ImageEditState,
  preset: AspectRatioPreset,
): ImageEditState {
  const bounds = rotatedDimensions(state);
  if (preset.ratio === null) {
    return setCropRect(state, {
      x: 0,
      y: 0,
      width: bounds.width,
      height: bounds.height,
    });
  }
  let width = bounds.width;
  let height = round(width / preset.ratio);
  if (height > bounds.height) {
    height = bounds.height;
    width = round(height * preset.ratio);
  }
  return setCropRect(state, {
    x: round((bounds.width - width) / 2),
    y: round((bounds.height - height) / 2),
    width,
    height,
  });
}

function clampTargetWidth(
  targetWidth: number | null,
  cropWidth: number,
): number | null {
  if (targetWidth === null) return null;
  // Downscale only: bounded to [MIN, crop width] so the editor never upscales.
  const max = Math.min(cropWidth, MAX_EDIT_DIMENSION_PX);
  return Math.min(max, Math.max(MIN_EDIT_TARGET_WIDTH_PX, round(targetWidth)));
}

/** Sets the bounded output width (`null` restores the crop's own size). */
export function setTargetWidth(
  state: ImageEditState,
  targetWidth: number | null,
): ImageEditState {
  return {
    ...state,
    targetWidth: clampTargetWidth(targetWidth, state.crop.width),
  };
}

/** Final output dimensions after crop and resize (aspect preserved, minimum 1px). */
export function editedOutputDimensions(state: ImageEditState): {
  width: number;
  height: number;
} {
  const cropped = Math.min(state.crop.width, MAX_EDIT_DIMENSION_PX);
  const width = state.targetWidth ?? cropped;
  const height = Math.max(
    1,
    round((state.crop.height / state.crop.width) * width),
  );
  return { width: Math.max(1, width), height };
}

/**
 * Output MIME type for a re-encode. Keeps the input format when canvas can
 * emit it; GIF (and anything else) falls back to PNG because canvas
 * re-encoding cannot preserve animation or exotic formats.
 */
export function editedOutputMimeType(inputMimeType: string): string {
  return (EDITABLE_OUTPUT_MIME_TYPES as readonly string[]).includes(
    inputMimeType,
  )
    ? inputMimeType
    : "image/png";
}

export type EditedImageResult =
  | { ok: true; file: File; width: number; height: number; mimeType: string }
  | { ok: false; reason: "too-large" | "render-failed"; message: string };

/** Browser pieces `renderEditedImage` needs, injectable so tests run without a real canvas. */
export interface ImageRenderDeps {
  loadImage: (
    file: Blob,
  ) => Promise<{ source: CanvasImageSource; width: number; height: number }>;
  createCanvas: (width: number, height: number) => HTMLCanvasElement;
}

const domRenderDeps: ImageRenderDeps = {
  loadImage: async (file) => {
    const bitmap = await createImageBitmap(file);
    return { source: bitmap, width: bitmap.width, height: bitmap.height };
  },
  createCanvas: (width, height) => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas;
  },
};

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), mimeType, 0.92);
  });
}

function editedFilename(originalName: string, mimeType: string): string {
  const extension =
    mimeType === "image/jpeg" ? "jpg" : (mimeType.split("/")[1] ?? "png");
  const base = originalName.replace(/\.[^.]+$/, "") || "image";
  return `${base}.${extension}`;
}

/**
 * Applies rotate -> crop -> resize to the local file and re-encodes it via
 * canvas. Returns a new File; the input file and any previously uploaded
 * durable asset are never mutated. Fails (without uploading anything) when
 * the re-encoded output exceeds `maxBytes` or the canvas cannot render.
 */
export async function renderEditedImage(
  file: File,
  state: ImageEditState,
  options?: { maxBytes?: number; deps?: ImageRenderDeps },
): Promise<EditedImageResult> {
  const maxBytes = options?.maxBytes ?? DEFAULT_EDITED_IMAGE_MAX_BYTES;
  const deps = options?.deps ?? domRenderDeps;
  try {
    const { source } = await deps.loadImage(file);
    const rotated = rotatedDimensions(state);

    // Stage 1: rotated full image.
    const rotatedCanvas = deps.createCanvas(rotated.width, rotated.height);
    const rotatedContext = rotatedCanvas.getContext("2d");
    if (!rotatedContext) {
      return {
        ok: false,
        reason: "render-failed",
        message: "Canvas 2D context is unavailable.",
      };
    }
    rotatedContext.translate(rotated.width / 2, rotated.height / 2);
    rotatedContext.rotate((state.rotation * Math.PI) / 180);
    rotatedContext.drawImage(
      source,
      -state.sourceWidth / 2,
      -state.sourceHeight / 2,
    );

    // Stage 2: crop + resize in one draw.
    const output = editedOutputDimensions(state);
    const outputCanvas = deps.createCanvas(output.width, output.height);
    const outputContext = outputCanvas.getContext("2d");
    if (!outputContext) {
      return {
        ok: false,
        reason: "render-failed",
        message: "Canvas 2D context is unavailable.",
      };
    }
    outputContext.drawImage(
      rotatedCanvas,
      state.crop.x,
      state.crop.y,
      state.crop.width,
      state.crop.height,
      0,
      0,
      output.width,
      output.height,
    );

    const requestedMimeType = editedOutputMimeType(file.type);
    const blob = await canvasToBlob(outputCanvas, requestedMimeType);
    // `toBlob` is allowed to ignore the requested type and fall back to PNG
    // when the browser cannot encode it. Trust what came back rather than what
    // was asked for: labelling PNG bytes as WebP produces a file whose
    // extension, declared type, and content disagree, which the upload
    // endpoint rejects.
    const mimeType = blob?.type || requestedMimeType;
    if (!blob) {
      return {
        ok: false,
        reason: "render-failed",
        message: "The edited image could not be encoded.",
      };
    }
    if (blob.size > maxBytes) {
      return {
        ok: false,
        reason: "too-large",
        message: `The edited image is ${blob.size} bytes; the limit is ${maxBytes} bytes.`,
      };
    }
    return {
      ok: true,
      file: new File([blob], editedFilename(file.name, mimeType), {
        type: mimeType,
      }),
      width: output.width,
      height: output.height,
      mimeType,
    };
  } catch (error) {
    return {
      ok: false,
      reason: "render-failed",
      message:
        error instanceof Error ? error.message : "Image rendering failed.",
    };
  }
}
