"use strict";

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const outPath = path.resolve(process.argv[2] || path.join(root, "embed.js"));
const catalog = fs.readFileSync(path.join(root, "js", "catalog.js"), "utf8");
const view = fs.readFileSync(path.join(root, "js", "view.js"), "utf8");
const boot = fs.readFileSync(path.join(root, "js", "embed-boot.js"), "utf8");

const bundle = `"use strict";
(function () {
  var module = { exports: {} };
  ${catalog}
  var Catalog = module.exports;
  module = { exports: {} };
  ${view}
  var FinderView = module.exports;
  ${boot}
})();
`;

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, bundle);
console.log("Wrote " + outPath);
