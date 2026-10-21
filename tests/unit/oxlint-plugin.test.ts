// @vitest-environment node
import { describe, expect, it } from "vitest";

import motoShopPlugin from "../../tools/oxlint-plugin";

type SyntaxNode = { type: string; [key: string]: unknown };
type Visitor = Record<string, (node: SyntaxNode) => void>;

/** Runs one visitor of a rule on a hand-built node and returns the reported messages. */
function report(ruleName: keyof typeof motoShopPlugin.rules, nodeType: string, node: Record<string, unknown>) {
  const messages: string[] = [];
  const visitor = motoShopPlugin.rules[ruleName].create({
    report: (descriptor) => messages.push(descriptor.message),
  }) as Visitor;
  visitor[nodeType]?.({ type: nodeType, ...node });
  return messages;
}

const identifier = (name: string) => ({ type: "Identifier", name });
const member = (object: unknown, name: string) => ({
  type: "MemberExpression",
  object,
  property: identifier(name),
  computed: false,
});
const literal = (value: string) => ({ type: "Literal", value });
const template = (...cooked: string[]) => ({
  type: "TemplateLiteral",
  quasis: cooked.map((text) => ({ type: "TemplateElement", value: { raw: text, cooked: text } })),
});

describe("moto-shop/no-else", () => {
  it("reports an else and lets an if without one pass", () => {
    expect(report("no-else", "IfStatement", { alternate: { type: "BlockStatement" } })).toEqual([
      expect.stringContaining("Não use else"),
    ]);
    expect(report("no-else", "IfStatement", { alternate: null })).toEqual([]);
  });
});

describe("moto-shop/no-then", () => {
  it("reports .then() and lets other calls pass", () => {
    expect(report("no-then", "CallExpression", { callee: member(identifier("request"), "then") })).toEqual([
      "Use async/await em vez de .then().",
    ]);
    expect(report("no-then", "CallExpression", { callee: member(identifier("request"), "catch") })).toEqual([]);
  });
});

describe("moto-shop/no-location-assign-relative-destination", () => {
  const assign = (object: unknown, destination: unknown) =>
    report("no-location-assign-relative-destination", "CallExpression", {
      callee: member(object, "assign"),
      arguments: [destination],
    });
  const setHref = (object: unknown, destination: unknown) =>
    report("no-location-assign-relative-destination", "AssignmentExpression", {
      left: member(object, "href"),
      right: destination,
    });

  it("reports navigation to an internal path through location", () => {
    expect(assign(identifier("location"), literal("/cart"))).toHaveLength(1);
    expect(assign(member(identifier("window"), "location"), template("/cart"))).toHaveLength(1);
    expect(setHref(member(identifier("globalThis"), "location"), literal("/products"))).toHaveLength(1);
  });

  it("lets absolute URLs, unknown starts and other objects pass", () => {
    expect(assign(identifier("location"), literal("https://example.test/cart"))).toEqual([]);
    expect(assign(identifier("location"), template("", "/cart"))).toEqual([]);
    expect(setHref(identifier("link"), literal("/cart"))).toEqual([]);
  });
});
