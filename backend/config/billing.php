<?php

/*
|--------------------------------------------------------------------------
| Billing: Pro prices and bank-transfer payments
|--------------------------------------------------------------------------
|
| Pro is paid by bank transfer. The user picks monthly or yearly, transfers the amount
| with their payment reference, and uploads the slip (or sends it on WhatsApp). An admin
| checks the bank and approves it on /admin/payments, which turns Pro on until the end date.
|
| Fill in the bank details in .env; the payment page shows them exactly as written.
|
*/

return [
    'currency' => 'LKR',

    /** The plan that is sold. Prices in whole rupees. */
    'plan' => 'pro',
    'prices' => [
        'monthly' => (int) env('PRO_PRICE_MONTHLY', 490),
        'yearly' => (int) env('PRO_PRICE_YEARLY', 3990),
    ],

    'bank' => [
        'bank_name' => env('BANK_NAME', ''),
        'account_name' => env('BANK_ACCOUNT_NAME', ''),
        'account_number' => env('BANK_ACCOUNT_NUMBER', ''),
        'branch' => env('BANK_BRANCH', ''),
    ],

    /** WhatsApp number for payment slips and Pro support, as dialled in Sri Lanka. */
    'whatsapp' => env('BILLING_WHATSAPP', '075 517 3298'),

    /** Slip uploads: images or PDF, up to this many KB. */
    'slip_max_kb' => 5120,

    /** Days before the end date when the "Pro is ending" reminder is sent. */
    'reminder_days' => 5,

    /**
     * WhatsApp alert to the admin when someone requests Pro or uploads a slip, sent with CallMeBot.
     * Off until CALLMEBOT_APIKEY is set. The phone defaults to the WhatsApp number above.
     */
    'admin_whatsapp' => [
        'callmebot_apikey' => env('CALLMEBOT_APIKEY', ''),
        'phone' => env('CALLMEBOT_PHONE', ''),
    ],
];
