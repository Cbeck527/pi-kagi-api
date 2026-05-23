import assert from "node:assert/strict";

const registeredTools = [];
const { default: extension } = await import("../dist/index.js");

assert.equal(typeof extension, "function", "default export must be the Pi extension function");

extension({
  registerTool(tool) {
    registeredTools.push(tool);
  },
});

assert.equal(registeredTools.length, 2, "extension must register exactly two tools");
assert.deepEqual(
  registeredTools.map((tool) => tool.name).sort(),
  ["kagi_extract", "kagi_search"],
  "extension must register the expected Kagi tools",
);

for (const tool of registeredTools) {
  assert.equal(typeof tool.execute, "function", `${tool.name} must expose an execute function`);
  assert.equal(typeof tool.parameters, "object", `${tool.name} must expose a parameters object`);
  assert.notEqual(tool.parameters, null, `${tool.name} parameters must not be null`);
}

console.log("Built artifact import smoke passed.");
