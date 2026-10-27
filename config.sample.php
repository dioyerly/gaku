<?php
/**
 * Copiá este archivo como config.php y completá lo que necesites.
 * config.php NO se sube a ningún repositorio y está bloqueado desde afuera por el .htaccess.
 */
return [
    'brand' => ['name' => 'Gaku', 'short' => 'Gaku'],

    // URL pública del sitio, sin barra final. Ej.: 'https://gaku.estrategia.site'
    'app_url' => '',
    'default_tz' => 'America/Argentina/Buenos_Aires',

    // Base de datos MariaDB (Hostinger → Bases de datos)
    'db' => ['host' => 'localhost', 'name' => '', 'user' => '', 'pass' => ''],

    // Mercado Pago
    'mp' => [
        'access_token'   => '',   // Tus integraciones → Credenciales → Access Token
        'webhook_secret' => '',   // Tus integraciones → Webhooks → Clave secreta
        'api_base'       => 'https://api.mercadopago.com',
        'plan_url'       => '',   // Link del plan de suscripción (el que te da Mercado Pago al crear el plan)
        'grace_days'     => 5,    // días de gracia si un cobro se demora
    ],

    // Pago único (versión en un archivo HTML, sin sincronización)
    'once' => [
        'price'       => 28510,   // pesos
        'title'       => 'Gaku — versión en un archivo (pago único)',
        'max_devices' => 3,
        'recheck_days' => 7,      // cada cuánto se revalida la licencia si hay internet
        'offline_days' => 35,     // cuántos días puede estar sin conexión antes de pedir revalidar
    ],

    // Panel del dueño: admin.php
    'admin' => [
        'email' => '',
        // generá el hash con:  php -r "echo password_hash('TU-CLAVE-LARGA', PASSWORD_DEFAULT);"
        'password_hash' => '',
    ],

    'contact' => ['whatsapp' => '+5491126425994'],

    // Correo saliente (SMTP). Opcional: sin esto la app funciona igual (los datos se muestran en pantalla).
    'mail' => ['host' => '', 'port' => 587, 'secure' => 'tls', 'user' => '', 'pass' => '', 'from' => '', 'from_name' => 'Gaku'],

    // Los avisos se disparan por CLI: php /ruta/cron.php
    'cron_token' => '',
    'mail_daily_limit' => 40,

    // El registro libre está cerrado: se entra pagando o con invitación de una familia.
    'open_registration' => false,
];
