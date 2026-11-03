import type { Metadata } from "next";
import { companyMetadata } from "@/components/site/company/meta";
import Link from "next/link";
import { Ban, Code2, Receipt, Scale } from "lucide-react";
import { ROUTES } from "@/components/site";
import { LegalPage } from "@/components/site/company/LegalPage";
import { CONTACT_EMAIL, GITHUB } from "@/components/site/company/records";

const DESCRIPTION = "Plain terms for Exhibit, an open-source hackathon project: the MIT licence, no warranty, the shared live demo, your own accounts, and the fact that PayPal decides every dispute.";

export const metadata: Metadata = companyMetadata({ title: "Terms", description: DESCRIPTION, path: "/legal/terms" });

/** The warranty and liability paragraph of the MIT licence, verbatim from LICENSE. */
const MIT_WARRANTY =
  'THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.';

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms"
      rest="Plain terms for open-source software."
      lede="Exhibit is free, open-source software, and it isn't on sale. These terms cover the code, the live demo and this website, in plain words."
      updated="November 3, 2026"
      art="slip"
      short={[
        { icon: Code2, text: "Exhibit is open source under the MIT licence." },
        { icon: Ban, text: "It comes as is, with no warranty." },
        { icon: Receipt, text: "It isn't on sale. Nothing here is an offer." },
        { icon: Scale, text: "PayPal decides every dispute. Exhibit recommends, and you approve." },
      ]}
      sections={[
        {
          id: "what",
          title: "What Exhibit is",
          body: (
            <p>Exhibit is open-source software that helps merchants answer PayPal disputes. Shivansh Dwivedi and Someet Shende built it for the PayPal AI Hackathon 2026. It is at version 1.0, it has been tested on PayPal&apos;s sandbox, and it has not been used in production. It isn&apos;t on sale, so these terms don&apos;t create a paid service.</p>
          ),
        },
        {
          id: "licence",
          title: "The licence",
          body: (
            <>
              <p>The code is licensed under the MIT licence. You may use, copy, modify, merge, publish, distribute, sublicense and sell copies of it, as long as the copyright notice and the permission notice come with every copy or substantial portion.</p>
              <p>
                Copyright (c) 2026 Shivansh Dwivedi, Someet Shende, KaDeep AI. The <a href={GITHUB.license}>LICENSE file</a> in the repository is what governs the code.
              </p>
            </>
          ),
        },
        {
          id: "warranty",
          title: "No warranty, no liability",
          body: (
            <>
              <p>In the licence&apos;s own words:</p>
              <blockquote className="!text-[13px] !leading-[1.7] !tracking-[0.01em]">{MIT_WARRANTY}</blockquote>
              <p>In plain words: you use Exhibit at your own risk, and its authors aren&apos;t responsible for what happens when you do.</p>
            </>
          ),
        },
        {
          id: "live-demo",
          title: "The live demo",
          body: (
            <p>
              The live demo is there to try Exhibit. It runs on a fictional store and a simulated PayPal, it can change, reset or go offline at any time, and everyone using it shares it. Don&apos;t enter real customer data or personal information, and don&apos;t try to disrupt it for other visitors. If you find a security problem, report it as the <Link href={`${ROUTES.security}#disclosure`}>security page</Link> describes.
            </p>
          ),
        },
        {
          id: "your-accounts",
          title: "Using Exhibit with your own accounts",
          body: (
            <p>If you run Exhibit with your own PayPal or Anthropic credentials, you&apos;re responsible for those accounts, for keeping the credentials safe and for the actions you approve. Follow PayPal&apos;s terms for its APIs, and Anthropic&apos;s terms if you use Claude. Exhibit has no sign-in yet, so don&apos;t put a deployment with real credentials on the internet until authentication sits in front of it.</p>
          ),
        },
        {
          id: "advice",
          title: "Not advice, not a guarantee",
          body: <p>Exhibit&apos;s decisions, letters and win likelihoods are estimates drawn from your records. They aren&apos;t legal or financial advice, and they don&apos;t guarantee an outcome. PayPal decides every dispute.</p>,
        },
        {
          id: "names",
          title: "PayPal and other names",
          body: <p>Exhibit is an independent project. It is not affiliated with or endorsed by PayPal. PayPal is a trademark of PayPal, Inc. Kora Atelier, the demo merchant, and its buyers are fictional.</p>,
        },
        {
          id: "pictures",
          title: "Pictures and fonts",
          body: <p>The paintings on this site are public-domain works, credited where they appear and in the footer. Geist, Geist Mono and Instrument Serif are used under the SIL Open Font License.</p>,
        },
        {
          id: "pricing",
          title: "Pricing",
          body: (
            <p>
              The <Link href={ROUTES.pricing}>pricing</Link> on this site is planned and not on sale. Nothing on this site is an offer to sell.
            </p>
          ),
        },
        {
          id: "changes",
          title: "Changes and contact",
          body: (
            <p>
              If these terms change, we&apos;ll update this page and its date. Questions go to <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
            </p>
          ),
        },
      ]}
      footnote={<p className="!text-[14px] !text-[color:var(--s-muted)]">These terms are written in plain language for an open-source project. They aren&apos;t legal advice.</p>}
    />
  );
}
