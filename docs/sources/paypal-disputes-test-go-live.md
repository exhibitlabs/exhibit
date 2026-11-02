---
title: Test and go live
description: Test your PayPal Disputes API integration end to end in sandbox and
  prepare it to go live.
badges:
  - type: neutral
    text: Disputes API
---

# Test and go live (/disputes/test-go-live)



Implement and validate the PayPal Disputes API in sandbox and live environments as a developer or QA engineer.

## Simulate test scenarios [#simulate-test-scenarios]

Before going live, you can use the PayPal sandbox environment to test the Disputes API integration. This ensures it works as expected and meets all business and technical requirements.

### Prerequisites [#prerequisites]

1. Ensure you set up the sandbox environment.
2. Ensure you set up buyer-side credentials in the sandbox environment. This is required to create disputes or change dispute reasons as a buyer.

### Simulate buyer actions [#simulate-buyer-actions]

Before testing dispute responses for your integration, you need to simulate buyer actions to create the disputes and transactions in the sandbox environment.

**Create transaction**

To create a transaction in the sandbox environment, do these steps:

1. Log in to your sandbox personal account as a buyer.
2. Select **Send and Request** and follow the on-page instructions to send money to your sandbox business account's email ID.

> **Note:** For a transaction to be eligible for chargeback, ensure you use a credit card to send money.

3. Select **Go to Summary**.
4. In the **Recent activity** section, select the transaction.
5. On the **Summary** page, copy the **Transaction ID**. Use this value to create a dispute.

**Create dispute**

You can create disputes as a buyer using this endpoint and test how to handle them in the sandbox environment.

> **Note:** This is a sandbox-only endpoint. You cannot use it to create disputes in the live environment.

Use a valid access token, include the PayPal-Auth-Assertion request header with a valid JWT, and make a `POST` call to the `/v1/customer/disputes` endpoint. Include the following parameters:

| Parameter                          | Description                                                                                                                                                           | Action                                                                                                                         |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `disputed_transactions`<br />array | Array of transaction details for which the dispute is created.                                                                                                        | Pass the transaction ID retrieved after [creating a transaction](#create-transaction) in the `buyer_transaction_id` parameter. |
| `reason`<br />string               | Reason for the dispute. For more information, see Dispute reasons.                                                                                                    | Pass the reason for which you are disputing the transaction.                                                                   |
| `dispute_amount`<br />object       | Currency and value of the amount in dispute. The amount value must be less than or equal to the transaction amount of the [created transaction](#create-transaction). | Pass the currency and amount details.                                                                                          |
| `extensions`<br />object           | Additional dispute details, including whether the merchant was contacted, the contact outcome, and the issue type.                                                    | Pass the additional dispute details as needed.                                                                                 |

Sample request

Sample response

```shell
curl -X POST https://api-m.sandbox.paypal.com/v1/customer/disputes \
-H 'Authorization: Bearer ACCESS-TOKEN' \
-H 'Content-Type: multipart/form-data' \
-H 'PayPal-Auth-Assertion: AUTH-ASSERTION-JWT' \
-F 'input={
    "disputed_transactions": [{
        "buyer_transaction_id": "BUYER-TRANSACTION-ID"
        }],
    "reason": "MERCHANDISE_OR_SERVICE_NOT_RECEIVED",
    "dispute_amount": { 
        "currency_code":"USD", 
        "value": "20"
        },
    "extensions": {
        "merchant_contacted": true,
        "merchant_contacted_outcome": "NO_RESPONSE",
        "merchandize_dispute_properties": {
          "issue_type": "PRODUCT"
        }
    }
};type=application/json'
```

```json
{
  "links": [
    {
      "href": "https://api-m.sandbox.paypal.com/v1/customer/disputes/PP-D-27803",
      "rel": "self",
      "method": "GET"
    }
  ]
}
```

A successful call returns a `201 Created` response and an HATEOAS link for the dispute. Use the dispute ID from the HATEOAS link to perform subsequent tests on the dispute.

To test Accelerated Response, see [Accelerated Response sandbox testing](/disputes/test-go-live#accelerated-response-sandbox-testing).

**Create chargeback**

You can create chargebacks using this endpoint and test how to handle them in the sandbox environment.

> **Note:** This is a sandbox-only endpoint. You cannot use it to create chargebacks in the live environment.

Use a valid access token and make a `POST` call to the `/v2/customer-support/process-chargeback` endpoint. Include the following parameters:

| Parameter                                               | Description                                                                                                               | Action                                                                                                                                    |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `adjacency`<br />Required, string                       | Payment method used for the transaction.                                                                                  | Set the value as `PAYPAL` for PayPal transactions.                                                                                        |
| `file_layout`<br />Required, string                     | Format or layout for the chargeback event.                                                                                | Set the value as `ATCK_CB` for PayPal transactions.                                                                                       |
| `merchant_id`<br />Required, string                     | Unique identifier for the merchant.                                                                                       | Pass the merchant ID associated with the PayPal account.                                                                                  |
| `financial_institution.processor`<br />Required, string | Name of the payment processor.                                                                                            | Set the value as `FDMS` for PayPal transactions.                                                                                          |
| `transaction.id_enc`<br />Required, string              | Encrypted transaction identifier of the transaction for which the chargeback is created.                                  | Pass the `SELLER-TRANSACTION-ID` in this parameter. This is the transaction ID available when you log in using the business test account. |
| `transaction.amount`<br />Required, object              | Currency and amount for the transaction.                                                                                  | Pass the currency and amount details.                                                                                                     |
| `instrument`<br />Required, object                      | Details about the payment instrument used for the transaction.                                                            | Pass the payment instrument details.                                                                                                      |
| `instrument.instrument_type`<br />Required, string      | Type of payment instrument used for the transaction.<br /><br />**Possible values**: `CARD`, `BANK`, `CREDIT`, and so on. | Set the value as `CARD` for card-funded transactions.                                                                                     |
| `dispute`<br />Required, object                         | Details about the dispute.                                                                                                | Pass the dispute details.                                                                                                                 |
| `dispute.receive_date`<br />string                      | Date and time when the chargeback was received.                                                                           | Pass a current value for this parameter.                                                                                                  |
| `dispute.money_movement_date`<br />string               | Date and time when the money movement happened.                                                                           | Pass a current value for this parameter.                                                                                                  |
| `dispute.response_date`<br />string                     | Date and time when the response to the chargeback is due.                                                                 | Pass a future value for this parameter.                                                                                                   |

Sample request

Sample response

```shell
curl -X POST https://api-m.sandbox.paypal.com/v2/customer-support/process-chargeback \
-H 'Authorization: Bearer ACCESS-TOKEN' \
-H 'Content-Type: application/json' \
-d '{
    "adjacency": "PAYPAL",
    "file_layout": "ATCK_CB",
    "merchant_id": "99038409233245",
    "financial_institution": {
        "processor": "FDMS"
    },
    "transaction": {
        "id_enc": "SELLER-TRANSACTION-ID",
        "amount": {
            "currency_code": "USD",
            "value": "20"
        }
    },
    "instrument": {
        "instrument_type": "CARD",
        "card_brand": "VISA",
        "credit_card_transaction_id": "2347289342893472",
        "external": false
    },
    "dispute": {
        "id": null,
        "stage": "CHARGEBACK",
        "response_date": "2023-07-16T12:05:22.544Z",
        "status": "2",
        "amount": {
            "currency_code": "USD",
            "value": "10"
        },
        "receive_date": "2025-06-16T12:05:22.544Z",
        "event_code": "CHARGEBACK_INITIATED",
        "money_movement_date": "2025-06-16T12:05:22.544Z",
        "event_type": "DEBIT",
        "chargeback_type": "REPORTED_TO_PROCESSOR",
        "processor_info": {
            "reference_number": "31639435342702423793399",
            "reason_code": "1330",
            "notes": "TEST_MEMO"
        }
    }
}'
```

```json
{
  "dispute_id": "PP-D-1234"
}
```

A successful call returns a `201 Created` response and a dispute ID. Use the dispute ID to perform subsequent tests on the dispute.

**Change dispute reason**

You can change the reason for a dispute using this endpoint in the sandbox environment. This allows you to test how your integration handles changes to dispute reasons.

> **Note:** This is a sandbox-only endpoint. You cannot use it to change dispute reasons in the live environment.

Use a valid access token, include the PayPal-Auth-Assertion request header with a valid JWT, and make a `POST` call to the `/v1/customer/disputes/{ID}/change-reason` endpoint. Include the following parameters:

| Parameter name         | Description                                                                                      | Action                                                                              |
| ---------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| `reason`<br />string   | New reason for the dispute.                                                                      | Set the value to the new dispute reason. For more information, see Dispute reasons. |
| `note`<br />string     | Note explaining the reason for the change.                                                       | Pass the reason for the change if needed.                                           |
| `item_info`<br />array | Details about the disputed item if more than one item was available in the disputed transaction. | Pass the item details if needed.                                                    |

**Path parameter**: `ID` is the `dispute_id` returned in the Create dispute response.

Sample request

Sample response

```shell
curl -X POST "https://api-m.sandbox.paypal.com/v1/customer/disputes/{ID}/change-reason" \
-H 'Authorization: Bearer ACCESS-TOKEN' \
-H 'Content-Type: multipart/related' \
-H 'PayPal-Auth-Assertion: AUTH-ASSERTION-JWT' \
-F 'input={
    "reason": "MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED",
    "note": "Product is not as advertised",
    "item_info":
    [
        {
            "item_name": "item 1",
            "item_quantity": "2",
            "reason": "MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED",
            "item_type": "PRODUCT",
            "product_details":
            {
                "sub_reason": "DELAYED",
                "category": "OTHER"
            },
            "expected_refund":
            {
                "currency_code": "USD",
                "value": "10"
            }
        }
    ]
};type=application/json'
```

```json
{
  "links": [
    {
      "href": "https://api-m.sandbox.paypal.com/v1/customer/disputes/PP-D-27803",
      "rel": "self",
      "method": "GET"
    }
  ]
}
```

A successful call returns a `200 OK` response and an HATEOAS link for the dispute.

**Accept offer to resolve dispute**

Accept a merchant's offer to resolve a dispute by ID. PayPal automatically refunds the proposed amount to the customer.

Use a valid access token and make a `POST` call to the `/v1/customer/disputes/{id}/accept-offer` endpoint. Include the following parameter:

| Parameter          | Description                                                                                           | Action                 |
| ------------------ | ----------------------------------------------------------------------------------------------------- | ---------------------- |
| `note`<br />string | The customer's notes about accepting the offer. PayPal can view these notes, but the merchant cannot. | Pass a note if needed. |

**Path parameter**: `id` is the `dispute_id` returned in the Create dispute response.

Sample request

Sample response

```shell
curl --request POST \
  --url https://api-m.sandbox.paypal.com/v1/customer/disputes/{id}/accept-offer \
  --header 'Authorization: Bearer ACCESS-TOKEN' \
  --header 'Content-Type: application/json' \
  --header 'PayPal-Auth-Assertion: AUTH-ASSERTION-JWT' \
  --data '{
  "note": "I am ok with the refund offered."
}'
```

```json
{
  "links": [
    {
      "href": "https://api-m.sandbox.paypal.com/v1/customer/disputes/PP-D-27803",
      "rel": "self",
      "method": "GET"
    }
  ]
}
```

A successful call returns an HTTP `200 OK` status code and a HATEOAS link to the dispute. If money movement for the offer is delayed due to internal reasons, the call returns an HTTP `202 Accepted` status code instead.

**Deny offer to resolve dispute**

The customer denies a merchant's offer to resolve a dispute, by ID.

Use a valid access token and make a `POST` call to the `/v1/customer/disputes/{id}/deny-offer` endpoint. Include the following parameter:

| Parameter                    | Description                                                                                               | Action                                 |
| ---------------------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| `note`<br />Required, string | The customer's notes about the denial of the offer. PayPal can view these notes, but the merchant cannot. | Pass the reason for denying the offer. |

**Path parameter**: `id` is the `dispute_id` returned in the Create dispute response.

Sample request

Sample response

```shell
curl --request POST \
  --url https://api-m.sandbox.paypal.com/v1/customer/disputes/{id}/deny-offer \
  --header 'Authorization: Bearer ACCESS-TOKEN' \
  --header 'Content-Type: application/json' \
  --header 'PayPal-Auth-Assertion: AUTH-ASSERTION-JWT' \
  --data '{
  "note": "Refund offer is low."
}'
```

```json
{
  "links": [
    {
      "href": "https://api-m.sandbox.paypal.com/v1/customer/disputes/PP-D-27803",
      "rel": "self",
      "method": "GET"
    }
  ]
}
```

A successful call returns an HTTP `200 OK` status code and a HATEOAS link to the dispute.

### Simulate PayPal actions [#simulate-paypal-actions]

**Settle dispute**

> **Note:** This is a sandbox-only endpoint. You cannot use it to settle disputes in the live environment.

Settle a dispute in the customer's or merchant's favor to complete end-to-end dispute resolution testing in the sandbox. Before you make this call, confirm that the dispute `status` is `UNDER_REVIEW` and the `adjudicate` link is available in the HATEOAS links of the show dispute details response.

To make this call, the dispute `status` must be `UNDER_REVIEW` and the `adjudicate` link must be available in the HATEOAS links of the show dispute details response.

Use a valid access token and make a `POST` call to the `/v1/customer/disputes/{id}/adjudicate` endpoint. Include the following parameter:

| Parameter                                    | Description                                                                                    | Action                                                                                              |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `adjudication_outcome`<br />Required, string | The outcome of the adjudication.<br /><br />**Possible values**: `BUYER_FAVOR`, `SELLER_FAVOR` | Pass the outcome to indicate whether the dispute is resolved in the customer's or merchant's favor. |

**Path parameter**: `id` is the `dispute_id` returned in the Create dispute response.

Sample request

Sample response

```shell
curl --request POST \
  --url https://api-m.sandbox.paypal.com/v1/customer/disputes/{id}/adjudicate \
  --header 'Authorization: Bearer ACCESS-TOKEN' \
  --header 'Content-Type: application/json' \
  --data '{
  "adjudication_outcome": "BUYER_FAVOR"
}'
```

```json
{
  "links": [
    {
      "href": "https://api-m.sandbox.paypal.com/v1/customer/disputes/PP-D-27803",
      "rel": "self",
      "method": "GET"
    }
  ]
}
```

A successful call returns an HTTP `200 OK` status code and a HATEOAS link to the dispute.

**Update dispute status**

> **Note:** This is a sandbox-only endpoint. You cannot use it to update dispute statuses in the live environment.

Updates the status of a dispute, by ID, from `UNDER_REVIEW` to either `WAITING_FOR_BUYER_RESPONSE` or `WAITING_FOR_SELLER_RESPONSE`. This status change enables either the customer or merchant to submit evidence for the dispute.

To make this call, the dispute `status` must be `UNDER_REVIEW` and the `require-evidence` link must be available in the HATEOAS links of the show dispute details response.

Use a valid access token and make a `POST` call to the `/v1/customer/disputes/{id}/require-evidence` endpoint. Include the following parameter:

| Parameter                      | Description                                                                                                                                                  | Action                                                                                                                                    |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `action`<br />Required, string | Indicates whether the status change enables the customer or merchant to submit evidence.<br /><br />**Possible values**: `BUYER_EVIDENCE`, `SELLER_EVIDENCE` | Pass `BUYER_EVIDENCE` to set the status to `WAITING_FOR_BUYER_RESPONSE`, or `SELLER_EVIDENCE` to set it to `WAITING_FOR_SELLER_RESPONSE`. |

**Path parameter**: `id` is the `dispute_id` returned in the Create dispute response.

Sample request

Sample response

```shell
curl --request POST \
  --url https://api-m.sandbox.paypal.com/v1/customer/disputes/{id}/require-evidence \
  --header 'Authorization: Bearer ACCESS-TOKEN' \
  --header 'Content-Type: application/json' \
  --data '{
  "action": "BUYER_EVIDENCE"
}'
```

```json
{
  "links": [
    {
      "href": "https://api-m.sandbox.paypal.com/v1/customer/disputes/PP-D-27803",
      "rel": "self",
      "method": "GET"
    }
  ]
}
```

A successful call returns an HTTP `200 OK` status code and a HATEOAS link to the dispute.

### Test dispute scenarios [#test-dispute-scenarios]

You can use the scenarios in this section to test how your integration handles disputes and chargebacks in the sandbox environment.

**Test internal disputes**

You can test internal disputes by creating a dispute for a transaction with PayPal. The dispute can be for payments made using a card, bank account, digital wallet, or other supported payment methods.

**Test data condition**: Use `OTHER` as the evidence type when you provide evidence.

| Scenario                                                                                     | Description                                                                                                                                                                                                   | Test steps                                                                                        | Expected outcome                                                                                                                                                                                                                 |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dispute NO HOLD, MERCHANT WINS CASE                                                          | The buyer creates a dispute for a transaction where PayPal does not hold the money in the merchant's account.The merchant provides evidence and the case resolves in the merchant's favor.                    | **Buyer**: Create a dispute using the PayPal wallet.**Merchant**: Provide the requested evidence. | The merchant receives the relevant [notifications](#internal-dispute-possible-notifications).The merchant's account balance remains unchanged.                                                                                   |
| Dispute WITH HOLD, MERCHANT WINS CASE                                                        | The buyer creates a dispute for a transaction where PayPal holds the money in the merchant's account. The merchant provides evidence and the case resolves in the merchant's favor. PayPal releases the hold. | **Buyer**: Create a dispute using the PayPal wallet.**Merchant**: Provide the requested evidence. | The merchant receives the relevant [notifications](#internal-dispute-possible-notifications).PayPal releases the hold on the merchant's account.                                                                                 |
| Dispute NO HOLD, MERCHANT LOSES CASE (no data), NO SELLER PROTECTION, DISPUTE FEE is charged | The buyer creates a dispute for a transaction where PayPal does not hold the money in the merchant's account.The merchant does not provide evidence and the case resolves in the buyer's favor.               | **Buyer**: Create a dispute using the PayPal wallet.**Merchant**: Do not provide evidence.        | The merchant receives the relevant [notifications](#internal-dispute-possible-notifications).The case resolves in the buyer's favor. The transaction is not eligible for Seller Protection.PayPal debits the merchant's account. |

**Possible notifications**<a id="internal-dispute-possible-notifications" />

* **Webhooks**:
  * Case creation: `CUSTOMER.DISPUTE.CREATED`
  * Merchant response for evidence submission: `CUSTOMER.DISPUTE.UPDATED`
  * Case resolution: `CUSTOMER.DISPUTE.RESOLVED`
* **Emails**: Case creation, response request, and resolution.

**Test chargebacks**

You can [create chargebacks](#create-chargeback) for card transactions and test them using these scenarios.

**Test data conditions:**

* **Mastercard**: Reason code - `4853`
* **Visa**: Reason code - `C2`
* For test conditions where a temporary hold applies, the hold is placed and released when the case is resolved in the merchant's favor.

| Scenario                                                               | Description                                                                                                                                                                                                                             | Test steps                                                                                         | Expected outcome                                                                                                                                                                              |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chargeback WITH PROVISIONAL CREDIT, MERCHANT WINS CASE                 | A chargeback is created for a transaction.The merchant provides evidence, the case resolves in the merchant's favor, and the merchant retains the provisional credit.                                                                   | **Buyer**: [Create a chargeback](#create-chargeback).**Merchant**: Provide the requested evidence. | The merchant receives the relevant [notifications](#chargeback-possible-notifications).The merchant's account balance remains unchanged.                                                      |
| Chargeback WITHOUT PROVISIONAL CREDIT, MERCHANT WINS CASE              | A chargeback is created for a transaction where PayPal does not hold the money in the merchant's account.The merchant provides evidence and the case resolves in the merchant's favor.                                                  | **Buyer**: [Create a chargeback](#create-chargeback).**Merchant**: Provide the requested evidence. | The merchant receives the relevant [notifications](#chargeback-possible-notifications).The merchant's account balance remains unchanged.                                                      |
| Chargeback WITH PROVISIONAL CREDIT, MERCHANT LOSES CASE (no data)      | A chargeback is created for a transaction where PayPal does not hold the money in the merchant's account.The merchant does not provide evidence, the case resolves in the buyer's favor, and the merchant loses the provisional credit. | **Buyer**: [Create a chargeback](#create-chargeback).**Merchant**: Do not provide evidence.        | The merchant receives the relevant [notifications](#chargeback-possible-notifications).The case resolves in the buyer's favor. PayPal debits the merchant's account.                          |
| Chargeback WITHOUT PROVISIONAL CREDIT, MERCHANT LOSES CASE (no data)   | A chargeback is created for a transaction where PayPal does not hold the money in the merchant's account.The merchant does not provide evidence and the case resolves in the buyer's favor.                                             | **Buyer**: [Create a chargeback](#create-chargeback).**Merchant**: Do not provide evidence.        | The merchant receives the relevant [notifications](#chargeback-possible-notifications).The case resolves in the buyer's favor. PayPal debits the merchant's account.                          |
| Chargeback WITH PROVISIONAL CREDIT, MERCHANT LOSES CASE (adjudication) | A chargeback is created for a transaction where PayPal does not hold the money in the merchant's account. The merchant provides evidence and the case resolves in the buyer's favor and the merchant loses the provisional credit.      | **Buyer**: [Create a chargeback](#create-chargeback).**Merchant**: Provide the requested evidence. | The merchant receives the relevant [notifications](#chargeback-possible-notifications).The case adjudicates in the buyer's favor after evidence review\.PayPal debits the merchant's account. |

**Possible notifications**<a id="chargeback-possible-notifications" />

* **Webhooks**:
  * Case creation: `CUSTOMER.DISPUTE.CREATED`
  * Merchant response for evidence submission: `CUSTOMER.DISPUTE.UPDATED`
  * Case resolution: `CUSTOMER.DISPUTE.RESOLVED`
* **Emails**: Case creation, response request, and resolution.

### Test merchant response [#test-merchant-response]

You can test and determine how to respond to disputes using different scenarios. This ensures that your integration correctly handles the merchant actions during the dispute process.

**Key terms**:

* **INR**: Item Not Received
* **SNAD**: Significantly Not As Described

#### Check response due date and HATEOAS links [#check-response-due-date-and-hateoas-links]

You can use the Show dispute details response to determine how and when to respond to disputes.

| Test steps                                                                                                            | Expected outcome                                                                                                                                                        |
| --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Buyer**: Log in to your sandbox personal account and create an INR case.**Merchant**: Retrieve the dispute details. | The API returns a `200 OK` response. It includes `status`, `seller_response_due_date`, and `links` parameters that help you respond appropriately within the timeframe. |

#### Inquiry stage [#inquiry-stage]

You can use the procedures in this section to test dispute response handling during the inquiry stage.

**Send message to other party**

You can test sending a message to the buyer during the inquiry stage of a dispute. For example, when a buyer creates an INR or SNAD case for a completed transaction, you can send a message to the buyer directly and help resolve the issue before it escalates.

| Test steps                                                                                                                                                                                                                        | Expected outcome                                                                                                          |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Buyer**: Log in to your sandbox personal account and create an INR or SNAD case.**Merchant**:Retrieve the dispute details.Check if the send message action is available in the HATEOAS links.Send a message to the other party. | The API returns a `200 OK` response. You can retrieve the dispute details and check the `messages` array in the response. |

**Make offer to resolve dispute**

You can test making an offer to the buyer in these scenarios.

> **Info:** Merchants must have sufficient funds to issue a refund.

**REFUND_WITH_RETURN - SNAD case**

For a SNAD case in the inquiry stage, you can test offering the buyer a refund in exchange for returning the item.

| Test steps                                                                                                                                                                                                                                                                                                                                                                                                                                | Expected outcome                                                                                                                                                         |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Buyer**: Log in to your sandbox personal account and create a SNAD case.**Merchant**:Retrieve the dispute details.Check if the make offer action is available in the HATEOAS links.Make an offer with the following parameters:`offer_amount`: Set the amount that you are willing to refund the buyer.`offer_type`: Set the value as `REFUND_WITH_RETURN`.`return_shipping_address`: Pass the shipping address for returning the item. | The API returns a `200 OK` response. You can retrieve the dispute details and check the `offer.seller_offered_amount` and `offer.offer_type` parameters in the response. |

**REFUND_WITH_REPLACEMENT - SNAD case**

For a SNAD case in the inquiry stage, you can test offering the buyer a replacement item along with a refund.

| Test steps                                                                                                                                                                                                                                                                                                                                                         | Expected outcome                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Buyer**: Log in to your sandbox personal account and create a SNAD case.**Merchant**:Retrieve the dispute details.Check if the make offer action is available in the HATEOAS links.Make an offer with the following parameters:`offer_amount`: Set the amount that you are willing to refund the buyer.`offer_type`: Set the value as `REFUND_WITH_REPLACEMENT`. | The API returns a `200 OK` response. You can retrieve the dispute details and check the `offer.seller_offered_amount` and `offer.offer_type` parameters in the response. |

**REPLACEMENT_WITHOUT_REFUND - SNAD case**

For a SNAD case in the inquiry stage, you can test offering the buyer a replacement item without a refund.

| Test steps                                                                                                                                                                                                                                                                | Expected outcome                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Buyer**: Log in to your sandbox personal account and create a SNAD case.**Merchant**:Retrieve the dispute details.Check if the make offer action is available in the HATEOAS links.Make an offer with the `offer_type` parameter value as `REPLACEMENT_WITHOUT_REFUND`. | The API returns a `200 OK` response. You can retrieve the dispute details and check the `offer.offer_type` parameter in the response. |

**REFUND**

For an INR or SNAD case in the inquiry stage, you can test offering the buyer a refund without the replacement of the item.

| Test steps                                                                                                                                                                                                                                                                                                                                                | Expected outcome                                                                                                                                                         |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Buyer**: Log in to your sandbox personal account and create an INR or SNAD case.**Merchant**:Retrieve the dispute details.Check if the make offer action is available in the HATEOAS links.Make an offer with the following parameters:`offer_amount`: Set the amount that you are willing to refund the buyer.`offer_type`: Set the value as `REFUND`. | The API returns a `200 OK` response. You can retrieve the dispute details and check the `offer.seller_offered_amount` and `offer.offer_type` parameters in the response. |

For the actions involving return, you can acknowledge returned item when the buyer returns the item and uploads the tracking information.

**Acknowledge returned item**

You can test [offering a refund with the return of the item](#refund-with-return-snad-case), accept it as a buyer and upload the return tracking information. After this, the acknowledge return item option will be available for you.

| Test steps                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Expected outcome                                                                                                                                                                                  |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Buyer**: Log in to your sandbox personal account and create a SNAD case.**Merchant**:Retrieve the dispute details.Check if the make offer action is available in the HATEOAS links.Make an offer with the following parameters:`offer_amount`: Set the amount that you are willing to refund the buyer.`offer_type`: Set the value as `REFUND_WITH_RETURN`.`return_shipping_address`: Pass the shipping address for returning the item.**Buyer**:In the PayPal Resolution Center, view the dispute details and accept the offer.Add the tracking information for the returned item.**Merchant**:Retrieve the dispute details.Check if the acknowledge returned item action is available in HATEOAS links.Acknowledge the returned item. | The API returns a `200 OK` response. You can retrieve the dispute details and check the `offer.seller_offered_amount`, `offer.offer_type`, and `acknowledgement_type` parameters in the response. |

**Provide evidence**

You can test providing evidence for these evidence types. This section applies to INR cases only.

**PROOF_OF_FULFILLMENT**

You can test the `PROOF_OF_FULFILLMENT` evidence type by providing tracking information for the INR cases.

| Test steps                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Expected outcome                                                                                                                                                                                               |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Buyer**: Log in to your sandbox personal account and create an INR case.**Merchant**:Retrieve the dispute details.Check if the provide evidence is available in the HATEOAS links and if the `evidences` object contains `evidence_type` as `PROOF_OF_FULFILLMENT` and `source` as `REQUESTED_FROM_SELLER`.Provide the evidence with the following parameters within the `evidences` object:`evidence_type`: Set the value as `PROOF_OF_FULFILLMENT`.`evidence_info.tracking_info`: Pass the tracking information for the item. | The API returns a `200 OK` response. You can retrieve the dispute details and check the `evidence_type`, `source`, and `evidence_info.tracking_info` parameters within the `evidences` object in the response. |

**PROOF_OF_REFUND**

You can test the `PROOF_OF_REFUND` evidence type by providing refund details for the INR cases.

| Test steps                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Expected outcome                                                                                                                                                                                            |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Buyer**: Log in to your sandbox personal account and create an INR case.**Merchant**:Retrieve the dispute details.Check if the provide evidence is available in the HATEOAS links and if the `evidences` object contains `evidence_type` as `PROOF_OF_REFUND` and `source` as `REQUESTED_FROM_SELLER`.Provide the evidence with the following parameters within the `evidences` object:`evidence_type`: Set the value as `PROOF_OF_REFUND`.`evidence_info.refund_ids`: Pass the refund ID for the item. | The API returns a `200 OK` response. You can retrieve the dispute details and check the `evidence_type`, `source`, and `evidence_info.refund_ids` parameters within the `evidences` object in the response. |

**OTHER**

You can test the `OTHER` evidence type by providing notes or documents (including photos and files) for the INR cases.

> **Note:** For more information about the supported file types and size limits, see 
>
> Supported file types and sizes
>
> .

| Test steps                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Expected outcome                                                                                                                                                                                      |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Buyer**: Log in to your sandbox personal account and create an INR case.**Merchant**:Retrieve the dispute details.Check if the provide evidence is available in the HATEOAS links and if the `evidences` object contains `evidence_type` as `OTHER` and `source` as `REQUESTED_FROM_SELLER`.Provide the evidence with the following parameters within the `evidences` object:`evidence_type`: Set the value as `OTHER`.`notes`: Pass the additional evidence details as notes.`documents`: Pass the document details. | The API returns a `200 OK` response. You can retrieve the dispute details and check the `evidence_type`, `source`, `notes`, and `documents` parameters within the `evidences` object in the response. |

**Accept claim**

You can test accepting the claim and refunding the buyer when you choose not to dispute the case.

> **Info:** Merchants must have sufficient funds to issue a refund.

| Test steps                                                                                                                                                                                                                                                                | Expected outcome                                                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Buyer**: Log in to your sandbox personal account and create an INR or SNAD case.**Merchant**:Retrieve the dispute details.Check if the accept claim action is available in the HATEOAS links.Accept the claim with the `accept_claim_type` parameter value as `REFUND`. | The API returns a `200 OK` response. You can retrieve the dispute details and check the `dispute_outcome` object in the response. The `CUSTOMER.DISPUTE.RESOLVED` webhook notification with the refund details is sent to the buyer. |

**Escalate dispute to claim**

You can test escalating the dispute to a claim to simulate cases where you cannot reach an amicable resolution with the buyer.

| Test steps                                                                                                                                                                                                                | Expected outcome                                                                                                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Buyer**: Log in to your sandbox personal account and create an INR or SNAD case.**Merchant**:Retrieve the dispute details.Check if the escalate action is available in the HATEOAS links.Escalate the dispute to claim. | The API returns a `200 OK` response. You can retrieve the dispute details and check the `dispute_life_cycle_stage` parameter value is updated from `INQUIRY` to `CHARGEBACK`. The system also triggers the `CUSTOMER.DISPUTE.UPDATED` webhook. |

To test Accelerated Response, see [Accelerated Response sandbox testing](/disputes/test-go-live#accelerated-response-sandbox-testing).

#### Claim stage [#claim-stage]

You can use the procedures in this section to test dispute response handling during the claim stage.

**Provide evidence**

You can test providing evidence for these evidence types.

**PROOF_OF_FULFILLMENT - INR case**

You can test the `PROOF_OF_FULFILLMENT` evidence type by providing tracking information for the INR cases.

| Test steps                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Expected outcome                                                                                                                                                                                               |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Buyer**: Log in to your sandbox personal account and create an INR case.**Merchant**:Retrieve the dispute details.Check if the provide evidence is available in the HATEOAS links and if the `evidences` object contains `evidence_type` as `PROOF_OF_FULFILLMENT` and `source` as `REQUESTED_FROM_SELLER`.Provide the evidence with the following parameters within the `evidences` object:`evidence_type`: Set the value as `PROOF_OF_FULFILLMENT`.`evidence_info.tracking_info`: Pass the tracking information for the item. | The API returns a `200 OK` response. You can retrieve the dispute details and check the `evidence_type`, `source`, and `evidence_info.tracking_info` parameters within the `evidences` object in the response. |

**PROOF_OF_REFUND**

You can test the `PROOF_OF_REFUND` evidence type by providing refund details for the INR or SNAD cases.

| Test steps                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Expected outcome                                                                                                                                                                                            |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Buyer**: Log in to your sandbox personal account and create an INR or SNAD case.**Merchant**:Retrieve the dispute details.Check if the provide evidence is available in the HATEOAS links and if the `evidences` object contains `evidence_type` as `PROOF_OF_REFUND` and `source` as `REQUESTED_FROM_SELLER`.Provide the evidence with the following parameters within the `evidences` object:`evidence_type`: Set the value as `PROOF_OF_REFUND`.`evidence_info.refund_ids`: Pass the refund ID for the item. | The API returns a `200 OK` response. You can retrieve the dispute details and check the `evidence_type`, `source`, and `evidence_info.refund_ids` parameters within the `evidences` object in the response. |

**OTHER**

You can test the `OTHER` evidence type by providing notes or documents (including photos and files) for the INR or SNAD cases.

> **Note:** For more information about the supported file types and size limits, see 
>
> Supported file types and sizes
>
> .

| Test steps                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Expected outcome                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Buyer**: Log in to your sandbox personal account and create an INR or SNAD case.**Merchant**:Retrieve the dispute details.Check if the provide evidence is available in the HATEOAS links and if the `evidences` object contains `evidence_type` as `OTHER` and `source` as `REQUESTED_FROM_SELLER`.Provide the evidence with the following parameters within the `evidences` object:`evidence_type`: Set the value as `OTHER`.`notes`: Pass the additional evidence details as notes.`documents`: Pass the document details. | The API returns a `200 OK` response. You can retrieve the dispute details and check the `evidence_type`, `source`, `notes`, and `documents` parameters within the `evidences` object in the response. |

**Accept claim**

You can test accepting the claim and refunding the buyer if you choose to resolve the case using these accept claim types.

> **Info:** Merchants must have sufficient funds to issue a refund.

**REFUND**

The test procedure to refund the dispute amount is identical in the inquiry and claim stages. For detailed information, see [Accept claim](#accept-claim).

**REFUND_WITH_RETURN**

You can test accepting the claim for a SNAD case and refunding the buyer after they return the item to a specified address.

| Test steps                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Expected outcome                                                                                                                                                                             |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Buyer**: Log in to your sandbox personal account and create a SNAD dispute.**Merchant**: Retrieve the dispute details.Check if the accept claim action is available in the HATEOAS links.Accept the claim with the following parameters:`return_shipping_address`: Pass the shipping address for returning the item.`accept_claim_type`: Set the value as `REFUND_WITH_RETURN`.**Buyer**: In the PayPal Resolution Center, view the dispute details and provide the tracking information for the returned item. | The system triggers the `CUSTOMER.DISPUTE.UPDATED` webhook.<br />You can retrieve the dispute details and check the response parameters to get the tracking information and update the case. |

**PARTIAL_REFUND**

You can test accepting the claim and providing a partial refund (amount less than the buyer-requested refund) to the buyer for a INR or SNAD cases.

| Test steps                                                                                                                                                                                                                                                                                                                         | Expected outcome                                                                                                                                                                                                                                                                                                                                                                                                           |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Buyer**: Log in to your sandbox personal account and create a SNAD dispute.**Merchant**:Retrieve the dispute details.Check if the accept claim action is available in the HATEOAS links.Accept the claim with the following parameters:`refund_amount`: Amount to refund.`accept_claim_type`: Set the value as `PARTIAL_REFUND`. | The API returns a `200 OK` response. You can retrieve the dispute details and track the updates.If the refund amount is greater than or equal to the buyer-requested refund amount, the case is resolved, and you receive the `CUSTOMER.DISPUTE.RESOLVED` webhook notification.If the amount is less than the buyer-requested refund amount, it triggers an email to the buyer for their consent in the Resolution Center. |

**Acknowledge returned item**

You can test [offering a refund with the return of the item](#refund-with-return-snad-case), accept it as a buyer and upload the return tracking information. After this, the acknowledge return item option will be available for you.

| Test steps                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Expected outcome                                                                                                                                                                                  |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Buyer**: Log in to your sandbox personal account and create a SNAD case.**Merchant**:Retrieve the dispute details.Check if the make offer action is available in the HATEOAS links.Make an offer with the following parameters:`offer_amount`: Set the amount that you are willing to refund the buyer.`offer_type`: Set the value as `REFUND_WITH_RETURN`.`return_shipping_address`: Pass the shipping address for returning the item.**Buyer**:In the PayPal Resolution Center, view the dispute details and accept the offer.Add the tracking information for the returned item.**Merchant**:Retrieve the dispute details.Check if the acknowledge returned item action is available in HATEOAS links.Acknowledge the returned item. | The API returns a `200 OK` response. You can retrieve the dispute details and check the `offer.seller_offered_amount`, `offer.offer_type`, and `acknowledgement_type` parameters in the response. |

#### Appeal dispute [#appeal-dispute]

When PayPal adjudicates a case against a party, you or the buyer may be eligible to appeal the decision. PayPal uses predefined rules to determine appeal eligibility.

To test appeals, create a buyer account with a primary email address that includes `allowappeal` (for example, [testallowappeal@personal.example.com](mailto:testallowappeal@personal.example.com)). The disputes created with this account will trigger:

* The seller appeal workflow if you are found liable.
* The buyer appeal workflow if the buyer is found liable.

> **Note:** Each party can submit only one appeal per case.

To simulate cases where appeals are not allowed for a buyer, create a buyer account with a primary email address that includes `noappeal` (for example, [testnoappeal@personal.example.com](mailto:testnoappeal@personal.example.com)).

You can appeal the case and provide evidence using these evidence types.

**PROOF_OF_FULFILLMENT**

If the case is resolved in the buyer's favor, you can appeal by providing the fulfillment information for INR, unauthorized, or other cases.

| Test steps                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Expected outcome                                                                                                                                                                                                                                                                                                                  |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Buyer**: Log in to your sandbox personal account and create an INR case.**Merchant**:Settle the dispute with `adjudication_outcome` as `BUYER_FAVOR` to resolve the case in the buyer's favor.Retrieve the dispute details.Check if the appeal action is available in the HATEOAS links.Appeal the case with the following parameters within the `evidences` object:`evidence_type`: Set the value as `PROOF_OF_FULFILLMENT`.`evidence_info.tracking_info`: Pass the tracking information for the item. | The API returns a `200 OK` response. You can retrieve the dispute details and check:If the `evidences` object contains the `evidence_type` and `evidence_info.tracking_info` parameter values you provided.If the `status` and `dispute_life_cycle_stage` parameter values are `UNDER_REVIEW` and `PRE_ARBITRATION` respectively. |

**PROOF_OF_REFUND**

If the case is resolved in the buyer's favor, you can appeal by providing the refund information for all the dispute reasons.

| Test steps                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Expected outcome                                                                                                                                                                                                                                                                                                               |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Buyer**: Log in to your sandbox personal account and create an INR or SNAD case.**Merchant**:Settle the dispute with `adjudication_outcome` as `BUYER_FAVOR` to resolve the case in the buyer's favor.Retrieve the dispute details.Check if the appeal action is available in the HATEOAS links.Appeal the case with the following parameters within the `evidences` object:`evidence_type`: Set the value as `PROOF_OF_REFUND`.`evidence_info.refund_ids`: Pass the refund ID for the item. | The API returns a `200 OK` response. You can retrieve the dispute details and check:If the `evidences` object contains the `evidence_type` and `evidence_info.refund_ids` parameter values you provided.If the `status` and `dispute_life_cycle_stage` parameter values are `UNDER_REVIEW` and `PRE_ARBITRATION` respectively. |

**OTHER**

If the case is resolved in the buyer's favor, you can appeal by providing notes or documents. You can use the `OTHER` evidence type if the requested evidence is not covered by the `PROOF_OF_FULFILLMENT` and `PROOF_OF_REFUND` evidence types.

| Test steps                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Expected outcome                                                                                                            |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **Buyer**: Log in to your sandbox personal account and create an INR or SNAD case.**Merchant**:Settle the dispute with `adjudication_outcome` as `BUYER_FAVOR` to resolve the case in the buyer's favor.Retrieve the dispute details.Check if the appeal action is available in the HATEOAS links and the `evidences` object for the requested evidence.Appeal the case with the following parameters within the `evidences` object:`evidence_type`: Set the value as `OTHER`.`notes`: Pass the additional evidence details as notes.`documents`: Pass the document details. | The API returns a `200 OK` response. You can retrieve the dispute details and check the `evidences` object in the response. |

## Accelerated response sandbox testing [#accelerated-response-sandbox-testing]

To enable Accelerated Response for a dispute, include the value `ACCELERATED_RESPONSE_ENABLED` in the `notes` field under `evidences` when submitting your `create_dispute` API request.

Sample request

Sample response

```shell
curl -X POST https://api-m.sandbox.paypal.com/v1/customer/disputes \
-H 'Authorization: Bearer <ACCESS_TOKEN>' \
-H 'Content-Type: multipart/form-data' \
-H 'PayPal-Auth-Assertion: eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJpc3MiOiJBWmdidVpPU1B0YnJIWnNrNFZHeFAxOVFvZFUzVk91R1R5UEhhRTZJNkJVVm9NdTJvSnpIZExGeVc3Rmpvd1labGdVaEk4eWRzcXh6RlAtSSIsImVtYWlsIjoic2ItcmstYnV5ZXJAcGVyc29uYWwuZXhhbXBsZS5jb20ifQ.' \
-F 'input={
    "disputed_transactions": [{
        "buyer_transaction_id": "2NJ45340EV624100G"
        }],
    "reason": "MERCHANDISE_OR_SERVICE_NOT_RECEIVED",
    "dispute_amount": {
        "currency_code":"USD",
        "value": "5"
        },
    "extensions": {
        "merchant_contacted": true,
        "merchant_contacted_outcome": "NO_RESPONSE",
        "merchandize_dispute_properties": {
          "issue_type": "PRODUCT"
        }
    },
    "evidences": [{
            "notes": "ACCELERATED_RESPONSE_ENABLED"
        }
    ]
};type=application/json'
```

```json
{
  "links": [{
    "href": "https://api-m.sandbox.paypal.com/v1/customer/disputes/PP-R-TOW-10161582",
    "rel": "self",
    "method": "GET"
  }]
}
```

### Escalation simulation [#escalation-simulation]

To simulate the day of escalation in the sandbox environment, use the following transaction amounts:

| Transaction amount (USD) | Simulated escalation day |
| ------------------------ | ------------------------ |
| 5.00 – 5.99              | Day 5 escalation         |
| 9.00 – 9.99              | Day 9 escalation         |
| ≥ 11.00                  | Day 11 escalation        |

Create a transaction with one of the listed amounts, then use that transaction when creating the dispute to simulate the corresponding escalation day.

### Applicable dispute reasons [#applicable-dispute-reasons]

Accelerated Response currently applies to these dispute reasons:

* `MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED`
* `MERCHANDISE_OR_SERVICE_NOT_RECEIVED`

Once the dispute is created, you can perform any of the actions listed under the [Inquiry stage](/api/disputes#understand-dispute-lifecycle-stages) section.

## Applicable document proofs [#applicable-document-proofs]

Refer to the applicable documentation requirements in [Supported file types and sizes](/disputes/supported-file-sizes-types).

## Test webhooks [#test-webhooks]

To test disputes webhooks, you need to wait a few minutes after creating the dispute for the actions to become available. You can then perform the actions to trigger the webhooks.

### Test dispute created webhook [#test-dispute-created-webhook]

You can test the `CUSTOMER.DISPUTE.CREATED` webhook in both the [inquiry](#test-dispute-created-inquiry-stage) and [claim](#test-dispute-created-claim-stage) stages.

#### **Inquiry stage** [#test-dispute-created-inquiry-stage]

You can test this webhook in the inquiry stage for these scenarios.

**SNAD case**

You can create a SNAD case for a transaction and test triggering the webhook.

| Test steps                                                                 | Expected outcome                                                                                                                                                                                                                                                                                 |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Buyer**: Log in to your sandbox personal account and create a SNAD case. | The system triggers the `CUSTOMER.DISPUTE.CREATED` webhook.After receiving the webhook notification, you can retrieve the dispute details and check if the parameter values of `reason` and `dispute_life_cycle_stage` are `MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED` and `INQUIRY` respectively. |

**INR case**

You can create an INR case for a transaction and test triggering the webhook.

| Test steps                                                                 | Expected outcome                                                                                                                                                                                                                                                                             |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Buyer**: Log in to your sandbox personal account and create an INR case. | The system triggers the `CUSTOMER.DISPUTE.CREATED` webhook.After receiving the webhook notification, you can retrieve the dispute details and check if the parameter values of `reason` and `dispute_life_cycle_stage` are `MERCHANDISE_OR_SERVICE_NOT_RECEIVED` and `INQUIRY` respectively. |

#### **Claim stage** [#test-dispute-created-claim-stage]

You can test this webhook in the claim stage for these scenarios.

**SNAD case**

If you have opted out of the dispute stage, you can create a SNAD case for a transaction and test triggering this webhook in the claim stage.

| Test steps                                                                 | Expected outcome                                                                                                                                                                                                                                                                                    |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Buyer**: Log in to your sandbox personal account and create a SNAD case. | The system triggers the `CUSTOMER.DISPUTE.CREATED` webhook.After receiving the webhook notification, you can retrieve the dispute details and check if the parameter values of `reason` and `dispute_life_cycle_stage` are `MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED` and `CHARGEBACK` respectively. |

**INR case**

If you have opted out of the dispute stage, you can create an INR case for a transaction and test triggering this webhook in the claim stage.

| Test steps                                                                 | Expected outcome                                                                                                                                                                                                                                                                                |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Buyer**: Log in to your sandbox personal account and create an INR case. | The system triggers the `CUSTOMER.DISPUTE.CREATED` webhook.After receiving the webhook notification, you can retrieve the dispute details and check if the parameter values of `reason` and `dispute_life_cycle_stage` are `MERCHANDISE_OR_SERVICE_NOT_RECEIVED` and `CHARGEBACK` respectively. |

**Unauthorized case**

You can create an unauthorized case for a transaction and test triggering the webhook.

> **Note:** For unauthorized disputes, the buyer and merchant receive different dispute IDs. For merchants, the format and identifiers of the notifications stay the same as those of other dispute types.

| Test steps                                                                          | Expected outcome                                                                                                                                                                                                                                                         |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Buyer**: Log in to your sandbox personal account and create an unauthorized case. | The system triggers the `CUSTOMER.DISPUTE.CREATED` webhook.After receiving the webhook notification, you can retrieve the dispute details and check if the parameter values of `reason` and `dispute_life_cycle_stage` are `UNAUTHORISED` and `CHARGEBACK` respectively. |

**Transaction error case**

You can test triggering the webhook by creating a dispute for a transaction error using one of these dispute reasons: `CREDIT_NOT_PROCESSED`, `DUPLICATE_TRANSACTION`, `INCORRECT_AMOUNT`, `PAYMENT_BY_OTHER_MEANS`, `CANCELED_RECURRING_BILLING`, or `OTHER`.

> **Note:** For more information about the dispute reasons, see 
>
> Dispute reasons
>
> .

| Test steps                                                                                            | Expected outcome                                                                                                                                                                                                                                                                               |
| ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Buyer**: Log in to your sandbox personal account and create a case with one of the dispute reasons. | The system triggers the `CUSTOMER.DISPUTE.CREATED` webhook.After receiving the webhook notification, you can retrieve the dispute details and check if the parameter values of `reason` and `dispute_life_cycle_stage` are the dispute reason that you provided and `CHARGEBACK` respectively. |

**Duplicate dispute creation (negative testing)**

You can test that a buyer cannot open a duplicate dispute on a transaction that already has an existing dispute. Even after the original dispute case is closed, the buyer cannot open a new dispute on the same transaction.

| Test steps                                                                                                                                                                                                                                                                      | Expected outcome                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| **Buyer**: Log in to your sandbox personal account and create an INR or SNAD case.**Merchant**: Settle the dispute with `adjudication_outcome` as `BUYER_FAVOR` to resolve the case in the buyer's favor.**Buyer**: Check if you can create a dispute for the same transaction. | You cannot open a duplicate dispute on the same transaction. |

### Test dispute updated webhook [#test-dispute-updated-webhook]

You can test the `CUSTOMER.DISPUTE.UPDATED` webhook in both the [inquiry](#test-dispute-updated-inquiry-stage) and [claim](#test-dispute-updated-claim-stage) stages.

#### **Inquiry stage** [#test-dispute-updated-inquiry-stage]

You can test this webhook in the inquiry stage for this scenario.

**Buyer sends message to merchant**

You can test this webhook by sending a message to the merchant as a buyer for the INR or SNAD case.

| Test steps                                                                                                                               | Expected outcome                                                                                                                                                                                               |
| ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Buyer**: Log in to your sandbox personal account and create an INR or SNAD case.Select the case ID and send a message to the merchant. | The system triggers `CUSTOMER.DISPUTE.UPDATED` webhook. After receiving the webhook notification, you can retrieve the dispute details and check if the message details are available in the `messages` array. |

#### **Claim stage** [#test-dispute-updated-claim-stage]

You can test this webhook in the claim stage for these scenarios.

**Buyer provides return tracking information**

If you have opted out of the dispute stage, you can accept a claim for a case and provide the buyer with the return shipping address. Then, test as a buyer by returning the item and providing the return tracking information.

| Test steps                                                                                                                                                                               | Expected outcome                                                                                                                                                                                          |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Buyer**: Log in to your sandbox personal account and create a SNAD dispute.**Merchant**: Accept the claim.**Buyer**: Provide the tracking number through the PayPal Resolution Center. | The system triggers `CUSTOMER.DISPUTE.UPDATED` webhook. After receiving the webhook notification, you can retrieve the dispute details and check the response parameters to get the tracking information. |

**Buyer changes reason**

You can test changing the dispute reason of the INR dispute to SNAD or unauthorized activity.

| Test steps                                                                                                                                                       | Expected outcome                                                                                                                                                                                                     |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Buyer**: Log in to your sandbox personal account and create an INR dispute.Select **Change case type** and update the reason to SNAD or unauthorized activity. | The system triggers `CUSTOMER.DISPUTE.UPDATED` webhook.After receiving the webhook notification, you can retrieve the dispute details and check if the `reason` parameter value contains the updated dispute reason. |

### Test dispute resolved webhook [#test-dispute-resolved-webhook]

You can test the `CUSTOMER.DISPUTE.RESOLVED` webhook for these scenarios.

**Buyer cancels dispute**

You can test cancelling the dispute in the Resolution Center as a buyer to trigger the webhook.

| Test steps                                                                                                                  | Expected outcome                                         |
| --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| **Buyer**:Log in to your sandbox personal account and create a dispute.Select the case ID and then, select **Cancel case**. | The system triggers `CUSTOMER.DISPUTE.RESOLVED` webhook. |

**Settle dispute (buyer wins)**

You can test settling the case in the buyer's favor to trigger the webhook.

| Test steps                                                                                                                                                                                      | Expected outcome                                         |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| **Buyer**: Log in to your sandbox personal account and create a dispute.**Merchant**: Settle the dispute with `adjudication_outcome` as `BUYER_FAVOR` to resolve the case in the buyer's favor. | The system triggers `CUSTOMER.DISPUTE.RESOLVED` webhook. |

**Settle dispute (merchant wins)**

You can test settling the case in the merchant's favor to trigger the webhook.

| Test steps                                                                                                                                                                                          | Expected outcome                                         |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| **Buyer**: Log in to your sandbox personal account and create a dispute.**Merchant**: Settle the dispute with `adjudication_outcome` as `SELLER_FAVOR` to resolve the case in the merchant's favor. | The system triggers `CUSTOMER.DISPUTE.RESOLVED` webhook. |

### Identify unique webhook through webhook ID [#identify-unique-webhook-through-webhook-id]

You can test identifying a specific webhook using the webhook ID in the webhook payload.

| Test steps                                                                                                                                                                                                               | Expected outcome                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Merchant**: Subscribe and listen to the dispute webhooks: `CUSTOMER.DISPUTE.CREATED`, `CUSTOMER.DISPUTE.RESOLVED`, `CUSTOMER.DISPUTE.UPDATED`.**Buyer**: Log in to your sandbox personal account and create a dispute. | The system triggers the `CUSTOMER.DISPUTE.CREATED` webhook notification. You can use the unique webhook ID in the payload to identify the webhook. |

### Test API calls: use test values and simulate responses [#test-api-calls-use-test-values-and-simulate-responses]

To simulate Disputes API responses, inject test values as a path or query parameter in the request URL. These methods allow you to trigger specific error responses without creating actual disputes.

#### Sample - test value as path parameter

| Path parameter                    | Simulated error response |
| --------------------------------- | ------------------------ |
| `/v1/customer/disputes/ERRDIS015` | `FORBIDDEN`              |

Sample request

Sample response

```shell
curl -X GET https://api-m.sandbox.paypal.com/v1/customer/disputes/ERRDIS015 \
  -H 'Authorization: Bearer ACCESS-TOKEN' \
  -H 'Content-Type: application/json'
```

```json
{
    "name": "FORBIDDEN",
    "message": "No permission for the requested operation",
    "debug_id": "e90ec082e0e4d"
}
```

#### Sample - test value as query parameter

| Query parameter                                           | Simulated error response |
| --------------------------------------------------------- | ------------------------ |
| `/v1/customer/disputes?disputed_transaction_id=ERRDIS023` | `FORBIDDEN`              |

Sample request

Sample response

```shell
curl -X GET https://api-m.sandbox.paypal.com/v1/customer/disputes?disputed_transaction_id=ERRDIS023 \
  -H 'Authorization: Bearer ACCESS-TOKEN' \
  -H 'Content-Type: application/json'
```

```json
{
    "name": "FORBIDDEN",
    "message": "No permission for the requested operation",
    "debug_id": "e90ec082e0e4d"
}
```

### Common issues [#common-issues]

If an API call fails while you test , check for these common issues:

* 400 Bad Request when required fields or formats are invalid.
* 401 Unauthorized when the access token is missing, expired, or invalid.
* 403 Forbidden when the app is not permitted to perform this action.

For more details, see the [HTTP status codes and error messages](/api/errors/overview#http-status-codes-and-error-messages).

## Go live [#go-live]

1. Set up live account.
2. Set up webhooks to get real-time notifications about dispute events, such as created, updated, or resolved disputes.
3. Go live with your app.
