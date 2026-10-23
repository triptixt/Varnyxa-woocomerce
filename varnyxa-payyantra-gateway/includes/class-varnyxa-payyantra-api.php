<?php
/**
 * VARNYXA PayYantra Payin API Client
 *
 * Implements official PayYantra Payin API (2024-01-01 specification):
 * - Token API (/api/auth/token) with 24h transient caching
 * - Create Order API (/api/v2/merchant/orders) supporting method restrictions (UPI, CARD)
 * - Order Status API (/api/pay/status/{orderId} & /api/pay/status/by-reference/{referenceId})
 *
 * @package   VARNYXA_PayYantra_Gateway
 * @author    VARNYXA Haute Couture
 * @license   Proprietary
 */

if (!defined('ABSPATH')) {
    exit;
}

class Varnyxa_PayYantra_API_Client {

    /**
     * API Client ID (x-client-id).
     *
     * @var string
     */
    protected $client_id;

    /**
     * API Client Secret (x-client-secret).
     *
     * @var string
     */
    protected $client_secret;

    /**
     * Base Gateway URL.
     *
     * @var string
     */
    protected $base_url;

    /**
     * Test mode flag.
     *
     * @var bool
     */
    protected $test_mode;

    /**
     * HTTP Request timeout in seconds.
     *
     * @var int
     */
    protected $timeout = 35;

    /**
     * API Version header value.
     */
    const API_VERSION = '2024-01-01';

    /**
     * Constructor.
     *
     * @param string $client_id     Merchant Client ID.
     * @param string $client_secret Merchant Client Secret.
     * @param string $base_url      Gateway base endpoint URL.
     * @param bool   $test_mode     Sandbox / test mode flag.
     */
    public function __construct($client_id, $client_secret, $base_url, $test_mode = false) {
        $this->client_id     = trim((string)$client_id);
        $this->client_secret = trim((string)$client_secret);
        $this->base_url      = untrailingslashit(trim((string)$base_url));
        $this->test_mode     = (bool)$test_mode;
    }

    /**
     * Check if merchant credentials are fully configured.
     *
     * @return bool
     */
    public function is_configured() {
        return !empty($this->client_id) && !empty($this->client_secret) && !empty($this->base_url);
    }

    /**
     * Get unique transient key for caching Bearer token per client ID.
     *
     * @return string
     */
    protected function get_transient_key() {
        return 'varnyxa_py_jwt_' . substr(md5($this->client_id . $this->base_url), 0, 16);
    }

    /**
     * Obtain a valid Bearer JWT.
     * Uses WordPress Transients for 23-hour caching (token lasts 24h).
     *
     * @param bool $force_refresh Force a new token request.
     * @return string|WP_Error Bearer token string or WP_Error.
     */
    public function get_auth_token($force_refresh = false) {
        if (!$this->is_configured()) {
            return new WP_Error(
                'payyantra_unconfigured',
                __('PayYantra credentials (Client ID and Client Secret) are not configured in WooCommerce settings.', 'varnyxa-payyantra-gateway')
            );
        }

        $transient_key = $this->get_transient_key();

        if (!$force_refresh) {
            $cached_token = get_transient($transient_key);
            if (!empty($cached_token) && is_string($cached_token)) {
                return $cached_token;
            }
        }

        $endpoint = $this->base_url . '/api/auth/token';
        $headers  = array(
            'x-client-id'     => $this->client_id,
            'x-client-secret' => $this->client_secret,
            'x-api-version'   => self::API_VERSION,
            'Accept'          => 'application/json',
        );

        Varnyxa_PayYantra_Logger::info('Requesting new Bearer JWT from PayYantra Token API', array(
            'endpoint' => $endpoint,
            'client_id_len' => strlen($this->client_id),
        ));

        $response = wp_remote_post($endpoint, array(
            'headers'     => $headers,
            'timeout'     => $this->timeout,
            'sslverify'   => true,
            'httpversion' => '1.1',
        ));

        if (is_wp_error($response)) {
            Varnyxa_PayYantra_Logger::error('Token API HTTP communication failure', array('error' => $response->get_error_message()));
            return new WP_Error('payyantra_network_error', sprintf(__('Failed to connect to PayYantra server: %s', 'varnyxa-payyantra-gateway'), $response->get_error_message()));
        }

        $status_code = wp_remote_retrieve_response_code($response);
        $body_raw    = wp_remote_retrieve_body($response);
        $body        = json_decode($body_raw, true);

        if (200 !== $status_code) {
            $error_detail = isset($body['message']) ? $body['message'] : (isset($body['error']) ? $body['error'] : 'HTTP ' . $status_code);
            Varnyxa_PayYantra_Logger::error('Token API authentication rejected', array(
                'status_code' => $status_code,
                'response'    => $error_detail,
            ));

            if (401 === $status_code) {
                return new WP_Error('payyantra_auth_failed', __('Invalid PayYantra Client ID or Client Secret. Please verify your credentials.', 'varnyxa-payyantra-gateway'));
            }

            return new WP_Error('payyantra_api_error', sprintf(__('PayYantra authentication failed (%d): %s', 'varnyxa-payyantra-gateway'), $status_code, $error_detail));
        }

        $token = isset($body['data']['token']) ? trim($body['data']['token']) : '';
        if (empty($token)) {
            Varnyxa_PayYantra_Logger::error('Token API response missing token field', array('body' => $body));
            return new WP_Error('payyantra_invalid_token', __('Invalid token response returned from PayYantra.', 'varnyxa-payyantra-gateway'));
        }

        // Cache for 23 hours (82800 seconds)
        set_transient($transient_key, $token, 23 * HOUR_IN_SECONDS);
        Varnyxa_PayYantra_Logger::info('PayYantra Bearer JWT obtained and cached successfully.');

        return $token;
    }

    /**
     * Create a new payment order session on PayYantra.
     *
     * @param array $payload Order creation payload matching OpenAPI spec.
     * @return array|WP_Error Response data array or WP_Error on failure.
     */
    public function create_order($payload) {
        $token = $this->get_auth_token();
        if (is_wp_error($token)) {
            return $token;
        }

        $endpoint = $this->base_url . '/api/v2/merchant/orders';
        $headers  = array(
            'Authorization' => 'Bearer ' . $token,
            'Content-Type'  => 'application/json',
            'Accept'        => 'application/json',
        );

        Varnyxa_PayYantra_Logger::info('Initiating PayYantra Create Order API', array(
            'endpoint'    => $endpoint,
            'orderId'     => isset($payload['orderId']) ? $payload['orderId'] : null,
            'amount'      => isset($payload['amount']) ? $payload['amount'] : null,
            'currency'    => isset($payload['currency']) ? $payload['currency'] : null,
            'methods'     => isset($payload['allowedPaymentMethods']) ? $payload['allowedPaymentMethods'] : null,
        ));

        $response = wp_remote_post($endpoint, array(
            'headers'     => $headers,
            'body'        => wp_json_encode($payload),
            'timeout'     => $this->timeout,
            'sslverify'   => true,
            'httpversion' => '1.1',
        ));

        if (is_wp_error($response)) {
            Varnyxa_PayYantra_Logger::error('Create Order API network error', array('error' => $response->get_error_message()));
            return new WP_Error('payyantra_order_network_error', sprintf(__('Network error connecting to PayYantra: %s', 'varnyxa-payyantra-gateway'), $response->get_error_message()));
        }

        $status_code = wp_remote_retrieve_response_code($response);
        $body_raw    = wp_remote_retrieve_body($response);
        $body        = json_decode($body_raw, true);

        // If token expired unexpectedly (401), clear cache and retry once
        if (401 === $status_code) {
            Varnyxa_PayYantra_Logger::warning('Received 401 during Create Order. Refreshing token and retrying...');
            delete_transient($this->get_transient_key());
            $token = $this->get_auth_token(true);
            if (is_wp_error($token)) {
                return $token;
            }
            $headers['Authorization'] = 'Bearer ' . $token;
            $response = wp_remote_post($endpoint, array(
                'headers' => $headers,
                'body'    => wp_json_encode($payload),
                'timeout' => $this->timeout,
            ));
            $status_code = wp_remote_retrieve_response_code($response);
            $body_raw    = wp_remote_retrieve_body($response);
            $body        = json_decode($body_raw, true);
        }

        if (!in_array($status_code, array(200, 201), true)) {
            $error_msg = isset($body['message']) ? $body['message'] : (isset($body['error']) ? $body['error'] : 'HTTP ' . $status_code);
            Varnyxa_PayYantra_Logger::error('PayYantra Create Order rejected', array(
                'status_code' => $status_code,
                'error'       => $error_msg,
                'body'        => $body_raw,
            ));
            return new WP_Error('payyantra_order_creation_failed', sprintf(__('Payment initiation failed (%d): %s', 'varnyxa-payyantra-gateway'), $status_code, $error_msg));
        }

        $order_data = isset($body['data']) && is_array($body['data']) ? $body['data'] : array();
        Varnyxa_PayYantra_Logger::info('PayYantra order created successfully', array(
            'orderId'        => isset($order_data['orderId']) ? $order_data['orderId'] : null,
            'transactionId'  => isset($order_data['transactionId']) ? $order_data['transactionId'] : null,
            'hasCheckoutUrl' => !empty($order_data['checkoutUrl']),
            'hasQrData'      => !empty($order_data['qrData']) || !empty($order_data['qr_data']) || !empty($order_data['qrCode']),
        ));

        return $order_data;
    }

    /**
     * Query order payment status by PayYantra Order ID.
     *
     * @param string $order_id PayYantra Order ID (from Create Order response).
     * @return array|WP_Error Status data array or WP_Error.
     */
    public function get_order_status_by_id($order_id) {
        $token = $this->get_auth_token();
        if (is_wp_error($token)) {
            return $token;
        }

        $clean_id = rawurlencode(trim((string)$order_id));
        $endpoint = $this->base_url . '/api/pay/status/' . $clean_id;

        $response = wp_remote_get($endpoint, array(
            'headers' => array(
                'Authorization' => 'Bearer ' . $token,
                'Accept'        => 'application/json',
            ),
            'timeout' => 20,
        ));

        if (is_wp_error($response)) {
            Varnyxa_PayYantra_Logger::error('Order status query failed (network)', array('error' => $response->get_error_message()));
            return $response;
        }

        $status_code = wp_remote_retrieve_response_code($response);
        $body_raw    = wp_remote_retrieve_body($response);
        $body        = json_decode($body_raw, true);

        if (200 !== $status_code) {
            Varnyxa_PayYantra_Logger::warning('Order status query returned non-200', array(
                'status_code' => $status_code,
                'order_id'    => $order_id,
            ));
            return new WP_Error('payyantra_status_query_error', sprintf(__('Order status query failed (%d)', 'varnyxa-payyantra-gateway'), $status_code));
        }

        return isset($body['data']) && is_array($body['data']) ? $body['data'] : array();
    }

    /**
     * Query order payment status by merchant referenceId.
     *
     * @param string $reference_id Merchant reference ID.
     * @return array|WP_Error Status data array or WP_Error.
     */
    public function get_order_status_by_reference($reference_id) {
        $token = $this->get_auth_token();
        if (is_wp_error($token)) {
            return $token;
        }

        $clean_ref = rawurlencode(trim((string)$reference_id));
        $endpoint  = $this->base_url . '/api/pay/status/by-reference/' . $clean_ref;

        $response = wp_remote_get($endpoint, array(
            'headers' => array(
                'Authorization' => 'Bearer ' . $token,
                'Accept'        => 'application/json',
            ),
            'timeout' => 20,
        ));

        if (is_wp_error($response)) {
            return $response;
        }

        $status_code = wp_remote_retrieve_response_code($response);
        $body_raw    = wp_remote_retrieve_body($response);
        $body        = json_decode($body_raw, true);

        if (200 !== $status_code) {
            return new WP_Error('payyantra_status_query_error', sprintf(__('Reference status query failed (%d)', 'varnyxa-payyantra-gateway'), $status_code));
        }

        return isset($body['data']) && is_array($body['data']) ? $body['data'] : array();
    }

    /**
     * Diagnostic connectivity test helper.
     *
     * @return array
     */
    public function test_connection() {
        if (!$this->is_configured()) {
            return array(
                'success' => false,
                'message' => __('Credentials are not set. Please provide Client ID, Client Secret, and Base URL.', 'varnyxa-payyantra-gateway'),
            );
        }

        // Test with forced token generation
        $token = $this->get_auth_token(true);

        if (is_wp_error($token)) {
            return array(
                'success' => false,
                'message' => $token->get_error_message(),
                'code'    => $token->get_error_code(),
            );
        }

        return array(
            'success'   => true,
            'message'   => __('Successfully authenticated with PayYantra Payin API. 24-hour Bearer token generated.', 'varnyxa-payyantra-gateway'),
            'base_url'  => $this->base_url,
            'test_mode' => $this->test_mode,
        );
    }
}
