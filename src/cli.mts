#!/usr/bin/env node

import fs from "fs";
import { logDebug, log, logError } from "./log.mjs";
import { findPackages } from "./find-packages/index.mjs";
import { findAllInternalPackageImports } from "./find-package-imports/index.mjs";
import { getArgv } from "./argv.mjs";
import { byName } from "./utils.mjs";
import path from "path";
import { reportCycles } from "./report-cycles/index.mjs";
(async () => {
  const argv = await getArgv();

  const rootPath = argv.m;

  try {
    const packages = await findPackages(rootPath);
    log(`Found ${packages.length} package(s) in ${rootPath}`);

    reportCycles(packages);

    return;

    packages.forEach((pkg) => {
      console.log(pkg.name);
    });

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
      (packageImport) => packageImport.importKind === "default"
    );
    const namedImports = packageImports.filter(
      (packageImport) => packageImport.importKind === "named"
    );
    const namespaceImports = packageImports.filter(
      (packageImport) => packageImport.importKind === "namespace"
    );
    const sideEffectImports = packageImports.filter(
      (packageImport) => packageImport.importKind === "side-effect"
    );

    log(`defaultImports.length`, defaultImports.length);
    log(`namedImports.length`, namedImports.length);
    log(`namespaceImports.length`, namespaceImports.length);
    log(`sideEffectImports.length`, sideEffectImports.length);

    const results: {
      [name: string]: {
        type: string | null;
        count: { overall: number; dependants: { [name: string]: number } };
      };
    } = {};
    namedImports
      .filter((packageImport) => {
        // return true;
        // e.g. return packageImport.importModule.startsWith("@org/xyz");
        return (
          !packageImport.importModule.startsWith("@moonpig/web-core-") &&
          !packageImport.importModule.startsWith("@moonpig/web-shared-")
        );
      })
      .forEach((namedImport) => {
        const name = `${namedImport.importModule}:${namedImport.importName}`;
        if (!results[name]) {
          results[name] = {
            type: namedImport.importType,
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

    const reportPath = path.join(process.env.PWD || "", "report.json");
    logDebug(`Writing report to ${reportPath}...`);
    fs.writeFileSync(reportPath, JSON.stringify(sortedResults, null, 2));

    log(`Length: ${packageImports.length}`);
  } catch (e) {
    logError(e);
  }
})();
