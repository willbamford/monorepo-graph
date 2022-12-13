import { log } from "../log.mjs";
import { findCycles } from "./find-cycles.mjs";
import type { Edge } from "./find-cycles.mjs";
import { PackageWithDeps } from "../types.mjs";

export const reportCycles = (packages: PackageWithDeps[]) => {
  const edges: Edge[] = [];

  packages.forEach((p) => {
    log(p.name);

    p.deps.forEach((d) => {
      const edge: Edge = {
        source: p.name,
        target: d,
      };
      log(`  -> ${edge.target}`);
      edges.push(edge);
    });
  });

  log(`Found ${edges.length} edge(s)`);

  const cycles = findCycles(edges);

  log(`Found ${cycles.length} cycle(s)`);

  cycles.forEach((cycle) => {
    log(cycle);
  });
};
