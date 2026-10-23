# VARNYXA PayYantra Gateway for WooCommerce

**High-Fashion & Haute Couture Payment Engine**  
Seamless, production-ready PayYantra payment gateway for WooCommerce, engineered specifically for the luxury apparel boutique VARNYXA.

---

## Key Features

- **Dedicated UPI Experience**:
  - Automatically isolates payment methods so customers select **UPI** (Google Pay, PhonePe, Paytm, BHIM, QR) directly at checkout.
  - Passes `allowedPaymentMethods: ["UPI"]` to the PayYantra Payin API.
  - Renders genuine, transaction-specific dynamic QR codes directly on the VARNYXA order payment page when supplied by PayYantra.
  - Supports mobile UPI App Intent deep-links (`upi://pay?...`) for single-tap payment on smartphones.
  - **Zero Fabricated QRs**: If the configured merchant account returns a hosted checkout URL rather than direct QR data, it uses the official UPI-locked hosted checkout without fabricating fake or static merchant QRs.
- **Dedicated Debit & Credit Cards**:
  - Presents a distinct card payment option at checkout.
  - Directly launches the secure, 256-bit bank encrypted card checkout interface with `allowedPaymentMethods: ["CARD"]`.
  - **Strict PCI-DSS Compliance**: Zero raw card numbers, CVVs, or expiration dates are collected, processed, or logged on the WordPress server.
  - Full support for 3-D Secure OTP verification directly through issuing banks.
- **Server-to-Server Payment Verification**:
  - Never trusts browser query parameters or frontend redirects as proof of payment.
  - Automatically queries official PayYantra Status APIs (`/api/pay/status/{orderId}` and `/api/pay/status/by-reference/{referenceId}`) to verify the authentic ledger state before marking orders as paid.
  - Idempotent webhook handler (`/?wc-api=varnyxa_payyantra_webhook`) prevents double-charging and duplicate stock reduction.
- **High-Performance Order Storage (HPOS)**:
  - 100% compliant with WooCommerce HPOS (Custom Order Tables) and backward compatible with classic post-meta storage.
- **Diagnostic Logging & Redaction**:
  - Built-in sensitive data scrubber automatically redacts Bearer JWTs, Client Secrets, Client IDs, card numbers, and VPAs in WooCommerce system logs.
- **Cash on Delivery (COD) Policy**:
  - Customer checkout is completely free of COD. COD remains admin-restricted and is never added to the customer payment options.

---

## Directory Structure

```
varnyxa-payyantra-gateway/
├── varnyxa-payyantra-gateway.php        # Main bootstrap file with HPOS declarations & hooks
├── README.md                            # Complete documentation & setup instructions
├── includes/
│   ├── class-varnyxa-payyantra-api.php      # PayYantra Payin API Client (Token cache, Orders, Status)
│   ├── class-varnyxa-payyantra-gateway.php  # Base gateway class with shared credentials & settings
│   ├── class-varnyxa-payyantra-upi.php      # Dedicated UPI gateway (Dynamic QR & Intent)
│   ├── class-varnyxa-payyantra-card.php     # Dedicated Card gateway (PCI-DSS compliant)
│   ├── class-varnyxa-payyantra-unified.php  # Optional All-in-One unified checkout gateway
│   ├── class-varnyxa-payyantra-webhook.php  # Webhook & return verification, idempotency handler
│   └── class-varnyxa-payyantra-logger.php   # Diagnostic logger with automated sensitive redaction
├── templates/
│   └── upi-qr-pay.php                       # Luxury VARNYXA dynamic QR & real-time polling template
└── assets/
    ├── css/
    │   ├── varnyxa-checkout.css             # Frontend styling, luxury dark/gold aesthetic, QR card
    │   └── varnyxa-admin.css                # WooCommerce admin settings styling
    ├── js/
    │   └── varnyxa-checkout.js              # Real-time AJAX status polling & countdown timer
    └── images/
        ├── upi-icon.svg                     # Official UPI brand icon
        ├── cards-icon.svg                   # Visa / Mastercard / RuPay brand icons
        └── logo.svg                         # VARNYXA luxury branding logo
```

---

## Installation

### Method A: Install via WordPress Admin (Recommended)
1. Download the packaged `varnyxa-payyantra-gateway.zip` file.
2. In your WordPress admin dashboard, navigate to **Plugins > Add New > Upload Plugin**.
3. Choose `varnyxa-payyantra-gateway.zip` and click **Install Now**.
4. Click **Activate Plugin**.

### Method B: Manual SFTP / FTP Installation
1. Unzip the `varnyxa-payyantra-gateway.zip` archive.
2. Upload the `varnyxa-payyantra-gateway` folder to your WordPress installation's `/wp-content/plugins/` directory.
3. In WordPress Admin, go to **Plugins** and activate **VARNYXA PayYantra Gateway**.

---

## Configuration

Navigate to **WooCommerce > Settings > Payments**:

You will see the registered VARNYXA gateways:
1. **VARNYXA PayYantra UPI** (Customer-facing dedicated UPI gateway)
2. **VARNYXA PayYantra Cards** (Customer-facing dedicated PCI-compliant card gateway)
3. **PayYantra Hosted Checkout** (Fully configurable in Admin; strictly hidden from customer checkout)

Click **Manage** on any gateway to configure your credentials:

### Settings Fields:
- **Enable/Disable**: Check to activate the payment method on checkout.
- **Environment**: Select **UAT / Sandbox** for staging tests or **Production / Live** for live payments.
- **UAT Credentials**:
  - **UAT Base URL**: `https://payin-api-uat.payyantra.com`
  - **UAT Client ID**: Obtained from PayYantra merchant support (`x-client-id`).
  - **UAT Client Secret**: PayYantra merchant secret (`x-client-secret`).
  - **UAT Test Amount Cap**: Keeps test transactions $\le$ ₹10.00 as required by the PayYantra sandbox.
- **Production Credentials**:
  - **Production Base URL**: `https://payin-api.payyantra.com`
  - **Production Client ID**: Live merchant client ID.
  - **Production Client Secret**: Live merchant secret.
- **Webhook Notification URL**:
  - Displayed at the bottom of the settings screen:
    `https://yourdomain.com/?wc-api=varnyxa_payyantra_webhook`
  - Copy and paste this URL into your PayYantra Merchant Dashboard under **Webhooks / Notifications**.
- **Diagnostic Logging**: Enable to troubleshoot transactions under **WooCommerce > Status > Logs > `varnyxa-payyantra`**.

---

## Provider Capability & QR Handling Architecture

1. **When PayYantra returns dynamic QR data**:
   - The plugin detects `data.qrData`, `data.qr_data`, or `data.qrUrl`.
   - The customer is directed to the VARNYXA Order-Pay screen, where the genuine dynamic QR is rendered with an auto-polling mechanism querying `/wc-api/varnyxa_payyantra_order_status`.
   - Once the customer completes payment in their UPI app, the polling mechanism automatically detects status `SUCCESS`, marks the order paid, and redirects to the receipt page.
2. **When PayYantra returns standard Hosted Checkout URL**:
   - The plugin detects `data.checkoutUrl`.
   - Because `allowedPaymentMethods: ["UPI"]` was requested, the customer is immediately presented with PayYantra's official UPI interface.
   - For Cards (`allowedPaymentMethods: ["CARD"]`), the customer is presented directly with the card entry form.
3. **No Fabricated QR Codes**:
   - Per production banking guidelines, the plugin **never** generates a fake QR code or static merchant VPA when dynamic QR is unsupported by the merchant's gateway account tier.

---

## System Requirements

- **WordPress**: 5.8 or higher
- **WooCommerce**: 6.0 or higher (Tested up to 8.8+)
- **PHP**: 7.4, 8.0, 8.1, or 8.2+
- **cURL & OpenSSL**: Enabled in PHP
- **SSL Certificate**: HTTPS is required for live payments and webhook notifications
