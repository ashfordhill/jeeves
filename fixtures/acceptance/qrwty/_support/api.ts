/**
 * Minimal authenticated client for the qrwty fixed acceptance suites.
 *
 * The service requires an exact Origin on register/login and every mutation, plus the CSRF token
 * returned by the session. The browser sends those itself; these Node suites do it explicitly.
 */

export const serviceUrl = process.env.JEEVES_TEST_URL ?? "";
export const publicOrigin = process.env.JEEVES_TEST_PUBLIC_ORIGIN ?? "";

export type Response = {
  status: number;
  body: unknown;
  headers: Headers;
};

export class Client {
  cookie = "";
  csrfToken = "";
  email = "";
  password = "";
  readonly base: string;
  readonly origin: string;

  constructor(base = serviceUrl, origin = publicOrigin) {
    this.base = base;
    this.origin = origin;
  }

  static async register(base = serviceUrl, origin = publicOrigin): Promise<Client> {
    const client = new Client(base, origin);
    client.email = uniqueEmail();
    client.password = "qrwty-fixed-password";
    const response = await client.post("/auth/register", {
      email: client.email,
      password: client.password,
    });
    if (response.status !== 201)
      throw new Error(`register failed: ${response.status} ${JSON.stringify(response.body)}`);
    return client;
  }

  static async login(email: string, password: string, base = serviceUrl): Promise<Client> {
    const client = new Client(base);
    client.email = email;
    client.password = password;
    const response = await client.post("/auth/login", { email, password });
    if (response.status !== 200)
      throw new Error(`login failed: ${response.status} ${JSON.stringify(response.body)}`);
    return client;
  }

  async request(
    method: string,
    path: string,
    options: { body?: unknown; csrf?: boolean; redirect?: RequestRedirect } = {},
  ): Promise<Response> {
    const headers: Record<string, string> = {};
    if (options.body !== undefined) headers["content-type"] = "application/json";
    if (this.cookie) headers.cookie = this.cookie;
    if (options.csrf !== false) headers.origin = this.origin;
    if (options.csrf !== false && this.csrfToken) headers["x-csrf-token"] = this.csrfToken;
    const response = await fetch(`${this.base}${path}`, {
      method,
      headers,
      ...(options.body !== undefined && { body: JSON.stringify(options.body) }),
      redirect: options.redirect ?? "follow",
    });
    const text = await response.text();
    let body: unknown = text;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      // Binary or non-JSON response; callers read the bytes from the response itself.
    }
    this.remember(response, body);
    return { status: response.status, body, headers: response.headers };
  }

  get(path: string, options?: { redirect?: RequestRedirect }) {
    return this.request("GET", path, options);
  }

  post(path: string, body: unknown) {
    return this.request("POST", path, { body });
  }

  patch(path: string, body: unknown) {
    return this.request("PATCH", path, { body });
  }

  logout() {
    return this.request("POST", "/auth/logout");
  }

  createQr(destination: string, title?: string) {
    return this.post("/api/qr", { destination, ...(title === undefined ? {} : { title }) });
  }

  updateQr(id: string, destination: string, title?: string | null) {
    return this.patch(`/api/qr/${id}`, {
      destination,
      ...(title === undefined ? {} : { title }),
    });
  }

  image(id: string) {
    return fetch(`${this.base}/api/qr/${id}/image`, {
      headers: this.cookie ? { cookie: this.cookie } : {},
    });
  }

  activity(id: string, from: string, to: string) {
    return this.get(
      `/api/qr/${id}/activity?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    );
  }

  private remember(response: globalThis.Response, body: unknown) {
    const cookies = response.headers.getSetCookie?.() ?? [];
    const session = cookies.find((cookie) => cookie.trim().startsWith("jeeves_session="));
    if (session) {
      const value = session.trim().split(";")[0];
      this.cookie = value === "jeeves_session=" ? "" : value;
    }
    if (body && typeof body === "object" && "csrfToken" in body)
      this.csrfToken = String((body as { csrfToken: unknown }).csrfToken);
  }
}

export function uniqueEmail(): string {
  return `qrwty-${crypto.randomUUID()}@example.test`;
}

export function assertStatus(response: { status: number; body?: unknown }, status: number): void {
  if (response.status !== status)
    throw new Error(`expected ${status}, got ${response.status}: ${JSON.stringify(response.body)}`);
}

export function today(): string {
  // Computed once per test. A run that crosses 00:00 UTC can flake, so treat this as a known limit.
  return new Date().toISOString().slice(0, 10);
}

export function daysFrom(start: string, count: number): string[] {
  const date = new Date(`${start}T00:00:00Z`);
  return Array.from({ length: count }, (_, index) => {
    const day = new Date(date);
    day.setUTCDate(date.getUTCDate() + index);
    return day.toISOString().slice(0, 10);
  });
}
