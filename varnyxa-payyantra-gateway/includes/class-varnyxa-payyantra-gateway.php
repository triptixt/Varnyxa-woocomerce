<?php
/**
 * VARNYXA PayYantra Base Gateway Abstract Class
 *
 * Provides shared settings, environment resolution (UAT vs Production),
 * order payload creation, HPOS compatibility, and admin configuration.
 *
 * @package   VARNYXA_PayYantra_Gateway
 * @author    VARNYXA Haute Couture
 * @license   Proprietary
 */

if (!defined('ABSPATH')) {
    exit;
}

abstract class WC_Gateway_Varnyxa_PayYantra_Base extends WC_Payment_Gateway {

    /**
     * Selected environment ('uat' or 'production').
     *
     * @var string
     */
    public $environment;

    /**
     * Active API Client ID.
     *
     * @var string
     */
    public $client_id;

    /**
     * Active API Client Secret.
     *
     * @var string
     */
    public $client_secret;

    /**
     * Active API Base URL.
     *
     * @var string
     */
    public $api_base_url;

    /**
     * Test mode flag.
     *
     * @var bool
     */
    public $test_mode;

    /**
     * Debug logging flag.
     *
     * @var bool
     */
    public $debug_log;

    /**
     * Webhook secret token.
     *
     * @var string
     */
    public $webhook_secret;

    /**
     * Cached API Client instance.
     *
     * @var Varnyxa_PayYantra_API_Client|null
     */
    protected $api_client = null;

    /**
     * Base Constructor.
     */
    public function __construct() {
        $this->has_fields = false;
        $this->supports   = array('products');

        $this->init_form_fields();
        $this->init_settings();

        $this->enabled        = $this->get_option('enabled', 'no');
        $this->title          = $this->get_option('title');
        $this->description    = $this->get_option('description');
        $this->environment    = $this->get_option('environment', 'uat');
        $this->test_mode      = 'yes' === $this->get_option('test_mode', 'yes');
        $this->debug_log      = 'yes' === $this->get_option('debug_log', 'no');
        $this->webhook_secret = $this->get_option('webhook_secret', '');

        // Resolve active credentials based on environment
        if ('production' === $this->environment) {
            $this->client_id     = trim((string)$this->get_option('prod_client_id'));
            $this->client_secret = trim((string)$this->get_option('prod_client_secret'));
            $this->api_base_url  = trim((string)$this->get_option('prod_base_url', 'https://payin-api.payyantra.com'));
        } else {
            $this->client_id     = trim((string)$this->get_option('uat_client_id'));
            $this->client_secret = trim((string)$this->get_option('uat_client_secret'));
            $this->api_base_url  = trim((string)$this->get_option('uat_base_url', 'https://payin-api-uat.payyantra.com'));
        }

        // Save settings hook
        add_action('woocommerce_update_options_payment_gateways_' . $this->id, array($this, 'process_admin_options'));
    }

    /**
     * Get shared form fields for PayYantra settings.
     */
    public function get_common_form_fields() {
        return array(
            'enabled' => array(
                'title'       => __('Enable/Disable', 'varnyxa-payyantra-gateway'),
                'type'        => 'checkbox',
                'label'       => sprintf(__('Enable %s', 'varnyxa-payyantra-gateway'), $this->method_title),
                'default'     => 'no',
            ),
            'title' => array(
                'title'       => __('Title', 'varnyxa-payyantra-gateway'),
                'type'        => 'text',
                'description' => __('Payment method title displayed to the customer at checkout.', 'varnyxa-payyantra-gateway'),
                'default'     => $this->method_title,
                'desc_tip'    => true,
            ),
            'description' => array(
                'title'       => __('Description', 'varnyxa-payyantra-gateway'),
                'type'        => 'textarea',
                'description' => __('Payment method description displayed to the customer at checkout.', 'varnyxa-payyantra-gateway'),
                'default'     => $this->method_description,
            ),
            'environment' => array(
                'title'       => __('Environment', 'varnyxa-payyantra-gateway'),
                'type'        => 'select',
                'description' => __('Select PayYantra gateway environment. Use UAT for testing before going live.', 'varnyxa-payyantra-gateway'),
                'default'     => 'uat',
                'desc_tip'    => true,
                'options'     => array(
                    'uat'        => __('UAT / Sandbox (payin-api-uat.payyantra.com)', 'varnyxa-payyantra-gateway'),
                    'production' => __('Production / Live (payin-api.payyantra.com)', 'varnyxa-payyantra-gateway'),
                ),
            ),
            'test_mode' => array(
                'title'       => __('UAT Test Amount Cap', 'varnyxa-payyantra-gateway'),
                'type'        => 'checkbox',
                'label'       => __('Cap orders to ₹10.00 in UAT (PayYantra UAT requirement)', 'varnyxa-payyantra-gateway'),
                'default'     => 'yes',
                'description' => __('PayYantra UAT sandbox specifies test amounts must be ≤ 10 INR for testing transactions.', 'varnyxa-payyantra-gateway'),
            ),
            'uat_heading' => array(
                'title'       => __('UAT Sandbox Credentials', 'varnyxa-payyantra-gateway'),
                'type'        => 'title',
                'description' => __('Enter the sandbox credentials obtained from your PayYantra merchant onboarding team.', 'varnyxa-payyantra-gateway'),
            ),
            'uat_base_url' => array(
                'title'       => __('UAT Base URL', 'varnyxa-payyantra-gateway'),
                'type'        => 'text',
                'default'     => 'https://payin-api-uat.payyantra.com',
                'description' => __('Official PayYantra UAT sandbox API base URL.', 'varnyxa-payyantra-gateway'),
            ),
            'uat_client_id' => array(
                'title'       => __('UAT Client ID', 'varnyxa-payyantra-gateway'),
                'type'        => 'text',
                'description' => __('Sent as the x-client-id header.', 'varnyxa-payyantra-gateway'),
            ),
            'uat_client_secret' => array(
                'title'       => __('UAT Client Secret', 'varnyxa-payyantra-gateway'),
                'type'        => 'password',
                'description' => __('Sent as the x-client-secret header. Stored securely and never exposed in logs or frontend.', 'varnyxa-payyantra-gateway'),
            ),
            'prod_heading' => array(
                'title'       => __('Production Credentials', 'varnyxa-payyantra-gateway'),
                'type'        => 'title',
                'description' => __('Live credentials for actual payment processing. Never share or commit production secrets.', 'varnyxa-payyantra-gateway'),
            ),
            'prod_base_url' => array(
                'title'       => __('Production Base URL', 'varnyxa-payyantra-gateway'),
                'type'        => 'text',
                'default'     => 'https://payin-api.payyantra.com',
                'description' => __('Official PayYantra Production API base URL.', 'varnyxa-payyantra-gateway'),
            ),
            'prod_client_id' => array(
                'title'       => __('Production Client ID', 'varnyxa-payyantra-gateway'),
                'type'        => 'text',
                'description' => __('Production client ID from PayYantra merchant portal.', 'varnyxa-payyantra-gateway'),
            ),
            'prod_client_secret' => array(
                'title'       => __('Production Client Secret', 'varnyxa-payyantra-gateway'),
                'type'        => 'password',
                'description' => __('Production client secret. Redacted in all diagnostic output.', 'varnyxa-payyantra-gateway'),
            ),
            'security_heading' => array(
                'title'       => __('Security & Diagnostics', 'varnyxa-payyantra-gateway'),
                'type'        => 'title',
                'description' => __('Webhook and diagnostic logging settings.', 'varnyxa-payyantra-gateway'),
            ),
            'webhook_secret' => array(
                'title'       => __('Webhook Verification Secret', 'varnyxa-payyantra-gateway'),
                'type'        => 'text',
                'description' => __('Optional secret used to verify incoming PayYantra notifyUrl callbacks.', 'varnyxa-payyantra-gateway'),
                'default'     => '',
            ),
            'debug_log' => array(
                'title'       => __('Diagnostic Logging', 'varnyxa-payyantra-gateway'),
                'type'        => 'checkbox',
                'label'       => __('Log API transactions to WooCommerce > Status > Logs', 'varnyxa-payyantra-gateway'),
                'default'     => 'no',
                'description' => __('Sensitive credentials and card numbers are automatically redacted from logs.', 'varnyxa-payyantra-gateway'),
            ),
        );
    }

    /**
     * Get instance of the PayYantra API client.
     *
     * @return Varnyxa_PayYantra_API_Client
     */
    public function get_api_client() {
        if (null === $this->api_client) {
            $this->api_client = new Varnyxa_PayYantra_API_Client(
                $this->client_id,
                $this->client_secret,
                $this->api_base_url,
                $this->test_mode && 'uat' === $this->environment
            );
        }
        return $this->api_client;
    }

    /**
     * Check if this gateway is available for use.
     *
     * @return bool
     */
    public function is_available() {
        $is_available = ('yes' === $this->enabled);

        if ($is_available) {
            // Must have credentials
            if (empty($this->client_id) || empty($this->client_secret)) {
                return false;
            }

            // PayYantra supports INR
            $currency = get_woocommerce_currency();
            if ('INR' !== $currency) {
                return false;
            }
        }

        return $is_available;
    }

    /**
     * Clean phone number into valid 10-digit format for PayYantra.
     *
     * @param string $phone Raw phone string from order.
     * @return string 10-digit phone number.
     */
    public static function sanitize_phone($phone) {
        $clean = preg_replace('/[^0-9]/', '', (string)$phone);
        if (strlen($clean) > 10) {
            // If phone starts with 91, strip country code
            if ('91' === substr($clean, 0, 2) && strlen($clean) === 12) {
                $clean = substr($clean, 2);
            } else {
                $clean = substr($clean, -10);
            }
        } elseif (strlen($clean) < 10) {
            // Fallback placeholder if customer left phone blank or invalid
            $clean = '9876543210';
        }
        return $clean;
    }

    /**
     * Calculate payable amount for order, enforcing UAT cap if test mode active.
     *
     * @param WC_Order $order WooCommerce order object.
     * @return float Payable amount.
     */
    public function get_order_payable_amount($order) {
        $total = round((float)$order->get_total(), 2);
        if ($this->test_mode && 'uat' === $this->environment) {
            return min($total, 10.00);
        }
        return $total;
    }

    /**
     * Format merchant order reference for PayYantra.
     *
     * @param WC_Order $order WooCommerce order.
     * @return string Unique merchant order ID.
     */
    public static function format_merchant_order_id($order) {
        return 'ORD-WC-' . $order->get_id() . '-' . time();
    }

    /**
     * Get the notifyUrl for server-to-server webhook delivery.
     *
     * @return string Fully qualified webhook URL.
     */
    public function get_notify_url() {
        return WC()->api_request_url('varnyxa_payyantra_webhook');
    }

    /**
     * Render administrative settings with VARNYXA branding and diagnostics.
     */
    public function admin_options() {
        $client = $this->get_api_client();
        $is_configured = $client->is_configured();
        $env_label = ('production' === $this->environment) ? 'Production (Live)' : 'UAT Sandbox';
        $env_badge_class = ('production' === $this->environment) ? 'badge-live' : 'badge-uat';

        echo '<div class="varnyxa-admin-wrap">';
        echo '<div class="varnyxa-admin-header">';
        echo '<div class="varnyxa-logo-title">';
        echo '<h2>VARNYXA <span class="gold-text">PayYantra Gateway</span></h2>';
        echo '<p class="tagline">' . esc_html__('Haute Couture & Bespoke Fashion Payment Engine', 'varnyxa-payyantra-gateway') . '</p>';
        echo '</div>';
        echo '<div class="varnyxa-status-badges">';
        echo '<span class="v-badge ' . esc_attr($env_badge_class) . '">' . esc_html($env_label) . '</span>';
        if ($is_configured) {
            echo '<span class="v-badge badge-configured">' . esc_html__('Configured', 'varnyxa-payyantra-gateway') . '</span>';
        } else {
            echo '<span class="v-badge badge-missing">' . esc_html__('Missing Credentials', 'varnyxa-payyantra-gateway') . '</span>';
        }
        echo '</div>';
        echo '</div>';

        if (!$is_configured) {
            echo '<div class="notice notice-warning inline"><p><strong>' . esc_html__('Configuration Notice:', 'varnyxa-payyantra-gateway') . '</strong> ' .
                 esc_html__('Please enter your PayYantra Client ID and Client Secret below to enable checkout processing.', 'varnyxa-payyantra-gateway') . '</p></div>';
        }

        echo '<table class="form-table">';
        $this->generate_settings_html();
        echo '</table>';

        echo '<div class="varnyxa-diagnostics-box">';
        echo '<h3>' . esc_html__('Gateway Diagnostics & Webhook URL', 'varnyxa-payyantra-gateway') . '</h3>';
        echo '<p>' . esc_html__('Configure this Webhook Notification URL in your PayYantra Merchant Portal:', 'varnyxa-payyantra-gateway') . '</p>';
        echo '<code>' . esc_url($this->get_notify_url()) . '</code>';
        echo '</div>';

        echo '</div>';
    }
}
