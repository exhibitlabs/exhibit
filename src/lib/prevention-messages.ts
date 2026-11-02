// Buyer messages for the Prevention radar. Before a dispute exists PayPal has no messaging API,
// so these go out through the merchant's own support inbox. Every template is written per
// language (not machine-translated at send time) so the no-key demo works; English is the fallback.

export type MessageSituation =
  | "stalled"
  | "exception"
  | "delivered_not_found"
  | "not_as_expected"
  | "redirected"
  | "receipt_check"
  | "refund_issued"
  | "verify"
  | "general";

export type MessageContext = {
  first: string;
  orderId: string;
  item: string;
  qty: number;
  carrier: string;
  tracking: string;
  shippedAt?: string;
  lastScanAt?: string;
  lastScanLocation?: string;
  lastScanDescription?: string;
  customs: boolean;
  deliveredAt?: string;
  deliveredTo?: string;
  shipTo: string;
  amount?: string;
  refundId?: string;
  returnAt?: string;
  /** The buyer wrote first; open by acknowledging their message. */
  replying: boolean;
  merchant: string;
  merchantEmail: string;
};

export type MessageDraft = {
  situation: MessageSituation;
  language: string;
  languageName: string;
  subject: string;
  body: string;
  /** English version for the merchant when the buyer's language is not English. */
  translation?: { subject: string; body: string };
};

const LANG_NAME: Record<string, string> = { en: "English", de: "German", fr: "French", it: "Italian", es: "Spanish" };
const LOCALE: Record<string, string> = { en: "en-US", de: "de-DE", fr: "fr-FR", it: "it-IT", es: "es-ES" };

type T = { subject: string; body: string };
type Template = (c: MessageContext, d: (iso?: string, plusDays?: number) => string) => T;

const sign = (c: MessageContext, close: string) => `${close}\n${c.merchant} · ${c.merchantEmail}`;

const EN: Record<MessageSituation, Template> = {
  stalled: (c, d) => ({
    subject: `An update on your order ${c.orderId}`,
    body: [
      `Hi ${c.first},`,
      `${c.replying ? "Thanks for your message, and I'm sorry for the wait. " : ""}Your ${c.item} left our Brooklyn studio on ${d(c.shippedAt)} with ${c.carrier} (tracking ${c.tracking}). The last scan was in ${c.lastScanLocation} on ${d(c.lastScanAt)} and it hasn't moved since, so we opened a trace with ${c.carrier} today.${c.customs ? " The parcel is in customs clearance, which sometimes takes a few extra days." : ""}`,
      `We'll write again within 48 hours with what they find. If it isn't moving by ${d(undefined, 5)}, we'll send a replacement by express or refund you in full, whichever you prefer. You don't need to do anything.`,
      sign(c, "Thank you for your patience,"),
    ].join("\n\n"),
  }),
  exception: (c, d) => ({
    subject: `Your order ${c.orderId}: ${c.carrier} needs your address details`,
    body: [
      `Hi ${c.first},`,
      `${c.carrier} tried to deliver your ${c.item} on ${d(c.lastScanAt)} but marked the address as incomplete, so the parcel is being held at their depot in ${c.lastScanLocation}.`,
      `Could you reply with your full address (apartment number, door code, the name on the mailbox) and a phone number? We'll pass it to ${c.carrier} today and book a new delivery.`,
      sign(c, "Best regards,"),
    ].join("\n\n"),
  }),
  delivered_not_found: (c, d) => ({
    subject: `Re: your order ${c.orderId}`,
    body: [
      `Hi ${c.first},`,
      `I'm sorry, that's stressful. ${c.carrier} recorded the delivery on ${d(c.deliveredAt)} as "${c.lastScanDescription}". Parcels marked delivered often turn up within 48 hours, so it's worth checking around the property, with neighbours or a building mailroom.`,
      `We've opened a missing-parcel request with ${c.carrier} today. If it hasn't turned up by ${d(undefined, 3)}, reply here and we'll ship a replacement or refund you. There's no need to file a claim; we'll sort it out directly.`,
      sign(c, "Thanks for your patience,"),
    ].join("\n\n"),
  }),
  not_as_expected: (c) => ({
    subject: `Re: your ${c.item}`,
    body: [
      `Hi ${c.first},`,
      `Thanks for telling us. Every clutch is cut from vegetable-tanned leather, so each hide has its own tone, and our photos are taken in daylight; indoor light often reads a shade darker. Could you send a photo by a window? We're happy to show you daylight photos of other hides we have in stock.`,
      `If it still isn't right for you, you can return it within 30 days of delivery for a full refund of the item. Reply and we'll send the return instructions; we refund the day it arrives at the studio.`,
      sign(c, "Warm regards,"),
    ].join("\n\n"),
  }),
  redirected: (c, d) => ({
    subject: `Did your order ${c.orderId} arrive safely?`,
    body: [
      `Hi ${c.first},`,
      `${c.carrier} shows your ${c.item} as delivered on ${d(c.deliveredAt)} to ${c.deliveredTo}, rather than ${c.shipTo}. Could you reply to confirm you've collected it and that it arrived in good condition?`,
      `If you didn't request the change or can't find it, tell us and we'll take it up with ${c.carrier} right away.`,
      sign(c, "Thank you,"),
    ].join("\n\n"),
  }),
  receipt_check: (c, d) => ({
    subject: `Did your order ${c.orderId} arrive safely?`,
    body: [
      `Hi ${c.first},`,
      `${c.carrier} shows your ${c.item} as delivered on ${d(c.deliveredAt)}${c.deliveredTo ? ` to ${c.deliveredTo}` : ""}. We just want to make sure it reached you in good condition: could you reply to confirm it arrived?`,
      `If anything is wrong, tell us and we'll sort it out straight away.`,
      sign(c, "Thank you,"),
    ].join("\n\n"),
  }),
  refund_issued: (c, d) => ({
    subject: `Refund issued for order ${c.orderId}`,
    body: [
      `Hi ${c.first},`,
      `You're right, and I'm sorry. Your return arrived on ${d(c.returnAt)} and the refund should have gone out then. We've just refunded ${c.amount} through PayPal${c.refundId ? ` (refund ${c.refundId})` : ""}. It shows in your PayPal account right away; card or bank refunds can take a few business days.`,
      sign(c, "Thank you for shopping with us,"),
    ].join("\n\n"),
  }),
  verify: (c) => ({
    subject: `Confirming your order ${c.orderId}`,
    body: [
      `Hi ${c.first},`,
      `Thank you for your order (${c.qty} × ${c.item}). Before we ship larger first orders we confirm a couple of details. Could you reply from this email address with the billing address on your card and a phone number we can reach you on?`,
      `We'll ship the same day we hear back. If you didn't place this order, reply and we'll cancel and refund it immediately.`,
      sign(c, "Thank you,"),
    ].join("\n\n"),
  }),
  general: (c) => ({
    subject: `Re: your order ${c.orderId}`,
    body: [`Hi ${c.first},`, `Thanks for your message about order ${c.orderId}. We're looking into it now and will come back to you today with an answer.`, sign(c, "Best regards,")].join("\n\n"),
  }),
};

const DE: Partial<Record<MessageSituation, Template>> = {
  stalled: (c, d) => ({
    subject: `Neuigkeiten zu Ihrer Bestellung ${c.orderId}`,
    body: [
      `Hallo ${c.first},`,
      `${c.replying ? "danke für Ihre Nachricht, und entschuldigen Sie bitte die Wartezeit. " : ""}Ihre Bestellung (${c.item}) hat unser Atelier in Brooklyn am ${d(c.shippedAt)} mit ${c.carrier} verlassen (Sendungsnummer ${c.tracking}). Der letzte Scan stammt vom ${d(c.lastScanAt)} aus ${c.lastScanLocation}, seitdem gibt es keine Bewegung. Wir haben deshalb heute einen Nachforschungsauftrag bei ${c.carrier} eröffnet.${c.customs ? " Die Sendung liegt in der Zollabfertigung; das dauert manchmal einige Tage länger." : ""}`,
      `Wir melden uns innerhalb von 48 Stunden mit dem Ergebnis. Ist das Paket bis zum ${d(undefined, 5)} nicht unterwegs, schicken wir Ihnen sofort Ersatz per Express oder erstatten den vollen Betrag, ganz wie Sie möchten. Sie müssen dafür nichts weiter tun.`,
      sign(c, "Herzliche Grüße"),
    ].join("\n\n"),
  }),
  exception: (c, d) => ({
    subject: `Ihre Bestellung ${c.orderId}: ${c.carrier} benötigt Ihre Adressdaten`,
    body: [
      `Hallo ${c.first},`,
      `${c.carrier} hat am ${d(c.lastScanAt)} versucht, Ihre Bestellung (${c.item}) zuzustellen, die Adresse aber als unvollständig markiert. Das Paket liegt jetzt im Depot in ${c.lastScanLocation}.`,
      `Könnten Sie uns Ihre vollständige Adresse (Wohnungsnummer, Name am Briefkasten) und eine Telefonnummer schicken? Wir geben sie heute an ${c.carrier} weiter und vereinbaren eine neue Zustellung.`,
      sign(c, "Viele Grüße"),
    ].join("\n\n"),
  }),
  receipt_check: (c, d) => ({
    subject: `Ist Ihre Bestellung ${c.orderId} gut angekommen?`,
    body: [
      `Hallo ${c.first},`,
      `laut ${c.carrier} wurde Ihre Bestellung (${c.item}) am ${d(c.deliveredAt)} zugestellt. Wir möchten sichergehen, dass alles unversehrt bei Ihnen angekommen ist: Könnten Sie uns kurz antworten und den Empfang bestätigen?`,
      `Falls etwas nicht stimmt, sagen Sie uns Bescheid, dann kümmern wir uns sofort darum.`,
      sign(c, "Vielen Dank und viele Grüße"),
    ].join("\n\n"),
  }),
};

const FR: Partial<Record<MessageSituation, Template>> = {
  stalled: (c, d) => ({
    subject: `Des nouvelles de votre commande ${c.orderId}`,
    body: [
      `Bonjour ${c.first},`,
      `${c.replying ? "Merci pour votre message, et toutes nos excuses pour l'attente. " : ""}Votre commande (${c.item}) a quitté notre atelier de Brooklyn le ${d(c.shippedAt)} avec ${c.carrier} (suivi ${c.tracking}). Le dernier scan date du ${d(c.lastScanAt)} à ${c.lastScanLocation} et le colis n'a pas bougé depuis : nous avons ouvert une enquête auprès de ${c.carrier} aujourd'hui.`,
      `Nous revenons vers vous sous 48 heures. Si le colis n'est pas reparti d'ici le ${d(undefined, 5)}, nous vous envoyons un remplacement en express ou vous remboursons intégralement, comme vous préférez.`,
      sign(c, "Bien cordialement,"),
    ].join("\n\n"),
  }),
  exception: (c, d) => ({
    subject: `Votre commande ${c.orderId} : ${c.carrier} a besoin de votre adresse complète`,
    body: [
      `Bonjour ${c.first},`,
      `${c.carrier} a tenté de livrer votre commande (${c.item}) le ${d(c.lastScanAt)}, mais l'adresse a été signalée comme incomplète. Le colis est conservé au dépôt de ${c.lastScanLocation}.`,
      `Pourriez-vous nous confirmer votre adresse complète (numéro d'appartement, code d'accès, nom sur la boîte aux lettres) et un numéro de téléphone ? Nous transmettons l'information à ${c.carrier} aujourd'hui pour une nouvelle livraison.`,
      sign(c, "Bien cordialement,"),
    ].join("\n\n"),
  }),
  receipt_check: (c, d) => ({
    subject: `Votre commande ${c.orderId} est-elle bien arrivée ?`,
    body: [
      `Bonjour ${c.first},`,
      `${c.carrier} indique que votre commande (${c.item}) a été livrée le ${d(c.deliveredAt)}. Pourriez-vous nous confirmer qu'elle est bien arrivée en bon état ?`,
      `Si quelque chose ne va pas, dites-le-nous et nous nous en occupons tout de suite.`,
      sign(c, "Merci et bien cordialement,"),
    ].join("\n\n"),
  }),
};

const BY_LANG: Record<string, Partial<Record<MessageSituation, Template>>> = { en: EN, de: DE, fr: FR };

const dateFn = (lang: string) => (iso?: string, plusDays = 0) => {
  const t = iso ? new Date(iso) : new Date(Date.now() + plusDays * 86400_000);
  return t.toLocaleDateString(LOCALE[lang] ?? "en-US", { day: "numeric", month: "long", timeZone: "UTC" });
};

export function renderMessage(situation: MessageSituation, language: string, ctx: MessageContext): MessageDraft {
  const local = BY_LANG[language]?.[situation];
  const lang = local ? language : "en";
  const out = (local ?? EN[situation])(ctx, dateFn(lang));
  const translation = lang !== "en" ? EN[situation](ctx, dateFn("en")) : undefined;
  return { situation, language: lang, languageName: LANG_NAME[lang] ?? lang, ...out, translation };
}

export function languageFor(country: string, lastCustomerLanguage?: string) {
  if (lastCustomerLanguage) return lastCustomerLanguage;
  if (["DE", "AT", "CH", "LI"].includes(country)) return "de";
  if (["FR", "BE", "LU", "MC"].includes(country)) return "fr";
  if (["IT", "SM"].includes(country)) return "it";
  if (["ES", "MX", "AR", "CO", "CL"].includes(country)) return "es";
  return "en";
}

// Language that tends to come right before a dispute, in the languages the demo store sells to.
export const THREAT_RE =
  /\b(dispute|chargeback|file (a )?claim|filing a claim|claim with paypal|paypal claim|report (you|this)|my bank|scam|fraud)|konflikt|käuferschutz|reklamation|betrug|anwalt|litige|réclamation|contestation|opposition bancaire|reclamo|disputa|contestazione/i;
export const WISMO_RE =
  /where is my (order|package|parcel)|haven'?t (received|got)|never (got|arrived|received)|nothing at my door|still (don'?t|do not) see|wo ist meine (bestellung|sendung|paket)|nicht angekommen|nichts neues|où est ma commande|pas reçu|dov'?è il mio ordine|dónde está mi pedido/i;
export const NEGATIVE_RE = /disappointed|not happy|unhappy|not sure i want to keep|darker than|lighter than|not as described|broken|damaged|enttäuscht|kaputt|beschädigt|déçu|abîmé/i;
