# Card-network dispute monitoring thresholds

Fetched 2026-10-21. Used by the Command center's "Dispute-rate health" card (`THRESHOLDS` in `src/lib/overview.ts`).

PayPal does not publish a merchant dispute-rate threshold on its merchant fees or Seller Protection pages, so Exhibit
shows card-network monitoring lines and labels them as such. It does not invent PayPal-specific thresholds.

## Visa Acquirer Monitoring Program (VAMP), primary source

Source: Visa, "Visa Acquirer Monitoring Program Overview" fact sheet (PDF titled "VAMP_external fact sheet_2025 v2",
created 14 May 2025):
https://corporate.visa.com/content/dam/VCOM/corporate/visa-perspectives/security-and-trust/documents/visa-acquirer-monitoring-program-fact-sheet-2025.pdf

Quoted:

- "VAMP Ratio = Count of [Fraud (TC40) + Disputes (TC15)] ÷ Count of Settled Transactions (TC05)", on "card-not-present
  VisaNet transactions (domestic and cross-border)".
- Excludes "disputes resolved through pre-dispute solutions" and "TC 40 fraud qualified for Compelling Evidence 3.0".
- Acquirer portfolio: "Above Standard if its VAMP ratio is ≥50bps and as Excessive if ≥70bps".
- Excessive Merchant thresholds, AP, Canada, EU, U.S.: "VAMP Ratio: ≥220bps", "Monthly count of fraud and disputes: ≥1,500".
- Footnote 5: "Excessive Merchant threshold reduced to >=150bps in AP, Canada, EU, and U.S. regions on 1 April 2026."
- Program thresholds effective 1 June 2025; advisory period ended 30 September 2025.

Used as: 1.5% line, minimum 1,500 fraud + disputes a month (US, from 1 April 2026).

## Mastercard Excessive Chargeback Program (ECM / HECM), secondary source

Mastercard's own rules (Security Rules and Procedures / Chargeback Guide) are not publicly fetchable as a plain page. The
figures below come from a chargeback-industry summary and match what processors commonly publish:

Source: chargebackhelp.com, "Mastercard Excessive Chargeback Program: ECM and HECM Explained" (published and updated
23 April 2026): https://chargebackhelp.com/?p=31728

- Excessive Chargeback Merchant (ECM): "100 or more chargebacks in a single month" and a ratio that "reaches or exceeds
  1.5% (150 basis points)".
- High Excessive Chargeback Merchant (HECM): 300 or more chargebacks in a month and a ratio that "reaches or exceeds
  3% (300 basis points)".
- Ratio: first-presentment chargebacks in a month ÷ Mastercard transactions in the previous month.

Used as: 1.5% (ECM) and 3.0% (HECM) lines with their monthly count minimums.

## How Exhibit computes the merchant's rate

Disputes opened in a rolling 30-day window ÷ orders in the same window. It counts every PayPal dispute and chargeback
(including PayPal-wallet inquiries), which is stricter than the networks' card-only ratios. The demo merchant's order
volume (about 2,250 to 2,500 orders a month) is part of its labelled demo history (`demoOrders` in
`src/lib/store/history.ts`). In sandbox mode Exhibit has no order count, so the card shows the dispute count and the
thresholds, not a rate.
