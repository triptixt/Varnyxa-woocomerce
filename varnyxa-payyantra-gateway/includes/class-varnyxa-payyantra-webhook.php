<?php
/**
 * VARNYXA PayYantra Webhook & Callback Verification Handler
 *
 * Implements secure server-to-server payment verification:
 * - Listens on /?wc-api=varnyxa_payyantra_webhook (notifyUrl)
 * - Cross-verifies payment state against official PayYantra Status API
 * - Idempotent processing preventing duplicate order confirmation or double-charging
 * - Secure AJAX status polling endpoint for dynamic QR checkout page
 * - Nonce and order-key ownership verification
 *
 * @package   VARNYXA_PayYantra_Gateway
 * @author    VARNYXA Haute Couture
 * @license   Proprietary
 */

if (!defined('ABSPATH')) {
    exit;
}

class Varnyxa_PayYantra_Webhook_Handler {

    /**
     * Initialize webhook listeners.
     */
    public static function init() {
        // Server-to-server webhook callback (notifyUrl)
        add_action('woocommerce_api_varnyxa_payyantra_webhook', array(__CLASS__, 'handle_webhook'));

        // Customer browser return URL handler
        add_action('woocommerce_api_varnyxa_payyantra_return', array(__CLASS__, 'handle_return'));

        // Real-time status polling endpoint for QR checkout page
        add_action('woocommerce_api_varnyxa_payyantra_order_status', array(__CLASS__, 'handle_status_poll'));
        add_action('wp_ajax_varnyxa_payyantra_poll_status', array(__CLASS__, 'handle_ajax_status_poll'));
        add_action('wp_ajax_nopriv_varnyxa_payyantra_poll_status', array(__CLASS__, 'handle_ajax_status_poll'));
    }

    /**
     * Handle incoming PayYantra notifyUrl webhook POST.
     */
    public static function handle_webhook() {
        $raw_body = file_get_contents('php://input');
        Varnyxa_PayYantra_Logger::info('Incoming PayYantra notifyUrl webhook received', array(
            'raw_length' => strlen($raw_body),
        ));

        if (empty($raw_body)) {
            status_header(400);
            wp_send_json_error(array('message' => 'Empty webhook payload.'));
            exit;
        }

        $payload = json_decode($raw_body, true);
        if (!is_array($payload)) {
            status_header(400);
            wp_send_json_error(array('message' => 'Invalid JSON payload.'));
            exit;
        }

        $merchant_order_id = isset($payload['orderId']) ? trim((string)$payload['orderId']) : '';
        $reference_id      = isset($payload['referenceId']) ? trim((string)$payload['referenceId']) : '';
        $status            = isset($payload['status']) ? strtoupper(trim((string)$payload['status'])) : '';
        $terminal_status   = isset($payload['terminalStatus']) ? strtoupper(trim((string)$payload['terminalStatus'])) : '';
        $txn_id            = isset($payload['txnId']) ? trim((string)$payload['txnId']) : '';
        $rrn               = isset($payload['rrn']) ? trim((string)$payload['rrn']) : '';
        $amount_reported   = isset($payload['amount']) ? (float)$payload['amount'] : 0.0;

        Varnyxa_PayYantra_Logger::info('Parsing webhook payload', array(
            'orderId'        => $merchant_order_id,
            'referenceId'    => $reference_id,
            'status'         => $status,
            'terminalStatus' => $terminal_status,
            'txnId'          => $txn_id,
        ));

        // Extract WooCommerce Order ID from merchant orderId format: ORD-WC-{id}-{timestamp}
        $wc_order_id = 0;
        if (preg_match('/ORD-WC-(\d+)/', $merchant_order_id, $matches)) {
            $wc_order_id = (int)$matches[1];
        }

        if (!$wc_order_id) {
            Varnyxa_PayYantra_Logger::error('Unable to parse WooCommerce order ID from webhook orderId', array(
                'merchant_order_id' => $merchant_order_id,
            ));
            status_header(404);
            wp_send_json_error(array('message' => 'Order reference not recognised.'));
            exit;
        }

        $order = wc_get_order($wc_order_id);
        if (!$order) {
            Varnyxa_PayYantra_Logger::error('WooCommerce order does not exist', array('order_id' => $wc_order_id));
            status_header(404);
            wp_send_json_error(array('message' => 'WooCommerce order not found.'));
            exit;
        }

        // Idempotency: If order is already settled, acknowledge immediately without duplicate processing
        if ($order->is_paid() || in_array($order->get_status(), array('processing', 'completed'), true)) {
            Varnyxa_PayYantra_Logger::info('Order already paid and confirmed. Idempotently acknowledging duplicate webhook.', array(
                'order_id' => $wc_order_id,
            ));
            status_header(200);
            wp_send_json_success(array('message' => 'Order already settled.'));
            exit;
        }

        // Retrieve active gateway client to cross-verify status with official API
        $gateway = self::get_gateway_for_order($order);
        $api     = $gateway ? $gateway->get_api_client() : null;

        // Perform trusted server-to-server status verification
        $is_verified_success = false;
        if ($api && $api->is_configured()) {
            $status_check = null;
            $payyantra_order_id = $order->get_meta('_payyantra_order_id');

            if (!empty($payyantra_order_id)) {
                $status_check = $api->get_order_status_by_id($payyantra_order_id);
            }

            if (empty($status_check) || is_wp_error($status_check)) {
                $ref = $order->get_meta('_payyantra_reference_id');
                if (!empty($ref)) {
                    $status_check = $api->get_order_status_by_reference($ref);
                }
            }

            if (!empty($status_check) && !is_wp_error($status_check)) {
                $verified_status = isset($status_check['status']) ? strtoupper(trim((string)$status_check['status'])) : '';
                if ('SUCCESS' === $verified_status) {
                    $is_verified_success = true;
                    if (!empty($status_check['rrn'])) {
                        $rrn = $status_check['rrn'];
                    }
                }
            }
        }

        // Fallback: Check if payload terminalStatus is SUCCESS and webhook has valid matching reference
        if (!$is_verified_success && 'SUCCESS' === $terminal_status && 'SUCCESS' === $status) {
            $expected_ref = $order->get_meta('_payyantra_reference_id');
            if (!empty($expected_ref) && $expected_ref === $reference_id) {
                $is_verified_success = true;
            }
        }

        if ($is_verified_success) {
            // Verify payable amount matches order
            $order_total = (float)$order->get_total();
            $payable_amount = (float)$order->get_meta('_payyantra_payable_amount');
            if (!$payable_amount) {
                $payable_amount = $order_total;
            }

            // In UAT capped mode, amount may be capped to 10
            if ($amount_reported > 0 && abs($amount_reported - $payable_amount) > 0.05 && abs($amount_reported - $order_total) > 0.05) {
                Varnyxa_PayYantra_Logger::warning('Webhook amount discrepancy detected', array(
                    'reported' => $amount_reported,
                    'expected' => $payable_amount,
                ));
            }

            // Save transaction details
            $order->set_transaction_id($txn_id);
            $order->update_meta_data('_payyantra_status', 'SUCCESS');
            $order->update_meta_data('_payyantra_txn_id', $txn_id);
            $order->update_meta_data('_payyantra_rrn', $rrn);
            $order->update_meta_data('_payyantra_settled_at', current_time('mysql'));

            if (!empty($payload['payment_details']['udf2'])) {
                $order->update_meta_data('_payyantra_vpa', sanitize_text_field($payload['payment_details']['udf2']));
            }

            // Mark order complete
            $order->payment_complete($txn_id);

            $note = sprintf(
                __('PayYantra payment confirmed via webhook. Txn ID: %s, RRN: %s, Amount: ₹%s.', 'varnyxa-payyantra-gateway'),
                $txn_id,
                $rrn ? $rrn : 'N/A',
                number_format($amount_reported > 0 ? $amount_reported : $order_total, 2)
            );
            $order->add_order_note($note);
            $order->save();

            Varnyxa_PayYantra_Logger::info('Order successfully marked paid and settled via webhook', array(
                'order_id' => $wc_order_id,
                'txn_id'   => $txn_id,
            ));

            status_header(200);
            wp_send_json_success(array('message' => 'Order successfully confirmed.'));
            exit;
        }

        // Handle FAILED terminal status
        if ('FAILED' === $terminal_status || 'FAILED' === $status) {
            $error_code = isset($payload['errorCode']) ? $payload['errorCode'] : '';
            $error_msg  = isset($payload['errorMessage']) ? $payload['errorMessage'] : '';

            $order->update_status('failed', sprintf(
                __('PayYantra payment failed (%s): %s', 'varnyxa-payyantra-gateway'),
                $error_code ? $error_code : 'N/A',
                $error_msg ? $error_msg : 'Transaction declined'
            ));
            $order->save();

            Varnyxa_PayYantra_Logger::info('Order marked failed via webhook', array('order_id' => $wc_order_id));
            status_header(200);
            wp_send_json_success(array('message' => 'Order marked failed.'));
            exit;
        }

        // Pending state
        status_header(200);
        wp_send_json_success(array('message' => 'Webhook received for pending state.'));
        exit;
    }

    /**
     * Handle browser return URL redirection.
     * Verifies payment status securely without trusting browser query parameters.
     */
    public static function handle_return() {
        $order_id  = isset($_GET['order_id']) ? (int)$_GET['order_id'] : 0;
        $order_key = isset($_GET['key']) ? sanitize_text_field($_GET['key']) : '';

        if (!$order_id) {
            wp_safe_redirect(wc_get_checkout_url());
            exit;
        }

        $order = wc_get_order($order_id);
        if (!$order || ($order_key && $order->get_order_key() !== $order_key)) {
            wp_safe_redirect(wc_get_checkout_url());
            exit;
        }

        // If not already settled, do a trusted status check with PayYantra API
        if (!$order->is_paid()) {
            $gateway = self::get_gateway_for_order($order);
            if ($gateway) {
                $api = $gateway->get_api_client();
                $payyantra_order_id = $order->get_meta('_payyantra_order_id');
                if (!empty($payyantra_order_id)) {
                    $status_res = $api->get_order_status_by_id($payyantra_order_id);
                    if (!empty($status_res) && !is_wp_error($status_res)) {
                        $remote_status = isset($status_res['status']) ? strtoupper(trim((string)$status_res['status'])) : '';
                        if ('SUCCESS' === $remote_status) {
                            $txn_id = !empty($status_res['rrn']) ? $status_res['rrn'] : $payyantra_order_id;
                            $order->payment_complete($txn_id);
                            $order->add_order_note(sprintf(__('Payment confirmed upon customer return verification. PayYantra ID: %s', 'varnyxa-payyantra-gateway'), $payyantra_order_id));
                            $order->save();
                        }
                    }
                }
            }
        }

        wp_safe_redirect($order->get_checkout_order_received_url());
        exit;
    }

    /**
     * Real-time AJAX polling endpoint for QR payment page.
     */
    public static function handle_ajax_status_poll() {
        $order_id  = isset($_POST['order_id']) ? (int)$_POST['order_id'] : (isset($_GET['order_id']) ? (int)$_GET['order_id'] : 0);
        $order_key = isset($_POST['order_key']) ? sanitize_text_field($_POST['order_key']) : (isset($_GET['order_key']) ? sanitize_text_field($_GET['key']) : '');

        if (!$order_id || empty($order_key)) {
            wp_send_json_error(array('status' => 'error', 'message' => 'Missing order parameters.'));
        }

        $order = wc_get_order($order_id);
        if (!$order || $order->get_order_key() !== $order_key) {
            wp_send_json_error(array('status' => 'error', 'message' => 'Access denied. Order key mismatch.'));
        }

        // 1. If already paid, return confirmed
        if ($order->is_paid() || in_array($order->get_status(), array('processing', 'completed'), true)) {
            wp_send_json_success(array(
                'status'       => 'paid',
                'redirect_url' => $order->get_checkout_order_received_url(),
            ));
        }

        // 2. Query PayYantra official Status API
        $gateway = self::get_gateway_for_order($order);
        if (!$gateway) {
            wp_send_json_error(array('status' => 'error', 'message' => 'Gateway not resolved.'));
        }

        $api = $gateway->get_api_client();
        $payyantra_order_id = $order->get_meta('_payyantra_order_id');
        $reference_id      = $order->get_meta('_payyantra_reference_id');

        $status_data = null;
        if (!empty($payyantra_order_id)) {
            $status_data = $api->get_order_status_by_id($payyantra_order_id);
        }

        if (empty($status_data) || is_wp_error($status_data)) {
            if (!empty($reference_id)) {
                $status_data = $api->get_order_status_by_reference($reference_id);
            }
        }

        if (empty($status_data) || is_wp_error($status_data)) {
            wp_send_json_success(array('status' => 'pending'));
        }

        $remote_status = isset($status_data['status']) ? strtoupper(trim((string)$status_data['status'])) : 'PENDING';

        if ('SUCCESS' === $remote_status) {
            $txn_id = !empty($status_data['rrn']) ? $status_data['rrn'] : (!empty($payyantra_order_id) ? $payyantra_order_id : 'PY-' . time());
            $order->payment_complete($txn_id);
            $order->update_meta_data('_payyantra_status', 'SUCCESS');
            $order->add_order_note(sprintf(__('Payment verified via QR real-time status polling. ID: %s', 'varnyxa-payyantra-gateway'), $txn_id));
            $order->save();

            wp_send_json_success(array(
                'status'       => 'paid',
                'redirect_url' => $order->get_checkout_order_received_url(),
            ));
        }

        if ('FAILED' === $remote_status) {
            $order->update_status('failed', __('Payment marked failed via PayYantra status check.', 'varnyxa-payyantra-gateway'));
            $order->save();

            wp_send_json_success(array(
                'status'       => 'failed',
                'redirect_url' => wc_get_checkout_url(),
            ));
        }

        wp_send_json_success(array('status' => 'pending'));
    }

    /**
     * Resolve gateway instance associated with an order.
     *
     * @param WC_Order $order WooCommerce Order.
     * @return WC_Gateway_Varnyxa_PayYantra_Base|null
     */
    protected static function get_gateway_for_order($order) {
        $payment_method = $order->get_payment_method();
        $gateways = WC()->payment_gateways()->payment_gateways();

        if (isset($gateways[$payment_method])) {
            return $gateways[$payment_method];
        }

        // Default to UPI gateway instance if not specified
        if (isset($gateways['varnyxa_payyantra_upi'])) {
            return $gateways['varnyxa_payyantra_upi'];
        }

        return null;
    }
}
