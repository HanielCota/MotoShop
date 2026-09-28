// Read-only inventory of JSX declarations (not runtime instance counts).
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const rows = [];
const tags = new Set([
  "select",
  "option",
  "input",
  "textarea",
  "button",
  "details",
  "summary",
  "dialog",
  "datalist",
  "progress",
  "meter",
  "Button",
  "DesignSelect",
  "DesignCheckbox",
  "DesignRadio",
]);
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "generated") walk(file);
      continue;
    }
    if (!file.endsWith(".tsx") || /\.(test|spec)\./.test(file)) continue;
    const source = ts.createSourceFile(
      file,
      fs.readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    function visit(node) {
      if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
        const tag = node.tagName.getText(source);
        if (tags.has(tag)) {
          const attributes = Object.fromEntries(
            node.attributes.properties
              .filter(ts.isJsxAttribute)
              .map((attribute) => [attribute.name.getText(source), attribute.initializer?.getText(source) ?? "true"]),
          );
          rows.push({
            file: file.replaceAll("\\", "/"),
            line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
            tag,
            attributes,
          });
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
}
walk("src");
const mode = process.argv[2] ?? "summary";
if (mode === "json") console.log(JSON.stringify(rows));
else if (mode === "summary") {
  const counts = {};
  for (const row of rows) {
    const key = row.tag === "input" ? `input:${row.attributes.type ?? '"text"'}` : row.tag;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  console.log(JSON.stringify(counts, null, 2));
} else if (mode === "select-without-value") {
  for (const row of rows.filter(
    (row) => row.tag === "DesignSelect" && !row.attributes.value && !row.attributes.defaultValue,
  )) console.log(`${row.file}:${row.line} | ${row.attributes.name ?? row.attributes["aria-label"] ?? "—"}`);
} else {
  for (const row of rows.filter((row) => row.tag === mode)) {
    console.log(
      `${row.file}:${row.line} | ${row.attributes.name ?? row.attributes.id ?? "—"} | ${row.attributes.type ?? ""} | ${row.attributes.multiple ? "multiple" : ""}`,
    );
  }
}
