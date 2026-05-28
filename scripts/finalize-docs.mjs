import fs from "node:fs";
import path from "node:path";

const docs = "docs";
const built = path.join(docs, "index.src.html");
const index = path.join(docs, "index.html");

if (fs.existsSync(built)) {
  if (fs.existsSync(index)) fs.unlinkSync(index);
  fs.renameSync(built, index);
}

fs.writeFileSync(path.join(docs, ".nojekyll"), "");
