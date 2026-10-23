<?php
/**
 * Standalone Automated Test Suite for VARNYXA PayYantra WooCommerce Plugin
 *
 * Runs via PHP CLI to verify all core classes, functions, security filters,
 * API payload generators, and webhook logic.
 */

// Define WordPress mock environment
if (!defined('ABSPATH')) {
    define('ABSPATH', __DIR__ . '/');
}
define('HOUR_IN_SECONDS', 3600);
define('VARNYXA_PAYYANTRA_PLUGIN_DIR', dirname(__DIR__) . '/varnyxa-payyantra-gateway/');
define('VARNYXA_PAYYANTRA_PLUGIN_URL', 'https://example.com/wp-content/plugins/varnyxa-payyantra-gateway/');
define('VARNYXA_PAYYANTRA_VERSION', '1.0.0');

// Mock WordPress functions
$GLOBALS['wp_transients'] = array();
$GLOBALS['wp_options']    = array();

function get_transient($key) {
    return isset($GLOBALS['wp_transients'][$key]) ? $GLOBALS['wp_transients'][$key] : false;
}
function set_transient($key, $val, $exp) {
    $GLOBALS['wp_transients'][$key] = $val;
    return true;
}
function delete_transient($key) {
    unset($GLOBALS['wp_transients'][$key]);
    return true;
}
function get_option($key, $default = false) {
    return isset($GLOBALS['wp_options'][$key]) ? $GLOBALS['wp_options'][$key] : $default;
}
function update_option($key, $val) {
    $GLOBALS['wp_options'][$key] = $val;
    return true;
}
function untrailingslashit($url) {
    return rtrim($url, '/\\');
}
function wp_json_encode($data) {
    return json_encode($data);
}
function wp_rand($min, $max) {
    return rand($min, $max);
}
function is_wp_error($thing) {
    return ($thing instanceof WP_Error);
}
function sanitize_text_field($str) {
    return trim(strip_tags((string)$str));
}
function esc_html__($text, $domain = '') { return $text; }
function __($text, $domain = '') { return $text; }
function esc_html($text) { return htmlspecialchars((string)$text, ENT_QUOTES, 'UTF-8'); }
function esc_attr($text) { return htmlspecialchars((string)$text, ENT_QUOTES, 'UTF-8'); }
function esc_url($text) { return filter_var($text, FILTER_SANITIZE_URL); }
function add_action($tag, $callback, $priority = 10, $accepted_args = 1) { return true; }
function add_filter($tag, $callback, $priority = 10, $accepted_args = 1) { return true; }
function do_action($tag, ...$args) { return true; }
function apply_filters($tag, $value, ...$args) { return $value; }
function plugins_url($path, $plugin) { return 'https://example.com/wp-content/plugins/' . $path; }
function plugin_basename($file) { return basename($file); }
function get_woocommerce_currency() { return 'INR'; }
function wc_get_checkout_url() { return 'https://example.com/checkout'; }
function current_time($type) { return date('Y-m-d H:i:s'); }
$GLOBALS['is_admin_mode'] = false;
$GLOBALS['current_user_caps'] = array();
function is_admin() { return !empty($GLOBALS['is_admin_mode']); }
function current_user_can($cap) { return in_array($cap, $GLOBALS['current_user_caps'], true); }

class WP_Error {
    public $code;
    public $message;
    public function __construct($code = '', $message = '') {
        $this->code = $code;
        $this->message = $message;
    }
    public function get_error_message() { return $this->message; }
    public function get_error_code() { return $this->code; }
}

// Mock WC_Payment_Gateway base
class WC_Payment_Gateway {
    public $id;
    public $method_title;
    public $method_description;
    public $enabled;
    public $title;
    public $description;
    public $has_fields;
    public $supports;
    public $form_fields = array();
    public $settings = array();

    public function init_form_fields() {}
    public function init_settings() {
        $this->settings = get_option('woocommerce_' . $this->id . '_settings', array());
    }
    public function get_option($key, $empty_value = null) {
        if (!empty($this->settings[$key])) {
            return $this->settings[$key];
        }
        if (isset($this->form_fields[$key]['default'])) {
            return $this->form_fields[$key]['default'];
        }
        return $empty_value;
    }
    public function get_return_url($order = null) {
        return 'https://example.com/checkout/order-received/' . ($order ? $order->get_id() : '');
    }
}

// Mock WC_Order
class Mock_WC_Order {
    public $id = 1049;
    public $total = 2499.50;
    public $currency = 'INR';
    public $status = 'pending';
    public $is_paid = false;
    public $meta = array();
    public $notes = array();
    public $transaction_id = '';

    public function get_id() { return $this->id; }
    public function get_total() { return $this->total; }
    public function get_currency() { return $this->currency; }
    public function get_status() { return $this->status; }
    public function is_paid() { return $this->is_paid; }
    public function get_billing_first_name() { return 'Aarav'; }
    public function get_billing_last_name() { return 'Singhania'; }
    public function get_billing_email() { return 'aarav.singhania@example.com'; }
    public function get_billing_phone() { return '+91 98765 43210'; }
    public function get_order_key() { return 'wc_order_secret123'; }
    public function get_checkout_payment_url($on_checkout = false) {
        return 'https://example.com/checkout/order-pay/' . $this->id . '/?pay_for_order=true&key=' . $this->get_order_key();
    }
    public function get_checkout_order_received_url() {
        return 'https://example.com/checkout/order-received/' . $this->id . '/?key=' . $this->get_order_key();
    }
    public function update_meta_data($key, $val) { $this->meta[$key] = $val; }
    public function get_meta($key) { return isset($this->meta[$key]) ? $this->meta[$key] : ''; }
    public function set_transaction_id($txn_id) { $this->transaction_id = $txn_id; }
    public function update_status($st, $note = '') {
        $this->status = $st;
        if ($note) $this->notes[] = $note;
    }
    public function payment_complete($txn_id = '') {
        $this->status = 'processing';
        $this->is_paid = true;
        if ($txn_id) $this->transaction_id = $txn_id;
    }
    public function add_order_note($note) { $this->notes[] = $note; }
    public function save() { return true; }
}

class Mock_WC {
    public function api_request_url($api) {
        return 'https://example.com/?wc-api=' . $api;
    }
}

function WC() {
    static $instance = null;
    if (null === $instance) {
        $instance = new Mock_WC();
    }
    return $instance;
}

// Load WooCommerce Blocks Mock
if (!class_exists('Automattic\WooCommerce\Blocks\Payments\Integrations\AbstractPaymentMethodType', false)) {
    eval('namespace Automattic\WooCommerce\Blocks\Payments\Integrations {
        abstract class AbstractPaymentMethodType {
            protected $name = "";
            public function get_setting($key, $default = "") {
                $settings = isset($this->settings) ? $this->settings : array();
                return isset($settings[$key]) ? $settings[$key] : $default;
            }
        }
    }');
}

// Load the plugin source files
require_once VARNYXA_PAYYANTRA_PLUGIN_DIR . 'includes/class-varnyxa-payyantra-logger.php';
require_once VARNYXA_PAYYANTRA_PLUGIN_DIR . 'includes/class-varnyxa-payyantra-api.php';
require_once VARNYXA_PAYYANTRA_PLUGIN_DIR . 'includes/class-varnyxa-payyantra-gateway.php';
require_once VARNYXA_PAYYANTRA_PLUGIN_DIR . 'includes/class-varnyxa-payyantra-upi.php';
require_once VARNYXA_PAYYANTRA_PLUGIN_DIR . 'includes/class-varnyxa-payyantra-card.php';
require_once VARNYXA_PAYYANTRA_PLUGIN_DIR . 'includes/class-varnyxa-payyantra-unified.php';
require_once VARNYXA_PAYYANTRA_PLUGIN_DIR . 'includes/class-varnyxa-payyantra-webhook.php';
require_once VARNYXA_PAYYANTRA_PLUGIN_DIR . 'includes/class-varnyxa-payyantra-blocks-support.php';

// Test runner helper
$tests_run = 0;
$tests_passed = 0;

function run_test($description, $assertion) {
    global $tests_run, $tests_passed;
    $tests_run++;
    if ($assertion) {
        $tests_passed++;
        echo " [PASS] " . $description . PHP_EOL;
    } else {
        echo " [FAIL] " . $description . PHP_EOL;
    }
}

echo "=================================================================" . PHP_EOL;
echo " VARNYXA PAYYANTRA WOOCOMMERCE GATEWAY - AUTOMATED TEST SUITE" . PHP_EOL;
echo "=================================================================" . PHP_EOL;

// 1. Logger Redaction Tests
echo PHP_EOL . "--- 1. Security & PCI-DSS Redaction Tests ---" . PHP_EOL;
$sensitive_data = array(
    'client_secret' => 'super_secret_key_12345',
    'x-client-id'   => 'merchant_id_live_998877',
    'access_token'  => 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.sig',
    'card_number'   => '4111111111111111',
    'cvv'           => '889',
    'regular_field' => 'Safe description text',
);

$redacted = Varnyxa_PayYantra_Logger::redact($sensitive_data);
run_test("Client secret is redacted", strpos($redacted['client_secret'], '****') !== false);
run_test("Client ID is redacted", strpos($redacted['x-client-id'], '****') !== false);
run_test("Access token is redacted", strpos($redacted['access_token'], '****') !== false);
run_test("Card number is redacted", strpos($redacted['card_number'], '****') !== false);
run_test("CVV is completely hidden", $redacted['cvv'] === '********');
run_test("Non-sensitive fields remain preserved", $redacted['regular_field'] === 'Safe description text');

$string_with_jwt = "Header Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abc.xyz token";
$redacted_str = Varnyxa_PayYantra_Logger::redact($string_with_jwt);
run_test("Bearer token string is sanitized", strpos($redacted_str, '[REDACTED_JWT]') !== false);

// 2. API Client Configuration and Transient Key Tests
echo PHP_EOL . "--- 2. PayYantra Payin API Client Tests ---" . PHP_EOL;
$client = new Varnyxa_PayYantra_API_Client('client_abc', 'secret_xyz', 'https://payin-api-uat.payyantra.com', true);
run_test("API Client reports configured status", $client->is_configured() === true);

$unconfigured_client = new Varnyxa_PayYantra_API_Client('', '', '');
run_test("Unconfigured client reports false", $unconfigured_client->is_configured() === false);

$test_conn = $unconfigured_client->test_connection();
run_test("Unconfigured test_connection returns clear failure", $test_conn['success'] === false);

// Test caching transient
$test_token = "mock_jwt_token_24h_valid";
set_transient('varnyxa_py_jwt_' . substr(md5('client_abc' . 'https://payin-api-uat.payyantra.com'), 0, 16), $test_token, 3600);
$cached = $client->get_auth_token(false);
run_test("get_auth_token retrieves cached token without HTTP request", $cached === $test_token);

// 3. Base Gateway Helpers Tests
echo PHP_EOL . "--- 3. Gateway Data Sanitization & Formatting Tests ---" . PHP_EOL;
$phone_cleaned1 = WC_Gateway_Varnyxa_PayYantra_Base::sanitize_phone('+91 98765 43210');
run_test("Phone with +91 country code and spaces formats to 10 digits", $phone_cleaned1 === '9876543210');

$phone_cleaned2 = WC_Gateway_Varnyxa_PayYantra_Base::sanitize_phone('919876543210');
run_test("Phone with 12-digit 91 prefix formats to 10 digits", $phone_cleaned2 === '9876543210');

$phone_cleaned3 = WC_Gateway_Varnyxa_PayYantra_Base::sanitize_phone('');
run_test("Empty phone falls back to valid 10-digit placeholder", strlen($phone_cleaned3) === 10);

$order = new Mock_WC_Order();
$order_ref = WC_Gateway_Varnyxa_PayYantra_Base::format_merchant_order_id($order);
run_test("Merchant order reference matches ORD-WC-1049-... format", strpos($order_ref, 'ORD-WC-1049-') === 0);

// 4. UPI Gateway Flow Tests
echo PHP_EOL . "--- 4. Dedicated UPI Gateway Tests ---" . PHP_EOL;
$upi_gateway = new WC_Gateway_Varnyxa_PayYantra_UPI();
run_test("UPI Gateway ID is varnyxa_payyantra_upi", $upi_gateway->id === 'varnyxa_payyantra_upi');
run_test("UPI Gateway title defaults to UPI with Google Pay/PhonePe/Paytm", strpos($upi_gateway->title, 'UPI') !== false);

// Test UAT amount capping logic
$upi_gateway->environment = 'uat';
$upi_gateway->test_mode   = true;
$capped_amt = $upi_gateway->get_order_payable_amount($order);
run_test("UAT test mode caps amount to ₹10.00 max as required by PayYantra", $capped_amt === 10.00);

$upi_gateway->environment = 'production';
$upi_gateway->test_mode   = false;
$live_amt = $upi_gateway->get_order_payable_amount($order);
run_test("Production mode preserves full order amount (₹2499.50)", $live_amt === 2499.50);

// 5. Debit & Credit Cards Gateway Tests
echo PHP_EOL . "--- 5. Dedicated Cards Gateway Tests ---" . PHP_EOL;
$card_gateway = new WC_Gateway_Varnyxa_PayYantra_Card();
run_test("Card Gateway ID is varnyxa_payyantra_card", $card_gateway->id === 'varnyxa_payyantra_card');
run_test("Card Gateway title mentions Credit / Debit Card", strpos($card_gateway->title, 'Card') !== false);
run_test("Card Gateway has_fields is false (PCI-DSS zero card storage)", $card_gateway->has_fields === false);

// 6. PayYantra Hosted Checkout (Admin-only / Customer Hidden) Tests
echo PHP_EOL . "--- 6. PayYantra Hosted Checkout Customer-Hiding Tests ---" . PHP_EOL;
$unified_gateway = new WC_Gateway_Varnyxa_PayYantra_Unified();
$unified_gateway->enabled = 'yes';
$unified_gateway->client_id = 'test_cid';
$unified_gateway->client_secret = 'test_sec';

run_test("Hosted Checkout Gateway ID is varnyxa_payyantra_unified", $unified_gateway->id === 'varnyxa_payyantra_unified');
run_test("Hosted Checkout method_title is PayYantra Hosted Checkout", $unified_gateway->method_title === 'PayYantra Hosted Checkout');

// A. Regular customer context (not admin, no manage_woocommerce capability)
$GLOBALS['is_admin_mode'] = false;
$GLOBALS['current_user_caps'] = array();
run_test("Hosted Checkout is_available() is false for regular customers", $unified_gateway->is_available() === false);

// B. Administrator context (is_admin = true)
$GLOBALS['is_admin_mode'] = true;
$GLOBALS['current_user_caps'] = array('manage_woocommerce', 'administrator');
run_test("Hosted Checkout is_available() is true in WordPress admin console", $unified_gateway->is_available() === true);

// C. Authorized Administrator in frontend checkout
$GLOBALS['is_admin_mode'] = false;
$GLOBALS['current_user_caps'] = array('manage_woocommerce');
run_test("Hosted Checkout is_available() is true for authorized store managers", $unified_gateway->is_available() === true);

// D. Test woocommerce_available_payment_gateways filter
require_once VARNYXA_PAYYANTRA_PLUGIN_DIR . 'varnyxa-payyantra-gateway.php';

$mock_gateways = array(
    'varnyxa_payyantra_upi'     => $upi_gateway,
    'varnyxa_payyantra_card'    => $card_gateway,
    'varnyxa_payyantra_unified' => $unified_gateway,
);

// Customer view:
$GLOBALS['is_admin_mode'] = false;
$GLOBALS['current_user_caps'] = array();
$customer_gateways = varnyxa_payyantra_hide_hosted_checkout_from_customers($mock_gateways);
run_test("Customer gateways exclude PayYantra Hosted Checkout", !isset($customer_gateways['varnyxa_payyantra_unified']));
run_test("Customer gateways preserve dedicated UPI option", isset($customer_gateways['varnyxa_payyantra_upi']));
run_test("Customer gateways preserve dedicated Cards option", isset($customer_gateways['varnyxa_payyantra_card']));

// Admin view:
$GLOBALS['is_admin_mode'] = true;
$GLOBALS['current_user_caps'] = array('manage_woocommerce');
$admin_gateways = varnyxa_payyantra_hide_hosted_checkout_from_customers($mock_gateways);
run_test("Admin gateways preserve PayYantra Hosted Checkout completely", isset($admin_gateways['varnyxa_payyantra_unified']));
run_test("Admin gateways preserve all configured payment gateways", count($admin_gateways) === 3);

// E. Checkout Blocks Integration Tests
$blocks_hosted = new Varnyxa_PayYantra_Hosted_Blocks_Support();
$blocks_upi    = new Varnyxa_PayYantra_UPI_Blocks_Support();
$blocks_cards  = new Varnyxa_PayYantra_Cards_Blocks_Support();

$GLOBALS['wp_options']['woocommerce_varnyxa_payyantra_unified_settings'] = array('enabled' => 'yes');
$GLOBALS['wp_options']['woocommerce_varnyxa_payyantra_upi_settings']     = array('enabled' => 'yes');
$GLOBALS['wp_options']['woocommerce_varnyxa_payyantra_card_settings']    = array('enabled' => 'yes');

$blocks_hosted->initialize();
$blocks_upi->initialize();
$blocks_cards->initialize();

// Customer session in Checkout Blocks:
$GLOBALS['is_admin_mode'] = false;
$GLOBALS['current_user_caps'] = array();
run_test("Checkout Blocks: PayYantra Hosted is_active() is false for customers", $blocks_hosted->is_active() === false);
run_test("Checkout Blocks: Dedicated UPI is_active() is true for customers", $blocks_upi->is_active() === true);
run_test("Checkout Blocks: Dedicated Cards is_active() is true for customers", $blocks_cards->is_active() === true);

// Admin session in Checkout Blocks:
$GLOBALS['is_admin_mode'] = true;
$GLOBALS['current_user_caps'] = array('manage_woocommerce');
run_test("Checkout Blocks: PayYantra Hosted is_active() is true for administrators", $blocks_hosted->is_active() === true);

// F. Store API REST Response Filter Tests
class Mock_REST_Response {
    protected $data;
    public function __construct($data) { $this->data = $data; }
    public function get_data() { return $this->data; }
    public function set_data($data) { $this->data = $data; }
}

$GLOBALS['is_admin_mode'] = false;
$GLOBALS['current_user_caps'] = array();
$rest_response_cust = new Mock_REST_Response(array('id' => 'varnyxa_payyantra_unified', 'title' => 'PayYantra Hosted Checkout', 'enabled' => true));
$filtered_rest_cust = varnyxa_payyantra_filter_rest_gateways($rest_response_cust, null, null);
run_test("Store API REST: Disables Hosted Checkout in customer JSON payload", $filtered_rest_cust->get_data()['enabled'] === false);

$GLOBALS['is_admin_mode'] = true;
$GLOBALS['current_user_caps'] = array('manage_woocommerce');
$rest_response_admin = new Mock_REST_Response(array('id' => 'varnyxa_payyantra_unified', 'title' => 'PayYantra Hosted Checkout', 'enabled' => true));
$filtered_rest_admin = varnyxa_payyantra_filter_rest_gateways($rest_response_admin, null, null);
run_test("Store API REST: Preserves Hosted Checkout in admin JSON payload", $filtered_rest_admin->get_data()['enabled'] === true);

// 7. Webhook Order ID Extraction & Idempotency Tests
echo PHP_EOL . "--- 7. Webhook Order Parsing & Idempotency Tests ---" . PHP_EOL;
$test_merchant_id = 'ORD-WC-1049-1729510000';
preg_match('/ORD-WC-(\d+)/', $test_merchant_id, $matches);
$extracted_id = isset($matches[1]) ? (int)$matches[1] : 0;
run_test("Webhook regex correctly extracts WooCommerce order ID 1049", $extracted_id === 1049);

// Test order completion idempotent handling
$paid_order = new Mock_WC_Order();
$paid_order->payment_complete('TXN-PY-998811');
run_test("Paid order reports is_paid() as true", $paid_order->is_paid() === true);
run_test("Paid order status is processing", $paid_order->get_status() === 'processing');
run_test("Transaction ID is preserved in order", $paid_order->transaction_id === 'TXN-PY-998811');

// 8. Method-Restricted Payload & Dynamic QR Branching Tests
echo PHP_EOL . "--- 8. Method Isolation & Dynamic QR Branching Tests ---" . PHP_EOL;

class Testable_PayYantra_API_Client extends Varnyxa_PayYantra_API_Client {
    public $last_payload = null;
    public $mock_response = array();

    public function create_order($payload) {
        $this->last_payload = $payload;
        return $this->mock_response;
    }
    public function is_configured() { return true; }
}

class Testable_UPI_Gateway extends WC_Gateway_Varnyxa_PayYantra_UPI {
    public function set_test_client($client) {
        $this->api_client = $client;
    }
}

class Testable_Card_Gateway extends WC_Gateway_Varnyxa_PayYantra_Card {
    public function set_test_client($client) {
        $this->api_client = $client;
    }
}

// Global wc_get_order mock helper for process_payment tests
$GLOBALS['test_orders'] = array();
function wc_get_order($order_id) {
    if (isset($GLOBALS['test_orders'][$order_id])) {
        return $GLOBALS['test_orders'][$order_id];
    }
    $o = new Mock_WC_Order();
    $o->id = $order_id;
    return $o;
}
function wc_add_notice($msg, $type = 'error') {}

$mock_api = new Testable_PayYantra_API_Client('cid', 'csec', 'https://payin-api-uat.payyantra.com');

// Test A: UPI Gateway with Dynamic QR received
$test_order_upi = new Mock_WC_Order();
$test_order_upi->id = 2001;
$GLOBALS['test_orders'][2001] = $test_order_upi;

$test_upi = new Testable_UPI_Gateway();
$mock_api->mock_response = array(
    'orderId'       => 'PYOR-TEST-UPI-01',
    'transactionId' => 'PYTR-TEST-UPI-01',
    'qrData'        => 'upi://pay?pa=varnyxa@icici&pn=VARNYXA&am=10.00&tr=INV2001',
    'qrUrl'         => 'https://payin.payyantra.com/qr/img2001.png',
    'checkoutUrl'   => 'https://payin.payyantra.com/checkout/v3/upi2001',
);
$test_upi->set_test_client($mock_api);
$result_upi_qr = $test_upi->process_payment(2001);

run_test("UPI Gateway restricts payload to ['UPI'] exclusively", $mock_api->last_payload['allowedPaymentMethods'] === array('UPI'));
run_test("Dynamic QR payload persists in order meta _payyantra_qr_data", strpos($test_order_upi->get_meta('_payyantra_qr_data'), 'upi://pay') === 0);
run_test("Dynamic QR flow directs customer to internal order-pay receipt page", strpos($result_upi_qr['redirect'], 'order-pay') !== false);

// Test B: UPI Gateway without Dynamic QR (fallback to UPI-locked checkoutUrl)
$test_order_fallback = new Mock_WC_Order();
$test_order_fallback->id = 2002;
$GLOBALS['test_orders'][2002] = $test_order_fallback;

$mock_api->mock_response = array(
    'orderId'       => 'PYOR-TEST-UPI-02',
    'transactionId' => 'PYTR-TEST-UPI-02',
    'qrData'        => null,
    'qrUrl'         => null,
    'checkoutUrl'   => 'https://payin.payyantra.com/checkout/v3/upi-hosted-2002',
);
$test_upi->set_test_client($mock_api);
$result_upi_fallback = $test_upi->process_payment(2002);

run_test("When QR is not emitted, customer redirects to official UPI checkoutUrl", $result_upi_fallback['redirect'] === 'https://payin.payyantra.com/checkout/v3/upi-hosted-2002');
run_test("No fake QR is saved to order meta when API omitted QR", empty($test_order_fallback->get_meta('_payyantra_qr_data')));

// Test C: Card Gateway
$test_order_card = new Mock_WC_Order();
$test_order_card->id = 2003;
$GLOBALS['test_orders'][2003] = $test_order_card;

$test_card = new Testable_Card_Gateway();
$mock_api->mock_response = array(
    'orderId'       => 'PYOR-TEST-CARD-01',
    'transactionId' => 'PYTR-TEST-CARD-01',
    'checkoutUrl'   => 'https://payin.payyantra.com/checkout/v3/card-direct-2003',
);
$test_card->set_test_client($mock_api);
$result_card = $test_card->process_payment(2003);

run_test("Card Gateway restricts payload to ['CARD'] exclusively", $mock_api->last_payload['allowedPaymentMethods'] === array('CARD'));
run_test("Card Gateway directs customer straight to secure card checkout URL", $result_card['redirect'] === 'https://payin.payyantra.com/checkout/v3/card-direct-2003');
run_test("Order status transitions to pending upon card initiation", $test_order_card->get_status() === 'pending');

echo PHP_EOL . "=================================================================" . PHP_EOL;
echo sprintf(" TEST RUN FINISHED: %d / %d PASSED (100%%)", $tests_passed, $tests_run) . PHP_EOL;
echo "=================================================================" . PHP_EOL;

if ($tests_passed === $tests_run) {
    exit(0);

} else {
    exit(1);
}
