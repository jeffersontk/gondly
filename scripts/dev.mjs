import { spawn } from "node:child_process";

const isWindows = process.platform === "win32";
const npm = isWindows ? "npm.cmd" : "npm";

const commands = [
  ["api", ["run", "dev:api"]],
  ["web", ["run", "dev:web"]],
];

const children = commands.map(([name, args]) => {
  const child = spawn(npm, args, {
    stdio: ["inherit", "pipe", "pipe"],
    shell: false,
    env: process.env,
  });

  child.stdout.on("data", (chunk) => process.stdout.write(`[${name}] ${chunk}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`[${name}] ${chunk}`));
  child.on("exit", (code) => {
    if (code && code !== 0) {
      process.exitCode = code;
    }
  });

  return child;
});

function shutdown() {
  for (const child of children) {
    child.kill();
  }
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
