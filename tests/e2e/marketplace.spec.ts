import { randomUUID } from "node:crypto";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { cleanupFixtures, testDb } from "../support/database";
import { must, requireEnv } from "../support/must";

async function noHorizontalOverflow(page: Page) {
  const layout = await page.evaluate(() => {
    const overflowingElements = Array.from(document.querySelectorAll<HTMLElement>("body *"))
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const form = element.closest("form");
        return {
          tag: element.tagName,
          id: element.id,
          className: typeof element.className === "string" ? element.className : "",
          text: element.innerText?.slice(0, 80),
          formClassName: form?.className,
          formWidth: form ? Math.round(form.getBoundingClientRect().width) : null,
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
  expect(layout.documentWidth <= layout.viewportWidth + 1, `Horizontal overflow: ${JSON.stringify(layout)}`).toBe(true);
}

async function chooseOption(page: Page, label: string, optionName: string) {
  await page.getByRole("combobox", { name: label, exact: true }).click();
  await page.getByRole("option", { name: optionName, exact: true }).click();
}

async function checkCardFields(page: Page, testInfo: TestInfo) {
  const cardMethod = page.getByRole("radio", { name: /Cartão de crédito/ });
  if (await cardMethod.isDisabled()) {
    await expect(page.getByRole("radio", { name: "Pix", exact: true })).toBeEnabled();
    await expect(page.getByText("Cartão ainda indisponível. Você pode continuar com Pix.")).toBeVisible();
    return;
  }

  await cardMethod.check();
  await expect(page.getByLabel("Nome no cartão")).toBeVisible();
  await expect(page.locator("#motoshop-cardNumber iframe")).toBeVisible();
  await expect(page.locator("#motoshop-expirationDate iframe")).toBeVisible();
  await expect(page.locator("#motoshop-securityCode iframe")).toBeVisible();
  await noHorizontalOverflow(page);
  await page.screenshot({ path: testInfo.outputPath("checkout-card.png"), fullPage: true, caret: "initial" });
}

async function checkPaymentOptions(page: Page, testInfo: TestInfo) {
  const paymentUnavailable = page.getByRole("status").filter({ hasText: /temporariamente indisponível/ });
  if (await paymentUnavailable.count()) {
    await expect(paymentUnavailable).toBeVisible();
    await expect(page.getByRole("button", { name: "Pagamento indisponível" })).toBeDisabled();
    return;
  }

  await checkCardFields(page, testInfo);
  await page.getByRole("radio", { name: "Pix", exact: true }).check();
  await expect(page.locator("#motoshop-cardNumber")).toHaveCount(0);
}

test("store registration → approval → product → publication → catalog → cart → own shipping", async ({
  page,
  browser,
}, testInfo) => {
  const run = randomUUID().slice(0, 8);
  const sellerEmail = `e2e-seller-${run}@example.test`;
  const staffEmail = `e2e-orders-${run}@example.test`;
  const adminEmail = requireEnv("E2E_ADMIN_EMAIL");
  const password = `Test-${randomUUID()}!`;
  const staffPassword = `Staff-${randomUUID()}!`;
  const slug = `e2e-${run}`;
  const productName = `Capacete Teste ${run}`;
  const couponCode = `E2E${run.toUpperCase()}`;
  const sellerCouponCode = `SEL${run.toUpperCase()}`;
  const baseURL = must(testInfo.project.use.baseURL, "Playwright baseURL");
  const admin = await browser.newContext({ baseURL, viewport: page.viewportSize() });
  const staffRegistration = await browser.newContext({ baseURL });
  const staff = await browser.newContext({ baseURL, viewport: page.viewportSize() });
  try {
    await page.goto("/login?next=/seller");
    await page.getByRole("button", { name: "Ainda não tenho conta" }).click();
    await page.getByLabel(/^Nome\*?$/).fill("Lojista de teste");
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
    await expect(adminPage.getByRole("heading", { name: "Visão geral" })).toBeVisible();
    if ((adminPage.viewportSize()?.width ?? 1280) < 1024)
      await adminPage.locator("summary").filter({ hasText: "Navegar pelo Admin" }).click();
    await adminPage.getByRole("link", { name: "Lojistas", exact: true }).first().click();
    await expect(adminPage).toHaveURL(/\/admin\/sellers$/);
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

    const staffSignup = await staffRegistration.request.post("/api/auth/sign-up/email", {
      data: { name: "Equipe de pedidos", email: staffEmail, password: staffPassword },
      headers: { origin: String(testInfo.project.use.baseURL) },
    });
    expect(staffSignup.ok()).toBe(true);
    await testDb.user.update({ where: { email: staffEmail }, data: { emailVerified: true } });
    await page.goto("/seller/settings");
    await page.getByLabel("E-mail de uma conta existente").fill(staffEmail);
    await chooseOption(page, "Perfil", "Pedidos");
    await page.getByRole("button", { name: "Adicionar membro", exact: true }).click();
    await expect(page.getByText(`${staffEmail} foi adicionado à equipe.`, { exact: true })).toBeVisible();
    expect(
      await testDb.sellerMember.findFirst({ where: { sellerId: fixtureStore.sellerId, user: { email: staffEmail } } }),
    ).toMatchObject({ role: "ORDERS" });

    const staffPage = await staff.newPage();
    await staffPage.goto("/login?next=/seller/orders");
    await staffPage.getByLabel("E-mail", { exact: true }).fill(staffEmail);
    await staffPage.getByLabel("Senha", { exact: true }).fill(staffPassword);
    await staffPage.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(staffPage).toHaveURL(/\/seller\/orders$/);
    await expect(staffPage.getByRole("heading", { name: "Preparação e envio" })).toBeVisible();
    await staffPage.goto("/seller");
    await expect(staffPage.getByRole("heading", { name: "Equipe da loja" })).toHaveCount(0);
    await expect(staffPage.getByRole("heading", { name: "Resumo financeiro" })).toHaveCount(0);
    await staffPage.goto("/seller/products/new");
    await expect(staffPage).toHaveURL(/\/seller\/sem-permissao\?permissao=PRODUCT_CREATE$/);
    await expect(staffPage.getByRole("heading", { name: /Esta área é do dono/ })).toBeVisible();
    await expect(staffPage.getByRole("link", { name: "Voltar para a Central do Lojista" })).toHaveAttribute(
      "href",
      "/seller",
    );

    await page.goto("/seller/orders");
    await expect(page.getByRole("heading", { name: "Preparação e envio" })).toBeVisible();
    await expect(page.getByText("Ainda não há pedidos para processar.")).toBeVisible();
    await page.goto("/seller/questions");
    await expect(page.getByRole("heading", { name: "Perguntas dos clientes" })).toBeVisible();
    await expect(page.getByText("Ainda não há perguntas nos seus produtos.")).toBeVisible();
    await page.goto("/seller/shipping/integrations");
    await expect(page.getByRole("heading", { name: "Integrações de frete" })).toBeVisible();
    await page.goto("/seller/coupons");
    await page.getByLabel(/^Código do cupom\*?$/).fill(sellerCouponCode);
    await page.getByLabel(/^Desconto \(%\)\*?$/).fill("15");
    await page.getByRole("button", { name: "Criar cupom", exact: true }).click();
    await expect(page.getByText(`Cupom ${sellerCouponCode} criado.`, { exact: true })).toBeVisible();
    const temporarySellerCoupon = await testDb.coupon.findUniqueOrThrow({ where: { code: sellerCouponCode } });
    expect(temporarySellerCoupon).toMatchObject({
      ownerType: "SELLER",
      fundedBy: "SELLER",
      sellerId: fixtureStore.sellerId,
      active: true,
    });
    await page.goto(`/seller/coupons?couponQ=${sellerCouponCode}`);
    // Cards on small screens, table rows on larger ones: use whichever is visible.
    const sellerCouponRow = page.locator("li, tr").filter({ hasText: sellerCouponCode }).filter({ visible: true });
    await sellerCouponRow.getByRole("button", { name: "Desativar", exact: true }).click();
    await expect
      .poll(async () => (await testDb.coupon.findUnique({ where: { code: sellerCouponCode } }))?.active)
      .toBe(false);
    await expect
      .poll(async () =>
        testDb.auditLog.findFirst({
          where: { action: "SELLER_COUPON_DEACTIVATED", entityId: temporarySellerCoupon.id },
        }),
      )
      .not.toBeNull();
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.locator("h1")).toHaveText(/Página não encontrada/);

    await adminPage.goto("/admin/moderation");
    await expect(adminPage.getByRole("heading", { name: "Moderação pública" })).toBeVisible();
    await expect(adminPage.getByRole("navigation", { name: "Tipo de conteúdo" })).toBeVisible();
    await adminPage.goto("/admin/shipping-recovery");
    await expect(adminPage.getByRole("heading", { name: "Conferir etiquetas" })).toBeVisible();
    await adminPage.goto("/admin/outbox");
    await expect(adminPage.getByRole("heading", { name: "Eventos que precisam de atenção" })).toBeVisible();
    await adminPage.goto("/admin/coupons");
    const couponCodeField = adminPage.getByLabel(/^Código do cupom\*?$/);
    const couponPercentField = adminPage.getByLabel(/^Desconto \(%\)\*?$/);
    await couponCodeField.fill(couponCode);
    // Malformed percent passes the browser's required check and must be rejected by the server.
    await couponPercentField.fill("dez");
    await adminPage.getByRole("button", { name: "Criar cupom", exact: true }).click();
    await expect(adminPage.getByText(/Informe o percentual com até duas casas/)).toBeVisible();
    expect(await testDb.coupon.findUnique({ where: { code: couponCode } })).toBeNull();
    // A failed server validation must preserve the required code so the same form can be corrected and retried.
    await expect(couponCodeField).toHaveValue(couponCode);
    await couponPercentField.fill("10");
    await adminPage.getByRole("button", { name: "Criar cupom", exact: true }).click();
    await expect(adminPage.getByText(`Cupom ${couponCode} criado.`, { exact: true })).toBeVisible();
    const temporaryCoupon = await testDb.coupon.findUniqueOrThrow({ where: { code: couponCode } });
    expect(temporaryCoupon).toMatchObject({ ownerType: "MARKETPLACE", fundedBy: "MARKETPLACE", active: true });
    await adminPage.goto(`/admin/coupons?couponQ=${couponCode}`);
    const couponRow = adminPage.locator("li, tr").filter({ hasText: couponCode }).filter({ visible: true });
    await couponRow.getByRole("button", { name: "Desativar", exact: true }).click();
    await expect
      .poll(async () => (await testDb.coupon.findUnique({ where: { code: couponCode } }))?.active)
      .toBe(false);
    await expect
      .poll(async () =>
        testDb.auditLog.findFirst({
          where: { action: "MARKETPLACE_COUPON_DEACTIVATED", entityId: temporaryCoupon.id },
        }),
      )
      .not.toBeNull();

    await page.goto("/seller/products/new");
    await page.getByLabel(/^Nome\*?$/).fill(productName);
    await expect(page.getByLabel(/^Nome\*?$/)).toHaveAttribute("aria-required", "true");
    await page.getByLabel(/^Slug\*?$/).fill(slug);
    await page
      .getByLabel(/^Descrição\*?$/)
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
    const firstVariant = page.getByRole("group", { name: "Variação 1", exact: true });
    await firstVariant.getByLabel(/^Nome da variação\*?$/).fill("Preto / M");
    await firstVariant.getByLabel(/^SKU\*?$/).fill(`SKU-${run}`);
    await firstVariant.getByLabel(/^Preço \(R\$\)\*?$/).fill("199,90");
    await firstVariant.getByLabel(/^Estoque\*?$/).fill("5");
    await page.locator("summary").filter({ hasText: "Dados de embalagem" }).click();
    const packaging = page.locator("details").filter({ hasText: "Dados de embalagem" }).first();
    await packaging.getByLabel("Peso embalado (g)").fill("1500");
    await packaging.getByLabel("Altura da embalagem (mm)").fill("200");
    await packaging.getByLabel("Largura da embalagem (mm)").fill("250");
    await packaging.getByLabel("Comprimento da embalagem (mm)").fill("300");
    await page.locator("summary").filter({ hasText: "Embalagem desta variação" }).click();
    await page
      .locator("details")
      .filter({ hasText: "Embalagem desta variação" })
      .first()
      .getByLabel("Peso embalado (g)")
      .fill("1600");
    await page.locator("summary").filter({ hasText: "Promoção" }).first().click();
    await page.getByLabel("Preço promocional (R$)").fill("179,90");
    await page.getByLabel("Início da promoção").fill("2026-01-01T10:00");
    await page.getByLabel("Término da promoção").fill("2099-12-31T18:00");
    await noHorizontalOverflow(page);
    await page.screenshot({
      path: testInfo.outputPath("product-commercial-new.png"),
      fullPage: true,
      caret: "initial",
    });
    await page.getByRole("button", { name: "Criar rascunho" }).click();
    await expect(page).toHaveURL(/\/seller\/products\/[^/]+\/edit$/, { timeout: 45_000 });
    await expect(page.getByLabel("Preço promocional (R$)")).toHaveValue("179,90");
    await expect(page.getByLabel("Início da promoção")).toHaveValue("2026-01-01T10:00");
    await page.getByLabel("Preço promocional (R$)").fill("250,00");
    await page.getByRole("button", { name: "Salvar alterações" }).click();
    // Validated in the form: the error sits under the field and is linked to it (aria-invalid/describedby).
    await expect(page.getByText(/menor que o preço normal/)).toBeVisible();
    await expect(page.getByLabel("Preço promocional (R$)")).toHaveAttribute("aria-invalid", "true");
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
    await page.screenshot({
      path: testInfo.outputPath("product-commercial-edit.png"),
      fullPage: true,
      caret: "initial",
    });
    await page.goto(`/products?q=${run}`);
    await expect(page.getByRole("heading", { name: "0 produtos", exact: true })).toBeVisible();
    await page.goto("/seller/products");
    await page.getByRole("button", { name: "Arquivar", exact: true }).click();
    await expect.poll(async () => (await testDb.product.findUnique({ where: { slug } }))?.status).toBe("ARCHIVED");
    await page.goto("/seller/products?productStatus=ARCHIVED");
    await page.getByRole("button", { name: "Restaurar", exact: true }).click();
    await expect.poll(async () => (await testDb.product.findUnique({ where: { slug } }))?.status).toBe("DRAFT");
    await page.goto("/seller/products");
    await page.getByRole("button", { name: "Enviar para aprovação" }).click();
    await expect.poll(async () => (await testDb.product.findUnique({ where: { slug } }))?.status).toBe("SUBMITTED");
    await adminPage.goto("/admin/products");
    const fixtureProduct = await testDb.product.findUniqueOrThrow({ where: { slug } });
    await adminPage
      .getByTestId(`product-review-${fixtureProduct.id}`)
      .getByRole("button", { name: "Aprovar", exact: true })
      .click();
    await expect.poll(async () => (await testDb.product.findUnique({ where: { slug } }))?.status).toBe("APPROVED");
    await page.goto(`/seller/coupons?couponQ=${couponCode}`);
    await expect(page.getByText(couponCode, { exact: true })).toHaveCount(0);
    await page.goto(`/products?q=${run}&moto=${fitment}`);
    await expect(page.getByRole("link", { name: productName, exact: true })).toBeVisible();
    const filtersToggle = page.getByRole("button", { name: /Filtrar produtos/ });
    if (await filtersToggle.isVisible()) await filtersToggle.click();
    await page.getByLabel("Preço mínimo (R$)", { exact: true }).fill("189,00");
    await page.getByLabel("Preço máximo (R$)", { exact: true }).fill("200,00");
    await page.getByRole("button", { name: "Aplicar filtros", exact: true }).click();
    await expect(page).toHaveURL(/minPrice=18900/);
    await expect(page.getByRole("link", { name: productName, exact: true })).toBeVisible();
    await noHorizontalOverflow(page);
    await page.screenshot({ path: testInfo.outputPath("catalog.png"), fullPage: true, caret: "initial" });
    await page.goto(`/loja/${slug}`);
    await expect(page.getByRole("link", { name: productName, exact: true })).toBeVisible();
    // The store search bar sits above the products, outside the collapsible filter panel.
    const storeSearch = page.getByRole("combobox", { name: "Buscar nesta loja" });
    await storeSearch.fill("sem-correspondencia-e2e");
    await storeSearch.press("Enter");
    await expect(page.getByRole("status")).toContainText("Nenhum produto corresponde");
    await expect(storeSearch).toHaveValue("sem-correspondencia-e2e");
    await storeSearch.fill("");
    await storeSearch.press("Enter");
    await expect(page.getByRole("link", { name: productName, exact: true })).toBeVisible();
    await noHorizontalOverflow(page);
    await page.goto(`/products/${slug}`);
    await expect(page.getByRole("heading", { name: productName, level: 1 })).toBeVisible();
    await noHorizontalOverflow(page);
    await page.screenshot({ path: testInfo.outputPath("product.png"), fullPage: true, caret: "initial" });
    await page.getByRole("button", { name: /Adicionar ao carrinho/i }).click();
    await expect(page.getByRole("status").filter({ hasText: "Adicionado ao carrinho" })).toBeVisible();
    await page.goto("/cart");
    await expect(page.getByText(productName, { exact: true }).first()).toBeVisible();
    await noHorizontalOverflow(page);
    await page.goto("/seller/shipping");
    await page.getByLabel("Nome da entrega").fill("Entrega de teste");
    await page.getByLabel("CEP inicial").fill("01000-000");
    await page.getByLabel("CEP final").fill("01999-999");
    await page.getByLabel("Preço por pedido da loja (R$)").fill("15,00");
    await page.getByLabel("Prazo em dias úteis").fill("3");
    await page.getByRole("button", { name: "Criar modalidade" }).click();
    // The method name is the heading; its state is a badge next to it.
    const shippingMethod = page
      .locator("[data-slot=card]")
      .filter({ has: page.getByRole("heading", { name: "Entrega de teste", exact: true }) });
    await expect(shippingMethod.getByText("Desativada", { exact: true })).toBeVisible();
    await shippingMethod.getByRole("button", { name: "Ativar", exact: true }).click();
    await expect(shippingMethod.getByText("Ativa", { exact: true })).toBeVisible();
    await noHorizontalOverflow(page);
    await page.screenshot({ path: testInfo.outputPath("own-shipping.png"), fullPage: true, caret: "initial" });
    await page.goto("/checkout");
    await page.getByLabel("CEP", { exact: true }).fill("01001000");
    await page.getByRole("button", { name: /Calcular frete/i }).click();
    await expect(page.getByText(/Entrega de teste/).first()).toBeVisible();
    await noHorizontalOverflow(page);
    const checkoutViewport = page.viewportSize();
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      await noHorizontalOverflow(page);
      await expect(page.getByLabel("CEP", { exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: /Calcular frete/i })).toBeVisible();
    }
    if (checkoutViewport) await page.setViewportSize(checkoutViewport);
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
    await checkPaymentOptions(page, testInfo);
    // No payment button is pressed: the checkout service is tested separately with an injected fake.
  } finally {
    testInfo.setTimeout(testInfo.timeout + 30_000);
    await staff.close();
    await staffRegistration.close();
    await admin.close();
    const users = await testDb.user.findMany({
      where: { email: { in: [sellerEmail, staffEmail, adminEmail] } },
      select: { id: true },
    });
    const store = await testDb.store.findUnique({ where: { slug }, select: { sellerId: true } });
    const testCoupon = await testDb.coupon.findUnique({ where: { code: couponCode }, select: { id: true } });
    const testSellerCoupon = await testDb.coupon.findUnique({
      where: { code: sellerCouponCode },
      select: { id: true },
    });
    await cleanupFixtures({
      sellerIds: store ? [store.sellerId] : [],
      userIds: users.map((u) => u.id),
      emails: [sellerEmail, staffEmail, adminEmail],
      couponIds: [testCoupon?.id, testSellerCoupon?.id].filter((id): id is string => id !== undefined),
    });
  }
});

test("public landing, keyboard filters and empty results remain usable", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h1")).toBeVisible();
  await noHorizontalOverflow(page);
  await page.goto("/products?q=no-matching-product-9e87a4");
  // On small screens the filters start collapsed behind a button; it must open with the keyboard.
  const toggle = page.getByRole("button", { name: /Filtrar produtos/ });
  if (await toggle.isVisible()) {
    await toggle.focus();
    await page.keyboard.press("Enter");
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
  }
  await expect(page.getByLabel("Preço mínimo (R$)")).toBeVisible();
  await expect(page.getByText(/Nenhum produto encontrado/)).toBeVisible();
  await noHorizontalOverflow(page);
});
