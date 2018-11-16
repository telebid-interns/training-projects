<?php
    /*
    * Plugin Name: BrainBenchTests
    * Description: Plugin that enables a form for sending brainbench tests
    * Version: 1.0
    * Author: Rosen
    */

    defined('ABSPATH') or die('ABSPATH not defined');
    // TODO: proper app error handling

    class BrainBenchTestsPlugin {
        const CODE_LENGTH = 30;
        const TITLE = 'Brainbench Tests';
        const TEST_PATH = 'brainbench-tests';
        const FORM_CSS_PATH = 'css/form.css';
        const JS_SET_DEFAULTS_PATH = 'js/set-defaults.js';

        // Admin error messages
        const INVALID_EMAIL_ERR_MSG = "Въведеният имейл е невалиден.";
        const FILL_ALL_FIELDS_ERR_MSG = "Моля попълнете всички полета.";
        const INVALID_DUE_DATE_ERR_MSG = "Невалидна дата на срок.";
        const INVALID_START_DATE_ERR_MSG = "Невалидна дата на задаване.";
        const START_DATE_IN_THE_PAST_ERR_MSG = "Датата на задаване не може да бъде в миналото.";
        const DUE_DATE_BEFORE_START_DATE_ERR_MSG = "Датата на срока трябва да бъде след датата на започване.";

        // Test page errors
        const DUE_DATE_MET_ERR_MSG = "Срока е изтекъл.";
        const LINK_NOT_VALID_ERR_MSG = "Линкът не е валиден.";
        const SERVICE_BLOCKED_ERR_MSG = "Вече има пуснат тест, опитайте по-късно.";
        const TEST_ALREADY_COMPLETED_ERR_MSG = "Теста вече е направен.";
        const START_DATE_IN_THE_FUTURE_ERR_MSG = "Теста ще бъде активен от %s до %s вкл.";

        // Opt name/def values
        const LOCKED_UNTIL_OPT_NAME = "locked_until";
        const CURRENT_TEST_OPT_NAME = "current_test";
        const LOCKED_UNTIL_DEF_VALUE = "1";
        const CURRENT_TEST_DEF_VALUE = "no_test";

        // Database Table names
        const TESTS_TABLE_NAME = "brainbench_tests";
        const SETTINGS_TABLE_NAME = "brainbench_settings";

        function __construct () {
            if (explode('/', add_query_arg($_GET))[1] === BrainBenchTestsPlugin::TEST_PATH) {
                add_filter('the_content', array($this, 'load_test_page'));
            }

            register_activation_hook ( __FILE__, array($this, 'on_activate'));
            register_deactivation_hook ( __FILE__, array($this, 'on_deactivate'));

            add_action('admin_menu', array($this, 'brainbench_tests_setup_menu'));
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
                        email TEXT NOT NULL,
                        start_date DATE NOT NULL,
                        due_date DATE NOT NULL,
                        code TEXT NOT NULL,
                        status TEXT NOT NULL,
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

            $opts_default_values = [BrainBenchTestsPlugin::LOCKED_UNTIL_OPT_NAME => BrainBenchTestsPlugin::LOCKED_UNTIL_DEF_VALUE, BrainBenchTestsPlugin::CURRENT_TEST_OPT_NAME => BrainBenchTestsPlugin::CURRENT_TEST_DEF_VALUE];

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
                $this->get_admin_page();
                wp_enqueue_script( 'set-default-dates', plugin_dir_url( __FILE__ ) . BrainBenchTestsPlugin::JS_SET_DEFAULTS_PATH );
            }

            if ($_SERVER['REQUEST_METHOD'] === 'POST') {
                try {
                    $this->post_admin_page();
                } catch (UserErrorWPTests $err) {
                    echo sprintf("<p id=\"err-msg\">%s</p>", htmlspecialchars($err->getMessage()));
                } finally {
                    echo "
                            <label for=\"submit\"></label>
                            <input type=\"submit\" value=\"Generate Email\">
                            </form>
                    ";

                    $this->display_tests();
                }
            }
        }

        function post_admin_page () {
            global $wpdb;

            // adding invalid-input class on invalid data
            echo "<form method=\"post\">";
            echo "<label for=\"link\">link URL:</label>\n";
            echo ($_POST['link'] ? sprintf("<input type=\"text\" name=\"link\" value=\"%s\">", htmlspecialchars($_POST['link'])) : "<input type=\"text\" name=\"link\" class=\"invalid-input\">");
            echo "<label for=\"email\">E-mail:</label>\n";
            echo ($_POST['email'] && filter_var($_POST['email'], FILTER_VALIDATE_EMAIL) ? sprintf("<input type=\"email\" name=\"email\" value=\"%s\">", htmlspecialchars($_POST['email'])) : sprintf("<input type=\"email\" name=\"email\" value=\"%s\" class=\"invalid-input\">", htmlspecialchars($_POST['email'])));
            echo "<label for=\"date-from\">От:</label>\n";
            echo ($_POST['date-from'] && $this->isRealDate($_POST['date-from']) && strtotime($_POST['date-from']) >= strtotime('today') ? sprintf("<input id=\"date-from\" type=\"date\" name=\"date-from\" value=\"%s\">", htmlspecialchars($_POST['date-from'])) : sprintf("<input id=\"date-from\" type=\"date\" name=\"date-from\" value=\"%s\" class=\"invalid-input\">", htmlspecialchars($_POST['date-from'])));
            echo "<label for=\"date-to\">До:</label>\n";
            echo ($_POST['date-to'] && $this->isRealDate($_POST['date-to']) && strtotime($_POST['date-to']) >= strtotime($_POST['date-from']) ? sprintf("<input id=\"date-to\" type=\"date\" name=\"date-to\" value=\"%s\">", htmlspecialchars($_POST['date-to'])) : sprintf("<input id=\"date-to\" type=\"date\" name=\"date-to\" value=\"%s\" class=\"invalid-input\">", htmlspecialchars($_POST['date-to'])));

            $this->assert_user($_POST['link'] && $_POST['email'] && $_POST['date-from'] && $_POST['date-to'], BrainBenchTestsPlugin::FILL_ALL_FIELDS_ERR_MSG);
            
            $this->assert_user(filter_var($_POST['email'], FILTER_VALIDATE_EMAIL), BrainBenchTestsPlugin::INVALID_EMAIL_ERR_MSG);

            $this->assert_user($this->isRealDate($_POST['date-from']), BrainBenchTestsPlugin::INVALID_START_DATE_ERR_MSG);
            $this->assert_user($this->isRealDate($_POST['date-to']), BrainBenchTestsPlugin::INVALID_DUE_DATE_ERR_MSG);

            $this->assert_user(strtotime($_POST['date-from']) >= strtotime('today'), BrainBenchTestsPlugin::START_DATE_IN_THE_PAST_ERR_MSG);
            $this->assert_user(strtotime($_POST['date-to']) >= strtotime($_POST['date-from']), BrainBenchTestsPlugin::DUE_DATE_BEFORE_START_DATE_ERR_MSG);

            $code = $this->generateRandomString(BrainBenchTestsPlugin::CODE_LENGTH);
            $link = sprintf("http://%s/%s?test=%s", $_SERVER['HTTP_HOST'], BrainBenchTestsPlugin::TEST_PATH, $code);
            echo sprintf("<p>Имаш тест, Цъкни <a href=\"%s\"> тук </a> за да го започнеш.</p>", htmlspecialchars($link));
            echo sprintf("<p>Срок: %s (включително)</p>", htmlspecialchars($_POST['date-to']));
            echo sprintf("<p>%s</p>", htmlspecialchars($link));

            $wpdb->insert(
                $wpdb->prefix . BrainBenchTestsPlugin::TESTS_TABLE_NAME,
                array(
                    'link' => $_POST['link'],
                    'email' => $_POST['email'],
                    'start_date' => $_POST['date-from'],
                    'due_date' => $_POST['date-to'],
                    'status' => BrainBenchTestStatus::NOT_COMPLETED,
                    'code' => $code,
                )
            );
        }

        function send_email ($html, $code) {
            // TODO: Implement, use
        }

        function get_admin_page () {
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
                </form>
            ";

            $this->display_tests();
        }

        function display_tests () { // TODO: make it a table
            global $wpdb;

            $rows = $wpdb->get_results(sprintf("SELECT * FROM %s", $wpdb->prefix . BrainBenchTestsPlugin::TESTS_TABLE_NAME));

            foreach ($rows as $row) {
                echo sprintf("<p>%s - %s - %s - %s - %s - %s - %s</p>", $row->id,  htmlspecialchars($row->link),  $row->email,  $row->start_date,  $row->due_date, $row->code, $row->status);
            }
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
            echo "<input type=\"submit\" target=\"_blank\" value=\"Test Completed\">";
            echo "</form>";
        }

        function load_test_page () {
            try {
                global $wpdb;

                if ($_SERVER['REQUEST_METHOD'] === 'POST') {
                    if (array_key_exists('reset', $_POST)) { // THIS IS JUST FOR TESTING (pun intended)
                        $wpdb->query(sprintf("UPDATE %s SET opt_value = '%s' WHERE opt_name = '%s'", $wpdb->prefix . BrainBenchTestsPlugin::SETTINGS_TABLE_NAME, BrainBenchTestsPlugin::LOCKED_UNTIL_DEF_VALUE, BrainBenchTestsPlugin::LOCKED_UNTIL_OPT_NAME));
                        $wpdb->query($wpdb->prepare(sprintf("UPDATE %s SET status = '%s' WHERE code = '%s'", $wpdb->prefix . BrainBenchTestsPlugin::TESTS_TABLE_NAME, BrainBenchTestStatus::COMPLETED, '%s'), $_POST['code']));
                        echo "<p>Теста е завършен успешно.</p>";
                        return;
                    }

                    $rows = $wpdb->get_results(sprintf("SELECT * FROM %s WHERE status = '%s'", $wpdb->prefix . BrainBenchTestsPlugin::TESTS_TABLE_NAME, BrainBenchTestStatus::STARTED));

                    $this->assert_user(count($rows) === 0, BrainBenchTestsPlugin::SERVICE_BLOCKED_ERR_MSG);

                    $wpdb->query($wpdb->prepare(sprintf("UPDATE %s SET status = '%s' WHERE code = '%s'", $wpdb->prefix . BrainBenchTestsPlugin::TESTS_TABLE_NAME, BrainBenchTestStatus::STARTED, '%s'), $_POST['code']));

                    $wpdb->query(sprintf("UPDATE %s SET opt_value = '%s' WHERE opt_name = '%s'", $wpdb->prefix . BrainBenchTestsPlugin::SETTINGS_TABLE_NAME, strtotime('now +2 hour'), BrainBenchTestsPlugin::LOCKED_UNTIL_OPT_NAME));

                    $wpdb->query($wpdb->prepare(sprintf("UPDATE %s SET opt_value = '%s' WHERE opt_name = '%s'", $wpdb->prefix . BrainBenchTestsPlugin::SETTINGS_TABLE_NAME, '%s', BrainBenchTestsPlugin::CURRENT_TEST_OPT_NAME), $_POST['code']));

                    $this->display_test($_POST['link'], $_POST['code']);
                    return;
                }

                if ($_SERVER['REQUEST_METHOD'] === 'GET') {
                    $rows = $wpdb->get_results(sprintf("SELECT * FROM %s WHERE opt_name = '%s'", $wpdb->prefix . BrainBenchTestsPlugin::SETTINGS_TABLE_NAME, BrainBenchTestsPlugin::CURRENT_TEST_OPT_NAME));

                    $current_test = $rows[0]->opt_value;

                    $rows = $wpdb->get_results(sprintf("SELECT * FROM %s WHERE opt_name = '%s'", $wpdb->prefix . BrainBenchTestsPlugin::SETTINGS_TABLE_NAME, BrainBenchTestsPlugin::LOCKED_UNTIL_OPT_NAME));

                    $locked_until = $rows[0]->opt_value;

                    $this->assert_user(array_key_exists('test', $_GET), BrainBenchTestsPlugin::LINK_NOT_VALID_ERR_MSG);

                    $rows = $wpdb->get_results($wpdb->prepare(sprintf("SELECT * FROM %s WHERE code = %s", $wpdb->prefix . BrainBenchTestsPlugin::TESTS_TABLE_NAME, '%s'), $_GET['test']));

                    $this->assert_user(count($rows) > 0, BrainBenchTestsPlugin::LINK_NOT_VALID_ERR_MSG);

                    $this->assert_user($rows[0]->status !== BrainBenchTestStatus::COMPLETED, BrainBenchTestsPlugin::TEST_ALREADY_COMPLETED_ERR_MSG);

                    $this->assert_user(strtotime($rows[0]->start_date) <= strtotime('today'), sprintf(BrainBenchTestsPlugin::START_DATE_IN_THE_FUTURE_ERR_MSG, $rows[0]->start_date, $rows[0]->due_date));
                    $this->assert_user(strtotime($rows[0]->due_date) >= strtotime('today'), BrainBenchTestsPlugin::DUE_DATE_MET_ERR_MSG);

                    if ($rows[0]->code === $current_test) {
                        $this->display_test($rows[0]->link, $rows[0]->code);
                        return;
                    }

                    $this->assert_user($locked_until < strtotime('today'), BrainBenchTestsPlugin::SERVICE_BLOCKED_ERR_MSG);

                    echo "<form method=\"post\">";
                    echo sprintf("<input type=\"text\" name=\"link\" value=\"%s\" style=\"display: none\">", htmlspecialchars($rows[0]->link));
                    echo sprintf("<input type=\"text\" name=\"code\" value=\"%s\" style=\"display: none\">", htmlspecialchars($rows[0]->code));
                    echo sprintf("<input type=\"text\" name=\"date-to\" value=\"%s\" style=\"display: none\">", htmlspecialchars($rows[0]->due_date));
                    echo sprintf("<input type=\"submit\" onclick='window.open(\"%s\")' value=\"Start Test\">", htmlspecialchars($rows[0]->link));
                    echo "</form>";
                }
            } catch (UserErrorWPTests $e) {
                echo sprintf("<p style=\"color: #FF0000;\">%s</p>", htmlspecialchars($e->getMessage()));
            }
        }

        function isRealDate ($date) {
            if (false === strtotime($date)) {
                return false;
            }

            list($year, $month, $day) = explode('-', $date);
            return checkdate($month, $day, $year);
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
