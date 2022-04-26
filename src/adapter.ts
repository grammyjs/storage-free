const rootUrl = "https://grammy-free-session.deno.dev";

class Storage<T> {
  private jwt: string | undefined;
  constructor(private readonly token: string) {}

  async login() {
    const url = `${rootUrl}/login`;
    const body = JSON.stringify({ token: this.token });
    const response = await fetch(url, { method: "POST", body });
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
  ): Promise<T> {
    // perform request
    const url = `${rootUrl}/session/${key}`;
    if (this.jwt === undefined) await this.login();
    const headers = { "Authorization": `Bearer ${this.jwt}` };
    const response = await fetch(url, { method, body, headers });
    // handle response
    if (response.status === 401) {
      // token was revoked, must login again
      this.jwt = undefined;
      return await this.call(method, key, body);
    }
    if (200 <= response.status && response.status < 300) {
      // success
      return await response.json();
    } else {
      // error
      throw new Error(`${response.status}: ${await response.text()}`);
    }
  }
}

export function freeStorage<T>(token: string) {
  const storage = new Storage<T>(token);
  return {
    async read(key: string) {
      return await storage.call("GET", key);
    },
    async write(key: string, data: T) {
      await storage.call("POST", key, JSON.stringify(data));
    },
    async delete(key: string) {
      await storage.call("DELETE", key);
    },
  };
}
