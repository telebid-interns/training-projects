<?php
    /*
    * Plugin Name: BrainBenchTests
    * Description: Plugin that enables a form for sending brainbench tests
    * Version: 0.4
    * Author: Rosen
    */

    defined('ABSPATH') or die('ABSPATH not defined');
    // TODO: proper app/user error handling
    // TODO: test send email
    // TODO: test path should not be hard codded ? or const
    // TODO: domain name should not be hard coded
    // TODO: table name also shouldnt be hard coded
    // TODO: link should always redirect
    // TODO: linkut ne e validen suobshtenie se povtarq

    class BrainBenchTestsPlugin {
        function __construct () {
            if (explode('/', add_query_arg($_GET))[1] == 'brainbench-tests') {
                add_filter('the_content', array($this, 'load_test_page'));
            }

            register_activation_hook ( __FILE__, array($this, 'on_activate'));
            register_deactivation_hook ( __FILE__, array($this, 'on_deactivate'));

            add_action('admin_menu', array($this, 'brainbench_tests_setup_menu'));
        }

        function on_activate () {
            global $wpdb;

            $title = 'Brainbench Tests';
            if (get_page_by_title( $title ) == null || get_page_by_title( $title )->post_status !== 'publish') {
                // Create the page
                wp_insert_post(array(
                  'post_title'    => $title,
                  'post_content'  => '',
                  'post_status'   => 'publish',
                  'post_author'   => 1,
                  'post_type'     => 'page',
                ));
            }

            require_once( ABSPATH . 'wp-admin/includes/upgrade.php' );
            dbDelta(sprintf("
                    CREATE TABLE IF NOT EXISTS %sbrainbench_tests (
                        id INT AUTO_INCREMENT,
                        link TEXT NOT NULL,
                        email TEXT NOT NULL,
                        start_date DATE NOT NULL,
                        due_date DATE NOT NULL,
                        code TEXT NOT NULL,
                        PRIMARY KEY (id)
                    );
                ", $wpdb->prefix
            ));

            dbDelta(sprintf("
                    CREATE TABLE IF NOT EXISTS %sbrainbench_settings (
                        id INT AUTO_INCREMENT,
                        opt_name TEXT NOT NULL,
                        opt_value TEXT NOT NULL,
                        PRIMARY KEY (id)
                    );
                ", $wpdb->prefix
            ));
            // TODO datafication
            $lock_opt_name = 'locked_until';
            $current_test_opt_name = 'current_test';
            $rows = $wpdb->get_results(sprintf("SELECT * FROM %sbrainbench_settings WHERE opt_name = '%s'", $wpdb->prefix, $lock_opt_name));
            if (count($rows) === 0) {
                $wpdb->insert(
                    $wpdb->prefix . 'brainbench_settings',
                    array(
                        'opt_name' => $lock_opt_name,
                        'opt_value' => strtotime('yesterday')
                    )
                );
            }
            $rows = $wpdb->get_results(sprintf("SELECT * FROM %sbrainbench_settings WHERE opt_name = '%s'", $wpdb->prefix, $current_test_opt_name));
            if (count($rows) === 0) {
                $wpdb->insert(
                    $wpdb->prefix . 'brainbench_settings',
                    array(
                        'opt_name' => $current_test_opt_name,
                        'opt_value' => ''
                    )
                );
            }
        }

        function on_deactivate () {
            $title = 'Brainbench Tests';
            if (get_page_by_title( $title ) != null) {
                wp_delete_post(get_page_by_title( $title )->ID);
            }
        }

        function brainbench_tests_setup_menu () {
            if (current_user_can('administrator')) {
                $test_menu = add_menu_page( 'Send Test', 'Send Test', 'manage_options', 'wp_tests', array($this, 'init_page'));

                add_action("admin_enqueue_scripts", function ($hook) use ($test_menu) {
                    if ($hook !== $test_menu) {
                        return;
                    }
                    
                    wp_enqueue_style( 'form-css', plugin_dir_url( __FILE__ ) . 'css/form.css' );
                });
            }
        }

        function init_page () {
            if ($_SERVER['REQUEST_METHOD'] === 'GET') {
                $this->get_admin_page();
                wp_enqueue_script( 'set-default-dates', plugin_dir_url( __FILE__ ) . 'js/set-defaults.js' );
                return;
            }

            if ($_SERVER['REQUEST_METHOD'] === 'POST') {
                try {
                    $this->post_admin_page();
                } catch (UserErrorWPTests $err) {
                    echo sprintf("<p id=\"err-msg\">%s</p>", $err->getMessage());
                } finally {
                    echo "
                            <label for=\"submit\"></label>
                            <input type=\"submit\" value=\"Generate Email\">
                            </form>
                    ";
                }
            }
        }

        function post_admin_page () {
            global $wpdb;

            // adding invalid class on invalid data
            echo "<form method=\"post\">";
            echo "<label for=\"link\">link URL:</label>\n";
            echo ($_POST['link'] ? sprintf("<input type=\"text\" name=\"link\" value=\"%s\">", htmlspecialchars($_POST['link'])) : "<input type=\"text\" name=\"link\" class=\"invalid-input\">");
            echo "<label for=\"email\">E-mail:</label>\n";
            echo ($_POST['email'] && filter_var($_POST['email'], FILTER_VALIDATE_EMAIL) ? sprintf("<input type=\"email\" name=\"email\" value=\"%s\">", htmlspecialchars($_POST['email'])) : sprintf("<input type=\"email\" name=\"email\" value=\"%s\" class=\"invalid-input\">", htmlspecialchars($_POST['email'])));
            echo "<label for=\"date-from\">От:</label>\n";
            echo ($_POST['date-from'] && $this->isRealDate($_POST['date-from']) && strtotime($_POST['date-from']) >= strtotime('today') ? sprintf("<input id=\"date-from\" type=\"date\" name=\"date-from\" value=\"%s\">", htmlspecialchars($_POST['date-from'])) : sprintf("<input id=\"date-from\" type=\"date\" name=\"date-from\" value=\"%s\" class=\"invalid-input\">", htmlspecialchars($_POST['date-from'])));
            echo "<label for=\"date-to\">До:</label>\n";
            echo ($_POST['date-to'] && $this->isRealDate($_POST['date-to']) && strtotime($_POST['date-to']) >= strtotime($_POST['date-from']) ? sprintf("<input id=\"date-to\" type=\"date\" name=\"date-to\" value=\"%s\">", htmlspecialchars($_POST['date-to'])) : sprintf("<input id=\"date-to\" type=\"date\" name=\"date-to\" value=\"%s\" class=\"invalid-input\">", htmlspecialchars($_POST['date-to'])));

            $this->assert_user($_POST['link'] && $_POST['email'] && $_POST['date-from'] && $_POST['date-to'], "Моля попълнете всички полета");
            
            $this->assert_user(filter_var($_POST['email'], FILTER_VALIDATE_EMAIL), "Въведеният имейл е невалиден.");

            $this->assert_user($this->isRealDate($_POST['date-from']), "Невалидна дата на задаване.");
            $this->assert_user($this->isRealDate($_POST['date-to']), "Невалидна дата на срок.");

            // $this->assert_user(strtotime($_POST['date-from']) >= strtotime('today'), "Датата на задаване не може да бъде в миналото.");
            // $this->assert_user(strtotime($_POST['date-to']) >= strtotime($_POST['date-from']), "Датата на срока трябва да бъде след датата на започване.");

            $code = $this->generateRandomString(30);
            $link = sprintf("http://%s/brainbench-tests?test=%s", $_SERVER['HTTP_HOST'], $code);
            echo sprintf("<p>Имаш тест, Цъкни <a href=\"%s\"> тук </a> за да го започнеш.</p>", $link);
            echo sprintf("<p>Срок: %s (включително)</p>", $_POST['date-to']);
            echo sprintf("<p>%s</p>", $link);

            $wpdb->insert(
                $wpdb->prefix . 'brainbench_tests',
                array(
                    'link' => $_POST['link'],
                    'email' => $_POST['email'],
                    'start_date' => $_POST['date-from'],
                    'due_date' => $_POST['date-to'],
                    'code' => $code,
                )
            );
        }

        function send_email_with_test ($html, $code) {
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

        function load_test_page () {
            try {
                global $wpdb;
                if ($_SERVER['REQUEST_METHOD'] === 'POST') {

                    if (array_key_exists('reset', $_POST)) {
                        $wpdb->query(sprintf("UPDATE %sbrainbench_settings SET opt_value = '1' WHERE opt_name = '%s'", $wpdb->prefix, 'locked_until'));
                        return;
                    }

                    echo sprintf("<a href=\"%s\">Link</a>", $_POST['link']);
                    $wpdb->query(sprintf("UPDATE %sbrainbench_settings SET opt_value = '%s' WHERE opt_name = '%s'", $wpdb->prefix, strtotime($_POST['date-to']), 'locked_until'));

                    echo "<form method=\"post\">";
                    echo "<input type=\"text\" name=\"reset\" value=\"1\" style=\"display: none\">";
                    echo "<input type=\"submit\" value=\"Test Completed\">";
                    echo "</form>";
                    return;
                }

                $rows = $wpdb->get_results(sprintf("SELECT * FROM %sbrainbench_settings WHERE opt_name = '%s'", $wpdb->prefix, 'locked_until')); // TODO: lock name should be constant
                
                $this->assert_user($rows[0]->opt_value < strtotime('today'), "Вече има пуснат тест, опитайте по-късно");

                $this->assert_user(array_key_exists('test', $_GET), "Линкът не е валиден");

                $rows = $wpdb->get_results($wpdb->prepare(sprintf("SELECT * FROM %sbrainbench_tests WHERE code = %s", $wpdb->prefix, '%s'), $_GET['test']));

                $this->assert_user(count($rows) > 0, "Линкът не е валиден");

                $this->assert_user(strtotime($rows[0]->start_date) <= strtotime('today'), sprintf("Теста ще бъде активен от %s до %s вкл.", $rows[0]->start_date, $rows[0]->due_date));
                $this->assert_user(strtotime($rows[0]->due_date) >= strtotime('today'), "Срока е изтекъл");

                echo "<form method=\"post\">";
                echo sprintf("<input type=\"text\" name=\"link\" value=\"%s\" style=\"display: none\">", $rows[0]->link);
                echo sprintf("<input type=\"text\" name=\"date-to\" value=\"%s\" style=\"display: none\">", $rows[0]->due_date);
                echo "<input type=\"submit\" value=\"Start Test\">";
                echo "</form>";
            } catch (UserErrorWPTests $e) {
                echo sprintf("<p style=\"color: #FF0000;\">%s</p>", $e->getMessage());
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

    new BrainBenchTestsPlugin();
?>
