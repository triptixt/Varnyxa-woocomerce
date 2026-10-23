<?php
/**
 * WooCommerce Checkout Blocks Integration for VARNYXA PayYantra Gateway
 *
 * Implements WooCommerce Blocks PaymentMethodType registration:
 * - Enables dedicated UPI and Cards on WooCommerce Checkout Blocks
 * - Strictly hides "PayYantra Hosted Checkout" from customers on Checkout Blocks
 * - Preserves PayYantra Hosted Checkout availability for authorized administrators
 *
 * @package   VARNYXA_PayYantra_Gateway
 * @author    VARNYXA Haute Couture
 * @license   Proprietary
 */

if (!defined('ABSPATH')) {
    exit;
}

use Automattic\WooCommerce\Blocks\Payments\Integrations\AbstractPaymentMethodType;

/**
 * Blocks Support for PayYantra Hosted Checkout (Admin only / Hidden from customers)
 */
class Varnyxa_PayYantra_Hosted_Blocks_Support extends AbstractPaymentMethodType {

    /**
     * Payment method name / ID.
     *
     * @var string
     */
    protected $name = 'varnyxa_payyantra_unified';

    /**
     * Settings from gateway.
     *
     * @var array
     */
    protected $settings = array();

    /**
     * Initialization.
     */
    public function initialize() {
        $this->settings = get_option('woocommerce_' . $this->name . '_settings', array());
    }

    /**
     * Check if payment method is active in Checkout Blocks.
     * Strictly hides from customer checkout; allows only for authorized administrators.
     *
     * @return bool
     */
    public function is_active() {
        // Only active if enabled by admin
        $is_enabled = !empty($this->settings['enabled']) && 'yes' === $this->settings['enabled'];
        if (!$is_enabled) {
            return false;
        }

        // Available only for authorized store managers or administrators; hidden from customers
        if (is_admin() || current_user_can('manage_woocommerce') || current_user_can('administrator')) {
            return true;
        }

        return false;
    }

    /**
     * Returns an array of script handles.
     *
     * @return array
     */
    public function get_payment_method_script_handles() {
        return array();
    }

    /**
     * Returns an array of key=>value pairs of data made available to the payment method script.
     *
     * @return array
     */
    public function get_payment_method_data() {
        return array(
            'title'       => $this->get_setting('title', __('PayYantra Hosted Checkout', 'varnyxa-payyantra-gateway')),
            'description' => $this->get_setting('description', ''),
            'supports'    => array('products'),
        );
    }
}

/**
 * Blocks Support for Dedicated UPI Gateway (Active for customers)
 */
class Varnyxa_PayYantra_UPI_Blocks_Support extends AbstractPaymentMethodType {

    protected $name = 'varnyxa_payyantra_upi';
    protected $settings = array();

    public function initialize() {
        $this->settings = get_option('woocommerce_' . $this->name . '_settings', array());
    }

    public function is_active() {
        return !empty($this->settings['enabled']) && 'yes' === $this->settings['enabled'];
    }

    public function get_payment_method_script_handles() {
        return array();
    }

    public function get_payment_method_data() {
        return array(
            'title'       => $this->get_setting('title', __('UPI (Google Pay, PhonePe, Paytm, QR)', 'varnyxa-payyantra-gateway')),
            'description' => $this->get_setting('description', ''),
            'supports'    => array('products'),
        );
    }
}

/**
 * Blocks Support for Dedicated Cards Gateway (Active for customers)
 */
class Varnyxa_PayYantra_Cards_Blocks_Support extends AbstractPaymentMethodType {

    protected $name = 'varnyxa_payyantra_card';
    protected $settings = array();

    public function initialize() {
        $this->settings = get_option('woocommerce_' . $this->name . '_settings', array());
    }

    public function is_active() {
        return !empty($this->settings['enabled']) && 'yes' === $this->settings['enabled'];
    }

    public function get_payment_method_script_handles() {
        return array();
    }

    public function get_payment_method_data() {
        return array(
            'title'       => $this->get_setting('title', __('Credit / Debit Card (Visa, Mastercard, RuPay)', 'varnyxa-payyantra-gateway')),
            'description' => $this->get_setting('description', ''),
            'supports'    => array('products'),
        );
    }
}
