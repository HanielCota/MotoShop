/**
 * Project lint rules that Oxlint does not ship, loaded through `jsPlugins` in `.oxlintrc.json`.
 *
 * - `moto-shop/no-else` and `moto-shop/no-then`: the code standards of AGENTS.md (section 46). They
 *   replace the two `no-restricted-syntax` selectors of the former ESLint config, with the same messages.
 * - `moto-shop/no-location-assign-relative-destination`: the Next.js rule of the same name, which
 *   Oxlint has not implemented yet. It flags `location.assign("/path")` and `location.href = "/path"`.
 */

type Node = { type: string; [key: string]: unknown };

type RuleContext = {
  report(descriptor: { node: Node; message: string }): void;
};

const NEXT_LOCATION_DOCS = "https://nextjs.org/docs/messages/no-location-assign-relative-destination";
const LOCATION_ROOTS = new Set(["window", "globalThis", "self"]);
const ABSOLUTE_URL = /^(?:[a-z][\d+.a-z-]*:|\/\/)/i;

const noElse = {
  meta: { type: "suggestion", docs: { description: "Disallow `else` (AGENTS.md, section 46)." }, schema: [] },
  create(context: RuleContext) {
    return {
      IfStatement(node: Node) {
        const alternate = asNode(node.alternate);
        if (alternate == null) return;

        context.report({
          node: alternate,
          message: "Não use else: retorne cedo (early return), use continue em laços ou extraia uma função.",
        });
      },
    };
  },
};

const noThen = {
  meta: { type: "suggestion", docs: { description: "Disallow `.then()` (AGENTS.md, section 46)." }, schema: [] },
  create(context: RuleContext) {
    return {
      CallExpression(node: Node) {
        if (propertyName(asNode(node.callee)) !== "then") return;

        context.report({ node, message: "Use async/await em vez de .then()." });
      },
    };
  },
};

const noLocationAssignRelativeDestination = {
  meta: {
    type: "problem",
    docs: { description: "Navigate to internal pages with the Next.js router, not `location`." },
    schema: [],
  },
  create(context: RuleContext) {
    const report = (node: Node, expression: string) =>
      context.report({
        node,
        message: `Do not use \`${expression}\` to navigate to internal Next.js pages. Use \`redirect()\` in the render phase, or \`useRouter().push()\` in Client Components' event handlers instead. See: ${NEXT_LOCATION_DOCS}`,
      });

    return {
      CallExpression(node: Node) {
        const callee = asNode(node.callee);
        if (propertyName(callee) !== "assign" || !isLocation(asNode(callee?.object))) return;

        const [destination] = Array.isArray(node.arguments) ? node.arguments : [];
        if (isRelativeDestination(asNode(destination))) report(node, "location.assign()");
      },
      AssignmentExpression(node: Node) {
        const target = asNode(node.left);
        if (propertyName(target) !== "href" || !isLocation(asNode(target?.object))) return;

        if (isRelativeDestination(asNode(node.right))) report(node, "location.href");
      },
    };
  },
};

function asNode(value: unknown): Node | null {
  if (typeof value !== "object" || value === null || !("type" in value)) return null;

  return value as Node;
}

/** `name` of `object.name` or `object["name"]`. */
function propertyName(node: Node | null): string | undefined {
  if (node?.type !== "MemberExpression") return undefined;

  const property = asNode(node.property);
  if (property == null) return undefined;
  if (!node.computed && typeof property.name === "string") return property.name;

  return property.type === "Literal" && typeof property.value === "string" ? property.value : undefined;
}

/** `location`, or `window.location` / `globalThis.location` / `self.location`. */
function isLocation(node: Node | null): boolean {
  if (node?.type === "Identifier") return node.name === "location";
  if (propertyName(node) !== "location") return false;

  const root = asNode(node?.object);
  return root?.type === "Identifier" && typeof root.name === "string" && LOCATION_ROOTS.has(root.name);
}

/** A string, or a template whose fixed start is known, that is not an absolute URL. */
function isRelativeDestination(node: Node | null): boolean {
  const prefix = staticPrefix(node);
  return prefix !== null && !ABSOLUTE_URL.test(prefix);
}

function staticPrefix(node: Node | null): string | null {
  if (node?.type === "Literal") return typeof node.value === "string" ? node.value : null;
  if (node?.type !== "TemplateLiteral" || !Array.isArray(node.quasis)) return null;

  // The quasi's `value` is a plain `{ raw, cooked }` object, not a node.
  const value = asNode(node.quasis[0])?.value;
  const cooked = typeof value === "object" && value !== null && "cooked" in value ? value.cooked : null;
  if (typeof cooked !== "string") return null;

  // `${origin}/path` starts with an unknown value: it may well be absolute.
  return cooked === "" && node.quasis.length > 1 ? null : cooked;
}

const motoShopPlugin = {
  meta: { name: "moto-shop" },
  rules: {
    "no-else": noElse,
    "no-then": noThen,
    "no-location-assign-relative-destination": noLocationAssignRelativeDestination,
  },
};

export default motoShopPlugin;
