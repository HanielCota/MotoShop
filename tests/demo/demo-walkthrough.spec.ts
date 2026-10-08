import { expect, test, type Page } from "@playwright/test";

import { demoAccounts, demoStorageState } from "./demo-accounts";

/**
 * Read-only tour of every screen the client will review. Each visit asserts: HTTP < 400, a visible
 * <h1>, no horizontal page scroll, no uncaught page error or console error, and screen-specific content.
 */

const ignoredConsole = [/_next\/hmr/, /\[Fast Refresh\]/, /Download the React DevTools/];

async function visit(page: Page, url: string, expectations: { h1?: RegExp; text?: (string | RegExp)[] } = {}) {
  const problems: string[] = [];
  const onConsole = (message: { type(): string; text(): string }) => {
    if (message.type() === "error" && !ignoredConsole.some((pattern) => pattern.test(message.text())))
      problems.push(`console: ${message.text().slice(0, 200)}`);
  };
  const onPageError = (error: Error) => problems.push(`pageerror: ${error.message.slice(0, 200)}`);
  page.on("console", onConsole);
  page.on("pageerror", onPageError);

  const response = await page.goto(url);
  expect(response?.status(), `${url} status`).toBeLessThan(400);
  const heading = page.locator("h1").first();
  await expect(heading, `${url} has a visible h1`).toBeVisible();
  if (expectations.h1) await expect(heading).toHaveText(expectations.h1);
  for (const text of expectations.text ?? [])
    await expect(page.getByText(text).first(), `${url} shows ${text}`).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, `${url} must not scroll horizontally`).toBeLessThanOrEqual(1);

  await page.waitForLoadState("networkidle").catch(() => undefined);
  page.off("console", onConsole);
  page.off("pageerror", onPageError);
  expect(problems, `${url} browser errors`).toEqual([]);
}

test.describe("Loja pública (visitante)", () => {
  test("home, catálogo e busca", async ({ page }) => {
    await visit(page, "/", { text: [/Peças por moto/i] });
    await visit(page, "/products", { text: [/\d+ produtos/] });
    const count = Number(
      (
        await page
          .getByText(/(\d+) produtos/)
          .first()
          .innerText()
      ).match(/\d+/)?.[0],
    );
    expect(count, "the demo catalogue has volume").toBeGreaterThanOrEqual(50);
    await visit(page, "/products?q=capacete", { text: [/\d+ produtos?/] });
    await visit(page, "/products?q=zzzz-nada-encontrado", { text: [/Limpar filtros|Nenhum produto/i] });
  });

  test("produto de demonstração bloqueia a compra", async ({ page }) => {
    await visit(page, "/products/review-capacete-apex-pro", {
      h1: /Capacete off-road Apex Pro/,
      text: ["a compra está desativada", "Avaliações do produto", "Dúvidas sobre o produto"],
    });
    await expect(page.getByRole("button", { name: /Adicionar/i })).toHaveCount(0);
  });

  test("vitrines das lojas e páginas de categoria", async ({ page }) => {
    await visit(page, "/loja/review-garagem-mx", { h1: /Garagem MX/, text: ["Loja VIP"] });
    await visit(page, "/loja/review-box-77", { h1: /Box 77/ });
    await page.goto("/products/review-capacete-apex-pro");
    const categoryHref = await page.locator('a[href^="/categoria/"]').first().getAttribute("href");
    expect(categoryHref).toBeTruthy();
    await visit(page, categoryHref!);
  });

  test("prévias de carrinho e checkout, login e página inexistente", async ({ page }) => {
    await visit(page, "/cart?preview=1", { h1: /Carrinho/ });
    await visit(page, "/checkout?preview=1", { h1: /Finalizar compra/ });
    await visit(page, "/login", { text: ["Entrar"] });
    await visit(page, "/login?modo=cadastro");
    await visit(page, "/forgot-password");
    const missing = await page.goto("/pagina-que-nao-existe");
    expect(missing?.status()).toBe(404);
    await expect(page.locator("h1").first()).toBeVisible();
  });
});

test.describe("Área do cliente", () => {
  test.use({ storageState: demoStorageState("customer") });

  test("pedidos, detalhe e pós-venda", async ({ page }) => {
    await visit(page, "/orders", { h1: /Meus pedidos/, text: ["MS-REVIEW-0005"] });
    await visit(page, "/orders/MS-REVIEW-0005", { h1: /MS-REVIEW-0005/, text: ["Entregue"] });
    await visit(page, "/orders/MS-REVIEW-0004", { text: ["Enviado"] });
    await visit(page, "/orders/MS-REVIEW-0007");
  });

  test("serviços da conta, motos e carrinho", async ({ page }) => {
    await visit(page, "/favorites", { h1: /Meus favoritos/ });
    await visit(page, "/account/profile", { h1: /Dados cadastrais/, text: ["Serviços"] });
    await visit(page, "/account/password", { h1: /Redefinir senha/ });
    await visit(page, "/account/addresses", { h1: /Meus endereços/ });
    // Old notification link now lands on the preferences section of "Dados cadastrais".
    await page.goto("/account/notifications");
    await expect(page).toHaveURL(/\/account\/profile/);
    await visit(page, "/account/motorcycles", { h1: /Minhas motos/ });
    await visit(page, "/cart", { h1: /Carrinho/ });
    await visit(page, "/checkout", { h1: /Finalizar compra/ });
  });

  test("cliente não acessa o Admin", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/forbidden/);
    await expect(page.locator("h1")).toHaveText(/Acesso não autorizado/);
  });
});

test.describe("Central do Lojista (dono)", () => {
  test.use({ storageState: demoStorageState("seller") });

  test("todas as telas da Central", async ({ page }) => {
    await visit(page, "/seller", { text: ["Central do Lojista"] });
    await visit(page, "/seller/orders", { text: [/MS-REVIEW-/] });
    await visit(page, "/seller/products", { text: [/demonstração/] });
    await visit(page, "/seller/products/new", { h1: /Novo produto/ });
    await visit(page, "/seller/questions");
    await visit(page, "/seller/shipping");
    await visit(page, "/seller/shipping/integrations");
    await visit(page, "/seller/coupons");
    await visit(page, "/seller/settings");
  });
});

test.describe("Central do Lojista (equipe de catálogo)", () => {
  test.use({ storageState: demoStorageState("catalog") });

  test("o menu mostra só o que a função permite", async ({ page }) => {
    await visit(page, "/seller/products");
    const nav = page.getByRole("navigation", { name: "Navegação da Central do Lojista" });
    await expect(nav.getByRole("link", { name: "Produtos" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Cupons" })).toHaveCount(0);
  });
});

test.describe("Admin", () => {
  test.use({ storageState: demoStorageState("admin") });
  test.skip(!demoAccounts().admin, "Defina DEMO_ADMIN_EMAIL e DEMO_ADMIN_PASSWORD (conta em ADMIN_EMAILS).");

  test("painel e todas as filas", async ({ page }) => {
    await visit(page, "/admin", { h1: /Visão geral/, text: ["Aguardando ação"] });
    for (const section of [
      "sellers",
      "products",
      "catalog",
      "coupons",
      "vip",
      "commission",
      "orders",
      "cancellations",
      "returns",
      "disputes",
      "moderation",
      "shipping-recovery",
      "integrations",
      "webhooks",
      "emails",
      "audit",
      "outbox",
    ]) {
      await visit(page, `/admin/${section}`);
    }
  });
});
