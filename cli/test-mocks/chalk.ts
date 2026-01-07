const passthrough = (s: string) => s;

const chalk: any = (
  (input: string) => input
) as any;

chalk.red = passthrough;
chalk.green = passthrough;
chalk.yellow = passthrough;
chalk.blue = passthrough;
chalk.magenta = passthrough;
chalk.gray = passthrough;
chalk.white = { bold: passthrough } as any;
chalk.whiteBright = passthrough as any;
chalk.bold = passthrough as any;

export default chalk;

