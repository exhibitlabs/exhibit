# GitHub setup: the steps that need a browser

Everything here is done on github.com by an owner of the `exhibitlabs` organisation: Shivansh, or Someet once he has accepted his invitation. It takes about ten minutes. Items marked "already set" were done through the API on Nov 3; check them and move on.

## 1. The organisation profile

Open **github.com/exhibitlabs → Settings → Profile** (`https://github.com/organizations/exhibitlabs/settings/profile`).

| Field | Value |
| :--- | :--- |
| Organization display name | `Exhibit` (already set) |
| Description | `The AI dispute agent for PayPal merchants. Disputes, answered with evidence. Refunds when the buyer is right.` (replaces the shorter one that is set now; 109 characters) |
| URL (website) | https://exhibit.9to5code.com (set Nov 4, 2026). |
| Location | `India` |
| Public email | `contact@exhibit.9to5code.com` (already set) |
| Profile picture | **Upload new picture** → [`docs/brand/org-avatar.png`](org-avatar.png) (1024 x 1024). GitHub rounds the corners itself. |

Then, on **github.com/exhibitlabs → People**, each founder sets their own membership to **Public**, so both co-founders show on the organisation page. Someet must accept the invitation first (it is in his email and at github.com/exhibitlabs).

## 2. The profile page

The coordinator creates the public repository `exhibitlabs/.github` from `~/Developer/exhibit-org-dotgithub` with `main` as its default branch. GitHub then shows `profile/README.md` at the top of github.com/exhibitlabs on its own; there is nothing to switch on.

## 3. Pinned repositories

- **On the organisation page:** github.com/exhibitlabs → **Customize pins** → pin `exhibit`. Only owners can pin. Don't pin `.github`: its content is already the page itself.
- **On each founder's own profile:** github.com/shvuuuu and github.com/someetshende → **Customize your pins** → add `exhibitlabs/exhibit`, so judges who open either founder's profile land on the project.

## 4. The repository's About box

Open **github.com/exhibitlabs/exhibit** and click the gear next to **About**.

**Description** (350 characters at most):

```
The AI dispute agent for PayPal merchants. Claude investigates each dispute, cites every claim to a real record and files through PayPal's Disputes API once the merchant approves. When the buyer is right, it refunds.
```

**Website:** https://exhibit.9to5code.com (set Nov 4, 2026).

**Topics** (20, GitHub's maximum). Eighteen are already set; add the last two, `claude-agent-sdk` and `ag-charts`:

```
paypal paypal-api paypal-ai-hackathon disputes chargebacks merchants ecommerce fintech ai-agent claude anthropic claude-agent-sdk mcp model-context-protocol nextjs react typescript sqlite ag-grid ag-charts
```

**Include in the home page:** keep **Releases** ticked. Untick **Packages** and **Deployments**, which are empty and only add noise to the sidebar.

## 5. The social preview

**github.com/exhibitlabs/exhibit → Settings → General → Social preview → Edit → Upload an image** → [`docs/brand/social-preview.png`](social-preview.png) (1280 x 640, under 1 MB). This is the card that appears when the repository link is shared on Devpost, Slack, X or LinkedIn.

## Which image goes where

| Image | Where it goes |
| :--- | :--- |
| [`docs/brand/org-avatar.png`](org-avatar.png) | Organisation profile picture (step 1) |
| [`docs/brand/social-preview.png`](social-preview.png) | Repository social preview (step 5) |
| [`docs/brand/readme-hero-light.png`](readme-hero-light.png), [`readme-hero-dark.png`](readme-hero-dark.png) | Already shown by `README.md`; nothing to upload |
| `profile/assets/banner-light.png`, `banner-dark.png` in `exhibitlabs/.github` | Already shown by the profile page; nothing to upload. Copies of [`org-banner-light.png`](org-banner-light.png) and [`org-banner-dark.png`](org-banner-dark.png) |

## Later

- **When the video is on YouTube:** replace every `<!-- VIDEO_URL -->` with a link, for example `<a href="https://www.youtube.com/watch?v=…">Demo video</a> ·`. There are three in `README.md` (the link row, the "For judges" list and the top of "What the demo video shows") and one in `profile/README.md` of `exhibitlabs/.github` (the link row).
- **When a CI run on `main` is green:** add the CI badge to the badge row of `README.md`; the line is in a comment under "Tests and CI".
- **Optional, a "Verified" badge:** Settings → **Verified and approved domains** → **Add a domain** → `exhibit.9to5code.com`, then add the TXT record GitHub shows in Cloudflare DNS and press **Verify**. GitHub shows the badge only when the profile's website and email are both on the verified domain, so do this once the Website field is set, and only if the option appears for the organisation's plan.

## Rebuilding the images

With Exhibit running (`npm run dev -- -p 3101`, demo mode is fine), `node docs/brand/build.mjs` rebuilds every image in this folder from real page parts in about ten seconds, and copies the organisation banners into `../exhibit-org-dotgithub/profile/assets/` when that folder sits next to the repository. `node docs/brand/readme-facts.mjs` rewrites the README's sandbox record from `proof.json` and checks every figure, link, image and anchor in both READMEs.
