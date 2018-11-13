<?php
    /**
    * Plugin Name: WP Tests
    * Description: Plugin that enables a form for sending brainbench tests
    * Version: 0.1
    * Author: Rosen
    */

    defined('ABSPATH') or die('ABSPATH not defined');
    // TODO: proper app/user error handling
    
    add_action('admin_menu', 'wp_tests_setup_menu');

    function wp_tests_setup_menu () {
        if (current_user_can('administrator')) {
            $test_menu = add_menu_page( 'Send Test', 'Send Test', 'manage_options', 'wp_tests', 'init_page' );

            add_action("admin_enqueue_scripts", function ($hook) use ($test_menu) {
                if ($hook !== $test_menu) {
                    return;
                }

                wp_enqueue_style( 'form-css', plugin_dir_url( __FILE__ ) . 'css/form.css' );
            });
        }
    }

    function init_page () {
        wp_enqueue_script( 'set-default-dates', plugin_dir_url( __FILE__ ) . 'js/set-defaults.js' );
        // TODO: date-to before today check, large date interval check
        // TODO: required fields
        echo "
                <form method=\"post\">
                    <label for=\"link\">link URL:</label>
                    <input type=\"text\" name=\"link\">
                    <label for=\"email\">E-mail:</label>
                    <input type=\"email\" name=\"email\">
                    <label for=\"date-from\">От:</label>
                    <input id=\"date-from\" type=\"date\" name=\"date-from\">
                    <label for=\"date-to\">До:</label>
                    <input id=\"date-to\" type=\"date\" name=\"date-to\">
                    <label for=\"submit\"></label>
                    <input type=\"submit\" value=\"Generate Email\">
            ";

        if ($_POST) {
            // TODO: save in db
            // TODO: test send email
            // TODO: test path should not be hard codded ? or const
            // TODO: domain name should not be hard coded

            // echo "<p>Имаш тест, Цъкни <a href=\"http://" . $_SERVER['HTTP_HOST'] . "/wptest/" . generateRandomString(30) . "\"> тук </a> за да го започнеш.</p><p>Срок: " . $_POST['date-to'] . " (включително)</p>";

            mail($_POST['email'], "Weekly Test", "<p>Имаш тест, Цъкни <a href=\"http://" . $_SERVER['HTTP_HOST'] . "/wptest/" . generateRandomString(30) . "\"> тук </a> за да го започнеш.</p><p>Срок: " . $_POST['date-to'] . " (включително)</p>"));
        }

        echo "</form>";
    }

    function generateRandomString ($length = 20) {
        $characters = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
        $charactersLength = strlen($characters);
        $randomString = '';

        for ($i = 0; $i < $length; $i++) {
            $randomString .= $characters[rand(0, $charactersLength - 1)];
        }

        return $randomString;
    }

?>
