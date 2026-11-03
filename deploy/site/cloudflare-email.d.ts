// The one Workers runtime module the site's Worker uses, typed by hand instead of adding @cloudflare/workers-types.
// https://developers.cloudflare.com/email-routing/email-workers/send-email-workers/
declare module "cloudflare:email" {
  export class EmailMessage {
    constructor(from: string, to: string, raw: ReadableStream | string);
    readonly from: string;
    readonly to: string;
  }
}
