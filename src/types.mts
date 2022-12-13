export type Workspaces = string[] | { packages: string[] };

export type PackageNameAndDir = {
  name: string;
  dir: string;
};

export type PackageWithDeps = {
  name: string;
  dir: string;
  deps: Set<string>;
};

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/import#description
export type ImportType = "named" | "namespace" | "default" | "side-effect";

export type PackageImports = {
  packageName: string; // e.g. '@org/name-1'
  sourceFile: string; // e.g. 'src/index.ts'
  importModule: string; // e.g. '@org/dep-1'
  importType: ImportType; // e.g. 'named'
  importName: string; // e.g. 'myUtil'
};
