import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

import { testDb } from "../support/database";

async function expectNoHorizontalOverflow(page: import("@playwright/test").Page) {
  const widths = await page.evaluate(() => ({ document: document.documentElement.scrollWidth, viewport: innerWidth }));
  expect(widths.document, `Horizontal overflow at ${page.url()}`).toBeLessThanOrEqual(widths.viewport + 1);
}

async function signUpCustomer(page: import("@playwright/test").Page, email: string, password: string) {
  await page.goto("/login?next=/account/addresses");
  await page.getByRole("button", { name: "Ainda não tenho conta" }).click();
  await page.getByLabel("Nome", { exact: true }).fill("Cliente QA Moto Shop");
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Criar conta", exact: true }).click();
  await expect(page).toHaveURL(/\/account\/addresses$/);
}

async function fillAddress(
  page: import("@playwright/test").Page,
  input: { label: string; recipient: string; postalCode: string; street: string; number: string; city: string },
) {
  await page.getByLabel("Nome do endereço", { exact: true }).fill(input.label);
  await page.getByLabel("Destinatário", { exact: true }).fill(input.recipient);
  await page.getByLabel("CEP", { exact: true }).fill(input.postalCode);
  await page.getByLabel("Rua", { exact: true }).fill(input.street);
  await page.getByLabel("Número", { exact: true }).fill(input.number);
  await page.getByLabel("Bairro", { exact: true }).fill("Centro");
  await page.getByLabel("Cidade", { exact: true }).fill(input.city);
  await page.getByLabel("UF", { exact: true }).fill("SP");
}

test("cliente mantém endereço principal, notificações, favoritos e consulta pedidos", async ({ page }) => {
  const run = randomUUID().slice(0, 8);
  const email = `e2e-account-${run}@example.test`;
  const password = `Test-${randomUUID()}!`;
  try {
    await signUpCustomer(page, email, password);
    await expectNoHorizontalOverflow(page);

    await fillAddress(page, {
      label: `Casa ${run}`,
      recipient: "Cliente QA",
      postalCode: "123",
      street: "Rua de teste",
      number: "10",
      city: "São Paulo",
    });
    await page.getByRole("checkbox", { name: "Usar como endereço padrão" }).click();
    await page.getByRole("button", { name: "Salvar endereço" }).click();
    await expect(page.getByText("Informe um CEP com 8 números.")).toBeVisible();
    await expect(page.getByRole("checkbox", { name: "Usar como endereço padrão" })).toBeChecked();
    await expect(page.getByRole("region", { name: "Endereços cadastrados" })).toHaveCount(0);
    await expect(page.getByLabel("Nome do endereço", { exact: true })).toHaveValue(`Casa ${run}`);
    await expect(page.getByLabel("Destinatário", { exact: true })).toHaveValue("Cliente QA");
    await expect(page.getByLabel("Rua", { exact: true })).toHaveValue("Rua de teste");

    await page.getByLabel("CEP", { exact: true }).fill("01001000");
    await page.getByRole("button", { name: "Salvar endereço" }).click();
    await expect(page.getByText("Endereço salvo.")).toBeVisible();
    await expect(page.getByRole("checkbox", { name: "Usar como endereço padrão" })).not.toBeChecked();
    const addressCards = page.getByRole("region", { name: "Endereços cadastrados" }).locator("[data-slot='card']");
    await expect(addressCards).toHaveCount(1);
    // The default address shows the badge once and hides "Usar como padrão".
    await expect(addressCards.first().getByText("Padrão", { exact: true })).toHaveCount(1);
    await expect(addressCards.first().getByRole("button", { name: "Usar como padrão" })).toHaveCount(0);

    await fillAddress(page, {
      label: `Oficina ${run}`,
      recipient: "Cliente QA",
      postalCode: "01311000",
      street: "Avenida de teste",
      number: "20",
      city: "São Paulo",
    });
    await page.getByRole("button", { name: "Salvar endereço" }).click();
    await expect(page.getByText("Endereço salvo.")).toBeVisible();
    await expect(page.getByRole("checkbox", { name: "Usar como endereço padrão" })).not.toBeChecked();
    await expect(addressCards).toHaveCount(2);
    const secondAddress = addressCards.filter({ hasText: `Oficina ${run}` });
    await expect(secondAddress).toHaveCount(1);
    await secondAddress.getByRole("button", { name: "Usar como padrão" }).click();
    const userId = (await testDb.user.findUniqueOrThrow({ where: { email }, select: { id: true } })).id;
    await expect
      .poll(
        async () => (await testDb.customerAddress.findFirst({ where: { userId, label: `Oficina ${run}` } }))?.isDefault,
      )
      .toBe(true);
    await expect(secondAddress.getByText("Padrão", { exact: true })).toHaveCount(1);
    await secondAddress.getByRole("button", { name: "Remover" }).click();
    await expect(addressCards).toHaveCount(1);
    await expect(addressCards.first().getByText("Padrão", { exact: true })).toHaveCount(1);
    await addressCards.first().getByRole("button", { name: "Remover" }).click();
    await expect(page.getByRole("region", { name: "Endereços cadastrados" })).toHaveCount(0);

    await page.goto("/account/notifications");
    await expectNoHorizontalOverflow(page);
    await expect(page.getByRole("heading", { name: "Notificações" })).toBeVisible();
    const emailUpdates = page.getByRole("checkbox", { name: /Atualizações dos meus pedidos/ });
    await expect(emailUpdates).toBeChecked();
    await emailUpdates.uncheck();
    await page.getByRole("button", { name: "Salvar preferências" }).click();
    await expect(page.getByRole("status")).toHaveText("Preferências de e-mail atualizadas.");
    await expect(emailUpdates).not.toBeChecked();
    await page.reload();
    await expect(emailUpdates).not.toBeChecked();

    const product = await testDb.product.findFirst({
      where: { status: "APPROVED" },
      select: { id: true, slug: true, name: true },
      orderBy: { createdAt: "asc" },
    });
    expect(product, "The test database must contain a public approved product").not.toBeNull();
    if (!product) return;

    await page.goto(`/products/${product.slug}`);
    const favoriteButton = page.getByRole("button", { name: "Favoritar", exact: true });
    await favoriteButton.click();
    await expect(page.getByRole("button", { name: "Favoritado", exact: true })).toHaveAttribute("aria-pressed", "true");
    await page.goto("/favorites");
    await expectNoHorizontalOverflow(page);
    await expect(page.getByRole("heading", { name: "Meus favoritos" })).toBeVisible();
    const favoriteCard = page.locator("[data-slot='product-card']").filter({ hasText: product.name });
    await expect(favoriteCard).toHaveCount(1);
    await favoriteCard.getByRole("button", { name: "Favoritado", exact: true }).click();
    await expect(page.getByText("Você ainda não favoritou nenhum produto.")).toBeVisible();

    await page.goto("/orders");
    await expectNoHorizontalOverflow(page);
    await expect(page.getByRole("heading", { name: "Meus pedidos" })).toBeVisible();
    await expect(page.getByText(/Você ainda não fez nenhum pedido/)).toBeVisible();
  } finally {
    const user = await testDb.user.findUnique({ where: { email }, select: { id: true } });
    if (user) await testDb.user.delete({ where: { id: user.id } });
  }
});
