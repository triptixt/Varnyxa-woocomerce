<?php
/**
 * VARNYXA PayYantra UPI Payment Gateway
 *
 * Dedicated UPI gateway supporting:
 * - Dynamic QR code presentation on order payment page (when supplied by PayYantra)
 * - UPI App Intent deep-links (Google Pay, PhonePe, Paytm, BHIM)
 * - Method-restricted UPI checkout redirect fallback
 * - Real-time client polling against official PayYantra Status API
 *
 * @package   VARNYXA_PayYantra_Gateway
 * @author    VARNYXA Haute Couture
 * @license   Proprietary
 */

if (!defined('ABSPATH')) {
    exit;
}

class WC_Gateway_Varnyxa_PayYantra_UPI extends WC_Gateway_Varnyxa_PayYantra_Base {

    /**
     * Gateway Identifier.
     */
    const GATEWAY_ID = 'varnyxa_payyantra_upi';

    /**
     * Constructor.
     */
    public function __construct() {
        $this->id                 = self::GATEWAY_ID;
        $this->method_title       = __('VARNYXA PayYantra UPI', 'varnyxa-payyantra-gateway');
        $this->method_description = __('Accept instant UPI payments with dynamic QR code and UPI app deep linking.', 'varnyxa-payyantra-gateway');
        $this->icon               = plugins_url('assets/images/upi-icon.svg', dirname(__FILE__));

        parent::__construct();

        // Hook for receipt / order-pay page
        add_action('woocommerce_receipt_' . $this->id, array($this, 'receipt_page'));
    }

    /**
     * Initialize form fields.
     */
    public function init_form_fields() {
        $fields = $this->get_common_form_fields();

        // Customize defaults for UPI
        $fields['title']['default']       = __('UPI (Google Pay, PhonePe, Paytm, QR)', 'varnyxa-payyantra-gateway');
        $fields['description']['default'] = __('Scan the dynamic QR code using any UPI app or click to pay instantly.', 'varnyxa-payyantra-gateway');

        $this->form_fields = $fields;
    }

    /**
     * Process checkout payment.
     *
     * @param int $order_id WooCommerce Order ID.
     * @return array
     */
    public function process_payment($order_id) {
        $order = wc_get_order($order_id);
        if (!$order) {
            wc_add_notice(__('Unable to locate order for payment processing.', 'varnyxa-payyantra-gateway'), 'error');
            return array('result' => 'fail');
        }

        $api = $this->get_api_client();
        if (!$api->is_configured()) {
            wc_add_notice(__('PayYantra payment gateway is not properly configured. Please contact store concierge.', 'varnyxa-payyantra-gateway'), 'error');
            return array('result' => 'fail');
        }

        // Prevent processing if order is already settled
        if ($order->is_paid()) {
            return array(
                'result'   => 'success',
                'redirect' => $this->get_return_url($order),
            );
        }

        $payable_amount   = $this->get_order_payable_amount($order);
        $merchant_order_id = self::format_merchant_order_id($order);
        $reference_id     = 'INV-' . $order->get_id() . '-' . wp_rand(1000, 9999);

        // Extract customer information
        $first_name = $order->get_billing_first_name();
        $last_name  = $order->get_billing_last_name();
        $cust_name  = trim($first_name . ' ' . $last_name);
        if (empty($cust_name)) {
            $cust_name = 'VARNYXA Patron';
        }

        $cust_email = $order->get_billing_email();
        $cust_phone = self::sanitize_phone($order->get_billing_phone());

        // Construct official Create Order request restricted to UPI
        $payload = array(
            'orderId'               => $merchant_order_id,
            'amount'                => $payable_amount,
            'currency'              => 'INR',
            'customerName'          => $cust_name,
            'customerEmail'         => $cust_email,
            'customerPhone'         => $cust_phone,
            'returnUrl'             => $this->get_return_url($order),
            'notifyUrl'             => $this->get_notify_url(),
            'referenceId'           => $reference_id,
            'allowedPaymentMethods' => array('UPI'),
            'metadata'              => array(
                'wc_order_id'      => $order->get_id(),
                'wc_order_key'     => $order->get_order_key(),
                'gateway'          => self::GATEWAY_ID,
                'requested_method' => 'UPI',
            ),
        );

        $response = $api->create_order($payload);

        if (is_wp_error($response)) {
            $error_message = $response->get_error_message();
            Varnyxa_PayYantra_Logger::error('UPI Payment creation failed', array(
                'order_id' => $order->get_id(),
                'error'    => $error_message,
            ));
            wc_add_notice($error_message, 'error');
            return array('result' => 'fail');
        }

        // Persist payment references in HPOS/order meta
        $payyantra_order_id = isset($response['orderId']) ? $response['orderId'] : '';
        $transaction_id     = isset($response['transactionId']) ? $response['transactionId'] : '';
        $checkout_url       = isset($response['checkoutUrl']) ? $response['checkoutUrl'] : '';

        // Extract real dynamic QR payload if provided by API
        $qr_data = '';
        if (!empty($response['qrData'])) {
            $qr_data = $response['qrData'];
        } elseif (!empty($response['qr_data'])) {
            $qr_data = $response['qr_data'];
        } elseif (!empty($response['qrCode'])) {
            $qr_data = $response['qrCode'];
        }

        $qr_url = !empty($response['qrUrl']) ? $response['qrUrl'] : (!empty($response['qr_url']) ? $response['qr_url'] : '');
        $upi_intent = !empty($response['upiIntent']) ? $response['upiIntent'] : (!empty($response['upiIntentUrl']) ? $response['upiIntentUrl'] : '');
        $expires_at = !empty($response['expiryTime']) ? $response['expiryTime'] : (!empty($response['expiresAt']) ? $response['expiresAt'] : '');

        $order->update_meta_data('_payyantra_gateway_method', 'UPI');
        $order->update_meta_data('_payyantra_merchant_order_id', $merchant_order_id);
        $order->update_meta_data('_payyantra_order_id', $payyantra_order_id);
        $order->update_meta_data('_payyantra_transaction_id', $transaction_id);
        $order->update_meta_data('_payyantra_reference_id', $reference_id);
        $order->update_meta_data('_payyantra_payable_amount', $payable_amount);
        $order->update_meta_data('_payyantra_checkout_url', $checkout_url);
        $order->update_meta_data('_payyantra_qr_data', $qr_data);
        $order->update_meta_data('_payyantra_qr_url', $qr_url);
        $order->update_meta_data('_payyantra_upi_intent', $upi_intent);
        $order->update_meta_data('_payyantra_expires_at', $expires_at);

        // Mark order pending payment
        $order->update_status('pending', sprintf(
            __('PayYantra UPI payment session created (Ref: %s, PayYantra ID: %s).', 'varnyxa-payyantra-gateway'),
            $reference_id,
            $payyantra_order_id
        ));
        $order->save();

        // Flow decision:
        // 1. If dynamic QR data/URL is returned, redirect to the receipt/order-pay page
        if (!empty($qr_data) || !empty($qr_url)) {
            Varnyxa_PayYantra_Logger::info('Dynamic QR received from PayYantra. Redirecting customer to order-pay page.', array(
                'order_id' => $order->get_id(),
            ));
            return array(
                'result'   => 'success',
                'redirect' => $order->get_checkout_payment_url(true),
            );
        }

        // 2. Otherwise, redirect to PayYantra UPI-restricted checkoutUrl
        if (!empty($checkout_url)) {
            Varnyxa_PayYantra_Logger::info('Redirecting to PayYantra UPI-restricted hosted checkout.', array(
                'order_id' => $order->get_id(),
            ));
            return array(
                'result'   => 'success',
                'redirect' => $checkout_url,
            );
        }

        wc_add_notice(__('PayYantra did not return a valid UPI payment endpoint.', 'varnyxa-payyantra-gateway'), 'error');
        return array('result' => 'fail');
    }

    /**
     * Render the receipt/order-pay page with dynamic QR code and status polling.
     *
     * @param int $order_id WooCommerce order ID.
     */
    public function receipt_page($order_id) {
        $order = wc_get_order($order_id);
        if (!$order) {
            return;
        }

        $qr_data    = $order->get_meta('_payyantra_qr_data');
        $qr_url     = $order->get_meta('_payyantra_qr_url');
        $upi_intent = $order->get_meta('_payyantra_upi_intent');
        $order_num  = $order->get_order_number();
        $amount     = $order->get_meta('_payyantra_payable_amount');
        if (!$amount) {
            $amount = $order->get_total();
        }

        $template_path = plugin_dir_path(dirname(__FILE__)) . 'templates/upi-qr-pay.php';
        if (file_exists($template_path)) {
            include $template_path;
        }
    }
}
