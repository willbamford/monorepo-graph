import fs from "fs";
import path from "path";

export const byName = <T extends { name: string }>(
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

export const loadPackageJson = async (rootPath: string, packageDir: string) => {
  return JSON.parse(
    await fs.promises.readFile(
      path.join(rootPath, packageDir, "package.json"),
      "utf-8"
    )
  );
};
