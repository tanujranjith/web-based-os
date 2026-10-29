import { mkdtemp, mkdir, chmod } from "node:fs/promises";
import { createReadStream, createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { createBrotliDecompress } from "node:zlib";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
export async function browserOptions() {
  if (process.platform !== "linux") return { headless: true };
  const binary = await import("@sparticuz/chromium");
  const base = new URL(
    "../node_modules/@sparticuz/chromium/bin/",
    import.meta.url,
  );
  const dir = await mkdtemp(join(tmpdir(), "novaos-browser-"));
  await pipeline(
    createReadStream(new URL("chromium.br", base)),
    createBrotliDecompress(),
    createWriteStream(join(dir, "chromium")),
  );
  await chmod(join(dir, "chromium"), 0o700);
  for (const name of ["fonts", "swiftshader"]) {
    const target = name === "fonts" ? join(dir, "fonts") : dir;
    await mkdir(target, { recursive: true });
    const child = spawn("tar", ["--no-same-owner", "-xf", "-", "-C", target], {
      stdio: ["pipe", "ignore", "pipe"],
    });
    const ended = new Promise((resolve, reject) => {
      child.on("error", reject);
      child.on("exit", (code) =>
        code === 0
          ? resolve()
          : reject(new Error("Could not extract browser assets")),
      );
    });
    await pipeline(
      createReadStream(new URL(name + ".tar.br", base)),
      createBrotliDecompress(),
      child.stdin,
    );
    await ended;
  }
  return {
    headless: true,
    executablePath: join(dir, "chromium"),
    args: [
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
    ],
    env: {
      ...process.env,
      FONTCONFIG_PATH: "/etc/fonts",
      LD_LIBRARY_PATH: [dir, process.env.LD_LIBRARY_PATH]
        .filter(Boolean)
        .join(":"),
    },
  };
}
