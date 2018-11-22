<?php
    /*
    * Plugin Name: BrainBenchTests
    * Description: Plugin that enables a form for sending brainbench tests
    * Version: 1.2
    * Author: Rosen
    */

    defined('ABSPATH') or die('ABSPATH not defined');
    // TODO: proper app error handling

    class BrainBenchTestsPlugin {
        const CODE_LENGTH = 30;
        const TITLE = 'Brainbench Tests';
        const TEST_PATH = 'brainbench-tests';
        const FORM_CSS_PATH = 'css/wptests.css';
        const JS_SET_DEFAULTS_PATH = 'js/wptests.js';
        const EMAIL_SUBJECT = "Weekly Tests";
        const RECAPTCHA_VERIFY_URL = "https://www.google.com/recaptcha/api/siteverify";

        // Admin error messages
            // send test form
        const INVALID_EMAIL_ERR_MSG = "Въведеният имейл е невалиден.";
        const FILL_ALL_FIELDS_ERR_MSG = "Моля попълнете всички полета.";
        const INVALID_DUE_DATE_ERR_MSG = "Невалидна дата на срок.";
        const INVALID_START_DATE_ERR_MSG = "Невалидна дата на задаване.";
        const START_DATE_IN_THE_PAST_ERR_MSG = "Датата на задаване не може да бъде в миналото.";
        const DUE_DATE_BEFORE_START_DATE_ERR_MSG = "Датата на срока трябва да бъде след датата на започване.";

            // settings form
        const INVALID_CC_ERR_MSG = "Невалидна конкурентност.";

        // Test page errors
        const DUE_DATE_MET_ERR_MSG = "Срока е изтекъл.";
        const LINK_NOT_VALID_ERR_MSG = "Линкът не е валиден.";
        const SERVICE_BLOCKED_ERR_MSG = "Услугата е заета, опитайте по-късно.";
        const TEST_ALREADY_COMPLETED_ERR_MSG = "Теста вече е направен.";
        const START_DATE_IN_THE_FUTURE_ERR_MSG = "Теста ще бъде активен от %s до %s вкл.";
        const INVALID_POST_PARAMETERS_ERR_MSG = "Невалидна заявка.";
        const RECAPTCHA_FAILED_ERR_MSG = "Моля потвърдете, че не сте робот.";

        // Opt name/def values
        const MAX_CONCURRENT_TESTS_OPT_NAME = "maximum_concurrent_tests";
        const MAX_CONCURRENT_TESTS_DEF_VALUE = "2";
        const EMAIL_MSG_OPT_NAME = "email_msg";
        const EMAIL_MSG_DEF_VALUE = "";
        const EMAIL_SENDER_OPT_NAME = "email_sender";
        const EMAIL_SENDER_DEF_VALUE = "wordpress@example.com";
        const RECAPTCHA_SITE_KEY_OPT_NAME = "recaptcha_site_key";
        const RECAPTCHA_SITE_KEY_DEF_VALUE = "";
        const RECAPTCHA_SECRET_KEY_OPT_NAME = "recaptcha_secret_key";
        const RECAPTCHA_SECRET_KEY_DEF_VALUE = "";

        // Database Table names
        const TESTS_TABLE_NAME = "brainbench_tests";
        const SETTINGS_TABLE_NAME = "brainbench_settings";
        const ODIT_TABLE_NAME = "brainbench_odit";

        function __construct () {
            if (explode('/', add_query_arg($_GET))[1] === BrainBenchTestsPlugin::TEST_PATH) {
                add_filter('the_content', array($this, 'load_test_page'));
            }

            register_activation_hook ( __FILE__, array($this, 'on_activate'));
            register_deactivation_hook ( __FILE__, array($this, 'on_deactivate'));

            add_filter( 'wp_mail_from', array($this, 'change_email') );
            add_action('admin_menu', array($this, 'brainbench_tests_setup_menu'));
        }

        function change_email ( $email ) {
            return "rosen@hackerschool-bg.com";
        }

        function on_activate () {
            global $wpdb;

            if (get_page_by_title( BrainBenchTestsPlugin::TITLE ) == null || get_page_by_title( BrainBenchTestsPlugin::TITLE )->post_status !== 'publish') {
                // Create the page if no such
                wp_insert_post(array(
                  'post_title'    => BrainBenchTestsPlugin::TITLE,
                  'post_content'  => '',
                  'post_status'   => 'publish',
                  'post_author'   => 1,
                  'post_type'     => 'page',
                ));
            }

            require_once( ABSPATH . 'wp-admin/includes/upgrade.php' );
            dbDelta(sprintf("
                    CREATE TABLE IF NOT EXISTS %s (
                        id INT AUTO_INCREMENT,
                        link TEXT NOT NULL,
                        name TEXT NOT NULL,
                        email TEXT NOT NULL,
                        start_date DATE NOT NULL,
                        due_date DATE NOT NULL,
                        code TEXT NOT NULL,
                        status TEXT NOT NULL,
                        unlock_time BIGINT,
                        PRIMARY KEY (id)
                    );
                ", $wpdb->prefix . BrainBenchTestsPlugin::TESTS_TABLE_NAME
            ));

            dbDelta(sprintf("
                    CREATE TABLE IF NOT EXISTS %s (
                        id INT AUTO_INCREMENT,
                        opt_name TEXT NOT NULL,
                        opt_value TEXT NOT NULL,
                        PRIMARY KEY (id)
                    );
                ", $wpdb->prefix . BrainBenchTestsPlugin::SETTINGS_TABLE_NAME
            ));

            dbDelta(sprintf("
                    CREATE TABLE IF NOT EXISTS %s (
                        id INT AUTO_INCREMENT,
                        event TEXT NOT NULL,
                        time TIMESTAMP NOT NULL,
                        test_id INT,
                        PRIMARY KEY (id),
                        FOREIGN KEY (test_id) REFERENCES %s(id)
                    );
                ", $wpdb->prefix . BrainBenchTestsPlugin::ODIT_TABLE_NAME, $wpdb->prefix . BrainBenchTestsPlugin::TESTS_TABLE_NAME
            ));

            $opts_default_values = [ BrainBenchTestsPlugin::MAX_CONCURRENT_TESTS_OPT_NAME => BrainBenchTestsPlugin::MAX_CONCURRENT_TESTS_DEF_VALUE, BrainBenchTestsPlugin::EMAIL_MSG_OPT_NAME => BrainBenchTestsPlugin::EMAIL_MSG_DEF_VALUE, BrainBenchTestsPlugin::EMAIL_SENDER_OPT_NAME => BrainBenchTestsPlugin::EMAIL_SENDER_DEF_VALUE, BrainBenchTestsPlugin::RECAPTCHA_SITE_KEY_OPT_NAME => BrainBenchTestsPlugin::RECAPTCHA_SITE_KEY_DEF_VALUE, BrainBenchTestsPlugin::RECAPTCHA_SECRET_KEY_OPT_NAME => BrainBenchTestsPlugin::RECAPTCHA_SECRET_KEY_DEF_VALUE ];

            foreach ($opts_default_values as $option => $default) {
                $rows = $wpdb->get_results(sprintf("SELECT * FROM %s WHERE opt_name = '%s'", $wpdb->prefix . BrainBenchTestsPlugin::SETTINGS_TABLE_NAME, $option));

                if (count($rows) === 0) {
                    $wpdb->insert(
                        $wpdb->prefix . BrainBenchTestsPlugin::SETTINGS_TABLE_NAME,
                        array(
                            'opt_name' => $option,
                            'opt_value' => $default
                        )
                    );
                }
            }
        }

        function on_deactivate () {
            if (get_page_by_title( BrainBenchTestsPlugin::TITLE ) != null) {
                wp_delete_post(get_page_by_title( BrainBenchTestsPlugin::TITLE )->ID);
            }
        }

        function brainbench_tests_setup_menu () {
            if (current_user_can('administrator')) {
                $test_menu = add_menu_page('Send Test', 'Send Test', 'manage_options', 'wp_tests', array($this, 'init_page'));
            }
        }

        function init_page () {
            wp_enqueue_style( 'form-css', plugin_dir_url( __FILE__ ) . BrainBenchTestsPlugin::FORM_CSS_PATH );
            
            if ($_SERVER['REQUEST_METHOD'] === 'GET') {
                $this->display_send_test_form();
                $this->display_settings_form();
                $this->display_tests();
                wp_enqueue_script( 'set-default-dates', plugin_dir_url( __FILE__ ) . BrainBenchTestsPlugin::JS_SET_DEFAULTS_PATH );
            }

            if ($_SERVER['REQUEST_METHOD'] === 'POST') {
                $this->post_admin_page();
            }
        }

        function display_settings_form () {
            global $wpdb;

            // TODO: datafication
            $max_parallel = $wpdb->get_results(sprintf("SELECT opt_value FROM %s WHERE opt_name = '%s'", $wpdb->prefix . BrainBenchTestsPlugin::SETTINGS_TABLE_NAME, BrainBenchTestsPlugin::MAX_CONCURRENT_TESTS_OPT_NAME))[0]->opt_value;
            $email_sender = $wpdb->get_results(sprintf("SELECT opt_value FROM %s WHERE opt_name = '%s'", $wpdb->prefix . BrainBenchTestsPlugin::SETTINGS_TABLE_NAME, BrainBenchTestsPlugin::EMAIL_SENDER_OPT_NAME))[0]->opt_value;
            $email_msg = $wpdb->get_results(sprintf("SELECT opt_value FROM %s WHERE opt_name = '%s'", $wpdb->prefix . BrainBenchTestsPlugin::SETTINGS_TABLE_NAME, BrainBenchTestsPlugin::EMAIL_MSG_OPT_NAME))[0]->opt_value;
            $site_key = $wpdb->get_results(sprintf("SELECT opt_value FROM %s WHERE opt_name = '%s'", $wpdb->prefix . BrainBenchTestsPlugin::SETTINGS_TABLE_NAME, BrainBenchTestsPlugin::RECAPTCHA_SITE_KEY_OPT_NAME))[0]->opt_value;
            $secret_key = $wpdb->get_results(sprintf("SELECT opt_value FROM %s WHERE opt_name = '%s'", $wpdb->prefix . BrainBenchTestsPlugin::SETTINGS_TABLE_NAME, BrainBenchTestsPlugin::RECAPTCHA_SECRET_KEY_OPT_NAME))[0]->opt_value;

            echo sprintf("
                    <form method=\"post\">
                        <label for=\"max_parallel\">Concurrency:</label>
                        <input name=\"max_parallel\" value=\"%s\">
                        <label for=\"email_sender\">Email Sender:</label>
                        <input name=\"email_sender\" value=\"%s\">
                        <label for=\"email_msg\">Email Text:</label>
                        <textarea name=\"email_msg\" rows=\"4\" style=\"width: 400px; margin-top: 20px;\">%s</textarea>
                        <label for=\"site_key\">Recaptcha site key:</label>
                        <input name=\"site_key\" value=\"%s\">
                        <label for=\"secret_key\">Recaptcha secret key:</label>
                        <input name=\"secret_key\" value=\"%s\">
                        <label></label>
                        <input type=\"submit\" value=\"Set\">
                    </form>
                ", $max_parallel, $email_sender, $email_msg, $site_key, $secret_key
            );
        }

        function post_admin_page () {
            global $wpdb;
            
            // TODO: add email_msg
            if (array_key_exists('max_parallel', $_POST)) { // second form
                if (
                    !array_key_exists('max_parallel', $_POST) ||
                    !array_key_exists('email_msg', $_POST) ||
                    !array_key_exists('email_sender', $_POST)
                    ) {
                    $this->display_send_test_form();
                    $this->display_settings_form();
                    $this->display_tests();
                    return;
                }

                $this->display_send_test_form();

                $rows = $wpdb->get_results(sprintf("SELECT opt_value FROM %s WHERE opt_name = '%s'", $wpdb->prefix . BrainBenchTestsPlugin::SETTINGS_TABLE_NAME, BrainBenchTestsPlugin::MAX_CONCURRENT_TESTS_OPT_NAME));


                echo "<form method=\"post\">";
                echo "  <label for=\"max_parallel\">Concurrency: </label>\n";
                echo (is_numeric($_POST['max_parallel']) && (int) $_POST['max_parallel'] > 0 ? sprintf("<input name=\"max_parallel\" value=\"%s\">", htmlspecialchars($_POST['max_parallel'])) : sprintf("<input name=\"max_parallel\" class=\"invalid-input\" value=\"%s\">", $rows[0]->opt_value));
                echo sprintf("
                    <label for=\"email_sender\">Email Sender:</label>
                    <input name=\"email_sender\" value=\"%s\">", $_POST['email_sender']
                );
                echo sprintf("
                    <label for=\"email_msg\">Email Text:</label>
                    <textarea name=\"email_msg\" rows=\"4\" style=\"width: 400px; margin-top: 20px;\">%s</textarea>", htmlspecialchars($_POST['email_msg'])
                );
                echo sprintf("
                    <label for=\"site_key\">Recaptcha site key:</label>
                    <input name=\"site_key\" value=\"%s\">", $_POST['site_key']
                );
                echo sprintf("
                    <label for=\"secret_key\">Recaptcha secret key:</label>
                    <input name=\"secret_key\" value=\"%s\">", $_POST['secret_key']
                );
                echo "<label></label>\n";
                echo "<input type=\"submit\" value=\"Set\">";

                $has_errors = false;

                try {
                    $this->assert_user(is_numeric($_POST['max_parallel']) && (int) $_POST['max_parallel'] > 0, BrainBenchTestsPlugin::INVALID_CC_ERR_MSG);
                } catch (UserErrorWPTests $err) {
                    $has_errors = true;
                    echo sprintf("<p id=\"err-msg\">%s</p>", htmlspecialchars($err->getMessage()));
                }

                if (!$has_errors) {
                    // TODO: datafication
                    $wpdb->query($wpdb->prepare(sprintf("UPDATE %s SET opt_value = '%s' WHERE opt_name = '%s'", $wpdb->prefix . BrainBenchTestsPlugin::SETTINGS_TABLE_NAME, '%s', BrainBenchTestsPlugin::MAX_CONCURRENT_TESTS_OPT_NAME), $_POST['max_parallel']));

                    $wpdb->query($wpdb->prepare(sprintf("UPDATE %s SET opt_value = '%s' WHERE opt_name = '%s'", $wpdb->prefix . BrainBenchTestsPlugin::SETTINGS_TABLE_NAME, '%s', BrainBenchTestsPlugin::EMAIL_MSG_OPT_NAME), $_POST['email_msg']));

                    $wpdb->query($wpdb->prepare(sprintf("UPDATE %s SET opt_value = '%s' WHERE opt_name = '%s'", $wpdb->prefix . BrainBenchTestsPlugin::SETTINGS_TABLE_NAME, '%s', BrainBenchTestsPlugin::EMAIL_SENDER_OPT_NAME), $_POST['email_sender']));

                    $wpdb->query($wpdb->prepare(sprintf("UPDATE %s SET opt_value = '%s' WHERE opt_name = '%s'", $wpdb->prefix . BrainBenchTestsPlugin::SETTINGS_TABLE_NAME, '%s', BrainBenchTestsPlugin::RECAPTCHA_SITE_KEY_OPT_NAME), $_POST['site_key']));

                    $wpdb->query($wpdb->prepare(sprintf("UPDATE %s SET opt_value = '%s' WHERE opt_name = '%s'", $wpdb->prefix . BrainBenchTestsPlugin::SETTINGS_TABLE_NAME, '%s', BrainBenchTestsPlugin::RECAPTCHA_SECRET_KEY_OPT_NAME), $_POST['secret_key']));

                    echo "<p>Настройките бяха запазени.</p>";
                }

                echo "</form>";
                $this->display_tests();

                wp_enqueue_script( 'set-default-dates', plugin_dir_url( __FILE__ ) . BrainBenchTestsPlugin::JS_SET_DEFAULTS_PATH );
                return;
            }

            // adding invalid-input class on invalid data
            echo "<form method=\"post\">";
            echo "<label for=\"link\">link URL:</label>\n";
            echo ($_POST['link'] ? sprintf("<input type=\"text\" name=\"link\" value=\"%s\">", htmlspecialchars($_POST['link'])) : "<input type=\"text\" name=\"link\" class=\"invalid-input\">");
            echo "<label for=\"real-name\">Name:</label>\n";
            echo ($_POST['real-name'] ? sprintf("<input type=\"text\" name=\"real-name\" value=\"%s\">", htmlspecialchars($_POST['real-name'])) : "<input type=\"text\" name=\"real-name\" class=\"invalid-input\">");
            echo "<label for=\"email\">E-mail:</label>\n";
            echo ($_POST['email'] && filter_var($_POST['email'], FILTER_VALIDATE_EMAIL) ? sprintf("<input type=\"email\" name=\"email\" value=\"%s\">", htmlspecialchars($_POST['email'])) : sprintf("<input type=\"email\" name=\"email\" value=\"%s\" class=\"invalid-input\">", htmlspecialchars($_POST['email'])));
            echo "<label for=\"date-from\">От:</label>\n";
            echo ($_POST['date-from'] && $this->isRealDate($_POST['date-from']) && strtotime($_POST['date-from']) >= strtotime('today') ? sprintf("<input id=\"date-from\" type=\"date\" name=\"date-from\" value=\"%s\">", htmlspecialchars($_POST['date-from'])) : sprintf("<input id=\"date-from\" type=\"date\" name=\"date-from\" value=\"%s\" class=\"invalid-input\">", htmlspecialchars($_POST['date-from'])));
            echo "<label for=\"date-to\">До:</label>\n";
            echo ($_POST['date-to'] && $this->isRealDate($_POST['date-to']) && strtotime($_POST['date-to']) >= strtotime($_POST['date-from']) ? sprintf("<input id=\"date-to\" type=\"date\" name=\"date-to\" value=\"%s\">", htmlspecialchars($_POST['date-to'])) : sprintf("<input id=\"date-to\" type=\"date\" name=\"date-to\" value=\"%s\" class=\"invalid-input\">", htmlspecialchars($_POST['date-to'])));
            echo "<label for=\"submit\"></label>";
            echo "<input type=\"submit\" value=\"Send Email\">";

            $has_errors = false;

            try {
                $this->assert_user($_POST['link'] && $_POST['email'] && $_POST['date-from'] && $_POST['date-to'] && $_POST['real-name'], BrainBenchTestsPlugin::FILL_ALL_FIELDS_ERR_MSG);
                
                $this->assert_user(filter_var($_POST['email'], FILTER_VALIDATE_EMAIL), BrainBenchTestsPlugin::INVALID_EMAIL_ERR_MSG);

                $this->assert_user($this->isRealDate($_POST['date-from']), BrainBenchTestsPlugin::INVALID_START_DATE_ERR_MSG);
                $this->assert_user($this->isRealDate($_POST['date-to']), BrainBenchTestsPlugin::INVALID_DUE_DATE_ERR_MSG);

                $this->assert_user(strtotime($_POST['date-from']) >= strtotime('today'), BrainBenchTestsPlugin::START_DATE_IN_THE_PAST_ERR_MSG);
                $this->assert_user(strtotime($_POST['date-to']) >= strtotime($_POST['date-from']), BrainBenchTestsPlugin::DUE_DATE_BEFORE_START_DATE_ERR_MSG);
            } catch (UserErrorWPTests $err) {
                echo sprintf("<p id=\"err-msg\">%s</p>", htmlspecialchars($err->getMessage()));
                $has_errors = true;
            }

            if (!$has_errors) {
                $code = $this->generateRandomString(BrainBenchTestsPlugin::CODE_LENGTH);
                $link = sprintf("http://%s/%s?test=%s", $_SERVER['HTTP_HOST'], BrainBenchTestsPlugin::TEST_PATH, $code);

                $wpdb->insert(
                    $wpdb->prefix . BrainBenchTestsPlugin::TESTS_TABLE_NAME,
                    array(
                        'link' => $_POST['link'],
                        'name' => $_POST['real-name'],
                        'email' => $_POST['email'],
                        'start_date' => $_POST['date-from'],
                        'due_date' => $_POST['date-to'],
                        'status' => BrainBenchTestStatus::NOT_COMPLETED,
                        'code' => $code
                    )
                );

                $msg = $wpdb->get_results(sprintf("SELECT opt_value FROM %s WHERE opt_name = '%s'", $wpdb->prefix . BrainBenchTestsPlugin::SETTINGS_TABLE_NAME, BrainBenchTestsPlugin::EMAIL_MSG_OPT_NAME))[0]->opt_value;

                // TODO: make '<link>' constant
                $msg = str_replace("<link>", htmlspecialchars($link), $msg);
                $msg = str_replace("<name>", htmlspecialchars($_POST['real-name']), $msg);
                $msg = str_replace("<from>", htmlspecialchars($_POST['date-from']), $msg);
                $msg = str_replace("<to>", htmlspecialchars($_POST['date-to']), $msg);

                if ($this->send_email($_POST['email'], $msg)) {
                    echo sprintf("<p>Теста беше успешно изпратен на %s</p>", htmlspecialchars($_POST['email']));
                } else {
                    echo sprintf("<p id=\"err-msg\">Теста не беше изпратен успешно</p>");
                }
            }

            echo "</form>";

            $this->display_settings_form();
            $this->display_tests();
        }

        function send_email ($to, $msg) {
            return wp_mail($to, BrainBenchTestsPlugin::EMAIL_SUBJECT, $msg);
        }

        function display_send_test_form () {
            echo "
                <form method=\"post\">
                    <label for=\"link\">link URL:</label>
                    <input name=\"link\">
                    <label for=\"real-name\">Name:</label>
                    <input name=\"real-name\">
                    <label for=\"email\">E-mail:</label>
                    <input type=\"email\" name=\"email\">
                    <label for=\"date-from\">От:</label>
                    <input id=\"date-from\" type=\"date\" name=\"date-from\">
                    <label for=\"date-to\">До:</label>
                    <input id=\"date-to\" type=\"date\" name=\"date-to\">
                    <label for=\"submit\"></label>
                    <input type=\"submit\" value=\"Send Email\">
                </form>
            ";
        }

        function display_tests () {
            global $wpdb;

            $rows = $wpdb->get_results(sprintf("SELECT * FROM %s", $wpdb->prefix . BrainBenchTestsPlugin::TESTS_TABLE_NAME));

            echo "<table class=\"test-table\" style=\"margin-top: 3em; width: 100%;\">";
            echo "  <tr>
                        <th>ID</th>
                        <th>Test</th>
                        <th>Email</th>
                        <th>Start Date</th>
                        <th>Due Date</th>
                        <th>Code</th>
                        <th>Status</th>
                        <th>Odit</th>
                    </tr>";
            foreach ($rows as $row) {
                $test_odits = $wpdb->get_results(sprintf("SELECT * FROM %s WHERE test_id = '%s'", $wpdb->prefix . BrainBenchTestsPlugin::ODIT_TABLE_NAME, $row->id));

                $odit = '';

                if (count($test_odits) > 0) {
                    foreach ($test_odits as $test_odit) {

                        $odit .= sprintf("%s%s%s\\n", $test_odit->time, str_repeat(" ", 20), $test_odit->event);
                    }
                } else {
                    $odit .= 'No actions have been performed for this test.';
                }

                echo sprintf("  
                    <tr>
                        <th>%s</th>
                        <th><a href=\"%s\">link</a></th>
                        <th>%s</th>
                        <th>%s</th>
                        <th>%s</th>
                        <th>%s</th>
                        <th>%s</th>
                        <th onclick=\"alert('%s'); return false;\"><a href=\"\">odit</a></th>
                    </tr>", $row->id, htmlspecialchars($row->link),  $row->email,  $row->start_date,  $row->due_date, $row->code, $row->status, $odit
                );
            }
            echo "</table>";
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

        function display_test ($link, $code) {
            echo "<form method=\"post\">";
            echo "<input type=\"text\" name=\"reset\" value=\"1\" style=\"display: none\">";
            echo sprintf("<input type=\"text\" name=\"code\" value=\"%s\" style=\"display: none\">", htmlspecialchars($code));
            echo "<input type=\"submit\" value=\"Test Completed\">";
            echo "</form>";
        }

        function can_start_new_test () {
            global $wpdb;

            $locks = $wpdb->get_results(sprintf("SELECT COUNT(*) AS count FROM %s WHERE unlock_time > '%s'", $wpdb->prefix . BrainBenchTestsPlugin::TESTS_TABLE_NAME, strtotime("now")));
            $max_parallel = $wpdb->get_results(sprintf("SELECT opt_value FROM %s where opt_name = '%s'", $wpdb->prefix . BrainBenchTestsPlugin::SETTINGS_TABLE_NAME, BrainBenchTestsPlugin::MAX_CONCURRENT_TESTS_OPT_NAME));

            return $locks[0]->count < (int)$max_parallel[0]->opt_value;
        }

        function load_test_page () {
            if ($_SERVER['REQUEST_METHOD'] === 'GET') {
                $this->get_test_page();
            }

            if ($_SERVER['REQUEST_METHOD'] === 'POST') {
                $this->post_test_page();
            }
        }

        function get_test_page ($err = NULL) {
            global $wpdb;

            try {
                $site_key = $wpdb->get_results(sprintf("SELECT opt_value FROM %s WHERE opt_name = '%s'", $wpdb->prefix . BrainBenchTestsPlugin::SETTINGS_TABLE_NAME, BrainBenchTestsPlugin::RECAPTCHA_SITE_KEY_OPT_NAME))[0]->opt_value;

                wp_enqueue_script( 'recaptcha', sprintf("https://www.google.com/recaptcha/api.js", $site_key) );

                $this->assert_user(array_key_exists('test', $_GET), BrainBenchTestsPlugin::LINK_NOT_VALID_ERR_MSG);

                $rows = $wpdb->get_results($wpdb->prepare(sprintf("SELECT * FROM %s WHERE code = %s", $wpdb->prefix . BrainBenchTestsPlugin::TESTS_TABLE_NAME, '%s'), $_GET['test']));

                $this->assert_user(count($rows) > 0, BrainBenchTestsPlugin::LINK_NOT_VALID_ERR_MSG);

                $wpdb->insert(
                    $wpdb->prefix . BrainBenchTestsPlugin::ODIT_TABLE_NAME,
                    array(
                        'event' => sprintf("Test page visited"),
                        'test_id' => $rows[0]->id
                    )
                );

                // TODO: replace $rows[0] with test
                $this->assert_user($rows[0]->status !== BrainBenchTestStatus::COMPLETED, BrainBenchTestsPlugin::TEST_ALREADY_COMPLETED_ERR_MSG);

                $this->assert_user(strtotime($rows[0]->start_date) <= strtotime('today'), sprintf(BrainBenchTestsPlugin::START_DATE_IN_THE_FUTURE_ERR_MSG, $rows[0]->start_date, $rows[0]->due_date));
                $this->assert_user(strtotime($rows[0]->due_date) >= strtotime('today'), BrainBenchTestsPlugin::DUE_DATE_MET_ERR_MSG);

                if ($rows[0]->status === BrainBenchTestStatus::STARTED) {
                    $this->display_test($rows[0]->link, $rows[0]->code);
                    return;
                }

                $this->assert_user($this->can_start_new_test(), BrainBenchTestsPlugin::SERVICE_BLOCKED_ERR_MSG);

                echo "<form method=\"post\" style=\"width: 300px;\">";
                echo "<p>Здравей Гошо123, За да започнеш теста попълни следната формичка и натисни старт ! :)))</p>";
                echo sprintf("<input type=\"text\" name=\"link\" value=\"%s\" style=\"display: none\">", htmlspecialchars($rows[0]->link));
                echo sprintf("<input type=\"text\" name=\"code\" value=\"%s\" style=\"display: none\">", htmlspecialchars($rows[0]->code));
                echo sprintf("<input type=\"text\" name=\"date-to\" value=\"%s\" style=\"display: none\">", htmlspecialchars($rows[0]->due_date));
                echo sprintf("<div class=\"g-recaptcha\" data-sitekey=\"%s\"></div>", $site_key);
                echo "<input type=\"submit\" value=\"Start Test\" style=\"width: 100%\">";
                if ($err) {
                    echo sprintf("<p id=\"err-msg\" style=\"color: #FF0000;\">%s</p>", htmlspecialchars($err->getMessage()));
                }
                echo "</form>";
            } catch (UserErrorWPTests $err) {
                echo sprintf("<p id=\"err-msg\" style=\"color: #FF0000;\">%s</p>", htmlspecialchars($err->getMessage()));
            }
        }

        function post_test_page () {
            global $wpdb;

            try {
                if (array_key_exists('reset', $_POST)) { // THIS IS JUST FOR TESTING (ON TEST COMPLETE CLICKED)
                    $wpdb->query($wpdb->prepare(sprintf("UPDATE %s SET status = '%s', unlock_time = 0 WHERE code = '%s'", $wpdb->prefix . BrainBenchTestsPlugin::TESTS_TABLE_NAME, BrainBenchTestStatus::COMPLETED, '%s'), $_POST['code']));
                    echo "<p>Теста е завършен успешно.</p>";
                    return;
                }

                $site_key = $wpdb->get_results(sprintf("SELECT opt_value FROM %s WHERE opt_name = '%s'", $wpdb->prefix . BrainBenchTestsPlugin::SETTINGS_TABLE_NAME, BrainBenchTestsPlugin::RECAPTCHA_SITE_KEY_OPT_NAME))[0]->opt_value;
                $secret_key = $wpdb->get_results(sprintf("SELECT opt_value FROM %s WHERE opt_name = '%s'", $wpdb->prefix . BrainBenchTestsPlugin::SETTINGS_TABLE_NAME, BrainBenchTestsPlugin::RECAPTCHA_SECRET_KEY_OPT_NAME))[0]->opt_value;

                wp_enqueue_script( 'recaptcha', sprintf("https://www.google.com/recaptcha/api.js", $site_key) );

                $test = $wpdb->get_results($wpdb->prepare(sprintf("SELECT * FROM %s where code = '%s'", $wpdb->prefix . BrainBenchTestsPlugin::TESTS_TABLE_NAME, '%s'), $_POST['code']));

                $this->assert_user(count($test) === 1, BrainBenchTestsPlugin::LINK_NOT_VALID_ERR_MSG);


                $response = $this->httpPost(BrainBenchTestsPlugin::RECAPTCHA_VERIFY_URL, 
                    ['secret' => $secret_key, 'response' => $_POST['g-recaptcha-response']]);

                $this->assert_user(json_decode($response)->success === true, BrainBenchTestsPlugin::RECAPTCHA_FAILED_ERR_MSG);

                $this->assert_user(array_key_exists('code', $_POST) && array_key_exists('link', $_POST), BrainBenchTestsPlugin::INVALID_POST_PARAMETERS_ERR_MSG);

                $wpdb->insert(
                    $wpdb->prefix . BrainBenchTestsPlugin::ODIT_TABLE_NAME,
                    array(
                        'event' => sprintf("Start button clicked"),
                        'test_id' => $test[0]->id
                    )
                );

                $this->assert_user($this->can_start_new_test(), BrainBenchTestsPlugin::SERVICE_BLOCKED_ERR_MSG);

                $wpdb->query($wpdb->prepare(sprintf("UPDATE %s SET status = '%s', unlock_time = '%s' WHERE code = '%s'", $wpdb->prefix . BrainBenchTestsPlugin::TESTS_TABLE_NAME, BrainBenchTestStatus::STARTED, strtotime('now +2 hour'), '%s'), $_POST['code']));

                $this->display_test($_POST['link'], $_POST['code']);
            } catch (UserErrorWPTests $err) {
                $this->get_test_page($err);
            }
        }

        function isRealDate ($date) {
            if (false === strtotime($date)) {
                return false;
            }

            list($year, $month, $day) = explode('-', $date);
            return checkdate($month, $day, $year);
        }

        function httpPost($url, $data) {
            $curl = curl_init($url);
            curl_setopt($curl, CURLOPT_POST, true);
            curl_setopt($curl, CURLOPT_POSTFIELDS, http_build_query($data));
            curl_setopt($curl, CURLOPT_RETURNTRANSFER, true);
            $response = curl_exec($curl);
            curl_close($curl);
            return $response;
        }

        function assert_user ($condition, $msg) {
            if (!$condition) {
                throw new UserErrorWPTests($msg);
            }
        }
    }

    class UserErrorWPTests extends Exception {
        public function __construct($message, $code = 0, Exception $previous = null) {
            parent::__construct($message, $code, $previous);
        }
    }

    abstract class BrainBenchTestStatus {
        const NOT_COMPLETED = 'not completed';
        const STARTED = 'started';
        const COMPLETED = 'completed';
    }

    new BrainBenchTestsPlugin();
?>
