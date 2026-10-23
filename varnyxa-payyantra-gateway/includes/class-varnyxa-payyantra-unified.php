<?php
/**
 * VARNYXA PayYantra Unified Online Payment Gateway
 *
 * All-in-one payment gateway allowing customers to choose between
 * UPI, Credit/Debit Cards, and NetBanking on the PayYantra portal.
 *
 * @package   VARNYXA_PayYantra_Gateway
 * @author    VARNYXA Haute Couture
 * @license   Proprietary
 */

if (!defined('ABSPATH')) {
    exit;
}

class WC_Gateway_Varnyxa_PayYantra_Unified extends WC_Gateway_Varnyxa_PayYantra_Base {

    /**
     * Gateway Identifier.
     */
    const GATEWAY_ID = 'varnyxa_payyantra_unified';

    /**
     * Constructor.
     */
    public function __construct() {
        $this->id                 = self::GATEWAY_ID;
        $this->method_title       = __('PayYantra Hosted Checkout', 'varnyxa-payyantra-gateway');
        $this->method_description = __('Official PayYantra Hosted Checkout V3 gateway. Configurable by administrators; hidden from customer checkout.', 'varnyxa-payyantra-gateway');
        $this->icon               = plugins_url('assets/images/logo.svg', dirname(__FILE__));

        parent::__construct();
    }

    /**
     * Check if gateway is available.
     * Keeps the gateway fully visible and configurable in the WordPress admin console,
     * while strictly hiding it from regular customer checkout.
     *
     * @return bool
     */
    public function is_available() {
        // Keep available in admin console or for authorized administrators
        if (is_admin() || current_user_can('manage_woocommerce') || current_user_can('administrator')) {
            return parent::is_available();
        }

        // Strictly hide generic Hosted Checkout from regular customer-facing checkout
        return false;
    }

    /**
     * Initialize form fields.
     */
    public function init_form_fields() {
        $fields = $this->get_common_form_fields();

        $fields['title']['default']       = __('PayYantra Hosted Checkout', 'varnyxa-payyantra-gateway');
        $fields['description']['default'] = __('Pay securely with UPI, Debit/Credit Cards, or NetBanking via PayYantra Hosted Checkout.', 'varnyxa-payyantra-gateway');

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
            wc_add_notice(__('Online payment service is not configured. Please contact support.', 'varnyxa-payyantra-gateway'), 'error');
            return array('result' => 'fail');
        }

        if (!is_admin() && !current_user_can('manage_woocommerce') && !current_user_can('administrator')) {
            wc_add_notice(__('PayYantra Hosted Checkout is restricted to authorized administrators. Please choose a specific payment method.', 'varnyxa-payyantra-gateway'), 'error');
            return array('result' => 'fail');
        }

        if ($order->is_paid()) {
            return array(
                'result'   => 'success',
                'redirect' => $this->get_return_url($order),
            );
        }

        $payable_amount   = $this->get_order_payable_amount($order);
        $merchant_order_id = self::format_merchant_order_id($order);
        $reference_id     = 'INV-ALL-' . $order->get_id() . '-' . wp_rand(1000, 9999);

        $first_name = $order->get_billing_first_name();
        $last_name  = $order->get_billing_last_name();
        $cust_name  = trim($first_name . ' ' . $last_name);
        if (empty($cust_name)) {
            $cust_name = 'VARNYXA Patron';
        }

        $cust_email = $order->get_billing_email();
        $cust_phone = self::sanitize_phone($order->get_billing_phone());

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
            'allowedPaymentMethods' => array('UPI', 'CARD', 'NETBANKING'),
            'metadata'              => array(
                'wc_order_id'      => $order->get_id(),
                'wc_order_key'     => $order->get_order_key(),
                'gateway'          => self::GATEWAY_ID,
                'requested_method' => 'ALL',
            ),
        );

        $response = $api->create_order($payload);

        if (is_wp_error($response)) {
            $error_message = $response->get_error_message();
            Varnyxa_PayYantra_Logger::error('Unified Payment creation failed', array(
                'order_id' => $order->get_id(),
                'error'    => $error_message,
            ));
            wc_add_notice($error_message, 'error');
            return array('result' => 'fail');
        }

        $payyantra_order_id = isset($response['orderId']) ? $response['orderId'] : '';
        $transaction_id     = isset($response['transactionId']) ? $response['transactionId'] : '';
        $checkout_url       = isset($response['checkoutUrl']) ? $response['checkoutUrl'] : '';

        $order->update_meta_data('_payyantra_gateway_method', 'UNIFIED');
        $order->update_meta_data('_payyantra_merchant_order_id', $merchant_order_id);
        $order->update_meta_data('_payyantra_order_id', $payyantra_order_id);
        $order->update_meta_data('_payyantra_transaction_id', $transaction_id);
        $order->update_meta_data('_payyantra_reference_id', $reference_id);
        $order->update_meta_data('_payyantra_payable_amount', $payable_amount);
        $order->update_meta_data('_payyantra_checkout_url', $checkout_url);

        $order->update_status('pending', sprintf(
            __('PayYantra payment session initiated (Ref: %s, PayYantra ID: %s).', 'varnyxa-payyantra-gateway'),
            $reference_id,
            $payyantra_order_id
        ));
        $order->save();

        if (!empty($checkout_url)) {
            return array(
                'result'   => 'success',
                'redirect' => $checkout_url,
            );
        }

        wc_add_notice(__('Unable to retrieve payment URL from PayYantra.', 'varnyxa-payyantra-gateway'), 'error');
        return array('result' => 'fail');
    }
}
