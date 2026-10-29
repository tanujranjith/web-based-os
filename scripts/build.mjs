import { build } from "esbuild";
import { createHash } from "node:crypto";
import { dirname } from "node:path";
import {
  mkdir,
  copyFile,
  readdir,
  readFile,
  writeFile,
  rm,
} from "node:fs/promises";
await mkdir("vendor", { recursive: true });
await build({
  entryPoints: ["styles/system.css"],
  bundle: true,
  outfile: "vendor/system.css",
  minify: true,
});
for (const name of ["editor", "markdown"])
  await build({
    entryPoints: [`src/vendor/${name}.js`],
    bundle: true,
    format: "esm",
    outfile: `vendor/${name}.js`,
    minify: true,
    legalComments: "eof",
    target: "es2022",
  });
for (const name of ["pdf.mjs", "pdf.worker.mjs"])
  await copyFile(`node_modules/pdfjs-dist/build/${name}`, `vendor/${name}`);
await mkdir("vendor/cmaps", { recursive: true });
await mkdir("vendor/standard_fonts", { recursive: true });
for (const dir of ["cmaps", "standard_fonts"])
  for (const file of await readdir(`node_modules/pdfjs-dist/${dir}`))
    await copyFile(
      `node_modules/pdfjs-dist/${dir}/${file}`,
      `vendor/${dir}/${file}`,
    );
async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (e.isDirectory()) out.push(...(await walk(`${dir}/${e.name}`)));
    else out.push(`${dir}/${e.name}`);
  }
  return out;
}
const files = [
  "./",
  "./index.html",
  "./icon.svg",
  "./manifest.json",
  "./clear.html",
  ...(await walk("src")),
  ...(await walk("styles")),
  ...(await walk("vendor")),
]
  .filter((p) => !p.startsWith("src/vendor/"))
  .map((p) => (p.startsWith(".") ? p : `./${p}`));
await writeFile("precache.json", JSON.stringify(files));
console.log(
  `Built local editor, Markdown and PDF assets; ${files.length} offline resources.`,
);

await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });
for (const path of [
  ...files.filter((p) => p !== "./"),
  "./sw.js",
  "./precache.json",
]) {
  const target = "dist/" + path.replace(/^\.\//, "");
  await mkdir(dirname(target), { recursive: true });
  await copyFile(path, target);
}
console.log("Prepared dist with public runtime files only.");

const hash = createHash("sha256");
for (const path of files.filter((p) => p !== "./"))
  hash.update(await readFile(path));
const version = hash.digest("hex").slice(0, 16);
await writeFile(
  "dist/sw.js",
  (await readFile("sw.js", "utf8")).replace(
    "novaos-4.0.0",
    `novaos-4.0.0-${version}`,
  ),
);
