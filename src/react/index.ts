/**
 * `email-visual-builder/react` — provider, compound UI, block canvas,
 * inspectors, rich-text adapter, and editor presets.
 */

export * from "./rich-text/index.js";

export type {
  AssetAdapter,
  AssetUploadContext,
  AssetUploadResult,
} from "./asset-adapter.js";
export {
  ASPECT_RATIO_PRESETS,
  DEFAULT_EDITED_IMAGE_MAX_BYTES,
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
  type AspectRatioPreset,
  type EditedImageResult,
  type ImageCropRect,
  type ImageEditState,
  type ImageRenderDeps,
  type ImageRotation,
} from "./image-edit.js";
export {
  ImageSourceControls,
  type ImageSourceControlsProps,
} from "./image-source-controls.js";

export {
  BuilderProvider,
  useBuilderActions,
  useBuilderMeta,
  useBuilderSelector,
  useEditorChrome,
  type BuilderActions,
  type BuilderMeta,
  type BuilderProviderProps,
  type EditorChromeState,
} from "./provider.js";
export {
  DEFAULT_BUILDER_LABELS,
  blockDisplayName,
  humanizeBlockType,
  type BuilderLabels,
} from "./labels.js";
export {
  canPlaceBlock,
  focusNodeElement,
  getDocumentTreeView,
  isDescendantOf,
  resolveInsertTarget,
  useCanPlaceBlock,
  useDocument,
  useHoveredNodeId,
  useNode,
  usePreviewDevice,
  useSelectedNodeId,
  type DocumentTreeView,
} from "./node-helpers.js";
export { useNodeActions, type NodeActions } from "./use-node-actions.js";
export {
  handleHistoryKeyDown,
  handleTreeKeyDown,
  type TreeKeyContext,
} from "./keyboard.js";
export {
  BuilderDndContext,
  DropSlot,
  completeDrag,
  isDropAllowed,
  useBlockDragHandle,
  useLibraryDrag,
  type ActiveDragData,
  type DropSlotData,
  type DropSlotProps,
} from "./dnd.js";
export { Canvas, CanvasNode, focusInspectorPanel } from "./canvas.js";
export {
  EmailComposerShell,
  type EmailComposerMetadataProps,
  type EmailComposerShellProps,
} from "./email-composer-shell.js";
export {
  BlockContent,
  StaticRichText,
  TemplatedText,
} from "./canvas-block-content.js";
export { Toolbar, type ToolbarProps } from "./toolbar.js";
export { BlockLibrary } from "./block-library.js";
export { Layers } from "./layers.js";
export { Inspector } from "./inspector.js";
export { ValidationReview } from "./validation-review.js";
export { Preview } from "./preview.js";
export {
  LibraryRail,
  Workspace,
  type WorkspaceLayout,
  type WorkspaceProps,
} from "./workspace.js";
export {
  EmailVisualBuilder,
  LandingPageVisualBuilder,
  type EmailVisualBuilderProps,
  type VisualBuilderPresetProps,
} from "./presets.js";
