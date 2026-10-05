import type {
  VisualBuilderNode,
  VisualBuilderNodeRecord,
} from "../../types/index.js";
import { VISUAL_DOCUMENT_LIMITS } from "../limits.js";
import type { BlockRegistry } from "../registry/types.js";
import {
  isPlainObject,
  parseArray,
  parsePositiveInteger,
  parseString,
} from "../primitives.js";
import { FieldCollector, err, issue, ok, type ParseResult } from "../result.js";

function parseChildren(
  value: unknown,
  path: string,
): ParseResult<string[] | undefined> {
  if (value === undefined) return ok(undefined);
  const raw = parseArray(value, path);
  if (!raw.ok) return raw;
  if (raw.value.length > VISUAL_DOCUMENT_LIMITS.maxChildrenPerNode) {
    return err([
      issue(
        "document/too-many-children",
        `Node at "${path}" exceeds the maximum children count.`,
        { path },
      ),
    ]);
  }
  const children: string[] = [];
  const issues = [];
  for (let index = 0; index < raw.value.length; index += 1) {
    const result = parseString(raw.value[index], `${path}[${index}]`, {
      allowEmpty: false,
      maxLength: 200,
    });
    if (!result.ok) {
      issues.push(...result.issues);
      continue;
    }
    children.push(result.value);
  }
  if (issues.length > 0) return err(issues);
  return ok(children);
}

function parseSingleNode(
  nodeId: string,
  raw: unknown,
  path: string,
  blockRegistry: BlockRegistry,
): ParseResult<VisualBuilderNode> {
  if (!isPlainObject(raw)) {
    return err([
      issue("value/not-an-object", `Expected a node object at "${path}".`, {
        path,
      }),
    ]);
  }

  const collector = new FieldCollector();
  const id = collector.field(
    parseString(raw.id, `${path}.id`, { allowEmpty: false, maxLength: 200 }),
    nodeId,
  );
  if (id !== nodeId) {
    collector.push(
      issue(
        "document/node-id-mismatch",
        `Node key "${nodeId}" does not match its own "id" field.`,
        { path },
      ),
    );
  }
  const type = collector.field(
    parseString(raw.type, `${path}.type`, {
      allowEmpty: false,
      maxLength: 100,
    }),
    "",
  );
  const version = collector.field(
    parsePositiveInteger(raw.version, `${path}.version`),
    1,
  );
  const children = collector.field(
    parseChildren(raw.children, `${path}.children`),
    undefined,
  );

  const preliminaryIssues = collector.finish(undefined);
  if (!preliminaryIssues.ok) return preliminaryIssues;

  const definition = blockRegistry.get(type);
  if (definition) {
    if (version !== definition.version) {
      return err([
        issue(
          "document/unsupported-block-version",
          `Node type "${type}" at "${path}" declares version ${version}; the current version is ${definition.version}.`,
          { path },
        ),
      ]);
    }
    const propsResult = definition.parseProps(raw.props, `${path}.props`);
    if (!propsResult.ok) return propsResult;
    return ok({
      id: nodeId,
      type,
      version,
      props: propsResult.value,
      children,
    } as VisualBuilderNode);
  }

  // Unknown block type: preserve the raw node rather than discarding it
  // (design.md decision #4). `props` is stored as-is once we confirm it is
  // at least a plain object, so a restored document round-trips losslessly.
  const rawProps = isPlainObject(raw.props) ? raw.props : {};
  return ok({
    id: nodeId,
    type,
    version,
    props: rawProps,
    children,
    unavailable: true,
  });
}

export function parseNodeMap(
  value: unknown,
  path: string,
  blockRegistry: BlockRegistry,
): ParseResult<VisualBuilderNodeRecord> {
  if (!isPlainObject(value)) {
    return err([
      issue("value/not-an-object", `Expected a nodes record at "${path}".`, {
        path,
      }),
    ]);
  }
  const entries = Object.entries(value);
  if (entries.length === 0) {
    return err([
      issue(
        "document/empty-node-map",
        `"${path}" must contain at least a root node.`,
        { path },
      ),
    ]);
  }
  if (entries.length > VISUAL_DOCUMENT_LIMITS.maxNodeCount) {
    return err([
      issue(
        "document/too-many-nodes",
        `"${path}" exceeds the maximum node count.`,
        { path },
      ),
    ]);
  }

  const nodes: VisualBuilderNodeRecord = {};
  const issues = [];
  for (const [nodeId, rawNode] of entries) {
    const result = parseSingleNode(
      nodeId,
      rawNode,
      `${path}.${nodeId}`,
      blockRegistry,
    );
    if (!result.ok) {
      issues.push(...result.issues);
      continue;
    }
    nodes[nodeId] = result.value;
  }
  if (issues.length > 0) return err(issues);
  return ok(nodes);
}
