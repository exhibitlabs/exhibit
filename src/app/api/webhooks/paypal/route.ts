import { runAgent } from "@/lib/agent/run";
import { paypalCredentials, paypalMode } from "@/lib/config";
import { logActivity } from "@/lib/db";
import { refreshDispute } from "@/lib/disputes";
import { paypal } from "@/lib/paypal/client";

type WebhookEvent = { id: string; event_type: string; resource?: { dispute_id?: string } & Record<string, unknown> };

/**
 * PayPal webhook listener. Subscribe the app to CUSTOMER.DISPUTE.CREATED, .UPDATED and .RESOLVED.
 * Signatures are verified with PayPal's verify-webhook-signature API before anything runs.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  const event = (() => {
    try {
      return JSON.parse(raw) as Partial<WebhookEvent> | null;
    } catch {
      return null;
    }
  })();
  if (!event || typeof event.event_type !== "string") return Response.json({ error: "Send a PayPal webhook event." }, { status: 400 });
  if (paypalMode() === "sandbox") {
    const { webhookId } = paypalCredentials();
    if (!webhookId) return Response.json({ error: "PAYPAL_WEBHOOK_ID is not set" }, { status: 500 });
    const h = (k: string) => req.headers.get(k) ?? "";
    const verdict = await paypal().verifyWebhookSignature({
      auth_algo: h("paypal-auth-algo"),
      cert_url: h("paypal-cert-url"),
      transmission_id: h("paypal-transmission-id"),
      transmission_sig: h("paypal-transmission-sig"),
      transmission_time: h("paypal-transmission-time"),
      webhook_id: webhookId,
      webhook_event: event as WebhookEvent,
    });
    if (verdict.verification_status !== "SUCCESS") {
      logActivity("webhook", `Rejected webhook ${event.id}: signature verification failed`);
      return Response.json({ error: "signature verification failed" }, { status: 400 });
    }
  }
  const disputeId = event.resource?.dispute_id;
  logActivity("webhook", `${event.event_type} ${disputeId ?? ""}`.trim(), disputeId, { id: event.id });
  if (disputeId && event.event_type.startsWith("CUSTOMER.DISPUTE.")) {
    await refreshDispute(disputeId);
    // New cases are investigated immediately; the webhook is acknowledged without waiting.
    if (event.event_type === "CUSTOMER.DISPUTE.CREATED") void runAgent(disputeId, undefined, { trigger: "webhook" });
  }
  return Response.json({ received: true });
}
