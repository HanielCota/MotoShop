import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { cleanupFixtures, testDb } from "../support/database";

async function noHorizontalOverflow(page: Page) {
  const layout = await page.evaluate(() => {
    const overflowingElements = Array.from(document.querySelectorAll<HTMLElement>("body *"))
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName,
          id: element.id,
          className: typeof element.className === "string" ? element.className : "",
          text: element.innerText?.slice(0, 80),
          formClassName: element.closest("form")?.className,
          formWidth: element.closest("form") ? Math.round(element.closest("form")!.getBoundingClientRect().width) : null,
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
        };
      })
      .filter((element) => element.width > 0 && (element.left < -1 || element.right > window.innerWidth + 1))
      .slice(0, 12);
    return {
      viewportWidth: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      overflowingElements,
    };
  });
  expect(layout.documentWidth <= layout.viewportWidth + 1, `Horizontal overflow: ${JSON.stringify(layout)}`).toBe(
    true,
  );
}

async function chooseOption(page: Page, label: string, optionName: string) {
  await page.getByRole("combobox", { name: label, exact: true }).click();
  await page.getByRole("option", { name: optionName, exact: true }).click();
}

test("store registration → approval → product → publication → catalog → cart → own shipping", async ({
  page,
  browser,
}, testInfo) => {
  const run = randomUUID().slice(0, 8);
  const sellerEmail = `e2e-seller-${run}@example.test`;
  const adminEmail = process.env.E2E_ADMIN_EMAIL!;
  const password = `Test-${randomUUID()}!`;
  const slug = `e2e-${run}`;
  const productName = `Capacete Teste ${run}`;
  const admin = await browser.newContext({ baseURL: testInfo.project.use.baseURL!, viewport: page.viewportSize() });
  try {
    await page.goto("/login?next=/seller");
    await page.getByRole("button", { name: "Ainda não tenho conta" }).click();
    await page.getByLabel("Nome", { exact: true }).fill("Lojista de teste");
    await page.getByLabel("E-mail", { exact: true }).fill(sellerEmail);
    await page.getByLabel("Senha", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Criar conta", exact: true }).click();
    await expect(page).toHaveURL(/\/seller$/);
    await page.getByLabel("Nome da loja", { exact: true }).fill(`Loja Teste ${run}`);
    await page.getByLabel("Identificador da loja", { exact: true }).fill(slug);
    await page.getByLabel("CEP de origem dos envios").fill("01001000");
    await page.getByRole("button", { name: "Solicitar cadastro da loja" }).click();
    await expect(page.getByText(/em análise/i).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Novo produto", exact: true })).toHaveCount(0);
    const signup = await admin.request.post("/api/auth/sign-up/email", {
      data: { name: "Admin Teste", email: adminEmail, password },
      headers: { origin: String(testInfo.project.use.baseURL) },
    });
    expect(signup.ok()).toBe(true);
    // Isolated test fixture only; production administrators must verify email.
    await testDb.user.update({ where: { email: adminEmail }, data: { emailVerified: true } });
    const adminPage = await admin.newPage();
    await adminPage.goto("/admin");
    const fixtureStore = await testDb.store.findUniqueOrThrow({ where: { slug } });
    const sellerReview = adminPage.getByTestId(`seller-review-${fixtureStore.sellerId}`);
    await sellerReview.getByLabel("Comissão individual (%)", { exact: true }).fill("10,50");
    await sellerReview.getByRole("button", { name: "Salvar comissão da loja" }).click();
    await expect(sellerReview.getByRole("status")).toContainText("Comissão salva");
    expect(
      (await testDb.seller.findUniqueOrThrow({ where: { id: fixtureStore.sellerId } })).commissionBpsOverride,
    ).toBe(1050);
    await noHorizontalOverflow(adminPage);
    await sellerReview.screenshot({ path: testInfo.outputPath("seller-commission.png"), caret: "initial" });
    await sellerReview.getByLabel("Comissão individual (%)", { exact: true }).fill("");
    await sellerReview.getByRole("button", { name: "Salvar comissão da loja" }).click();
    await expect
      .poll(
        async () =>
          (await testDb.seller.findUniqueOrThrow({ where: { id: fixtureStore.sellerId } })).commissionBpsOverride,
      )
      .toBeNull();
    await adminPage
      .getByTestId(`seller-review-${fixtureStore.sellerId}`)
      .getByRole("button", { name: "Aprovar", exact: true })
      .click();
    await expect
      .poll(async () => (await testDb.store.findUnique({ where: { slug }, include: { seller: true } }))?.seller.status)
      .toBe("ACTIVE");
    await page.goto("/seller/orders");
    await expect(page.getByRole("heading", { name: "Fulfillment e envios" })).toBeVisible();
    await expect(page.getByText("Ainda não há pedidos para processar.")).toBeVisible();
    await page.goto("/seller/questions");
    await expect(page.getByRole("heading", { name: "Perguntas dos clientes" })).toBeVisible();
    await expect(page.getByText("Ainda não há perguntas nos seus produtos.")).toBeVisible();
    await page.goto("/seller/shipping/integrations");
    await expect(page.getByRole("heading", { name: "Integrações de frete" })).toBeVisible();
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/forbidden$/);

    await adminPage.goto("/admin/moderation");
    await expect(adminPage.getByRole("heading", { name: "Moderação pública" })).toBeVisible();
    await expect(adminPage.getByRole("navigation", { name: "Tipo de conteúdo" })).toBeVisible();
    await adminPage.goto("/admin/shipping-recovery");
    await expect(adminPage.getByRole("heading", { name: "Conferir compras de etiquetas" })).toBeVisible();

    await page.goto("/seller/products/new");
    await page.getByLabel("Nome", { exact: true }).fill(productName);
    await page.getByLabel("Slug", { exact: true }).fill(slug);
    await page
      .getByLabel("Descrição", { exact: true })
      .fill("Produto temporário para validar a jornada do Moto Shop, sem vendas reais.");
    await chooseOption(page, "Categoria", "Capacetes");
    const brand = await testDb.brand.findFirstOrThrow({ where: { active: true }, orderBy: { name: "asc" } });
    await chooseOption(page, "Marca", brand.name);
    const firstFitment = await testDb.motorcycleFitment.findFirstOrThrow({
      where: { motorcycleModel: { active: true, manufacturer: { active: true } } },
      orderBy: [
        { motorcycleModel: { manufacturer: { name: "asc" } } },
        { motorcycleModel: { name: "asc" } },
        { year: "desc" },
      ],
      select: { id: true },
    });
    const fitment = firstFitment.id;
    const fitmentSelect = page.getByRole("combobox", { name: "Compatibilidade com motos", exact: true });
    await fitmentSelect.click();
    await page.getByRole("option").first().click();
    await page.keyboard.press("Escape");
    await page.getByLabel("Variação 1", { exact: true }).fill("Preto / M");
    await page.getByLabel("SKU", { exact: true }).fill(`SKU-${run}`);
    await page.getByLabel("Preço (R$)", { exact: true }).fill("199,90");
    await page.getByLabel("Estoque", { exact: true }).fill("5");
    const packaging = page.getByRole("group", { name: "Embalagem padrão para envio", exact: true });
    await packaging.getByLabel("Peso embalado (g)").fill("1500");
    await packaging.getByLabel("Altura da embalagem (mm)").fill("200");
    await packaging.getByLabel("Largura da embalagem (mm)").fill("250");
    await packaging.getByLabel("Comprimento da embalagem (mm)").fill("300");
    await page
      .getByRole("group", { name: "Embalagem desta variação", exact: true })
      .getByLabel("Peso embalado (g)")
      .fill("1600");
    await page.getByLabel("Preço promocional (R$)").fill("179,90");
    await page.getByLabel("Início da promoção").fill("2026-01-01T10:00");
    await page.getByLabel("Término da promoção").fill("2099-12-31T18:00");
    await noHorizontalOverflow(page);
    await page.screenshot({ path: testInfo.outputPath("product-commercial-new.png"), fullPage: true, caret: "initial" });
    await page.getByRole("button", { name: "Criar rascunho" }).click();
    await expect(page).toHaveURL(/\/seller\/products\/[^/]+\/edit$/);
    await expect(page.getByLabel("Preço promocional (R$)")).toHaveValue("179,90");
    await expect(page.getByLabel("Início da promoção")).toHaveValue("2026-01-01T10:00");
    await page.getByLabel("Preço promocional (R$)").fill("250,00");
    await page.getByRole("button", { name: "Salvar alterações" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "menor que o preço normal" })).toBeVisible();
    await expect(page.getByLabel("Preço promocional (R$)")).toHaveValue("250,00");
    await page.getByLabel("Preço promocional (R$)").fill("189,90");
    await page.getByRole("button", { name: "Salvar alterações" }).click();
    await expect(page.getByRole("status")).toContainText("Produto atualizado");
    await page.reload();
    await expect(page.getByLabel("Preço promocional (R$)")).toHaveValue("189,90");
    const savedProduct = await testDb.product.findUniqueOrThrow({ where: { slug }, include: { variants: true } });
    expect(savedProduct.weightInGrams).toBe(1500);
    expect(savedProduct.variants[0]?.weightInGrams).toBe(1600);
    expect(savedProduct.variants[0]?.heightInMillimeters).toBeNull();
    expect(savedProduct.variants[0]?.promotionStartsAt?.toISOString()).toBe("2026-01-01T13:00:00.000Z");
    await noHorizontalOverflow(page);
    await page.screenshot({ path: testInfo.outputPath("product-commercial-edit.png"), fullPage: true, caret: "initial" });
    await page.goto(`/products?q=${run}`);
    await expect(page.getByRole("heading", { name: "0 produtos", exact: true })).toBeVisible();
    await page.goto("/seller");
    await page.getByRole("button", { name: "Enviar para aprovação" }).click();
    await expect.poll(async () => (await testDb.product.findUnique({ where: { slug } }))?.status).toBe("SUBMITTED");
    await adminPage.goto("/admin");
    const fixtureProduct = await testDb.product.findUniqueOrThrow({ where: { slug } });
    await adminPage
      .getByTestId(`product-review-${fixtureProduct.id}`)
      .getByRole("button", { name: "Aprovar", exact: true })
      .click();
    await expect.poll(async () => (await testDb.product.findUnique({ where: { slug } }))?.status).toBe("APPROVED");
    await page.goto(`/products?q=${run}&moto=${fitment}`);
    await expect(page.getByRole("link", { name: productName, exact: true })).toBeVisible();
    await page.getByText("Categoria, preço e outros filtros", { exact: true }).click();
    await page.getByLabel("Preço mínimo (R$)", { exact: true }).fill("189,00");
    await page.getByLabel("Preço máximo (R$)", { exact: true }).fill("200,00");
    await page.getByRole("button", { name: "Aplicar busca", exact: true }).click();
    await expect(page).toHaveURL(/minPrice=18900/);
    await expect(page.getByRole("link", { name: productName, exact: true })).toBeVisible();
    await noHorizontalOverflow(page);
    await page.screenshot({ path: testInfo.outputPath("catalog.png"), fullPage: true, caret: "initial" });
    await page.getByRole("link", { name: productName, exact: true }).click();
    await expect(page.getByRole("heading", { name: productName, level: 1 })).toBeVisible();
    await noHorizontalOverflow(page);
    await page.screenshot({ path: testInfo.outputPath("product.png"), fullPage: true, caret: "initial" });
    await page.getByRole("button", { name: /Adicionar ao carrinho/i }).click();
    await expect(page).toHaveURL(/\/cart$/);
    await expect(page.getByText(productName, { exact: true }).first()).toBeVisible();
    await noHorizontalOverflow(page);
    await page.goto("/seller/shipping");
    await page.getByLabel("Nome da entrega").fill("Entrega de teste");
    await page.getByLabel("CEP inicial").fill("01000-000");
    await page.getByLabel("CEP final").fill("01999-999");
    await page.getByLabel("Preço por pedido da loja (R$)").fill("15,00");
    await page.getByLabel("Prazo em dias úteis").fill("3");
    await page.getByRole("button", { name: "Criar modalidade" }).click();
    await expect(page.getByRole("heading", { name: "Entrega de teste · Desativada" })).toBeVisible();
    await page.getByRole("button", { name: "Ativar", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Entrega de teste · Ativa" })).toBeVisible();
    await noHorizontalOverflow(page);
    await page.screenshot({ path: testInfo.outputPath("own-shipping.png"), fullPage: true, caret: "initial" });
    await page.goto("/checkout");
    await page.getByLabel("CEP", { exact: true }).fill("01001000");
    await page.getByRole("button", { name: /Calcular frete/i }).click();
    await expect(page.getByText(/Entrega de teste/).first()).toBeVisible();
    await noHorizontalOverflow(page);
    // Test-only hosted-field contract: no real card data, tokenization or charge.
    await page.route("https://sdk.mercadopago.com/js/v2", (route) =>
      route.fulfill({
        contentType: "application/javascript",
        body: `window.MercadoPago = class {
        fields = { create(type, options) {
          const handlers = {};
          let frame;
          return {
            on(event, handler) { handlers[event] = handler; },
            mount(id) {
              frame = document.createElement('iframe');
              frame.title = options.srLabel;
              frame.style.cssText = 'width:100%;height:44px;border:0';
              frame.srcdoc = '<input aria-label="' + options.srLabel + '" style="width:90%" />';
              document.getElementById(id).appendChild(frame);
              handlers.ready?.({});
            },
            unmount() { frame?.remove(); }, update() {}
          };
        }};
      };`,
      }),
    );
    const paymentUnavailable = page.getByRole("status").filter({ hasText: /temporariamente indisponível/ });
    if (await paymentUnavailable.count()) {
      await expect(paymentUnavailable).toBeVisible();
      await expect(page.getByRole("button", { name: "Pagamento indisponível" })).toBeDisabled();
    } else {
      const cardMethod = page.getByRole("radio", { name: /Cartão de crédito/ });
      if (await cardMethod.isDisabled()) {
        await expect(page.getByRole("radio", { name: "Pix", exact: true })).toBeEnabled();
        await expect(page.getByText("Cartão ainda indisponível. Você pode continuar com Pix.")).toBeVisible();
      } else {
        await cardMethod.check();
        await expect(page.getByLabel("Nome no cartão")).toBeVisible();
        await expect(page.locator("#motoshop-cardNumber iframe")).toBeVisible();
        await expect(page.locator("#motoshop-expirationDate iframe")).toBeVisible();
        await expect(page.locator("#motoshop-securityCode iframe")).toBeVisible();
        await noHorizontalOverflow(page);
        await page.screenshot({ path: testInfo.outputPath("checkout-card.png"), fullPage: true, caret: "initial" });
      }
      await page.getByRole("radio", { name: "Pix", exact: true }).check();
      await expect(page.locator("#motoshop-cardNumber")).toHaveCount(0);
    }
    // No payment button is pressed: the checkout service is tested separately with an injected fake.
  } finally {
    testInfo.setTimeout(testInfo.timeout + 30_000);
    await admin.close();
    const users = await testDb.user.findMany({
      where: { email: { in: [sellerEmail, adminEmail] } },
      select: { id: true },
    });
    const store = await testDb.store.findUnique({ where: { slug }, select: { sellerId: true } });
    await cleanupFixtures({
      sellerIds: store ? [store.sellerId] : [],
      userIds: users.map((u) => u.id),
      emails: [sellerEmail, adminEmail],
    });
  }
});

test("public landing, keyboard filters and empty results remain usable", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h1")).toBeVisible();
  await noHorizontalOverflow(page);
  await page.goto("/products?q=no-matching-product-9e87a4");
  const toggle = page.getByText("Categoria, preço e outros filtros", { exact: true });
  await toggle.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Preço mínimo (R$)")).toBeVisible();
  await expect(page.getByText(/Nenhum produto encontrado/)).toBeVisible();
  await noHorizontalOverflow(page);
});
