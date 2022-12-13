#!/usr/bin/env node

import { logDebug, log, logError } from "./log.mjs";
import { findPackages } from "./find-packages/index.mjs";
import { findPackageImports } from "./find-package-imports/index.mjs";
import { getArgv } from "./argv.mjs";
import path, { resolve } from "path";
import { byName } from "./utils.mjs";
import { PackageImports, PackageWithDeps } from "./types.mjs";

const findAllInternalPackageImports = async (
  rootPath: string,
  packageByName: {
    [id: string]: PackageWithDeps;
  }
): Promise<PackageImports[]> => {
  const all = (
    await Promise.all(
      Object.keys(packageByName).map((name) => {
        const p = packageByName[name];
        return findPackageImports(rootPath, packageByName[name].dir);
      })
    )
  ).flat();

  const allInternal = all.filter((packageImport) => {
    if (packageByName[packageImport.importModule] !== undefined) {
      return true;
    }
    return false;
  });

  return allInternal;
};

(async () => {
  const argv = await getArgv();

  const rootPath = argv.m;

  try {
    const packages = await findPackages(rootPath);
    log(`Found ${packages.length} package(s) in ${rootPath}`);

    const packageByName = byName(packages);

    const packageImports = await findAllInternalPackageImports(
      rootPath,
      packageByName
    );

    // packageImports.forEach((packageImport) => {
    //   log(packageImport);
    // });

    log(`Length: ${packageImports.length}`);

    // reportCycles(packages);
  } catch (e) {
    logError(e);
  }
})();
