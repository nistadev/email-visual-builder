import type {
  ColumnsProps,
  RichTextProps,
  VisualDocument,
} from "../../types/index.js";
import { parseRichTextValue } from "../parse/rich-text.js";
import type { BuilderRegistries } from "../registry/types.js";
import { issue } from "../result.js";
import { buildTreeIndex } from "../tree.js";
import { commandFailure, type BuilderCommand } from "./commands.js";
import {
  createUniqueIdGenerator,
  type IdGenerator,
} from "./id-generator.js";

export interface HandlerSuccess {
  ok: true;
  document: VisualDocument;
  /** `undefined` leaves selection untouched; `null` explicitly clears it. */
  selectedNodeId?: string | null;
}
export type HandlerResult = HandlerSuccess | ReturnType<typeof commandFailure>;

function handlerOk(
  document: VisualDocument,
  selectedNodeId?: string | null,
): HandlerSuccess {
  return selectedNodeId === undefined
    ? { ok: true, document }
    : { ok: true, document, selectedNodeId };
}

/**
 * Insert/remove/move/duplicate only ever touch `id`/`type`/`version`/
 * `children`/`unavailable` — `props` is opaque, untouched payload as far as
 * they're concerned. Working through `VisualBuilderNode`'s full
 * discriminated union here makes every generic spread fight the type
 * checker for no real benefit, so these tree-shape operations work through
 * this flat structural view and cast back to `VisualDocument` at the
 * boundary; `updateNodeProps`/`updateRichText` (which *do* care about the
 * specific props shape) work with the real node types directly instead.
 */
interface AnyNode {
  id: string;
  type: string;
  version: number;
  props: unknown;
  children?: string[];
  unavailable?: true;
}
type AnyNodeRecord = Record<string, AnyNode>;

function clampIndex(index: number | undefined, length: number): number {
  if (index === undefined) return length;
  return Math.max(0, Math.min(index, length));
}

/** Pre-order subtree traversal (node itself first, then each child recursively) — stable, deterministic order. */
function collectSubtreeIdsInOrder(
  nodeId: string,
  nodes: AnyNodeRecord,
): string[] {
  const result: string[] = [];
  const visit = (id: string) => {
    result.push(id);
    for (const childId of nodes[id]?.children ?? []) visit(childId);
  };
  visit(nodeId);
  return result;
}

function handleInsertNode(
  document: VisualDocument,
  registries: BuilderRegistries,
  command: Extract<BuilderCommand, { type: "insert-node" }>,
  generateId: IdGenerator,
): HandlerResult {
  const nodes = document.nodes as unknown as AnyNodeRecord;
  const parent = nodes[command.parentId];
  if (!parent) {
    return commandFailure([
      issue(
        "command/parent-not-found",
        `Parent node "${command.parentId}" does not exist.`,
      ),
    ]);
  }
  const definition = registries.blocks.get(command.blockType);
  if (!definition) {
    return commandFailure([
      issue(
        "command/unknown-block-type",
        `Block type "${command.blockType}" is not registered.`,
      ),
    ]);
  }
  if (!definition.supportedModes.includes(document.mode)) {
    return commandFailure([
      issue(
        "command/unsupported-mode",
        `Block type "${command.blockType}" does not support mode "${document.mode}".`,
      ),
    ]);
  }
  const parentDefinition = registries.blocks.get(parent.type);
  if (!parentDefinition || !parentDefinition.isContainer) {
    return commandFailure([
      issue(
        "command/invalid-parent",
        `Node "${command.parentId}" cannot contain children.`,
      ),
    ]);
  }
  if (
    parentDefinition.allowedChildTypes &&
    !parentDefinition.allowedChildTypes.includes(command.blockType)
  ) {
    return commandFailure([
      issue(
        "command/disallowed-child-type",
        `"${parent.type}" does not allow a "${command.blockType}" child.`,
      ),
    ]);
  }
  if (definition.allowedParentTypes === null) {
    return commandFailure([
      issue(
        "command/unparentable-block-type",
        `Block type "${command.blockType}" has no valid parent and cannot be inserted (it may only exist as the document root).`,
      ),
    ]);
  }
  if (
    definition.allowedParentTypes &&
    !definition.allowedParentTypes.includes(parent.type)
  ) {
    return commandFailure([
      issue(
        "command/disallowed-parent-type",
        `Block type "${command.blockType}" cannot be placed inside a "${parent.type}".`,
      ),
    ]);
  }

  const nodeId = command.nodeId ?? generateId();
  if (nodes[nodeId]) {
    return commandFailure([
      issue("command/duplicate-node-id", `Node "${nodeId}" already exists.`),
    ]);
  }

  const newNode: AnyNode = {
    id: nodeId,
    type: command.blockType,
    version: definition.version,
    props: definition.defaultProps(document.mode),
    ...(definition.isContainer ? { children: [] } : {}),
  };

  const defaultChildren = definition.defaultChildren?.(document.mode) ?? [];
  if (!definition.isContainer && defaultChildren.length > 0) {
    return commandFailure([
      issue(
        "command/invalid-default-children",
        `Block type "${command.blockType}" declares default children but is not a container.`,
      ),
    ]);
  }

  const generatedChildren: AnyNode[] = [];
  for (const child of defaultChildren) {
    const childDefinition = registries.blocks.get(child.type);
    if (!childDefinition) {
      return commandFailure([
        issue(
          "command/unknown-default-child-type",
          `Block type "${command.blockType}" declares an unregistered default child "${child.type}".`,
        ),
      ]);
    }
    if (
      !childDefinition.supportedModes.includes(document.mode) ||
      (definition.allowedChildTypes &&
        !definition.allowedChildTypes.includes(child.type)) ||
      (childDefinition.allowedParentTypes &&
        !childDefinition.allowedParentTypes.includes(command.blockType))
    ) {
      return commandFailure([
        issue(
          "command/invalid-default-child",
          `Default child "${child.type}" cannot be placed inside "${command.blockType}".`,
        ),
      ]);
    }

    const childId = generateId();
    generatedChildren.push({
      id: childId,
      type: child.type,
      version: childDefinition.version,
      props: childDefinition.defaultProps(document.mode),
      ...(childDefinition.isContainer ? { children: [] } : {}),
    });
  }

  if (generatedChildren.length > 0) {
    newNode.children = generatedChildren.map((child) => child.id);
  }

  const existingChildren = parent.children ?? [];
  const index = clampIndex(command.index, existingChildren.length);
  const nextChildren = [
    ...existingChildren.slice(0, index),
    nodeId,
    ...existingChildren.slice(index),
  ];

  const nextNodes: AnyNodeRecord = {
    ...nodes,
    [command.parentId]: { ...parent, children: nextChildren },
    [nodeId]: newNode,
  };
  for (const child of generatedChildren) nextNodes[child.id] = child;

  return handlerOk(
    { ...document, nodes: nextNodes } as unknown as VisualDocument,
    nodeId,
  );
}

function handleRemoveNode(
  document: VisualDocument,
  command: Extract<BuilderCommand, { type: "remove-node" }>,
): HandlerResult {
  if (command.nodeId === document.rootId) {
    return commandFailure([
      issue(
        "command/cannot-remove-root",
        "The document root cannot be removed.",
      ),
    ]);
  }
  const nodes = document.nodes as unknown as AnyNodeRecord;
  if (!nodes[command.nodeId]) {
    return commandFailure([
      issue(
        "command/node-not-found",
        `Node "${command.nodeId}" does not exist.`,
      ),
    ]);
  }
  if (nodes[command.nodeId]?.type === "column") {
    return commandFailure([
      issue(
        "command/cannot-remove-column",
        "Columns are managed by the parent Columns block and cannot be deleted individually.",
      ),
    ]);
  }

  const treeResult = buildTreeIndex(document.rootId, document.nodes);
  if (!treeResult.ok) return commandFailure(treeResult.issues);
  const parentId = treeResult.value.parentOf[command.nodeId];
  if (!parentId) {
    return commandFailure([
      issue(
        "command/node-not-reachable",
        `Node "${command.nodeId}" is not reachable from root.`,
      ),
    ]);
  }

  const subtreeIds = collectSubtreeIdsInOrder(command.nodeId, nodes);
  const nextNodes: AnyNodeRecord = { ...nodes };
  for (const id of subtreeIds) delete nextNodes[id];

  const parent = nextNodes[parentId];
  if (!parent) {
    return commandFailure([
      issue(
        "command/internal-remove-error",
        `Parent node "${parentId}" vanished mid-removal.`,
      ),
    ]);
  }
  nextNodes[parentId] = {
    ...parent,
    children: (parent.children ?? []).filter((id) => id !== command.nodeId),
  };

  return handlerOk({
    ...document,
    nodes: nextNodes,
  } as unknown as VisualDocument);
}

function handleMoveNode(
  document: VisualDocument,
  registries: BuilderRegistries,
  command: Extract<BuilderCommand, { type: "move-node" }>,
): HandlerResult {
  if (command.nodeId === document.rootId) {
    return commandFailure([
      issue("command/cannot-move-root", "The document root cannot be moved."),
    ]);
  }
  const nodes = document.nodes as unknown as AnyNodeRecord;
  const node = nodes[command.nodeId];
  if (!node) {
    return commandFailure([
      issue(
        "command/node-not-found",
        `Node "${command.nodeId}" does not exist.`,
      ),
    ]);
  }
  if (node.unavailable) {
    return commandFailure([
      issue(
        "command/cannot-move-unavailable-node",
        `Node "${command.nodeId}" belongs to an unavailable plugin and cannot be moved.`,
      ),
    ]);
  }
  const newParent = nodes[command.newParentId];
  if (!newParent) {
    return commandFailure([
      issue(
        "command/parent-not-found",
        `Parent node "${command.newParentId}" does not exist.`,
      ),
    ]);
  }

  const treeResult = buildTreeIndex(document.rootId, document.nodes);
  if (!treeResult.ok) return commandFailure(treeResult.issues);
  const oldParentId = treeResult.value.parentOf[command.nodeId];
  if (!oldParentId) {
    return commandFailure([
      issue(
        "command/node-not-reachable",
        `Node "${command.nodeId}" is not reachable from root.`,
      ),
    ]);
  }
  if (node.type === "column" && command.newParentId !== oldParentId) {
    return commandFailure([
      issue(
        "command/cannot-reparent-column",
        "A column can only be reordered inside its current Columns block.",
      ),
    ]);
  }

  const subtreeIds = new Set(collectSubtreeIdsInOrder(command.nodeId, nodes));
  if (subtreeIds.has(command.newParentId)) {
    return commandFailure([
      issue(
        "command/cycle",
        `Cannot move node "${command.nodeId}" into its own subtree.`,
      ),
    ]);
  }

  const parentDefinition = registries.blocks.get(newParent.type);
  const nodeDefinition = registries.blocks.get(node.type);
  if (!parentDefinition || !parentDefinition.isContainer) {
    return commandFailure([
      issue(
        "command/invalid-parent",
        `Node "${command.newParentId}" cannot contain children.`,
      ),
    ]);
  }
  if (
    parentDefinition.allowedChildTypes &&
    !parentDefinition.allowedChildTypes.includes(node.type)
  ) {
    return commandFailure([
      issue(
        "command/disallowed-child-type",
        `"${newParent.type}" does not allow a "${node.type}" child.`,
      ),
    ]);
  }
  if (nodeDefinition?.allowedParentTypes === null) {
    return commandFailure([
      issue(
        "command/unparentable-block-type",
        `Block type "${node.type}" has no valid parent and cannot be moved (it may only exist as the document root).`,
      ),
    ]);
  }
  if (
    nodeDefinition?.allowedParentTypes &&
    !nodeDefinition.allowedParentTypes.includes(newParent.type)
  ) {
    return commandFailure([
      issue(
        "command/disallowed-parent-type",
        `Block type "${node.type}" cannot be placed inside a "${newParent.type}".`,
      ),
    ]);
  }

  const nextNodes: AnyNodeRecord = { ...nodes };
  const oldParent = nextNodes[oldParentId];
  if (!oldParent) {
    return commandFailure([
      issue(
        "command/internal-move-error",
        `Parent node "${oldParentId}" vanished mid-move.`,
      ),
    ]);
  }
  nextNodes[oldParentId] = {
    ...oldParent,
    children: (oldParent.children ?? []).filter((id) => id !== command.nodeId),
  };

  const destinationParent = nextNodes[command.newParentId] ?? newParent;
  const destinationChildren = destinationParent.children ?? [];
  const index = clampIndex(command.index, destinationChildren.length);
  const nextChildren = [
    ...destinationChildren.slice(0, index),
    command.nodeId,
    ...destinationChildren.slice(index),
  ];
  nextNodes[command.newParentId] = {
    ...destinationParent,
    children: nextChildren,
  };

  return handlerOk({
    ...document,
    nodes: nextNodes,
  } as unknown as VisualDocument);
}

function handleDuplicateNode(
  document: VisualDocument,
  command: Extract<BuilderCommand, { type: "duplicate-node" }>,
  generateId: IdGenerator,
): HandlerResult {
  if (command.nodeId === document.rootId) {
    return commandFailure([
      issue(
        "command/cannot-duplicate-root",
        "The document root cannot be duplicated.",
      ),
    ]);
  }
  const nodes = document.nodes as unknown as AnyNodeRecord;
  const sourceNode = nodes[command.nodeId];
  if (!sourceNode) {
    return commandFailure([
      issue(
        "command/node-not-found",
        `Node "${command.nodeId}" does not exist.`,
      ),
    ]);
  }
  if (sourceNode.type === "column") {
    return commandFailure([
      issue(
        "command/cannot-duplicate-column",
        "Columns are managed by the parent Columns block and cannot be duplicated individually.",
      ),
    ]);
  }

  const treeResult = buildTreeIndex(document.rootId, document.nodes);
  if (!treeResult.ok) return commandFailure(treeResult.issues);
  const parentId = treeResult.value.parentOf[command.nodeId];
  if (!parentId) {
    return commandFailure([
      issue(
        "command/node-not-reachable",
        `Node "${command.nodeId}" is not reachable from root.`,
      ),
    ]);
  }
  const parent = nodes[parentId];
  if (!parent) {
    return commandFailure([
      issue(
        "command/internal-duplicate-error",
        `Parent node "${parentId}" vanished mid-duplicate.`,
      ),
    ]);
  }

  const subtreeIds = collectSubtreeIdsInOrder(command.nodeId, nodes);
  const idMap = new Map<string, string>();
  for (const id of subtreeIds) idMap.set(id, generateId());

  const nextNodes: AnyNodeRecord = { ...nodes };
  for (const oldId of subtreeIds) {
    const original = nodes[oldId];
    const newId = idMap.get(oldId);
    if (!original || !newId) continue;
    nextNodes[newId] = {
      ...original,
      id: newId,
      ...(original.children
        ? {
            children: original.children.map(
              (childId) => idMap.get(childId) ?? childId,
            ),
          }
        : {}),
    };
  }

  const newRootId = idMap.get(command.nodeId);
  if (!newRootId) {
    return commandFailure([
      issue(
        "command/internal-duplicate-error",
        "Failed to generate a duplicate node ID.",
      ),
    ]);
  }

  const parentChildren = parent.children ?? [];
  const originalIndex = parentChildren.indexOf(command.nodeId);
  const insertIndex =
    originalIndex === -1 ? parentChildren.length : originalIndex + 1;
  const nextParentChildren = [
    ...parentChildren.slice(0, insertIndex),
    newRootId,
    ...parentChildren.slice(insertIndex),
  ];
  nextNodes[parentId] = { ...parent, children: nextParentChildren };

  return handlerOk(
    { ...document, nodes: nextNodes } as unknown as VisualDocument,
    newRootId,
  );
}

function handleUpdateNodeProps(
  document: VisualDocument,
  registries: BuilderRegistries,
  command: Extract<BuilderCommand, { type: "update-node-props" }>,
): HandlerResult {
  const node = document.nodes[command.nodeId];
  if (!node) {
    return commandFailure([
      issue(
        "command/node-not-found",
        `Node "${command.nodeId}" does not exist.`,
      ),
    ]);
  }
  if ("unavailable" in node && node.unavailable) {
    return commandFailure([
      issue(
        "command/cannot-edit-unavailable-node",
        `Node "${command.nodeId}" belongs to an unavailable plugin and cannot be edited.`,
      ),
    ]);
  }
  const definition = registries.blocks.get(node.type);
  if (!definition) {
    return commandFailure([
      issue(
        "command/unknown-block-type",
        `Block type "${node.type}" is not registered.`,
      ),
    ]);
  }
  const propsResult = definition.parseProps(
    command.props,
    `nodes.${command.nodeId}.props`,
  );
  if (!propsResult.ok) return commandFailure(propsResult.issues);

  const nextNodes = {
    ...document.nodes,
    [command.nodeId]: { ...node, props: propsResult.value },
  };
  return handlerOk({
    ...document,
    nodes: nextNodes,
  } as unknown as VisualDocument);
}

function handleUpdateRichText(
  document: VisualDocument,
  command: Extract<BuilderCommand, { type: "update-rich-text" }>,
): HandlerResult {
  const node = document.nodes[command.nodeId];
  if (!node) {
    return commandFailure([
      issue(
        "command/node-not-found",
        `Node "${command.nodeId}" does not exist.`,
      ),
    ]);
  }
  if ("unavailable" in node && node.unavailable) {
    return commandFailure([
      issue(
        "command/cannot-edit-unavailable-node",
        `Node "${command.nodeId}" belongs to an unavailable plugin and cannot be edited.`,
      ),
    ]);
  }
  if (node.type !== "rich-text") {
    return commandFailure([
      issue(
        "command/not-a-rich-text-node",
        `Node "${command.nodeId}" is not a rich-text block.`,
      ),
    ]);
  }
  const valueResult = parseRichTextValue(
    command.value,
    `nodes.${command.nodeId}.props.value`,
  );
  if (!valueResult.ok) return commandFailure(valueResult.issues);

  const currentProps = node.props as RichTextProps;
  const nextNodes = {
    ...document.nodes,
    [command.nodeId]: {
      ...node,
      props: { ...currentProps, value: valueResult.value },
    },
  };
  return handlerOk({
    ...document,
    nodes: nextNodes,
  } as unknown as VisualDocument);
}

function handleUpdateDocumentSettings(
  document: VisualDocument,
  registries: BuilderRegistries,
  command: Extract<BuilderCommand, { type: "update-document-settings" }>,
): HandlerResult {
  const modeDefinition = registries.modes.get(document.mode);
  if (!modeDefinition) {
    return commandFailure([
      issue(
        "command/unregistered-mode",
        `Mode "${document.mode}" is not registered.`,
      ),
    ]);
  }
  const settingsResult = modeDefinition.parseSettings(
    command.settings,
    "settings",
  );
  if (!settingsResult.ok) return commandFailure(settingsResult.issues);

  return handlerOk({
    ...document,
    settings: settingsResult.value,
  } as unknown as VisualDocument);
}

function handleUpdateColumns(
  document: VisualDocument,
  registries: BuilderRegistries,
  command: Extract<BuilderCommand, { type: "update-columns" }>,
  generateId: IdGenerator,
): HandlerResult {
  const nodes = document.nodes as unknown as AnyNodeRecord;
  const columnsNode = nodes[command.nodeId];
  if (!columnsNode) {
    return commandFailure([
      issue(
        "command/node-not-found",
        `Node "${command.nodeId}" does not exist.`,
      ),
    ]);
  }
  if (columnsNode.type !== "columns" || columnsNode.unavailable) {
    return commandFailure([
      issue(
        "command/not-a-columns-node",
        `Node "${command.nodeId}" is not an editable columns block.`,
      ),
    ]);
  }

  const columnsDefinition = registries.blocks.get("columns");
  const columnDefinition = registries.blocks.get("column");
  if (
    !columnsDefinition ||
    !columnDefinition ||
    !columnDefinition.isContainer
  ) {
    return commandFailure([
      issue(
        "command/columns-registry-unavailable",
        "The columns layout definitions are not available.",
      ),
    ]);
  }

  const propsResult = columnsDefinition.parseProps(
    {
      ...(columnsNode.props as Record<string, unknown>),
      columnWidthRatios: command.columnWidthRatios,
    },
    `nodes.${command.nodeId}.props`,
  );
  if (!propsResult.ok) return commandFailure(propsResult.issues);

  const nextProps = propsResult.value as ColumnsProps;
  const targetCount = nextProps.columnWidthRatios.length;
  const nextNodes: AnyNodeRecord = { ...nodes };
  const nextChildren = [...(columnsNode.children ?? [])];

  while (nextChildren.length < targetCount) {
    const columnId = generateId();
    nextNodes[columnId] = {
      id: columnId,
      type: "column",
      version: columnDefinition.version,
      props: columnDefinition.defaultProps(document.mode),
      children: [],
    };
    nextChildren.push(columnId);
  }

  if (nextChildren.length > targetCount) {
    const destinationColumnId = nextChildren[targetCount - 1];
    const destinationColumn = destinationColumnId
      ? nextNodes[destinationColumnId]
      : undefined;
    if (
      !destinationColumnId ||
      !destinationColumn ||
      destinationColumn.type !== "column"
    ) {
      return commandFailure([
        issue(
          "command/invalid-columns-children",
          `Columns node "${command.nodeId}" does not contain valid column children.`,
        ),
      ]);
    }

    const movedContentIds: string[] = [];
    for (const removedColumnId of nextChildren.slice(targetCount)) {
      const removedColumn = nextNodes[removedColumnId];
      if (!removedColumn || removedColumn.type !== "column") {
        return commandFailure([
          issue(
            "command/invalid-columns-children",
            `Columns node "${command.nodeId}" does not contain valid column children.`,
          ),
        ]);
      }
      movedContentIds.push(...(removedColumn.children ?? []));
      delete nextNodes[removedColumnId];
    }
    nextNodes[destinationColumnId] = {
      ...destinationColumn,
      children: [...(destinationColumn.children ?? []), ...movedContentIds],
    };
    nextChildren.splice(targetCount);
  }

  nextNodes[command.nodeId] = {
    ...columnsNode,
    props: nextProps,
    children: nextChildren,
  };
  return handlerOk({
    ...document,
    nodes: nextNodes,
  } as unknown as VisualDocument);
}

export function executeCommand(
  document: VisualDocument,
  registries: BuilderRegistries,
  command: BuilderCommand,
  rawGenerateId: IdGenerator,
): HandlerResult {
  // Every generated ID is unique against the document as loaded, so no command
  // can collide with IDs a previous editing session already wrote.
  const generateId = createUniqueIdGenerator(
    rawGenerateId,
    document.nodes,
    command.type === "insert-node" && command.nodeId ? [command.nodeId] : [],
  );
  switch (command.type) {
    case "insert-node":
      return handleInsertNode(document, registries, command, generateId);
    case "remove-node":
      return handleRemoveNode(document, command);
    case "move-node":
      return handleMoveNode(document, registries, command);
    case "duplicate-node":
      return handleDuplicateNode(document, command, generateId);
    case "update-node-props":
      return handleUpdateNodeProps(document, registries, command);
    case "update-rich-text":
      return handleUpdateRichText(document, command);
    case "update-document-settings":
      return handleUpdateDocumentSettings(document, registries, command);
    case "update-columns":
      return handleUpdateColumns(document, registries, command, generateId);
    default: {
      const exhaustiveCheck: never = command;
      return commandFailure([
        issue(
          "command/unknown-command-type",
          `Unknown command: ${JSON.stringify(exhaustiveCheck)}`,
        ),
      ]);
    }
  }
}
