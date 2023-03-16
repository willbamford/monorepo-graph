import fs from "fs";

const results = JSON.parse(
  fs.readFileSync("./report.json", { encoding: "utf-8" })
);

let output = ``;

const createRow = (cells) => `${cells.map((cell) => `"${cell}"`).join("\t")}\n`;

const addRow = (cells) => {
  const row = createRow(cells);
  output += row;
};

addRow(["dep", "type", "overall_count", "dependants_count"]);

results.forEach((entry) => {
  console.log("entry", entry);
  const dep = entry[0];
  const type = entry[1].type;
  const count = entry[1].count;
  const overallCount = count.overall;
  const dependantsCount = Object.entries(count.dependants)
    .map(([d, v]) => {
      return `${d}: ${v}`;
    })
    .join("\n");
  addRow([dep, type, overallCount, dependantsCount]);
});

fs.writeFileSync("./output.tsv", output, { encoding: "utf-8" });
