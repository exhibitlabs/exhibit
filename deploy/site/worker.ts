// The static site's Worker. It answers one route itself, POST /api/contact (the contact form, see contact.ts),
// and passes every other request to the static assets, so pages, the 404 page, _headers and _redirects work
// exactly as before. Static files that match a request are served without running this code at all.
import { EmailMessage } from "cloudflare:email";
import { fail, handleContact } from "./contact";

type Env = {
  ASSETS: { fetch(request: Request): Promise<Response> };
  SEND_EMAIL: { send(message: EmailMessage): Promise<void> };
  /** Set with `wrangler secret put TURNSTILE_SECRET`; never in code or config. */
  TURNSTILE_SECRET?: string;
};

const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname !== "/api/contact" || request.method !== "POST") return env.ASSETS.fetch(request);
    try {
      return await handleContact(request, {
        secret: env.TURNSTILE_SECRET,
        send: ({ from, to, raw }) => env.SEND_EMAIL.send(new EmailMessage(from, to, raw)),
      });
    } catch (e) {
      console.error("contact: unexpected error:", e instanceof Error ? e.message : String(e));
      return fail("server_error");
    }
  },
};

export default worker;
