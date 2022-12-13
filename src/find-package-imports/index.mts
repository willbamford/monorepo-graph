import fs from "fs";
import path from "path";
import { loadPackageJson } from "../utils.mjs";

import { Project, SyntaxKind } from "ts-morph";
import { logDebug, log, logError } from "../log.mjs";
import { PackageImports } from "../types.mjs";

export const findPackageImports = async (
  rootPath: string,
  packageDir: string
): Promise<PackageImports[]> => {
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
  return packageImports;
};
