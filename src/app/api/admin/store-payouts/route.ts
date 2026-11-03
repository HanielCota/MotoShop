import { NextResponse } from "next/server";

import { MARKETPLACE_TIME_ZONE } from "@/lib/format";
import { logger } from "@/lib/logger";
import { getAdminSession } from "@/modules/auth/application/authorization";
import { storePayoutsCsv } from "@/modules/admin/domain/store-payouts-csv";
import { lastDayOf, resolveSalesDateRange, type SalesDateRange } from "@/modules/admin/queries/sales-period";
import { getStorePayoutReport } from "@/modules/admin/queries/store-payouts";
import { loadAdminSalesSearchParams } from "@/modules/admin/search-params";

// Money of every store: never cached or shared between people.
const privateHeaders = { "Cache-Control": "private, no-store" };

const isoDayFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: MARKETPLACE_TIME_ZONE });

/** São Paulo calendar days of the range, for the file name: repasse-lojas-2026-06-01-a-2026-10-31.csv. */
function fileNameFor(range: SalesDateRange) {
  return `repasse-lojas-${isoDayFormatter.format(range.start)}-a-${isoDayFormatter.format(lastDayOf(range))}.csv`;
}

/** The Admin payout list of the sales period in the URL, as a spreadsheet. Anyone but an admin gets a 404. */
export async function GET(request: Request): Promise<Response> {
  const session = await getAdminSession();
  if (session == null) return new NextResponse(null, { status: 404, headers: privateHeaders });

  const params = loadAdminSalesSearchParams(request);
  const range = resolveSalesDateRange({ period: params.salesPeriod, from: params.salesFrom, to: params.salesTo });
  if (range == null) {
    return NextResponse.json({ error: "Escolha a data inicial e a final." }, { status: 400, headers: privateHeaders });
  }

  try {
    const csv = storePayoutsCsv(await getStorePayoutReport(range));
    logger.info({ event: "admin.store_payouts.downloaded", adminUserId: session.user.id });

    return new Response(csv, {
      headers: {
        ...privateHeaders,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileNameFor(range)}"`,
      },
    });
  } catch (error) {
    logger.error({ event: "admin.store_payouts.failed", error });
    return NextResponse.json({ error: "Não foi possível gerar a planilha." }, { status: 500, headers: privateHeaders });
  }
}
