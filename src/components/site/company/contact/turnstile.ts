// Cloudflare Turnstile for the contact form, in the browser. The script loads only when someone starts filling
// in the form, the widget stays invisible unless Cloudflare needs a click, and each token is handed out once.
// https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/

/** The public site key. Without one (local development, the full app) Cloudflare's always-passing test key. */
export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "1x00000000000000000000AA";

// Must be loaded from this exact address; Cloudflare warns that a proxied or cached copy breaks.
const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

type Api = {
  render(el: HTMLElement, options: Record<string, unknown>): string | null | undefined;
  reset(id: string): void;
  remove(id: string): void;
};

declare global {
  interface Window {
    turnstile?: Api;
  }
}

let loading: Promise<Api> | null = null;

function load(): Promise<Api> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  loading ??= new Promise<Api>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT;
    s.async = true;
    s.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("Turnstile didn't start")));
    s.onerror = () => {
      loading = null;
      s.remove();
      reject(new Error("Turnstile couldn't load"));
    };
    document.head.appendChild(s);
  });
  return loading;
}

/** "blocked": the script didn't load (offline, or a blocker). "failed": Cloudflare's check errored. "timeout": no answer in time. */
export type TurnstileProblem = "blocked" | "failed" | "timeout";
type Outcome = { token: string } | { problem: TurnstileProblem };

/** One widget for one form. start() renders it; take() waits for a token and uses it up; reset() asks for a new one. */
export class TurnstileGate {
  private api: Api | null = null;
  private id: string | null = null;
  private token: string | null = null;
  private problem: TurnstileProblem | null = null;
  private waiting: ((o: Outcome) => void)[] = [];
  private started: Promise<void> | null = null;
  private interactive = false;

  constructor(
    private readonly box: HTMLElement,
    /** Called with true when Cloudflare needs the visitor to tick the box, and false once they have. */
    private readonly onInteractive: (needed: boolean) => void,
  ) {}

  start(): Promise<void> {
    this.started ??= load().then(
      (api) => {
        this.api = api;
        try {
          this.id =
            api.render(this.box, {
              sitekey: TURNSTILE_SITE_KEY,
              action: "contact",
              appearance: "interaction-only",
              size: "flexible",
              theme: "light",
              "response-field": false,
              "refresh-expired": "auto",
              callback: (token: string) => this.settle({ token }),
              "error-callback": () => {
                this.settle({ problem: "failed" });
                return true; // handled here; Turnstile keeps retrying on its own
              },
              "expired-callback": () => {
                this.token = null;
              },
              "timeout-callback": () => {
                this.token = null;
              },
              "unsupported-callback": () => this.settle({ problem: "failed" }),
              "before-interactive-callback": () => this.setInteractive(true),
              "after-interactive-callback": () => this.setInteractive(false),
            }) ?? null;
        } catch {
          this.settle({ problem: "failed" });
        }
      },
      () => this.settle({ problem: "blocked" }),
    );
    return this.started;
  }

  private setInteractive(needed: boolean) {
    this.interactive = needed;
    this.onInteractive(needed);
  }

  private settle(o: Outcome) {
    if ("token" in o) {
      this.problem = null;
      const next = this.waiting.shift();
      if (next) next(o);
      else this.token = o.token;
    } else {
      this.problem = o.problem;
      for (const w of this.waiting.splice(0)) w(o);
    }
  }

  /** The next unused token, waiting up to `ms` for Cloudflare (longer while the visitor is ticking the box). */
  async take(ms: number): Promise<Outcome> {
    void this.start();
    if (this.token) {
      const token = this.token;
      this.token = null;
      return { token };
    }
    if (this.problem) return { problem: this.problem };
    return new Promise<Outcome>((resolve) => {
      let timer = 0;
      const done = (o: Outcome) => {
        window.clearTimeout(timer);
        resolve(o);
      };
      // While Cloudflare is showing the box, the visitor is the one we're waiting for: keep waiting.
      const arm = () =>
        window.setTimeout(() => {
          if (this.interactive) {
            timer = arm();
            return;
          }
          this.waiting = this.waiting.filter((w) => w !== done);
          resolve({ problem: "timeout" });
        }, ms);
      timer = arm();
      this.waiting.push(done);
    });
  }

  /** Tokens work once: after any attempt to send, ask Cloudflare for a fresh one. */
  reset() {
    this.token = null;
    this.problem = null;
    if (this.api && this.id) this.api.reset(this.id);
    else if (!this.id) this.started = null; // never rendered (the script failed): try loading again
  }

  destroy() {
    if (this.api && this.id) this.api.remove(this.id);
    this.id = null;
    for (const w of this.waiting.splice(0)) w({ problem: "failed" });
  }
}
