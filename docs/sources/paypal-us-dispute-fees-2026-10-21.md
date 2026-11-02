# PayPal US merchant dispute and chargeback fees

Source: https://www.paypal.com/us/webapps/mpp/merchant-fees (page "last updated" October 1, 2026; fetched 2026-10-21)

Quoted facts (US dollar row):

- "We may charge a Dispute Fee when a buyer files a dispute claim or chargeback."
  - Standard Dispute Fee: 15.00 USD
  - High Volume Dispute Fee: 30.00 USD
  - Applies to transactions processed through a buyer's PayPal account or a PayPal checkout solution. Charged in the currency of the original transaction.
  - Thresholds for "High Volume" are defined in the PayPal User Agreement, not on the fee page.
- Chargeback fee: 20.00 USD per chargeback ("we assess a settlement fee to sellers for credit and debit card transaction chargebacks"). Covers card transactions not processed through a buyer's PayPal account.
- The page does not say whether fees are refunded when the seller wins.

How Exhibit uses it (`src/lib/prevention.ts`, `DISPUTE_FEE`): exposure per order = order total + fee, where the fee is
$15 for PayPal-funded orders (standard dispute fee) and $20 for card-funded orders (chargeback fee). The High Volume
fee ($30) is not modelled because the threshold is account specific.
