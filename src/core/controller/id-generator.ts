export type IdGenerator = () => string;

/**
 * A simple counter-scoped-per-instance generator. Deterministic by
 * construction (no randomness), which is what makes controller tests able
 * to assert exact generated IDs without injecting a fake.
 */
export function createIdGenerator(prefix = "node"): IdGenerator {
  let counter = 0;
  return () => {
    counter += 1;
    return `${prefix}-${counter}`;
  };
}

/**
 * Wraps a generator so it never hands out an ID the document already holds,
 * or one it already issued during the same command. A reopened document was
 * written by an earlier generator whose counter also started at zero, so its
 * stored IDs are exactly the ones the next session is about to produce.
 */
export function createUniqueIdGenerator(
  generateId: IdGenerator,
  takenIds: Readonly<Record<string, unknown>>,
  reservedIds: readonly string[] = [],
): IdGenerator {
  const issued = new Set<string>(reservedIds);
  return () => {
    let candidate = generateId();
    while (issued.has(candidate) || Object.hasOwn(takenIds, candidate)) {
      candidate = generateId();
    }
    issued.add(candidate);
    return candidate;
  };
}
