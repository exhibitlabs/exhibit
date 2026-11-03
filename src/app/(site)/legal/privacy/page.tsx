import type { Metadata } from "next";
import { companyMetadata } from "@/components/site/company/meta";
import Link from "next/link";
import { Cookie, Database, Mail, Network } from "lucide-react";
import { ROUTES } from "@/components/site";
import { LegalPage } from "@/components/site/company/LegalPage";
import { CONTACT_EMAIL } from "@/components/site/company/records";

const DESCRIPTION = "Exhibit's privacy page in plain words: this website sets no cookies and runs no analytics, the contact form only opens your email app, and a self-hosted Exhibit keeps its data on your own machine.";

export const metadata: Metadata = companyMetadata({ title: "Privacy", description: DESCRIPTION, path: "/legal/privacy" });

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy"
      rest="This website collects nothing about you."
      lede="Exhibit is an open-source hackathon project. Here, in plain words: what this website records (nothing of its own), what the live demo keeps, and what a copy of Exhibit you run yourself stores and shares."
      updated="November 3, 2026"
      art="letter"
      short={[
        { icon: Cookie, text: "No cookies, analytics or tracking on this website." },
        { icon: Mail, text: "The contact form opens your own email app. It sends nothing to us." },
        { icon: Database, text: "A self-hosted Exhibit keeps its data on your machine, in SQLite." },
        { icon: Network, text: "It talks to PayPal and Anthropic only when you set them up." },
      ]}
      sections={[
        {
          id: "website",
          title: "This website",
          body: (
            <>
              <p>This website sets no cookies and runs no analytics, advertising or tracking scripts. Its fonts and pictures are served from the site itself, so reading it doesn&apos;t make your browser contact a font service or any other third party.</p>
              <p>The contact form doesn&apos;t send anything to a server. It writes an email and opens it in your own email app. If you send it, we receive what you wrote, from your email address, and use it to reply to you.</p>
              <p>The server that hosts this website may keep standard request logs, such as IP addresses, browser types and the pages requested, as most web servers do. Exhibit adds no tracking of its own.</p>
            </>
          ),
        },
        {
          id: "live-demo",
          title: "The live demo",
          body: (
            <>
              <p>
                The live demo at <Link href={ROUTES.app}>/app</Link> runs on a fictional store, Kora Atelier, and Exhibit&apos;s built-in PayPal simulator, so nothing you do there reaches PayPal.
              </p>
              <p>It is shared. Everyone using the demo works the same store, so what you do there, such as a filing, an approval or an edited letter, can be seen by the next visitor until the demo resets after 20 quiet minutes. Please don&apos;t type personal information into it.</p>
              <p>Questions you ask Ask Exhibit are answered and not stored. When the demo runs live on Claude, your question and the demo records needed to answer it are sent to Anthropic to produce the answer. The same goes for an investigation you start: the demo case&apos;s records go to Claude.</p>
              <p>For the app, your browser keeps two small notes in local storage: whether you hid the demo guide strip on the overview, and which notifications you have seen. They aren&apos;t cookies and they aren&apos;t sent anywhere. Clearing this site&apos;s data in your browser removes them.</p>
            </>
          ),
        },
        {
          id: "self-hosted",
          title: "When you run Exhibit yourself",
          body: (
            <>
              <p>
                Exhibit is software you run on your own machine or server. It keeps its data there, in SQLite files under <code>.data/</code>, one for demo mode and one for the sandbox. We, its makers, receive nothing from your copy: it sends no usage data or anything else back to us.
              </p>
              <p>It stores store records (orders, shipments, buyers, messages and checkout signals), the disputes and payments it reads from PayPal, agent runs and briefs, filings with PayPal&apos;s responses, an audit log, the bodies of PayPal API calls, requests from AI agents with your decisions, and your settings.</p>
              <p>
                PayPal&apos;s responses can include buyers&apos; names, email addresses and shipping addresses, so treat the <code>.data</code> folder as customer data. Before anything is written, Exhibit masks secrets: the Authorization header is never stored, fields such as tokens, client secrets, passwords and CVV become <code>[redacted]</code>, and card numbers keep only their last four digits.
              </p>
              <p>
                Your credentials stay in <code>.env.local</code> on your machine. To remove everything Exhibit has stored, delete the <code>.data</code> folder. The <Link href={`${ROUTES.security}#data`}>security page</Link> lists every table.
              </p>
            </>
          ),
        },
        {
          id: "third-parties",
          title: "Who Exhibit talks to",
          body: (
            <ul>
              <li>
                <strong>PayPal, when you add sandbox credentials.</strong> Exhibit calls PayPal&apos;s REST APIs at <code>api-m.sandbox.paypal.com</code> to read disputes, and to act on them when you file, approve a request or switch on an Autopilot rule. Without credentials it uses the simulator and contacts no one.
              </li>
              <li>
                <strong>Anthropic, when you set up Claude.</strong> With an API key, or a Claude CLI login on the machine, the agent and Ask Exhibit send case records to Claude to reason about them. With neither, recorded runs replay and nothing is sent. What you send is covered by your own terms with Anthropic.
              </li>
              <li>
                <strong>AI agents you connect over MCP</strong> see what Exhibit&apos;s MCP tools return: dispute summaries, briefs, evidence packets, the prevention report and the overview.
              </li>
              <li>
                <strong>GitHub hosts the code.</strong> If you open an issue or a security report there, GitHub&apos;s own privacy terms apply.
              </li>
            </ul>
          ),
        },
        {
          id: "warranty",
          title: "No warranty",
          body: (
            <p>
              Exhibit is open-source software under the MIT licence, provided as is, without warranty of any kind. The <Link href={ROUTES.legal.terms}>terms</Link> say more.
            </p>
          ),
        },
        {
          id: "changes",
          title: "Changes and contact",
          body: (
            <p>
              If this page changes, we&apos;ll update it and the date at the top. Questions about privacy go to <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
            </p>
          ),
        },
      ]}
      footnote={<p className="!text-[14px] !text-[color:var(--s-muted)]">This page describes what the website and the software do. It isn&apos;t legal advice.</p>}
    />
  );
}
