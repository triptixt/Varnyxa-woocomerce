<?php
/**
 * VARNYXA PayYantra Debit & Credit Card Payment Gateway
 *
 * Dedicated Card payment gateway ensuring strict PCI-DSS compliance:
 * - Direct card checkout initiation via official PayYantra Payin API
 * - Method pre-locked to CARD (Visa, Mastercard, RuPay, Maestro)
 * - Zero raw card numbers, CVV, or sensitive cardholder data collected or logged
 * - Full 3-D Secure OTP verification handled directly by card issuing bank
 *
 * @package   VARNYXA_PayYantra_Gateway
 * @author    VARNYXA Haute Couture
 * @license   Proprietary
 */

if (!defined('ABSPATH')) {
    exit;
}

class WC_Gateway_Varnyxa_PayYantra_Card extends WC_Gateway_Varnyxa_PayYantra_Base {

    /**
     * Gateway Identifier.
     */
    const GATEWAY_ID = 'varnyxa_payyantra_card';

    /**
     * Constructor.
     */
    public function __construct() {
        $this->id                 = self::GATEWAY_ID;
        $this->method_title       = __('VARNYXA PayYantra Cards', 'varnyxa-payyantra-gateway');
        $this->method_description = __('Accept domestic and international Credit and Debit Cards securely via PayYantra.', 'varnyxa-payyantra-gateway');
        $this->icon               = plugins_url('assets/images/cards-icon.svg', dirname(__FILE__));

        parent::__construct();
    }

    /**
     * Initialize form fields.
     */
    public function init_form_fields() {
        $fields = $this->get_common_form_fields();

        // Customize defaults for Cards
        $fields['title']['default']       = __('Credit / Debit Card (Visa, Mastercard, RuPay)', 'varnyxa-payyantra-gateway');
        $fields['description']['default'] = __('Pay securely with your credit or debit card. Protected by 256-bit bank encryption and 3-D Secure.', 'varnyxa-payyantra-gateway');

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
            wc_add_notice(__('Unable to locate order for card payment processing.', 'varnyxa-payyantra-gateway'), 'error');
            return array('result' => 'fail');
        }

        $api = $this->get_api_client();
        if (!$api->is_configured()) {
            wc_add_notice(__('Card payment processing is currently unavailable. Please contact customer care.', 'varnyxa-payyantra-gateway'), 'error');
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
        $reference_id     = 'INV-CARD-' . $order->get_id() . '-' . wp_rand(1000, 9999);

        // Billing contact details
        $first_name = $order->get_billing_first_name();
        $last_name  = $order->get_billing_last_name();
        $cust_name  = trim($first_name . ' ' . $last_name);
        if (empty($cust_name)) {
            $cust_name = 'VARNYXA Patron';
        }

        $cust_email = $order->get_billing_email();
        $cust_phone = self::sanitize_phone($order->get_billing_phone());

        // Construct official Create Order request restricted exclusively to CARD
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
            'allowedPaymentMethods' => array('CARD'),
            'metadata'              => array(
                'wc_order_id'      => $order->get_id(),
                'wc_order_key'     => $order->get_order_key(),
                'gateway'          => self::GATEWAY_ID,
                'requested_method' => 'CARD',
            ),
        );

        $response = $api->create_order($payload);

        if (is_wp_error($response)) {
            $error_message = $response->get_error_message();
            Varnyxa_PayYantra_Logger::error('Card Payment creation failed', array(
                'order_id' => $order->get_id(),
                'error'    => $error_message,
            ));
            wc_add_notice($error_message, 'error');
            return array('result' => 'fail');
        }

        $payyantra_order_id = isset($response['orderId']) ? $response['orderId'] : '';
        $transaction_id     = isset($response['transactionId']) ? $response['transactionId'] : '';
        $checkout_url       = isset($response['checkoutUrl']) ? $response['checkoutUrl'] : '';

        // Store transaction references
        $order->update_meta_data('_payyantra_gateway_method', 'CARD');
        $order->update_meta_data('_payyantra_merchant_order_id', $merchant_order_id);
        $order->update_meta_data('_payyantra_order_id', $payyantra_order_id);
        $order->update_meta_data('_payyantra_transaction_id', $transaction_id);
        $order->update_meta_data('_payyantra_reference_id', $reference_id);
        $order->update_meta_data('_payyantra_payable_amount', $payable_amount);
        $order->update_meta_data('_payyantra_checkout_url', $checkout_url);

        $order->update_status('pending', sprintf(
            __('PayYantra Card payment initiated (Ref: %s, PayYantra ID: %s). Directing customer to card form.', 'varnyxa-payyantra-gateway'),
            $reference_id,
            $payyantra_order_id
        ));
        $order->save();

        if (!empty($checkout_url)) {
            Varnyxa_PayYantra_Logger::info('Redirecting customer to PayYantra Card-locked checkout', array(
                'order_id' => $order->get_id(),
            ));
            return array(
                'result'   => 'success',
                'redirect' => $checkout_url,
            );
        }

        wc_add_notice(__('PayYantra did not return a valid Card checkout URL.', 'varnyxa-payyantra-gateway'), 'error');
        return array('result' => 'fail');
    }
}
