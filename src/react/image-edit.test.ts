// Task 13.3 (pure half): geometry, bounds, identity detection, MIME
// mapping, and the stubbed-canvas re-encode pipeline of the pre-upload
// image editor. React interaction coverage lives in
// `image-source-controls.test.tsx`.

import assert from "node:assert/strict";
import test from "node:test";
import {
  ASPECT_RATIO_PRESETS,
  MAX_EDIT_DIMENSION_PX,
  MIN_EDIT_TARGET_WIDTH_PX,
  applyAspectRatioPreset,
  clampCropRect,
  createImageEditState,
  editedOutputDimensions,
  editedOutputMimeType,
  isIdentityEdit,
  renderEditedImage,
  rotateCounterQuarterTurn,
  rotateQuarterTurn,
  rotatedDimensions,
  setCropRect,
  setTargetWidth,
  type ImageRenderDeps,
} from "./image-edit.js";

test.describe("image edit geometry", () => {
  test("initial state is a full-image identity edit", () => {
    const state = createImageEditState(800, 600);
    assert.deepEqual(state.crop, { x: 0, y: 0, width: 800, height: 600 });
    assert.equal(state.rotation, 0);
    assert.equal(state.targetWidth, null);
    assert.equal(isIdentityEdit(state), true);
  });

  test("quarter-turn rotation swaps dimensions and resets the crop", () => {
    const state = rotateQuarterTurn(createImageEditState(800, 600));
    assert.equal(state.rotation, 90);
    assert.deepEqual(rotatedDimensions(state), { width: 600, height: 800 });
    assert.deepEqual(state.crop, { x: 0, y: 0, width: 600, height: 800 });
    assert.equal(isIdentityEdit(state), false);
  });

  test("counter-clockwise rotation swaps dimensions in the other direction", () => {
    const state = rotateCounterQuarterTurn(createImageEditState(800, 600));
    assert.equal(state.rotation, 270);
    assert.deepEqual(rotatedDimensions(state), { width: 600, height: 800 });
    assert.deepEqual(state.crop, { x: 0, y: 0, width: 600, height: 800 });
  });

  test("four quarter turns return to identity", () => {
    let state = createImageEditState(800, 600);
    for (let turn = 0; turn < 4; turn += 1) state = rotateQuarterTurn(state);
    assert.equal(state.rotation, 0);
    assert.equal(isIdentityEdit(state), true);
  });

  test("crop rectangles are clamped inside the rotated bounds", () => {
    const state = createImageEditState(800, 600);
    assert.deepEqual(
      clampCropRect(state, { x: -50, y: -50, width: 5000, height: 5000 }),
      { x: 0, y: 0, width: 800, height: 600 },
    );
    assert.deepEqual(
      clampCropRect(state, { x: 700, y: 500, width: 400, height: 300 }),
      { x: 400, y: 300, width: 400, height: 300 },
    );
    // Minimum 1x1.
    assert.deepEqual(
      clampCropRect(state, { x: 10, y: 10, width: 0, height: -5 }),
      { x: 10, y: 10, width: 1, height: 1 },
    );
  });

  test("aspect presets produce centered crops of the requested ratio", () => {
    const state = createImageEditState(800, 600);
    const square = applyAspectRatioPreset(
      state,
      ASPECT_RATIO_PRESETS.find((preset) => preset.key === "square")!,
    );
    assert.deepEqual(square.crop, { x: 100, y: 0, width: 600, height: 600 });

    const wide = applyAspectRatioPreset(
      state,
      ASPECT_RATIO_PRESETS.find((preset) => preset.key === "wide-16-9")!,
    );
    assert.equal(wide.crop.width, 800);
    assert.equal(wide.crop.height, 450);
    assert.equal(wide.crop.y, 75);

    const free = applyAspectRatioPreset(
      wide,
      ASPECT_RATIO_PRESETS.find((preset) => preset.key === "free")!,
    );
    assert.deepEqual(free.crop, { x: 0, y: 0, width: 800, height: 600 });
  });

  test("resize is bounded: no upscale past the crop width, floor at the minimum", () => {
    const state = setCropRect(createImageEditState(800, 600), {
      x: 0,
      y: 0,
      width: 400,
      height: 300,
    });
    assert.equal(setTargetWidth(state, 9000).targetWidth, 400);
    assert.equal(
      setTargetWidth(state, 1).targetWidth,
      MIN_EDIT_TARGET_WIDTH_PX,
    );
    assert.equal(setTargetWidth(state, 200).targetWidth, 200);
    assert.equal(setTargetWidth(state, null).targetWidth, null);
  });

  test("shrinking the crop re-clamps an existing resize target", () => {
    const state = setTargetWidth(createImageEditState(800, 600), 700);
    const cropped = setCropRect(state, { x: 0, y: 0, width: 300, height: 200 });
    assert.equal(cropped.targetWidth, 300);
  });

  test("output dimensions follow crop aspect through resize", () => {
    const state = setTargetWidth(
      setCropRect(createImageEditState(800, 600), {
        x: 0,
        y: 0,
        width: 400,
        height: 300,
      }),
      200,
    );
    assert.deepEqual(editedOutputDimensions(state), {
      width: 200,
      height: 150,
    });
  });

  test("output dimensions never exceed the maximum edit dimension", () => {
    const state = createImageEditState(MAX_EDIT_DIMENSION_PX + 1000, 100);
    assert.equal(
      editedOutputDimensions(state).width <= MAX_EDIT_DIMENSION_PX,
      true,
    );
  });

  test("output MIME keeps allowed raster formats and maps everything else to PNG", () => {
    assert.equal(editedOutputMimeType("image/jpeg"), "image/jpeg");
    assert.equal(editedOutputMimeType("image/png"), "image/png");
    assert.equal(editedOutputMimeType("image/webp"), "image/webp");
    // Canvas cannot re-encode GIF (animation would be lost anyway) or SVG.
    assert.equal(editedOutputMimeType("image/gif"), "image/png");
    assert.equal(editedOutputMimeType("image/svg+xml"), "image/png");
  });
});

/** Fake canvas deps: records draw calls, emits a blob of a controllable byte size. */
function createFakeDeps(options: {
  sourceWidth: number;
  sourceHeight: number;
  blobBytes: number | null;
}): ImageRenderDeps & { createdCanvases: { width: number; height: number }[] } {
  const createdCanvases: { width: number; height: number }[] = [];
  const context = {
    translate: () => undefined,
    rotate: () => undefined,
    drawImage: () => undefined,
  };
  return {
    createdCanvases,
    loadImage: () =>
      Promise.resolve({
        source: {} as CanvasImageSource,
        width: options.sourceWidth,
        height: options.sourceHeight,
      }),
    createCanvas: (width, height) => {
      createdCanvases.push({ width, height });
      const canvas = {
        width,
        height,
        getContext: () => context,
        toBlob: (callback: (blob: Blob | null) => void, mimeType?: string) => {
          callback(
            options.blobBytes === null
              ? null
              : new Blob([new Uint8Array(options.blobBytes)], {
                  type: mimeType,
                }),
          );
        },
      };
      return canvas as unknown as HTMLCanvasElement;
    },
  };
}

test.describe("renderEditedImage", () => {
  test("re-encodes with the edited dimensions and preserved MIME", async () => {
    const deps = createFakeDeps({
      sourceWidth: 800,
      sourceHeight: 600,
      blobBytes: 2048,
    });
    const state = setTargetWidth(
      setCropRect(createImageEditState(800, 600), {
        x: 100,
        y: 50,
        width: 400,
        height: 300,
      }),
      200,
    );
    const result = await renderEditedImage(
      new File([new Uint8Array(10)], "photo.jpg", { type: "image/jpeg" }),
      state,
      { deps },
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.width, 200);
    assert.equal(result.height, 150);
    assert.equal(result.mimeType, "image/jpeg");
    assert.equal(result.file.type, "image/jpeg");
    assert.equal(result.file.name, "photo.jpg");
    // Stage canvases: rotated full image, then the output.
    assert.deepEqual(deps.createdCanvases, [
      { width: 800, height: 600 },
      { width: 200, height: 150 },
    ]);
  });

  test("rotation renders through a swapped-dimension stage canvas", async () => {
    const deps = createFakeDeps({
      sourceWidth: 800,
      sourceHeight: 600,
      blobBytes: 10,
    });
    const state = rotateQuarterTurn(createImageEditState(800, 600));
    const result = await renderEditedImage(
      new File([new Uint8Array(10)], "photo.png", { type: "image/png" }),
      state,
      { deps },
    );
    assert.equal(result.ok, true);
    assert.deepEqual(deps.createdCanvases[0], { width: 600, height: 800 });
  });

  test("gif input re-encodes as png with a matching filename extension", async () => {
    const deps = createFakeDeps({
      sourceWidth: 100,
      sourceHeight: 100,
      blobBytes: 10,
    });
    const result = await renderEditedImage(
      new File([new Uint8Array(10)], "anim.gif", { type: "image/gif" }),
      rotateQuarterTurn(createImageEditState(100, 100)),
      { deps },
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.mimeType, "image/png");
    assert.equal(result.file.name, "anim.png");
  });

  test("rejects a re-encoded output that exceeds the byte limit", async () => {
    const deps = createFakeDeps({
      sourceWidth: 800,
      sourceHeight: 600,
      blobBytes: 5000,
    });
    const result = await renderEditedImage(
      new File([new Uint8Array(10)], "photo.png", { type: "image/png" }),
      rotateQuarterTurn(createImageEditState(800, 600)),
      { deps, maxBytes: 1024 },
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.reason, "too-large");
  });

  test("reports a render failure when the canvas cannot encode", async () => {
    const deps = createFakeDeps({
      sourceWidth: 800,
      sourceHeight: 600,
      blobBytes: null,
    });
    const result = await renderEditedImage(
      new File([new Uint8Array(10)], "photo.png", { type: "image/png" }),
      rotateQuarterTurn(createImageEditState(800, 600)),
      { deps },
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.reason, "render-failed");
  });
});
