<?php
/**
 * Plugin Name: VARNYXA PayYantra Gateway
 * Plugin URI: https://varnyxa.com
 * Description: Seamless, production-ready PayYantra payment gateway for WooCommerce. Features dedicated UPI dynamic QR codes, direct PCI-compliant Debit/Credit Card checkout, real-time status reconciliation, and HPOS compatibility.
 * Version: 1.0.0
 * Author: VARNYXA Haute Couture
 * Author URI: https://varnyxa.com
 * Text Domain: varnyxa-payyantra-gateway
 * Domain Path: /languages
 * Requires at least: 5.8
 * Requires PHP: 7.4
 * WC requires at least: 6.0
 * WC tested up to: 8.8
 * License: Proprietary
 */

if (!defined('ABSPATH')) {
    exit;
}

// Define Plugin Constants
if (!defined('VARNYXA_PAYYANTRA_VERSION')) {
    define('VARNYXA_PAYYANTRA_VERSION', '1.0.0');
}
if (!defined('VARNYXA_PAYYANTRA_PLUGIN_DIR')) {
    define('VARNYXA_PAYYANTRA_PLUGIN_DIR', plugin_dir_path(__FILE__));
}
if (!defined('VARNYXA_PAYYANTRA_PLUGIN_URL')) {
    define('VARNYXA_PAYYANTRA_PLUGIN_URL', plugin_dir_url(__FILE__));
}
if (!defined('VARNYXA_PAYYANTRA_MAIN_FILE')) {
    define('VARNYXA_PAYYANTRA_MAIN_FILE', __FILE__);
}

/**
 * Declare High-Performance Order Storage (HPOS) and Checkout Blocks Compatibility.
 */
add_action('before_woocommerce_init', function() {
    if (class_exists('\Automattic\WooCommerce\Utilities\FeaturesUtil')) {
        // High-Performance Order Storage (Custom Order Tables)
        \Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility('custom_order_tables', __FILE__, true);
        // Compatible with WooCommerce Checkout Blocks & Classic Checkout
        \Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility('cart_checkout_blocks', __FILE__, true);
    }
});

/**
 * Check if WooCommerce is installed and active before initializing.
 */
add_action('plugins_loaded', 'varnyxa_payyantra_init_gateway', 11);

function varnyxa_payyantra_init_gateway() {
    if (!class_exists('WooCommerce')) {
        add_action('admin_notices', function() {
            echo '<div class="notice notice-error"><p>' .
                 esc_html__('VARNYXA PayYantra Gateway requires WooCommerce to be installed and active.', 'varnyxa-payyantra-gateway') .
                 '</p></div>';
        });
        return;
    }

    // Load Plugin Classes
    require_once VARNYXA_PAYYANTRA_PLUGIN_DIR . 'includes/class-varnyxa-payyantra-logger.php';
    require_once VARNYXA_PAYYANTRA_PLUGIN_DIR . 'includes/class-varnyxa-payyantra-api.php';
    require_once VARNYXA_PAYYANTRA_PLUGIN_DIR . 'includes/class-varnyxa-payyantra-gateway.php';
    require_once VARNYXA_PAYYANTRA_PLUGIN_DIR . 'includes/class-varnyxa-payyantra-upi.php';
    require_once VARNYXA_PAYYANTRA_PLUGIN_DIR . 'includes/class-varnyxa-payyantra-card.php';
    require_once VARNYXA_PAYYANTRA_PLUGIN_DIR . 'includes/class-varnyxa-payyantra-unified.php';
    require_once VARNYXA_PAYYANTRA_PLUGIN_DIR . 'includes/class-varnyxa-payyantra-webhook.php';

    // Register Webhook & Callback Listeners
    Varnyxa_PayYantra_Webhook_Handler::init();
}

/**
 * Register WooCommerce Checkout Blocks payment method integrations.
 */
add_action('woocommerce_blocks_loaded', 'varnyxa_payyantra_register_blocks_support');

function varnyxa_payyantra_register_blocks_support() {
    if (class_exists('\Automattic\WooCommerce\Blocks\Payments\Integrations\AbstractPaymentMethodType')) {
        require_once VARNYXA_PAYYANTRA_PLUGIN_DIR . 'includes/class-varnyxa-payyantra-blocks-support.php';

        add_action('woocommerce_blocks_payment_method_type_registration', function(\Automattic\WooCommerce\Blocks\Payments\PaymentMethodRegistry $payment_method_registry) {
            $payment_method_registry->register(new Varnyxa_PayYantra_UPI_Blocks_Support());
            $payment_method_registry->register(new Varnyxa_PayYantra_Cards_Blocks_Support());
            $payment_method_registry->register(new Varnyxa_PayYantra_Hosted_Blocks_Support());
        });
    }
}

/**
 * Register Gateway classes with WooCommerce.
 */
add_filter('woocommerce_payment_gateways', 'varnyxa_payyantra_add_gateways');

function varnyxa_payyantra_add_gateways($gateways) {
    $gateways[] = 'WC_Gateway_Varnyxa_PayYantra_UPI';
    $gateways[] = 'WC_Gateway_Varnyxa_PayYantra_Card';
    $gateways[] = 'WC_Gateway_Varnyxa_PayYantra_Unified';
    return $gateways;
}

/**
 * Enqueue frontend scripts and styles on checkout and payment pages.
 */
add_action('wp_enqueue_scripts', 'varnyxa_payyantra_enqueue_assets');

function varnyxa_payyantra_enqueue_assets() {
    if (is_checkout() || is_checkout_pay_page() || is_order_received_page()) {
        wp_enqueue_style(
            'varnyxa-payyantra-checkout',
            VARNYXA_PAYYANTRA_PLUGIN_URL . 'assets/css/varnyxa-checkout.css',
            array(),
            VARNYXA_PAYYANTRA_VERSION
        );

        wp_enqueue_script(
            'varnyxa-payyantra-polling',
            VARNYXA_PAYYANTRA_PLUGIN_URL . 'assets/js/varnyxa-checkout.js',
            array(),
            VARNYXA_PAYYANTRA_VERSION,
            true
        );
    }
}

/**
 * Enqueue administrative styling on WooCommerce settings pages.
 */
add_action('admin_enqueue_scripts', 'varnyxa_payyantra_enqueue_admin_assets');

function varnyxa_payyantra_enqueue_admin_assets($hook) {
    if ('woocommerce_page_wc-settings' === $hook && isset($_GET['tab']) && 'checkout' === $_GET['tab']) {
        wp_enqueue_style(
            'varnyxa-payyantra-admin',
            VARNYXA_PAYYANTRA_PLUGIN_URL . 'assets/css/varnyxa-admin.css',
            array(),
            VARNYXA_PAYYANTRA_VERSION
        );
    }
}

/**
 * Hide the generic "PayYantra Hosted Checkout" option from customer-facing checkout,
 * while keeping it fully available and configurable in the WordPress admin console.
 */
add_filter('woocommerce_available_payment_gateways', 'varnyxa_payyantra_hide_hosted_checkout_from_customers');

function varnyxa_payyantra_hide_hosted_checkout_from_customers($gateways) {
    // Keep available in WordPress admin dashboard or for authorized store managers/administrators
    if (is_admin() || current_user_can('manage_woocommerce') || current_user_can('administrator')) {
        return $gateways;
    }

    // Target generic Hosted Checkout gateways to hide from regular customers
    $hosted_ids = array('varnyxa_payyantra_unified', 'payyantra_hosted', 'payyantra', 'payyantra_gateway');
    foreach ($hosted_ids as $id) {
        if (isset($gateways[$id])) {
            unset($gateways[$id]);
        }
    }

    // Also inspect gateway title or method_title for "PayYantra Hosted Checkout"
    foreach ($gateways as $gateway_id => $gateway) {
        if (is_object($gateway)) {
            $title = method_exists($gateway, 'get_title') ? $gateway->get_title() : (isset($gateway->title) ? $gateway->title : '');
            $method_title = isset($gateway->method_title) ? $gateway->method_title : '';
            if (false !== stripos($title, 'Hosted Checkout') || false !== stripos($method_title, 'Hosted Checkout')) {
                unset($gateways[$gateway_id]);
            }
        }
    }

    return $gateways;
}

/**
 * Ensure Store API REST responses for Checkout Blocks omit PayYantra Hosted Checkout for non-admins.
 */
add_filter('woocommerce_rest_prepare_payment_gateway', 'varnyxa_payyantra_filter_rest_gateways', 10, 3);

function varnyxa_payyantra_filter_rest_gateways($response, $item, $request) {
    if (!is_admin() && !current_user_can('manage_woocommerce') && !current_user_can('administrator')) {
        $data = $response->get_data();
        $id   = isset($data['id']) ? $data['id'] : '';
        $title = isset($data['title']) ? $data['title'] : '';
        if (in_array($id, array('varnyxa_payyantra_unified', 'payyantra_hosted', 'payyantra', 'payyantra_gateway'), true) || false !== stripos($title, 'Hosted Checkout')) {
            $data['enabled'] = false;
            $response->set_data($data);
        }
    }
    return $response;
}

/**
 * Add direct "Settings" action links to the WordPress plugins list.
 */
add_filter('plugin_action_links_' . plugin_basename(__FILE__), 'varnyxa_payyantra_action_links');

function varnyxa_payyantra_action_links($links) {
    $settings_link = '<a href="' . esc_url(admin_url('admin.php?page=wc-settings&tab=checkout&section=varnyxa_payyantra_upi')) . '">' .
                     esc_html__('UPI Settings', 'varnyxa-payyantra-gateway') . '</a>';
    $cards_link    = '<a href="' . esc_url(admin_url('admin.php?page=wc-settings&tab=checkout&section=varnyxa_payyantra_card')) . '">' .
                     esc_html__('Cards Settings', 'varnyxa-payyantra-gateway') . '</a>';
    $hosted_link   = '<a href="' . esc_url(admin_url('admin.php?page=wc-settings&tab=checkout&section=varnyxa_payyantra_unified')) . '">' .
                     esc_html__('Hosted Checkout Settings', 'varnyxa-payyantra-gateway') . '</a>';
    array_unshift($links, $settings_link, $cards_link, $hosted_link);
    return $links;
}

