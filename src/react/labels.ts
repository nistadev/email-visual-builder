// Every user-visible chrome string in one overridable map (task 15.10 wires
// host translations through `BuilderProviderProps.labels`). Block
// display names fall back to `humanizeBlockType` for plugin blocks that ship
// no label.

export interface BuilderLabels {
  modeMismatch: string;
  modeNames: Record<string, string>;
  blockNames: Record<string, string>;

  // Toolbar
  toolbarLabel: string;
  blockActionsLabel: string;
  undo: string;
  redo: string;
  deviceDesktop: string;
  deviceTablet: string;
  deviceMobile: string;
  variablePreviewTokens: string;
  variablePreviewSamples: string;
  validationStatus: string;
  validationValid: string;
  validationIssues: (errors: number, warnings: number) => string;
  openPreview: string;

  // Library / layers rail
  blocksTab: string;
  layersTab: string;
  searchBlocks: string;
  searchLayers: string;
  insertBlock: (blockName: string) => string;
  noBlockMatches: string;
  noLayerMatches: string;
  layersTree: string;
  expand: string;
  collapse: string;

  // Node actions
  moveUp: string;
  moveDown: string;
  moveLeft: string;
  moveRight: string;
  duplicate: string;
  remove: string;
  dragHandle: (blockName: string) => string;
  addVariable: string;
  searchVariables: string;
  noVariableMatches: string;
  addLink: string;
  applyLink: string;
  removeLink: string;
  formatBold: string;
  formatItalic: string;
  formatUnderline: string;
  formatStrikethrough: string;
  formatTextColor: string;
  formatFontFamily: string;
  formatFontDefault: string;
  formatClear: string;
  fontGroupSansSerif: string;
  fontGroupSerif: string;
  fontGroupMonospace: string;
  fontGroupScript: string;

  // Canvas
  canvasLabel: string;
  emptyContainer: string;
  unsupportedBlock: (type: string) => string;
  dropNotAllowed: string;

  // Email composer shell
  emailComposerLabel: string;
  emailComposerTitle: string;
  emailComposerDraft: string;
  emailComposerSaved: string;
  emailComposerUnsavedChanges: string;
  emailComposerOptions: string;
  emailComposerHideDetails: string;
  emailComposerShowDetails: string;
  emailSenderLabel: string;
  emailSubjectLabel: string;
  emailSubjectPlaceholder: string;
  emailPreviewTextSeparator: string;
  emailDefaultSenderName: string;
  emailDefaultSenderEmail: string;
  emailDefaultSubject: string;
  /** Accessible name for the toolbar's template-title input (task: placed next to undo/redo). */
  emailTemplateNameLabel: string;

  // Inspector
  inspectorTitle: string;
  documentSettingsTitle: string;
  inspectorNoSelection: string;
  groupDocument: string;
  groupContent: string;
  groupStyle: string;
  groupSpacing: string;
  groupLink: string;
  groupAccessibility: string;
  fieldLevel: string;
  fieldText: string;
  fieldAltText: string;
  fieldImageUrl: string;
  fieldLabel: string;
  fieldDestination: string;
  fieldColor: string;
  fieldBackgroundColor: string;
  fieldTextColor: string;
  fieldFontFamily: string;
  fieldFontSize: string;
  fieldLineHeight: string;
  fieldLetterSpacing: string;
  fieldFontWeight: string;
  fontWeightThin: string;
  fontWeightNormal: string;
  fontWeightSemibold: string;
  fontWeightBold: string;
  fieldAlign: string;
  alignLeft: string;
  alignCenter: string;
  alignRight: string;
  fieldWidth: string;
  fieldWidthUnit: string;
  fieldWidthPixels: string;
  fieldWidthPercent: string;
  fieldWidthAuto: string;
  fieldLanguage: string;
  fieldPreviewText: string;
  fieldPreviewTextHelp: string;
  fieldPageTitle: string;
  fieldMetaDescription: string;
  fieldFaviconUrl: string;
  fieldBodyBackground: string;
  fieldContentWidth: string;
  fieldLinkColor: string;
  fieldUnderlineLinks: string;
  fieldThickness: string;
  fieldDividerStyle: string;
  fieldHeight: string;
  fieldBorderRadius: string;
  fieldBorder: string;
  fieldBorderWidth: string;
  fieldBorderColor: string;
  fieldBorderRadiusByCorner: string;
  fieldBorderTopLeftRadius: string;
  fieldBorderTopRightRadius: string;
  fieldBorderBottomRightRadius: string;
  fieldBorderBottomLeftRadius: string;
  fieldShadow: string;
  fieldShadowOffsetX: string;
  fieldShadowOffsetY: string;
  fieldShadowBlur: string;
  fieldShadowSpread: string;
  fieldShadowColor: string;
  fieldSpacingTop: string;
  fieldSpacingRight: string;
  fieldSpacingBottom: string;
  fieldSpacingLeft: string;
  fieldPadding: string;
  fieldMargin: string;
  linkSpacing: string;
  unlinkSpacing: string;
  linkMargin: string;
  unlinkMargin: string;
  fieldResponsiveStack: string;
  fieldColumnRatios: string;
  fieldColumnCount: string;
  fieldColumnWidth: (column: number) => string;
  responsiveStackOn: string;
  responsiveStackOff: string;

  // Social block (items, style, shape)
  addSocialItem: string;
  removeSocialItem: (platform: string) => string;
  fieldSocialPlatform: string;
  fieldSocialUrl: string;
  socialPlatformNames: Record<string, string>;
  fieldSocialIconStyle: string;
  socialIconStyleLogo: string;
  socialIconStyleFilled: string;
  socialIconStyleFilledColor: string;
  socialIconStyleNoColor: string;
  fieldSocialShape: string;
  socialShapeCircle: string;
  socialShapeSquare: string;
  socialShapeRounded: string;
  fieldSocialGlyphTone: string;
  socialGlyphToneLight: string;
  socialGlyphToneDark: string;
  fieldSocialIconSize: string;
  fieldSocialGap: string;

  // Image source, upload, and pre-upload editing (tasks 13.1/13.2)
  imageSourceLabel: string;
  imageSourceUpload: string;
  imageSourceUrl: string;
  chooseImageFile: string;
  currentImage: (filename: string) => string;
  imageDimensions: (width: number, height: number) => string;
  uploadInProgress: string;
  uploadFailed: (message: string) => string;
  retryUpload: string;
  editCurrentImage: string;
  removeCurrentImage: string;
  loadingImageForEdit: string;
  editCurrentImageFailed: (message: string) => string;
  editImageTitle: string;
  editImageInstructions: string;
  imageCanvasControls: string;
  zoomImageIn: string;
  zoomImageOut: string;
  resetImageZoom: string;
  rotateImageLeft: string;
  rotateImage: string;
  aspectRatioLabel: string;
  aspectRatioNames: Record<
    "free" | "square" | "landscape-4-3" | "wide-16-9",
    string
  >;
  cropX: string;
  cropY: string;
  cropWidth: string;
  cropHeight: string;
  resizeWidth: string;
  resizeWidthHelp: string;
  cropAreaLabel: string;
  cropHandleLabel: (corner: string) => string;
  originalImageLabel: string;
  outputImageLabel: string;
  imageFileSize: (currentMegabytes: string, limitMegabytes: string) => string;
  imageFileSizeOk: string;
  imageFileSizeTooLarge: string;
  imageFileSizeMeasuring: string;
  imageFileSizeUnavailable: string;
  resetEdits: string;
  skipEditing: string;
  applyAndUpload: string;
  cancelEditing: string;

  // Validation review
  validationReviewTitle: string;
  validationNoIssues: string;
  validationErrorsHeading: string;
  validationWarningsHeading: string;
  close: string;

  // Preview
  previewTitle: string;
  previewUnavailable: string;
  previewHtmlSource: string;
  previewJsonLayout: string;
  previewCopySource: string;
  previewCopied: string;
  previewDeviceSelector: string;
  previewDeviceNames: Record<"desktop" | "tablet" | "mobile", string>;
  previewViewportDimensions: (width: number, height: number) => string;

  // Narrow-layout drawers
  openLibraryDrawer: string;
  openInspectorDrawer: string;

  // Live-region announcements
  announceInserted: (blockName: string) => string;
  announceRemoved: (blockName: string) => string;
  announceDuplicated: (blockName: string) => string;
  announceMoved: (blockName: string, position: number, total: number) => string;
  announceUndo: string;
  announceRedo: string;
  announceCommandRejected: (message: string) => string;
}

export function humanizeBlockType(type: string): string {
  const spaced = type.replace(/[-_]+/g, " ").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Resolves a block type's display name through the label map with a humanized fallback. */
export function blockDisplayName(labels: BuilderLabels, type: string): string {
  return labels.blockNames[type] ?? humanizeBlockType(type);
}

export const DEFAULT_BUILDER_LABELS: BuilderLabels = {
  modeMismatch: "This document's mode does not match this editor preset.",
  modeNames: { email: "Email", "landing-page": "Landing page" },
  blockNames: {
    "document-root": "Document",
    section: "Section",
    columns: "Columns",
    column: "Column",
    heading: "Heading",
    "rich-text": "Rich text",
    image: "Image",
    cta: "Button",
    divider: "Divider",
    spacer: "Spacer",
    social: "Social icons",
  },

  toolbarLabel: "Editor toolbar",
  blockActionsLabel: "Block actions",
  undo: "Undo",
  redo: "Redo",
  deviceDesktop: "Desktop preview width",
  deviceTablet: "Tablet preview width",
  deviceMobile: "Mobile preview width",
  variablePreviewTokens: "Show variable tokens",
  variablePreviewSamples: "Show sample values",
  validationStatus: "Validation status",
  validationValid: "No issues",
  validationIssues: (errors, warnings) => {
    const parts: string[] = [];
    if (errors > 0) parts.push(`${errors} error${errors === 1 ? "" : "s"}`);
    if (warnings > 0)
      parts.push(`${warnings} warning${warnings === 1 ? "" : "s"}`);
    return parts.join(", ");
  },
  openPreview: "Preview",

  blocksTab: "Blocks",
  layersTab: "Layers",
  searchBlocks: "Search blocks",
  searchLayers: "Search layers",
  insertBlock: (blockName) => `Insert ${blockName}`,
  noBlockMatches: "No blocks match your search.",
  noLayerMatches: "No layers match your search.",
  layersTree: "Document layers",
  expand: "Expand",
  collapse: "Collapse",

  moveUp: "Move up",
  moveDown: "Move down",
  moveLeft: "Move left",
  moveRight: "Move right",
  duplicate: "Duplicate",
  remove: "Delete",
  dragHandle: (blockName) => `Drag ${blockName}`,
  addVariable: "+ Add variable",
  searchVariables: "Search variables…",
  noVariableMatches: "No variables match your search.",
  addLink: "Add link",
  applyLink: "Apply",
  removeLink: "Remove link",
  formatBold: "Bold",
  formatItalic: "Italic",
  formatUnderline: "Underline",
  formatStrikethrough: "Strikethrough",
  formatTextColor: "Text color",
  formatFontFamily: "Font",
  formatFontDefault: "Block font",
  formatClear: "Clear formatting",
  fontGroupSansSerif: "Sans-serif",
  fontGroupSerif: "Serif",
  fontGroupMonospace: "Monospace",
  fontGroupScript: "Script and handwriting",

  canvasLabel: "Canvas",
  emptyContainer: "Empty — add blocks here",
  unsupportedBlock: (type) =>
    `Unsupported block "${type}". Its content is preserved but cannot be edited or exported until its plugin is available.`,
  dropNotAllowed: "This block cannot be placed here.",

  emailComposerLabel: "Email composer",
  emailComposerTitle: "New Message",
  emailComposerDraft: "Draft",
  emailComposerSaved: "Saved",
  emailComposerUnsavedChanges: "Unsaved changes",
  emailComposerOptions: "Composer options",
  emailComposerHideDetails: "Hide From and subject",
  emailComposerShowDetails: "Show From and subject",
  emailSenderLabel: "From",
  emailSubjectLabel: "Subject",
  emailSubjectPlaceholder: "Add a subject line",
  emailPreviewTextSeparator: "Email preview text",
  emailDefaultSenderName: "Sender",
  emailDefaultSenderEmail: "sender@example.com",
  emailDefaultSubject: "Untitled email",
  emailTemplateNameLabel: "Template name",

  inspectorTitle: "Inspector",
  documentSettingsTitle: "Document",
  inspectorNoSelection: "Select a block to edit its settings.",
  groupDocument: "Base settings",
  groupContent: "Content",
  groupStyle: "Style",
  groupSpacing: "Spacing",
  groupLink: "Link",
  groupAccessibility: "Accessibility",
  fieldLevel: "Heading level",
  fieldText: "Text",
  fieldAltText: "Alternative text",
  fieldImageUrl: "Image URL",
  fieldLabel: "Label",
  fieldDestination: "Destination",
  fieldColor: "Color",
  fieldBackgroundColor: "Background color",
  fieldTextColor: "Text color",
  fieldFontFamily: "Font family",
  fieldFontSize: "Font size (px)",
  fieldLineHeight: "Line height (%)",
  fieldLetterSpacing: "Letter spacing (px)",
  fieldFontWeight: "Weight",
  fontWeightThin: "Thin",
  fontWeightNormal: "Normal",
  fontWeightSemibold: "Semibold",
  fontWeightBold: "Bold",
  fieldAlign: "Alignment",
  alignLeft: "Left",
  alignCenter: "Center",
  alignRight: "Right",
  fieldWidth: "Width",
  fieldWidthUnit: "Width unit",
  fieldWidthPixels: "px",
  fieldWidthPercent: "%",
  fieldWidthAuto: "Auto",
  fieldLanguage: "Language",
  fieldPreviewText: "Preview text",
  fieldPreviewTextHelp:
    "The preheader shown after the subject in many inboxes. It is hidden when the email is opened.",
  fieldPageTitle: "Page title",
  fieldMetaDescription: "Meta description",
  fieldFaviconUrl: "Favicon URL",
  fieldBodyBackground: "Document background",
  fieldContentWidth: "Sections canvas max-width",
  fieldLinkColor: "Link color",
  fieldUnderlineLinks: "Underline links",
  fieldThickness: "Thickness (px)",
  fieldDividerStyle: "Line style",
  fieldHeight: "Height (px)",
  fieldBorderRadius: "Corner radius (px)",
  fieldBorder: "Border",
  fieldBorderWidth: "Border width (px)",
  fieldBorderColor: "Border color",
  fieldBorderRadiusByCorner: "Set corners individually",
  fieldBorderTopLeftRadius: "Top-left radius (px)",
  fieldBorderTopRightRadius: "Top-right radius (px)",
  fieldBorderBottomRightRadius: "Bottom-right radius (px)",
  fieldBorderBottomLeftRadius: "Bottom-left radius (px)",
  fieldShadow: "Shadow",
  fieldShadowOffsetX: "Horizontal offset (px)",
  fieldShadowOffsetY: "Vertical offset (px)",
  fieldShadowBlur: "Blur (px)",
  fieldShadowSpread: "Spread (px)",
  fieldShadowColor: "Shadow color",
  fieldSpacingTop: "Top",
  fieldSpacingRight: "Right",
  fieldSpacingBottom: "Bottom",
  fieldSpacingLeft: "Left",
  fieldPadding: "Padding",
  fieldMargin: "Margin",
  linkSpacing: "Link padding values",
  unlinkSpacing: "Unlink padding values",
  linkMargin: "Link margin values",
  unlinkMargin: "Unlink margin values",
  fieldResponsiveStack: "Stack on small screens",
  fieldColumnRatios: "Column widths (%)",
  fieldColumnCount: "Number of columns",
  fieldColumnWidth: (column) => `Column ${column} width (%)`,
  responsiveStackOn: "Stack",
  responsiveStackOff: "Keep columns",

  addSocialItem: "+ Add icon",
  removeSocialItem: (platform) => `Remove ${platform}`,
  fieldSocialPlatform: "Platform",
  fieldSocialUrl: "Link",
  socialPlatformNames: {
    facebook: "Facebook",
    instagram: "Instagram",
    x: "X",
    linkedin: "LinkedIn",
    youtube: "YouTube",
    tiktok: "TikTok",
    pinterest: "Pinterest",
    whatsapp: "WhatsApp",
    website: "Website",
    email: "Email",
  },
  fieldSocialIconStyle: "Icon style",
  socialIconStyleLogo: "Logo",
  socialIconStyleFilled: "Filled",
  socialIconStyleFilledColor: "Filled (custom color)",
  socialIconStyleNoColor: "No color (icon only)",
  fieldSocialShape: "Shape",
  socialShapeCircle: "Circle",
  socialShapeSquare: "Square",
  socialShapeRounded: "Rounded",
  fieldSocialGlyphTone: "Icon tone",
  socialGlyphToneLight: "Light",
  socialGlyphToneDark: "Dark",
  fieldSocialIconSize: "Icon size (px)",
  fieldSocialGap: "Gap (px)",

  imageSourceLabel: "Image source",
  imageSourceUpload: "Upload",
  imageSourceUrl: "URL",
  chooseImageFile: "Choose image file",
  currentImage: (filename) => `Current image: ${filename}`,
  imageDimensions: (width, height) => `${width} × ${height} px`,
  uploadInProgress: "Uploading…",
  uploadFailed: (message) => `Upload failed: ${message}`,
  retryUpload: "Retry upload",
  editCurrentImage: "Edit",
  removeCurrentImage: "Remove image",
  loadingImageForEdit: "Preparing image editor…",
  editCurrentImageFailed: (message) =>
    `This image could not be opened for editing: ${message}`,
  editImageTitle: "Edit image",
  editImageInstructions:
    "Drag the crop frame to position it. Use the corner handles to resize.",
  imageCanvasControls: "Image canvas controls",
  zoomImageIn: "Zoom in",
  zoomImageOut: "Zoom out",
  resetImageZoom: "Reset zoom",
  rotateImageLeft: "Rotate left 90°",
  rotateImage: "Rotate 90°",
  aspectRatioLabel: "Aspect ratio",
  aspectRatioNames: {
    free: "Free",
    square: "Square (1:1)",
    "landscape-4-3": "Landscape (4:3)",
    "wide-16-9": "Wide (16:9)",
  },
  cropX: "Crop X (px)",
  cropY: "Crop Y (px)",
  cropWidth: "Crop width (px)",
  cropHeight: "Crop height (px)",
  resizeWidth: "Output width (px)",
  resizeWidthHelp:
    "Downscales the cropped image. Leave empty to keep the crop size.",
  cropAreaLabel:
    "Crop area. Use arrow keys to reposition; hold Shift for larger steps.",
  cropHandleLabel: (corner) =>
    `Resize crop from the ${corner} corner. Use arrow keys for fine adjustments.`,
  originalImageLabel: "Original",
  outputImageLabel: "Output",
  imageFileSize: (currentMegabytes, limitMegabytes) =>
    `${currentMegabytes} MB / ${limitMegabytes} MB`,
  imageFileSizeOk: "OK — ready to upload",
  imageFileSizeTooLarge: "File too large — resize the image",
  imageFileSizeMeasuring: "Calculating encoded file size…",
  imageFileSizeUnavailable: "Size unavailable — it will be checked on upload",
  resetEdits: "Reset edits",
  skipEditing: "Upload original",
  applyAndUpload: "Apply and upload",
  cancelEditing: "Cancel",

  validationReviewTitle: "Validation review",
  validationNoIssues: "No validation issues.",
  validationErrorsHeading: "Errors (block export)",
  validationWarningsHeading: "Warnings",
  close: "Close",

  previewTitle: "Preview",
  previewUnavailable:
    "Preview is unavailable while blocking validation errors exist.",
  previewHtmlSource: "HTML source",
  previewJsonLayout: "JSON layout",
  previewCopySource: "Copy source",
  previewCopied: "Copied",
  previewDeviceSelector: "Preview device size",
  previewDeviceNames: {
    desktop: "Desktop",
    tablet: "Tablet",
    mobile: "Mobile",
  },
  previewViewportDimensions: (width, height) => `${width} × ${height} px`,

  openLibraryDrawer: "Open blocks and layers",
  openInspectorDrawer: "Open inspector",

  announceInserted: (blockName) => `${blockName} inserted.`,
  announceRemoved: (blockName) => `${blockName} deleted.`,
  announceDuplicated: (blockName) => `${blockName} duplicated.`,
  announceMoved: (blockName, position, total) =>
    `${blockName} moved to position ${position} of ${total}.`,
  announceUndo: "Undo applied.",
  announceRedo: "Redo applied.",
  announceCommandRejected: (message) => `Action not allowed: ${message}`,
};
