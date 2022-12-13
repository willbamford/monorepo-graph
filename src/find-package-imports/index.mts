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
  const dataDir = path.join(process.env.PWD || "", "data", packageDir);

  if (cacheRead) {
    const dataPath = path.join(dataDir, "data.json");
    if (fs.existsSync(dataPath)) {
      log(`Reading cache for ${packageDir}`);
      const result: PackageImports[] = JSON.parse(
        fs.readFileSync(dataPath, { encoding: "utf-8" })
      );
      return result;
    } else {
      logDebug(`No cache for ${packageDir}`);
    }
  }

  const packageJson = await loadPackageJson(rootPath, packageDir);
  const packageName = packageJson.name;

  const tsConfigFilePath = path.join(rootPath, packageDir, "tsconfig.json");
  if (!fs.existsSync(tsConfigFilePath)) {
    log(
      `${packageName} does not appear to be a TypeScript module (no root tsconfig.json found)`
    );
    return [];
  }
  logDebug(`Found tsconfig.json for ${packageName}`);

  const packageImports: PackageImports[] = [];

  const project = new Project({
    tsConfigFilePath,
  });

  const sourceFiles = project.getSourceFiles();
  for (const sourceFile of sourceFiles) {
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
      const sourceFilePath = sourceFile.getFilePath();

      if (namespaceImport) {
        packageImports.push({
          packageName,
          sourceFile: sourceFilePath,
          importModule,
          importType: "namespace",
          importName: namespaceImport.getText(),
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
            importType: "named",
            importName: parts[0],
          });
        });
      }

      if (defaultImport) {
        packageImports.push({
          packageName,
          sourceFile: sourceFilePath,
          importModule,
          importType: "default",
          importName: defaultImport.getText(),
        });
      }

      if (!namespaceImport && !namedImports && !defaultImport) {
        packageImports.push({
          packageName,
          sourceFile: sourceFile.getFilePath(),
          importModule,
          importType: "side-effect",
          importName: "",
        });
      }
    });
  }

  if (cacheWrite) {
    logDebug(`Writing cache for ${packageDir}`);
    fs.mkdirSync(dataDir, { recursive: true });
    const dataPath = path.join(dataDir, "data.json");
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
        return findPackageImports(
          rootPath,
          packageByName[name].dir,
          cacheWrite,
          cacheRead
        );
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
