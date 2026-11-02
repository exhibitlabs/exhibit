# Demo video v4: script and voiceover

- Render: `docs/exhibit-demo-v4.mp4`, 1920×1080, 2:52.6, H.264 + AAC, captions synced to the voice. (v3 stays at `docs/exhibit-demo-v3.mp4`.)
- Voice: Kokoro-82M `af_heart`, generated locally with `npx hyperframes tts` (Apache-2.0 model; no credits, no attribution requirement). The voiceover was regenerated for this script, in the same voice as v2 and v3.
- Source project: `~/Developer/exhibit-video/exhibit-demo-v4` (`timeline.json` → `tools/build_v4.py` → `index.html`). Recorders: `tools/rec/demo4.js` (demo merchant), `tools/rec/sandbox4.js` and `sandbox4-activity.js` (PayPal sandbox). Set `REC_OUT` to an output folder. The clips used live in the project's `assets/footage`.
- Brand: the square mark on the title card (black plate) and close card (inverse, white plate), with the gold arm sliding out of the stem (0.6 s).

## What's live and what's demo

Every footage segment carries a chip:

- **PayPal Sandbox · live API** (green): the live run on PP-R-EGO-10193744 (Daniel Reyes, $420 unauthorized chargeback), re-recorded for v4 so the app chrome matches. Claude (local login) took 36 s and called Fight at 88%, citing exhibits A–F. The packet card uses pages rendered from this run's PDF (response letter, Exhibit A). The audit-trail shot is the sandbox PayPal activity page. It shows the real `provide-supporting-info` calls from when this case was filed in an earlier session. Nothing was filed, refunded or approved on the sandbox while recording v4. The refund case (PP-R-KHB-10193747, Jordan Kim) is a read-only view of an earlier live investigation.
- **Demo merchant · PayPal simulator** (amber): Kora Atelier on `:3101`, recorded after a demo reset and replay-agent runs on all 8 open cases. The command center carries the app's own "Demo merchant · 90-day history" chip. Prevention fixes Lena Hoffmann's order (KA-10561) with the drafted German message. The approval beat approves a pending "Claude Code" request on PP-D-50211, which files only in the simulator. That request was recreated after the reset through `POST /api/approvals`, with the same client and note as the real MCP run.
- **Demo merchant · offline answers** (amber): Ask Exhibit on `:3101` runs its offline answer engine. The palette footer says so ("Offline answers · add a Claude key for open questions").
- **MCP transcript card**: the lines come from the real run recorded in `docs/MCP_DEMO.md` (Claude via the Agent SDK, with only the Exhibit MCP server attached). Some are shortened: the `investigate_dispute` calls are shown as "× 7", and the returned JSON is trimmed to `status`, `action` and `moves_money`.
- Every speed-up is labelled with its rate (1.25× to 4×). The 25 s of agent reasoning in the live run plays at 4×. Everything else plays at 1×.

## Script

| Time | Scene | Voiceover | On screen |
|---|---|---|---|
| 0:00.7–0:04.4 | Cold open (title) | Every day, small merchants lose PayPal disputes they should have won. | Logo with the arm slide |
| 0:05.3–0:23.5 | Problem | Mastercard expected two hundred and sixty-one million chargebacks worldwide in 2025. The evidence usually exists. A signed delivery scan, a policy the buyer accepted. But it's scattered across PayPal, the store, the carrier and the inbox, and the deadline arrives first. | Card: 261M / 4 / 1 |
| 0:24.1–0:29.2 | Meet Exhibit | This is Exhibit. An AI agent that works every PayPal dispute for the merchant. | Card |
| 0:29.6–0:41.1 | Command center (demo) | Here's a demo merchant's last ninety days. Seven thousand dollars recovered, eight cases waiting on a decision, and the dispute rate, tracked against Visa and Mastercard's monitoring lines. | `/app`: "$7,374 recovered. 8 cases need you." KPIs count up, Needs-you grid, recovered vs. given back. Scrolls to outcomes by reason and dispute-rate health (0.60%, zoomed) |
| 0:41.7–1:02.0 | Prevention (demo) | Better still, stop disputes before they're filed. Exhibit scores recent orders for the signals that come before a claim. Lena, in Germany, says she'll open a PayPal case if she doesn't hear back, and her tracking hasn't moved in five days. Exhibit drafts the reply in German. One click sends it, before there's a claim to fight. | `/app/protection`: $4,497 at risk, radar, at-risk list. Lena Hoffmann's drawer (Buyer waiting quote, Tracking stalled), German draft, then Message buyer: "Dispute prevented · $394 saved" and the row leaves |
| 1:03.1–1:22.8 | Live investigation (sandbox) | Now a real chargeback, live in PayPal's sandbox. Daniel's card issuer says a four hundred and twenty dollar briefcase was unauthorized. One click, and Exhibit pulls the case from PayPal's Disputes API, then the order, the delivery scans, the checkout signals, and PayPal's own Seller Protection flag. | Sandbox Disputes list, then the case. Re-run at 1:12.2. The dispute node queries PayPal at about 1:14.8 and the store sources fill in through 1:19.7 |
| 1:23.3–1:37.7 | The call (sandbox) | Thirty-six seconds after the click, it makes the call. Fight. The card passed three-D Secure, the briefcase was signed for at his address, and he wrote to the store the next day to say it's beautiful. Every reason links back to a real record. | 88% ring and Fight at 1:26.2. Node clicks: Checkout signals (1:28.5), Delivery (1:30.8), Buyer messages (1:33.2). Then a scroll to the brief and packet |
| 1:38.2–1:52.9 | Packet and audit trail (sandbox) | It builds a reviewer-ready packet. A cover letter and labelled exhibits, from the merchant's own records. The AI chooses the evidence. It can't invent it. Filing is a single PayPal API call, and every call is on the record. | Evidence packet list A–F, the packet card (letter and Exhibit A from this run), then the sandbox PayPal activity API surface with `provide-supporting-info` |
| 1:53.8–2:02.3 | Honest call (sandbox) | And it doesn't fight everything. This wallet came back to the store undelivered, so Exhibit's call is to refund, not to fight a case it can't win. | PP-R-KHB-10193747: red graph, Delivery "returned to sender", Refund brief |
| 2:03.2–2:19.3 | Ask Exhibit ⌘K (demo, offline answers) | Ask Exhibit answers questions about the whole dispute book. Why are we losing item-not-received cases? It checks the records first. Mostly, we aren't. Three quarters of those dollars came back, and most of the rest went out as refunds, not lost fights. | ⌘K, the question typed, four tool steps, the streamed answer ("you keep 74% of disputed dollars"), the donut chart |
| 2:19.8–2:37.0 | MCP and approvals | Exhibit is also an MCP server, so other agents can use it. Here, Claude triages the open disputes and picks the strongest case. But an agent can only ask. The merchant sees the request on the case, approves it, and only then does Exhibit file with PayPal. | Transcript card from `docs/MCP_DEMO.md`. Then PP-D-50211 with the banner "An AI agent (Claude Code) requests: File evidence with PayPal". Approve at 2:34.4, then "Approved. Evidence filed with PayPal" |
| 2:38.9–2:47.3 | Trust | Cited, never invented. Only the actions PayPal allows. And nothing an outside agent asks for happens until the merchant approves. | Card: Cited, never invented · Agents request, merchants approve · Only actions PayPal allows · Honest by design |
| 2:48.3–2:51.1 | Close | Exhibit. Every dispute, answered with evidence. | Inverse logo with the arm slide |

Words: 423. Voiceover: 160.7 s of 172.6 s.

## Re-recording

1. Reset the demo merchant: `curl -X POST localhost:3101/api/demo -H 'Content-Type: application/json' -d '{"op":"reset"}'`.
2. Run the agent on every open case: `POST /api/disputes/<id>/run` for each id.
3. Recreate the approval: `POST /api/approvals` with `{"kind":"dispute_action","disputeId":"PP-D-50211","client":"Claude Code","note":"…"}`.
4. `REC_OUT=/tmp/v4rec node demo4.js d-cc d-prevent d-ask` first, then `d-approve`. Approving changes the case, so record it last.
5. `REC_OUT=/tmp/v4rec node sandbox4.js s-inbox s-refund s-run` and `node sandbox4-activity.js`. On `:3100` these only run investigations; they never file, refund or approve.
