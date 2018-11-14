<?php
    /*
    * Plugin Name: WP Tests
    * Description: Plugin that enables a form for sending brainbench tests
    * Version: 0.2
    * Author: Rosen
    */

    defined('ABSPATH') or die('ABSPATH not defined');
    // TODO: proper app/user error handling

    if (explode('/', add_query_arg($_GET))[1] == 'brainbench-tests') {
        add_filter('the_content', function () {
            global $wpdb;

            $rows = $wpdb->get_results($wpdb->prepare(sprintf("SELECT link FROM %sbrainbench_tests WHERE code = %s", $wpdb->prefix, '%s'), $_GET['test']));
            echo "<a href=\"" . $rows[0]->link . "\"><button>Start Test</button></a>";
        });
    }

    register_activation_hook ( __FILE__, 'on_activate' );
    register_deactivation_hook ( __FILE__, 'on_deactivate' );

    add_action('admin_menu', 'wp_tests_setup_menu');

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

        $sql = "
            CREATE TABLE IF NOT EXISTS " . $wpdb->prefix . "brainbench_tests (
                id INT AUTO_INCREMENT,
                link TEXT NOT NULL,
                email TEXT NOT NULL,
                start_date DATE NOT NULL,
                due_date DATE NOT NULL,
                code TEXT NOT NULL,
                PRIMARY KEY (id)
            );
        ";

        require_once( ABSPATH . 'wp-admin/includes/upgrade.php' );
        dbDelta( $sql );
    }

    function on_deactivate () {
        $title = 'Brainbench Tests';
        if (get_page_by_title( $title ) != null) {
            wp_delete_post(get_page_by_title( $title )->ID);
        }
    }


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
        if ($_SERVER['REQUEST_METHOD'] === 'GET') {
            wp_enqueue_script( 'set-default-dates', plugin_dir_url( __FILE__ ) . 'js/set-defaults.js' );
        }
        // TODO: date-to before today check, large date interval check

        $html = "<form method=\"post\">";

        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            global $wpdb;

            $html .= "<label for=\"link\">link URL:</label>\n";
            $html .= ($_POST['link'] ? sprintf("<input type=\"text\" name=\"link\" value=\"%s\">", htmlspecialchars($_POST['link'])) : "<input type=\"text\" name=\"link\" class=\"invalid-input\">");
            $html .= "<label for=\"email\">E-mail:</label>\n";
            $html .= ($_POST['email'] ? sprintf("<input type=\"email\" name=\"email\" value=\"%s\">", htmlspecialchars($_POST['email'])) : "<input type=\"email\" name=\"email\" class=\"invalid-input\">");
            $html .= "<label for=\"date-from\">От:</label>\n";
            $html .= ($_POST['date-from'] ? sprintf("<input id=\"date-from\" type=\"date\" name=\"date-from\" value=\"%s\">", htmlspecialchars($_POST['date-from'])) : "<input id=\"date-from\" type=\"date\" name=\"date-from\" class=\"invalid-input\">");
            $html .= "<label for=\"date-to\">До:</label>\n";
            $html .= ($_POST['date-to'] ? sprintf("<input id=\"date-to\" type=\"date\" name=\"date-to\" value=\"%s\">", htmlspecialchars($_POST['date-to'])) : "<input id=\"date-to\" type=\"date\" name=\"date-to\" class=\"invalid-input\">");

            // TODO: test send email
            // TODO: test path should not be hard codded ? or const
            // TODO: domain name should not be hard coded
            // TODO: table name also shouldnt be hard coded
            // TODO: link should always redirect

            if ($_POST['link'] && $_POST['email'] && $_POST['date-from'] && $_POST['date-to']) {
                $code = generateRandomString(30);

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

                $html .= "<p>Имаш тест, Цъкни <a href=\"http://" . $_SERVER['HTTP_HOST'] . "/brainbench-tests?test=" . $code . "\"> тук </a> за да го започнеш.</p><p>Срок: " . $_POST['date-to'] . " (включително)</p>";
            } else {
                $html .= "<p id=\"err-msg\">Моля попълнете всички полета</p>";
            }
        } else {
            $html .= "
                <label for=\"link\">link URL:</label>
                <input type=\"text\" name=\"link\">
                <label for=\"email\">E-mail:</label>
                <input type=\"email\" name=\"email\">
                <label for=\"date-from\">От:</label>
                <input id=\"date-from\" type=\"date\" name=\"date-from\">
                <label for=\"date-to\">До:</label>
                <input id=\"date-to\" type=\"date\" name=\"date-to\">
            ";
        }

        $html .= "
                <label for=\"submit\"></label>
                <input type=\"submit\" value=\"Generate Email\">
                </form>
        ";

        echo $html;
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
