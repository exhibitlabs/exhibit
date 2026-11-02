<!-- Title in Conventional Commits form, e.g. `fix(approvals): expire a request when the brief changes`. -->

## What and why

<!-- One or two sentences. Link the issue it closes: Fixes #123 -->

## How it was tested

- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] Tried it in the app (demo mode is fine). What you did:

## Guardrails

Exhibit's promises are covered by tests. If this change touches one, say how it is still kept.

- [ ] An AI agent still cannot move money, file with PayPal or message a buyer without the merchant's approval
- [ ] Everything the model writes still has to cite a ref that resolves to a real record
- [ ] A PayPal action is still only taken when the dispute's current links allow it
- [ ] No keys, tokens or real customer data in the diff, the tests or the screenshots
