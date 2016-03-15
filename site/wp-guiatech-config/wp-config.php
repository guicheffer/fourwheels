<?php
/**
 * The base configuration for WordPress
 *
 * The wp-config.php creation script uses this file during the
 * installation. You don't have to use the web site, you can
 * copy this file to "wp-config.php" and fill in the values.
 *
 * This file contains the following configurations:
 *
 * * MySQL settings
 * * Secret keys
 * * Database table prefix
 * * ABSPATH
 *
 * @link https://codex.wordpress.org/Editing_wp-config.php
 *
 * @package WordPress
 */

/** !!!!!!!! Please just edit your local ones **/

// ** MySQL settings - You can get this info from your web host ** //
/** The name of the database for WordPress */
define('DB_NAME', 'dgjolero_four_wheels_dev');


/** MySQL database username */
define('DB_USER', 'USER');


/** MySQL database password */
define('DB_PASSWORD', 'PASS');


/** MySQL hostname */
define('DB_HOST', 'localhost');


/** Database Charset to use in creating database tables. */
define('DB_CHARSET', 'utf8');


/** The Database Collate type. Don't change this if in doubt. */
define('DB_COLLATE', '');

/** ENVs **/
define('WP_HOME','http://tests.guiatech.com.br/fourwheels/site/');
define('WP_SITEURL','http://tests.guiatech.com.br/fourwheels/site/');

/**#@+
 * Authentication Unique Keys and Salts.
 *
 * Change these to different unique phrases!
 * You can generate these using the {@link https://api.wordpress.org/secret-key/1.1/salt/ WordPress.org secret-key service}
 * You can change these at any point in time to invalidate all existing cookies. This will force all users to have to log in again.
 *
 * @since 2.6.0
 */
define('AUTH_KEY',         'Vw+JO8V=M.hrh{k gL5B0K_`/2 M9>o[4~ {cA!-%wEvM-DNzN$th$Tj&-~}B]E;');

define('SECURE_AUTH_KEY',  'BvQpje>$2a_#__77XtuGWUF=iY.cuR9,C QEwiMbEMm;TqBOniibw^H#*(_L(V:v');

define('LOGGED_IN_KEY',    ')^69~>mbW0N~jA80(J}N/jlizcM|U++~X4V%!5<-5}?xK5P|Oalt_l]Q)gvo0PxE');

define('NONCE_KEY',        'jz-#r6NH|)1j(I+*I`>r%{!Qq2Z~aZ*rn.u/Z_MWLAvhQ$:|6bjsZVs&iD9Qap:e');

define('AUTH_SALT',        'x-WO|cY~ifcCM+]`vJ8wMPtt$C*SKNft9BsBlm=B@&,yoK)![;vqn,lE%zG4D`J4');

define('SECURE_AUTH_SALT', 'M&A[sW)T-a@BE%k7{|i=gzzQAE|oCQ._WC]-G|uo/p+(_-6D[AHVe(OI0@/D/^y,');

define('LOGGED_IN_SALT',   'z6PxE`FG?7Au~.dx8p_M8&R=s$,,pgR$hN*L*=!hFIiX0$jWIcLKEwZ>.|szREQx');

define('NONCE_SALT',       'SnOx0G+Ud}G-!7Sp^]Bz]m9-RRB@<x(H&hQvws@FoT,TpF~IXTfU{qXS#sL4qb` ');


/**#@-*/

/**
 * WordPress Database Table prefix.
 *
 * You can have multiple installations in one database if you give each
 * a unique prefix. Only numbers, letters, and underscores please!
 */
$table_prefix  = 'wp_';


/**
 * For developers: WordPress debugging mode.
 *
 * Change this to true to enable the display of notices during development.
 * It is strongly recommended that plugin and theme developers use WP_DEBUG
 * in their development environments.
 *
 * For information on other constants that can be used for debugging,
 * visit the Codex.
 *
 * @link https://codex.wordpress.org/Debugging_in_WordPress
 */
define('WP_DEBUG', false);

/* That's all, stop editing! Happy blogging. */

/** Absolute path to the WordPress directory. */
if ( !defined('ABSPATH') )
	define('ABSPATH', dirname(__FILE__) . '/');

/** Sets up WordPress vars and included files. */
require_once(ABSPATH . 'wp-settings.php');
