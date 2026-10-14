/**
 * M-02 (Sentry part): URLs can carry secrets, such as the guest order `accessToken` and the
 * password reset `token`, and Sentry records URLs in errors, transactions, spans and breadcrumbs.
 * These hooks filter the values before anything leaves the app; cookies and authorization
 * headers are dropped. Shared by the browser, server and edge configs.
 */
const SECRET_QUERY_PARAMETERS = new Set(["accesstoken", "token", "code", "state", "secret", "password"]);
const SECRET_HEADERS = new Set(["cookie", "authorization", "x-signature", "set-cookie"]);
const URL_FIELDS = ["url", "from", "to", "http.url", "url.full", "http.target", "http.query"];
export const FILTERED = "[Filtered]";

type Data = Record<string, unknown>;

/** Replaces secret query values in an absolute or relative URL, keeping everything else. */
export function scrubUrl(value: string): string {
  const questionMark = value.indexOf("?");
  if (questionMark < 0) return value;

  const hashIndex = value.indexOf("#", questionMark);
  const query = value.slice(questionMark + 1, hashIndex < 0 ? undefined : hashIndex);
  const parameters = new URLSearchParams(query);
  for (const key of [...parameters.keys()])
    if (SECRET_QUERY_PARAMETERS.has(key.toLowerCase())) parameters.set(key, FILTERED);

  const hash = hashIndex < 0 ? "" : value.slice(hashIndex);
  return `${value.slice(0, questionMark)}?${parameters.toString()}${hash}`;
}

function scrubQueryString(value: unknown): unknown {
  if (typeof value === "string") return scrubUrl(`?${value}`).slice(1);
  return value;
}

function scrubUrlFields(data: Data | undefined): void {
  if (!data) return;
  for (const field of URL_FIELDS) {
    const value = data[field];
    if (typeof value === "string") data[field] = field === "http.query" ? scrubQueryString(value) : scrubUrl(value);
  }
}

function scrubHeaders(headers: unknown): void {
  if (!headers || typeof headers !== "object") return;
  for (const key of Object.keys(headers)) if (SECRET_HEADERS.has(key.toLowerCase())) delete (headers as Data)[key];
}

type ScrubbableEvent = {
  request?: { url?: string; query_string?: unknown; headers?: unknown; cookies?: unknown } | undefined;
  breadcrumbs?: Array<{ data?: Data | undefined }> | undefined;
  spans?: Array<{ data?: Data | undefined }> | undefined;
  contexts?: { trace?: { data?: Data | undefined } | undefined } | undefined;
};

/** Used as beforeSend and beforeSendTransaction. */
export function scrubSentryEvent<Event extends ScrubbableEvent>(event: Event): Event {
  const request = event.request;
  if (request) {
    if (request.url) request.url = scrubUrl(request.url);
    request.query_string = scrubQueryString(request.query_string);
    scrubHeaders(request.headers);
    delete request.cookies;
  }
  for (const breadcrumb of event.breadcrumbs ?? []) scrubUrlFields(breadcrumb.data);
  for (const span of event.spans ?? []) scrubUrlFields(span.data);
  scrubUrlFields(event.contexts?.trace?.data);
  return event;
}

/** Used as beforeBreadcrumb: navigation and fetch breadcrumbs keep their URLs without secrets. */
export function scrubSentryBreadcrumb<Breadcrumb extends { data?: Data | undefined }>(
  breadcrumb: Breadcrumb,
): Breadcrumb {
  scrubUrlFields(breadcrumb.data);
  return breadcrumb;
}

export const sentryPrivacyOptions = {
  sendDefaultPii: false,
  beforeSend: scrubSentryEvent,
  beforeSendTransaction: scrubSentryEvent,
  beforeBreadcrumb: scrubSentryBreadcrumb,
};
