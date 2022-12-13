#!/usr/bin/env node

import fs from "fs";
import { logDebug, log, logError } from "./log.mjs";
import { findPackages } from "./find-packages/index.mjs";
import { findAllInternalPackageImports } from "./find-package-imports/index.mjs";
import { getArgv } from "./argv.mjs";
import { byName } from "./utils.mjs";
import path from "path";
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

    // log(`defaultImports.length`, defaultImports.length);
    // log(`namedImports.length`, namedImports.length);
    // log(`namespaceImports.length`, namespaceImports.length);
    // log(`sideEffectImports.length`, sideEffectImports.length);

    const results: {
      [name: string]: {
        count: { overall: number; dependants: { [name: string]: number } };
      };
    } = {};
    namedImports
      .filter((packageImport) => {
        return true;
        // return packageImport.importModule.startsWith("...");
      })
      .forEach((namedImport) => {
        const name = `${namedImport.importModule}:${namedImport.importName}`;
        if (!results[name]) {
          results[name] = {
            count: {
              overall: 0,
              dependants: {},
            },
          };
        }
        results[name].count.overall += 1;

        if (!results[name].count.dependants[namedImport.packageName]) {
          results[name].count.dependants[namedImport.packageName] = 0;
        }
        results[name].count.dependants[namedImport.packageName] += 1;
      });

    const sortedResults = Object.entries(results).sort((a, b) => {
      if (a[1].count.overall > b[1].count.overall) return -1;
      else if (a[1].count.overall < b[1].count.overall) return 1;
      return 0;
    });

    sortedResults.forEach((result) => {
      const name = result[0];
      const value = result[1];
      log(name, value.count.overall, value.count.dependants);
    });

    const resultsPath = path.join(process.env.PWD || "", "results.json");
    logDebug(`Writing results to ${resultsPath}...`);
    fs.writeFileSync(resultsPath, JSON.stringify(sortedResults, null, 2));

    log(`Length: ${packageImports.length}`);

    // reportCycles(packages);
  } catch (e) {
    logError(e);
  }
})();
