import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

import { testDb } from "../support/database";

test("cliente salva, edita e usa sua moto principal", async ({ page }, testInfo) => {
  const run = randomUUID().slice(0, 8);
  const email = `e2e-garage-${run}@example.test`;
  const password = `Test-${randomUUID()}!`;
  try {
    await page.goto("/login?next=/account/motorcycles");
    await page.getByRole("button", { name: "Ainda não tenho conta" }).click();
    await page.getByLabel("Nome", { exact: true }).fill("Cliente de teste");
    await page.getByLabel("E-mail", { exact: true }).fill(email);
    await page.getByLabel("Senha", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Criar conta", exact: true }).click();
    await expect(page).toHaveURL(/\/account\/motorcycles$/);
    await expect(page.getByText("Sua garagem está vazia")).toBeVisible();

    const add = page.getByRole("region", { name: "Adicionar moto" });
    const selector = add.getByRole("combobox", { name: "Fabricante, modelo, versão e ano" });
    const options = selector.locator("option");
    const firstId = await options.nth(1).getAttribute("value");
    const secondId = await options.nth(2).getAttribute("value");
    const thirdId = await options.nth(3).getAttribute("value");
    expect(firstId && secondId && thirdId).toBeTruthy();
    await selector.selectOption(firstId!);
    await add.getByRole("button", { name: "Salvar moto" }).click();
    await expect(page.getByRole("region", { name: "Motos salvas" }).locator("article")).toHaveCount(1);
    await expect(page.getByText("Principal", { exact: true })).toBeVisible();

    await selector.selectOption(secondId!);
    await add.getByRole("button", { name: "Salvar moto" }).click();
    const cards = page.getByRole("region", { name: "Motos salvas" }).locator("article");
    await expect(cards).toHaveCount(2);
    await cards.nth(0).getByRole("button", { name: "Editar" }).click();
    await cards.nth(0).getByRole("combobox", { name: "Nova configuração" }).selectOption(thirdId!);
    await cards.nth(0).getByRole("button", { name: "Salvar alteração" }).click();
    await expect(cards.nth(0).getByRole("status")).toContainText("Configuração atualizada");
    await cards.nth(1).getByRole("button", { name: "Definir como principal" }).click();
    await expect
      .poll(
        async () =>
          (await testDb.savedMotorcycle.findFirst({ where: { user: { email }, isPrimary: true } }))
            ?.motorcycleFitmentId,
      )
      .toBe(secondId);

    await page.goto("/");
    await expect(page.getByRole("link", { name: "Peças compatíveis" })).toHaveAttribute(
      "href",
      `/products?moto=${secondId}`,
    );
    await page.goto("/products");
    await expect(page.getByRole("link", { name: "Ver peças para minha moto" })).toHaveAttribute(
      "href",
      `/products?moto=${secondId}`,
    );
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    await page.goto("/account/motorcycles");
    await page.screenshot({ path: testInfo.outputPath("saved-motorcycles.png"), fullPage: true, caret: "initial" });
    await page
      .getByRole("region", { name: "Motos salvas" })
      .locator("article")
      .first()
      .getByRole("button", { name: "Remover" })
      .click();
    await expect
      .poll(
        async () =>
          (await testDb.savedMotorcycle.findFirst({ where: { user: { email }, isPrimary: true } }))
            ?.motorcycleFitmentId,
      )
      .toBe(thirdId);
  } finally {
    const user = await testDb.user.findUnique({ where: { email }, select: { id: true } });
    if (user) await testDb.user.delete({ where: { id: user.id } });
  }
});
