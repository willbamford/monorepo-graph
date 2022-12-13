import yargs from "yargs/yargs";

const parser = yargs(process.argv.slice(2))
  .options({
    m: {
      type: "string",
      demandOption: true,
      describe: "Monorepo root",
      normalize: true,
    },
  })
  .scriptName("mgraph ")
  .example([["$0 -m /code/foo"]])
  .usage("Usage: $0 -m <monorepo_path>");

export const getArgv = async () => {
  return parser.argv;
};
