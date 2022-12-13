import { globby } from "globby";
import path from "path";
import { logDebug } from "../log.mjs";
import { PackageNameAndDir, PackageWithDeps, Workspaces } from "../types.mjs";
import { loadPackageJson } from "../utils.mjs";

const findPackageDeps = async (
  rootPath: string,
  packageDir: string,
  allPackageNames: Set<string>
): Promise<PackageWithDeps> => {
  const packageJson = await loadPackageJson(rootPath, packageDir);

  const all = [
    ...Object.keys(packageJson.dependencies || []),
    ...Object.keys(packageJson.devDependencies || []),
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

export const findPackages = async (rootPath: string) => {
  const nameAndDirs = await findNameAndDirs(rootPath, "/");

  const names = new Set(nameAndDirs.map((nameAndDir) => nameAndDir.name));
  const dirs = nameAndDirs.map((nameAndDir) => nameAndDir.dir);

  const packages = await Promise.all(
    dirs.map((dir) => findPackageDeps(rootPath, dir, names))
  );

  return packages;
};
