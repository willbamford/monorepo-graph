#!/usr/bin/env node

import yargs from "yargs/yargs";
import fs from "fs";
import path from "path";
import { globby } from "globby";

const log = (...args: Parameters<typeof console.log>) => {
  console.log(...args);
};

const logDebug = (...args: Parameters<typeof console.debug>) => {
  // console.debug(...args);
};

const logError = (...args: Parameters<typeof console.error>) => {
  console.error(...args);
};

const parser = yargs(process.argv.slice(2))
  .options({
    m: {
      type: "string",
      demandOption: true,
      describe: "Monorepo root",
      normalize: true,
    },
    p: {
      type: "string",
      demandOption: true,
      describe: "Package name",
      normalize: true,
    },
  })
  .scriptName("mgraph ")
  .example([["$0 -m /code/foo -p @foo/bar"]])
  .usage("Usage: $0 -m <monorepo_path> -p <package_name>");

type Workspaces = string[] | { packages: string[] };

type PackageNameAndDir = {
  name: string;
  dir: string;
};

type PackageWithDeps = {
  name: string;
  dir: string;
  deps: Set<string>;
};

const loadPackageJson = async (rootPath: string, packageDir: string) => {
  return JSON.parse(
    await fs.promises.readFile(
      path.join(rootPath, packageDir, "package.json"),
      "utf-8"
    )
  );
};

const findChildNameAndDirs = async (
  rootPath: string,
  dir: string,
  workspacesJson: Workspaces
): Promise<PackageNameAndDir[]> => {
  const workspaces =
    "packages" in workspacesJson ? workspacesJson.packages : workspacesJson;

  const packageJsonGlobs = workspaces.map((entry) =>
    path.join(rootPath, dir, entry, "package.json")
  );

  const paths = await globby(packageJsonGlobs);

  const getNameAndDir = async (p: string): Promise<PackageNameAndDir> => {
    const dir = p
      .substring(0, p.lastIndexOf("package.json"))
      .substring(rootPath.length)
      .slice(0, -1);

    const packageJson = await loadPackageJson(rootPath, dir);

    return {
      name: packageJson.name,
      dir,
    };
  };

  const result = await Promise.all(paths.map(getNameAndDir));

  return result;
};

const findNameAndDirs = async (
  rootPath: string,
  packageDir: string
): Promise<PackageNameAndDir[]> => {
  const packageJson = await loadPackageJson(rootPath, packageDir);

  if (!packageJson.workspaces) {
    return [{ name: packageJson.name, dir: packageDir }];
  }

  const childNameAndDirs = await findChildNameAndDirs(
    rootPath,
    packageDir,
    packageJson.workspaces
  );

  const result = (
    await Promise.all(
      childNameAndDirs.map((childNameAndDir) =>
        findNameAndDirs(rootPath, childNameAndDir.dir)
      )
    )
  ).flat();

  return result;
};

const getPackageDeps = async (
  rootPath: string,
  packageDir: string,
  allPackageNames: Set<string>
): Promise<PackageWithDeps> => {
  const packageJson = await loadPackageJson(rootPath, packageDir);

  const all = [
    ...Object.keys(packageJson.dependencies || []),
    ...Object.keys(packageJson.devDependencies || []),
    ...Object.keys(packageJson.peerDependencies || []),
    ...Object.keys(packageJson.optionalDependencies || []),
  ];

  const internalDeps = new Set(all.filter((dep) => allPackageNames.has(dep)));

  logDebug(
    `${packageJson.name} has ${internalDeps.size} internal ${
      internalDeps.size === 1 ? "dependency" : "dependencies"
    }`
  );
  logDebug(internalDeps);

  return {
    name: packageJson.name,
    dir: packageDir,
    deps: internalDeps,
  };
};

const byName = <T extends { name: string }>(
  v: T[]
): {
  [id: string]: T;
} => {
  return v.reduce<{
    [name: string]: T;
  }>((acc, curr) => {
    acc[curr.name] = curr;
    return acc;
  }, {});
};

(async () => {
  const argv = await parser.argv;

  const rootPath = argv.m;
  const packageName = argv.p;

  try {
    const nameAndDirs = await findNameAndDirs(rootPath, "/");

    const names = new Set(nameAndDirs.map((nameAndDir) => nameAndDir.name));
    const dirs = nameAndDirs.map((nameAndDir) => nameAndDir.dir);

    const packages = await Promise.all(
      dirs.map((dir) => getPackageDeps(rootPath, dir, names))
    );

    log(`Found ${packages.length} package(s) in ${rootPath}`);

    const packagesByName = byName(packages);
    const rootPackage = packagesByName[packageName];

    if (!rootPackage) {
      throw new Error(
        `Could not find package with name "${packageName}" in ${rootPath}`
      );
    }

    logDebug(
      `Checking ${JSON.stringify(
        rootPackage,
        (_key, value) => (value instanceof Set ? [...value] : value),
        2
      )}`
    );
  } catch (e) {
    logError(e);
  }
})();
