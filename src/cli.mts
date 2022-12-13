#!/usr/bin/env node

import { logDebug, log, logError } from "./log.mjs";
import { findPackages } from "./find-packages/index.mjs";
import { findAllInternalPackageImports } from "./find-package-imports/index.mjs";
import { getArgv } from "./argv.mjs";
import { byName } from "./utils.mjs";
(async () => {
  const argv = await getArgv();

  const rootPath = argv.m;

  try {
    const packages = await findPackages(rootPath);
    log(`Found ${packages.length} package(s) in ${rootPath}`);

    const packageByName = byName(packages);

    const cacheWrite = true;
    const cacheRead = true;

    const packageImports = await findAllInternalPackageImports(
      rootPath,
      packageByName,
      cacheWrite,
      cacheRead
    );

    const defaultImports = packageImports.filter(
      (packageImport) => packageImport.importType === "default"
    );
    const namedImports = packageImports.filter(
      (packageImport) => packageImport.importType === "named"
    );
    const namespaceImports = packageImports.filter(
      (packageImport) => packageImport.importType === "namespace"
    );
    const sideEffectImports = packageImports.filter(
      (packageImport) => packageImport.importType === "side-effect"
    );

    log(`defaultImports.length`, defaultImports.length);
    log(`namedImports.length`, namedImports.length);
    log(`namespaceImports.length`, namespaceImports.length);
    log(`sideEffectImports.length`, sideEffectImports.length);

    log(`Length: ${packageImports.length}`);

    // reportCycles(packages);
  } catch (e) {
    logError(e);
  }
})();
