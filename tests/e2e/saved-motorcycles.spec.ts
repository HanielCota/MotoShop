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

    const fitments = await testDb.motorcycleFitment.findMany({
      where: { motorcycleModel: { active: true, manufacturer: { active: true } } },
      include: { motorcycleModel: { include: { manufacturer: true } } },
      orderBy: [
        { motorcycleModel: { manufacturer: { name: "asc" } } },
        { motorcycleModel: { name: "asc" } },
        { year: "desc" },
      ],
      take: 3,
    });
    expect(fitments).toHaveLength(3);
    const fitmentLabel = (fitment: (typeof fitments)[number]) =>
      `${fitment.motorcycleModel.manufacturer.name} ${fitment.motorcycleModel.name} · ${fitment.version || "padrão"} · ${fitment.displacementCc} cc · ${fitment.year}`;
    const add = page.getByRole("region", { name: "Adicionar moto" });
    const selector = add.getByRole("combobox", { name: "Fabricante, modelo, versão e ano" });
    await selector.click();
    await page.getByRole("option", { name: fitmentLabel(fitments[0]!), exact: true }).click();
    await add.getByRole("button", { name: "Salvar moto" }).click();
    await expect(page.getByRole("region", { name: "Motos salvas" }).locator("article")).toHaveCount(1);
    await expect(page.getByText("Principal", { exact: true })).toBeVisible();

    await selector.click();
    await page.getByRole("option", { name: fitmentLabel(fitments[1]!), exact: true }).click();
    await add.getByRole("button", { name: "Salvar moto" }).click();
    const cards = page.getByRole("region", { name: "Motos salvas" }).locator("article");
    await expect(cards).toHaveCount(2);
    await cards.nth(0).getByRole("button", { name: "Editar" }).click();
    await cards.nth(0).getByRole("combobox", { name: "Nova configuração" }).click();
    await page.getByRole("option", { name: fitmentLabel(fitments[2]!), exact: true }).click();
    await cards.nth(0).getByRole("button", { name: "Salvar alteração" }).click();
    await expect(cards.nth(0).getByRole("status")).toContainText("Configuração atualizada");
    await cards.nth(1).getByRole("button", { name: "Definir como principal" }).click();
    await expect
      .poll(
        async () =>
          (await testDb.savedMotorcycle.findFirst({ where: { user: { email }, isPrimary: true } }))
            ?.motorcycleFitmentId,
      )
      .toBe(fitments[1]!.id);

    await page.goto("/");
    await expect(page.getByRole("combobox", { name: "Fabricante" })).toContainText(
      fitments[1]!.motorcycleModel.manufacturer.name,
    );
    await page.getByRole("button", { name: "Ver peças" }).click();
    await expect(page).toHaveURL(new RegExp(`/products\\?moto=${fitments[1]!.id}$`));
    await page.goto("/products");
    await expect(page.getByRole("link", { name: "Ver todas as motos" })).toHaveAttribute("href", "/products?moto=all");
    await expect(page.getByText("Minha moto principal:").locator("..")).toContainText(
      fitments[1]!.motorcycleModel.name,
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
      .toBe(fitments[2]!.id);
  } finally {
    const user = await testDb.user.findUnique({ where: { email }, select: { id: true } });
    if (user) await testDb.user.delete({ where: { id: user.id } });
  }
});
