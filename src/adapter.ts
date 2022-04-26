class Storage {
  private jwt: string | undefined;
  constructor(
    private readonly token: string,
    private readonly rootUrl = "https://grammy-free-session.deno.dev",
  ) {}

  async login() {
    const url = `${this.rootUrl}/login`;
    const body = JSON.stringify({ token: this.token });
    const response = await retryFetch(url, { method: "POST", body });
    const { token } = await response.json();
    if (typeof token !== "string") {
      throw new Error("Cannot use free session, invalid bot token!");
    }
    this.jwt = token;
  }

  async call(
    method: "GET" | "POST" | "DELETE",
    key: string,
    body?: string,
  ): Promise<string | undefined> {
    // perform request
    const url = `${this.rootUrl}/session/${key}`;
    if (this.jwt === undefined) await this.login();
    const headers = { "Authorization": `Bearer ${this.jwt}` };
    const response = await retryFetch(url, { method, body, headers });
    // handle response
    if (response.status === 401) {
      // token was revoked, must login again
      this.jwt = undefined;
      return await this.call(method, key, body);
    } else if (response.status === 404) {
      // empty session
      return undefined;
    } else if (200 <= response.status && response.status < 300) {
      // success
      return method === "GET" ? await response.text() : undefined;
    } else {
      // error
      throw new Error(`${response.status}: ${(await response.json()).error}`);
    }
  }
}

export function freeStorage<T>(token: string, opts?: { rootUrl?: string }) {
  const storage = new Storage(token, opts?.rootUrl);
  return {
    async read(key: string): Promise<T> {
      const session = await storage.call("GET", key);
      return session === undefined ? undefined : JSON.parse(session);
    },
    async write(key: string, data: T) {
      await storage.call("POST", key, JSON.stringify(data));
    },
    async delete(key: string) {
      await storage.call("DELETE", key);
    },
  };
}

async function retryFetch(
  ...args: Parameters<typeof fetch>
): ReturnType<typeof fetch> {
  let res: Awaited<ReturnType<typeof fetch>>;
  do {
    res = await fetch(...args);
    if (res.status >= 500) {
      console.error(`${res.status} in free session service, retrying!`);
    }
  } while (res.status >= 500);
  return res;
}
