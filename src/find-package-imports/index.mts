import fs from "fs";
import path from "path";

import { loadPackageJson } from "../utils.mjs";
import { Project, SyntaxKind } from "ts-morph";
import { logDebug, log, logError } from "../log.mjs";
import { PackageImports, PackageWithDeps } from "../types.mjs";

export const findPackageImports = async (
  rootPath: string,
  packageDir: string,
  cacheWrite: boolean,
  cacheRead: boolean
): Promise<PackageImports[]> => {
  const cacheDir = path.join(process.env.PWD || "", "cache", packageDir);

  if (cacheRead) {
    const cachePath = path.join(cacheDir, "cache.json");
    if (fs.existsSync(cachePath)) {
      log(`Reading cache for ${packageDir}`);
      const result: PackageImports[] = JSON.parse(
        fs.readFileSync(cachePath, { encoding: "utf-8" })
      );
      return result;
    } else {
      logDebug(`No cache for ${packageDir}`);
    }
  }

  const packageJson = await loadPackageJson(rootPath, packageDir);
  const packageName = packageJson.name;

  const packagePath = path.join(rootPath, packageDir);
  const tsConfigFilePath = path.join(packagePath, "tsconfig.json");
  if (!fs.existsSync(tsConfigFilePath)) {
    logDebug(
      `${packageName} does not appear to be a TypeScript module (no root tsconfig.json found)`
    );
    return [];
  }
  log(`Processing ${packageName} (found tsconfig.json)`);

  const packageImports: PackageImports[] = [];

  const project = new Project({
    tsConfigFilePath,
  });

  const sourceFiles = project.getSourceFiles();
  for (const sourceFile of sourceFiles) {
    const sourceFilePath = sourceFile.getFilePath();
    if (!sourceFilePath.startsWith(packagePath)) {
      logDebug(`Ignoring ${sourceFilePath}, not in ${packagePath}`);
      continue;
    }

    const importDeclarations = sourceFile.getImportDeclarations();
    importDeclarations.forEach((importDeclaration) => {
      const importClause = importDeclaration.getImportClause();

      const importNode = importDeclaration.getLastChildByKind(
        SyntaxKind.StringLiteral
      );

      const importModule = (importNode?.getText() || "'<unknown>'").slice(
        1,
        -1
      );

      const namedImports = importClause?.getNamedImports();
      const namespaceImport = importClause?.getNamespaceImport();
      const defaultImport = importClause?.getDefaultImport();

      if (namespaceImport) {
        packageImports.push({
          packageName,
          sourceFile: sourceFilePath,
          importModule,
          importKind: "namespace",
          importName: namespaceImport.getText(),
          importType: namespaceImport.getType().getApparentType().getText(),
        });
      }

      if (namedImports) {
        namedImports.map((namedImport) => {
          const importName = namedImport.getText();

          // Handle alias 'foo as bar'
          const parts = importName.split(/(?:\s+)as(?:\s+)/);

          packageImports.push({
            packageName,
            sourceFile: sourceFilePath,
            importModule,
            importKind: "named",
            importName: parts[0],
            importType: namedImport.getType().getApparentType().getText(),
          });
        });
      }

      if (defaultImport) {
        packageImports.push({
          packageName,
          sourceFile: sourceFilePath,
          importModule,
          importKind: "default",
          importName: defaultImport.getText(),
          importType: defaultImport.getType().getApparentType().getText(),
        });
      }

      if (!namespaceImport && !namedImports && !defaultImport) {
        packageImports.push({
          packageName,
          sourceFile: sourceFile.getFilePath(),
          importModule,
          importKind: "side-effect",
          importName: "",
          importType: null,
        });
      }
    });
  }

  if (cacheWrite) {
    logDebug(`Writing cache for ${packageDir}`);
    fs.mkdirSync(cacheDir, { recursive: true });
    const dataPath = path.join(cacheDir, "data.json");
    fs.writeFileSync(dataPath, JSON.stringify(packageImports, null, 2), {
      encoding: "utf-8",
    });
  }

  return packageImports;
};

export const findAllInternalPackageImports = async (
  rootPath: string,
  packageByName: {
    [id: string]: PackageWithDeps;
  },
  cacheWrite: boolean,
  cacheRead: boolean
): Promise<PackageImports[]> => {
  const all = (
    await Promise.all(
      Object.keys(packageByName).map((name) => {
        const p = packageByName[name];
        return findPackageImports(rootPath, p.dir, cacheWrite, cacheRead);
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
