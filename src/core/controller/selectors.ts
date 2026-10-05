import type { VisualBuilderNode, VisualDocument } from "../../types/index.js";
import type { BuilderController } from "./controller.js";
import type { BuilderState, EditorTransientState } from "./state-types.js";

export function selectDocument(state: BuilderState): VisualDocument {
  return state.document;
}

export function selectNode(
  state: BuilderState,
  nodeId: string,
): VisualBuilderNode | undefined {
  return state.document.nodes[nodeId];
}

export function selectTransient(state: BuilderState): EditorTransientState {
  return state.transient;
}

export function selectSelectedNodeId(state: BuilderState): string | null {
  return state.transient.selectedNodeId;
}

export function selectSelectedNode(
  state: BuilderState,
): VisualBuilderNode | undefined {
  const { selectedNodeId } = state.transient;
  return selectedNodeId ? state.document.nodes[selectedNodeId] : undefined;
}

/**
 * Subscribes to a derived slice of controller state, only invoking
 * `onChange` when that slice actually changes under `isEqual` (default
 * `Object.is`). Command handlers perform minimal-diff immutable updates —
 * untouched nodes keep their exact object reference across a dispatch — so
 * a node-scoped selector here only fires for edits to that node, not for
 * every unrelated canvas subscriber (design.md decision #5/#13).
 */
export function subscribeWithSelector<T>(
  controller: BuilderController,
  selector: (state: BuilderState) => T,
  onChange: (value: T, previous: T) => void,
  isEqual: (a: T, b: T) => boolean = Object.is,
): () => void {
  let currentValue = selector(controller.getState());
  return controller.subscribe(() => {
    const nextValue = selector(controller.getState());
    if (!isEqual(currentValue, nextValue)) {
      const previous = currentValue;
      currentValue = nextValue;
      onChange(nextValue, previous);
    }
  });
}
