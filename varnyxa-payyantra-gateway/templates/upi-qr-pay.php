<?php
/**
 * VARNYXA PayYantra Dynamic UPI QR Receipt & Order-Pay Template
 *
 * Renders the transaction-specific dynamic QR code, verified order amount,
 * countdown timer, UPI app intent button, and real-time polling widget.
 *
 * @package   VARNYXA_PayYantra_Gateway
 * @author    VARNYXA Haute Couture
 * @license   Proprietary
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Variables passed from WC_Gateway_Varnyxa_PayYantra_UPI::receipt_page:
 *
 * @var WC_Order $order
 * @var string   $qr_data
 * @var string   $qr_url
 * @var string   $upi_intent
 * @var string   $order_num
 * @var float    $amount
 */

$poll_nonce = wp_create_nonce('varnyxa_payyantra_poll_' . $order->get_id());
$ajax_url   = admin_url('admin-ajax.php');

// Determine QR image source
$qr_image_src = '';
if (!empty($qr_url)) {
    $qr_image_src = esc_url($qr_url);
} elseif (!empty($qr_data)) {
    // Generate QR using standard secure encoded vector/canvas payload
    $qr_image_src = 'https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=8&data=' . rawurlencode($qr_data);
}
?>

<div id="varnyxa-upi-checkout-wrap" class="varnyxa-qr-card" data-order-id="<?php echo esc_attr($order->get_id()); ?>" data-order-key="<?php echo esc_attr($order->get_order_key()); ?>" data-poll-url="<?php echo esc_url($ajax_url); ?>" data-nonce="<?php echo esc_attr($poll_nonce); ?>">

    <div class="varnyxa-qr-header">
        <div class="brand-eyebrow"><?php esc_html_e('VARNYXA HAUTE COUTURE', 'varnyxa-payyantra-gateway'); ?></div>
        <h2 class="qr-title"><?php esc_html_e('Scan & Pay with Any UPI App', 'varnyxa-payyantra-gateway'); ?></h2>
        <p class="qr-subtitle"><?php printf(esc_html__('Order #%s', 'varnyxa-payyantra-gateway'), esc_html($order_num)); ?></p>
    </div>

    <div class="varnyxa-amount-display">
        <span class="currency-symbol">₹</span>
        <span class="amount-value"><?php echo esc_html(number_format($amount, 2)); ?></span>
        <span class="tax-badge"><?php esc_html_e('Inclusive of all taxes', 'varnyxa-payyantra-gateway'); ?></span>
    </div>

    <!-- QR Code Presentation Box -->
    <div class="varnyxa-qr-stage">
        <?php if (!empty($qr_image_src)) : ?>
            <div class="qr-box">
                <img src="<?php echo esc_url($qr_image_src); ?>" alt="<?php esc_attr_e('PayYantra Dynamic UPI QR', 'varnyxa-payyantra-gateway'); ?>" class="qr-code-img" />
                <div class="qr-corner top-left"></div>
                <div class="qr-corner top-right"></div>
                <div class="qr-corner bottom-left"></div>
                <div class="qr-corner bottom-right"></div>
            </div>
        <?php else : ?>
            <div class="qr-fallback-box">
                <p><?php esc_html_e('Please complete your UPI transaction via the provider window.', 'varnyxa-payyantra-gateway'); ?></p>
            </div>
        <?php endif; ?>

        <!-- Supported UPI Apps Bar -->
        <div class="upi-partners-row">
            <span class="upi-pill">Google Pay</span>
            <span class="upi-pill">PhonePe</span>
            <span class="upi-pill">Paytm</span>
            <span class="upi-pill">BHIM</span>
            <span class="upi-pill">Any UPI App</span>
        </div>
    </div>

    <!-- Mobile UPI Deep Link Intent Button -->
    <?php if (!empty($upi_intent) || !empty($qr_data)) :
        $intent_url = !empty($upi_intent) ? $upi_intent : (0 === strpos($qr_data, 'upi://') ? $qr_data : '');
        if (!empty($intent_url)) : ?>
            <div class="varnyxa-mobile-intent">
                <a href="<?php echo esc_url($intent_url); ?>" class="varnyxa-intent-btn">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                    <span><?php esc_html_e('Open in Installed UPI App', 'varnyxa-payyantra-gateway'); ?></span>
                </a>
            </div>
        <?php endif;
    endif; ?>

    <!-- Real-time Polling & Expiry Bar -->
    <div class="varnyxa-polling-bar">
        <div class="pulse-indicator">
            <span class="pulse-dot"></span>
            <span class="pulse-label" id="poll-status-text"><?php esc_html_e('Awaiting payment confirmation...', 'varnyxa-payyantra-gateway'); ?></span>
        </div>
        <div class="countdown-wrap">
            <span class="timer-label"><?php esc_html_e('Expires in:', 'varnyxa-payyantra-gateway'); ?></span>
            <span id="varnyxa-countdown-timer" class="timer-val">14:59</span>
        </div>
    </div>

    <!-- Manual Status Refresh Action -->
    <div class="varnyxa-actions-bar">
        <button type="button" id="varnyxa-manual-check-btn" class="varnyxa-btn-secondary">
            <span class="btn-spinner" style="display:none;"></span>
            <span class="btn-text"><?php esc_html_e('I Have Paid (Check Status)', 'varnyxa-payyantra-gateway'); ?></span>
        </button>
    </div>

    <div class="varnyxa-security-footer">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
        <span><?php esc_html_e('256-Bit Bank Grade Encryption • Official PayYantra Secured Channel', 'varnyxa-payyantra-gateway'); ?></span>
    </div>

</div>
