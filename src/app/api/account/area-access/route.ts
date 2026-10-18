import { NextResponse } from "next/server";

import { logger } from "@/lib/logger";
import { getCurrentSession } from "@/modules/auth/application/authorization";
import { getAccountAreaAccess } from "@/modules/auth/application/get-account-area-access";
import { noAccountAreaAccess } from "@/modules/auth/domain/account-area-shortcuts";

// The answer depends on who is signed in, so it is never cached or shared.
const privateHeaders = { "Cache-Control": "private, no-store" };

/**
 * Which restricted areas the signed-in person can open, for the header account menu. The root layout
 * stays static, so the menu asks after the page loads. Each area still checks access on entry.
 */
export async function GET() {
  try {
    const session = await getCurrentSession();
    if (!session) return NextResponse.json(noAccountAreaAccess, { headers: privateHeaders });

    const access = await getAccountAreaAccess(session.user);
    return NextResponse.json(access, { headers: privateHeaders });
  } catch (error) {
    logger.error({ event: "account.area_access.failed", error });
    return NextResponse.json(noAccountAreaAccess, { status: 500, headers: privateHeaders });
  }
}
