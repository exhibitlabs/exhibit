// The Next app has no mail sender. On the live website, POST /api/contact is answered by the static site's
// Worker (deploy/site/worker.ts), which emails the founders. Here it answers 501, and the contact form falls
// back to opening the visitor's email app with the message written, or copying it.
export function POST() {
  return Response.json({ ok: false, error: "not_available", message: "This copy of Exhibit can't send email. Your email app can." }, { status: 501, headers: { "cache-control": "no-store" } });
}
