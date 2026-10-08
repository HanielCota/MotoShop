export type AdminSearchParams = Promise<Record<string, string | string[] | undefined>>;

export type AdminSectionProps = { searchParams: AdminSearchParams };
