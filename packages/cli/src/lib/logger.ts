import chalk from "chalk";

export const log = {
  info: (msg: string) => console.log(chalk.blue("ℹ"), msg),
  success: (msg: string) => console.log(chalk.green("✓"), msg),
  warn: (msg: string) => console.log(chalk.yellow("⚠"), msg),
  error: (msg: string) => console.error(chalk.red("✗"), msg),
  dim: (msg: string) => console.log(chalk.dim(msg)),
  heading: (msg: string) => console.log("\n" + chalk.bold.white(msg)),
  coverage: (percent: number, label: string) => {
    const color =
      percent >= 80 ? chalk.green : percent >= 50 ? chalk.yellow : chalk.red;
    const bar = "█".repeat(Math.round(percent / 5)) +
      "░".repeat(20 - Math.round(percent / 5));
    console.log(`  ${color(bar)} ${color(`${percent}%`)} ${label}`);
  },
};
