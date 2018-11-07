<?php
    class WordPressMonitor {
        const CONFIG_PATH = '/etc/wordpress/';

        function __construct($wp_path, $domain) {
            $this->$wp_path = $wp_path;
            $this->$domain = $domain;

            $this->config_file = sprintf('%sconfig-%s.php', self::CONFIG_PATH, $domain);
            assert_user(include $this->config_file, sprintf('Could not find %s', $this->config_file));

            assert_user(defined('DB_HOST'), sprintf('DB_HOST not defined in %s', $this->config_file));
            assert_user(defined('DB_NAME'), sprintf('DB_NAME not defined in %s', $this->config_file));
            assert_user(defined('DB_PASSWORD'), sprintf('DB_PASSWORD not defined in %s', $this->config_file));
            assert_user(defined('DB_USER'), sprintf('DB_USER not defined in %s', $this->config_file));

            assert_user(isset($table_prefix), 'WordPress table_prefix not defined');

            $this->table_prefix = $table_prefix;

            $this->conn = new mysqli(DB_HOST, DB_USER, DB_PASSWORD, DB_NAME);
            assert_user(is_null($this->conn->connect_error), 'Connection to WP db failed: ' . $this->conn->connect_error);

            $this->option_expected_dict = [
                'users_can_register' => '0',
                'default_comment_status' => 'closed'
            ];

            $this->option_actual_dict = [];
        }

        function start_test () {
            $has_differences = false;

            foreach ($this->option_expected_dict as $option) {
                $stmt = $this->conn->prepare("SELECT option_value FROM wp_options WHERE option_name = ?");

                if (!$stmt) {
                    echo "Execute failed: (" . $this->conn->errno . ") " . $this->conn->error;
                }

                if ($stmt->execute(array($option))) {
                    while ($row = $stmt->fetch()) {
                        print_r($row);
                    }
                }

                $stmt->close();

                // assert_user(, 'WP version not supported by script');

                // if (!$stmt->bind_param("s", $option)) {
                //     echo "Binding parameters failed: (" . $stmt->errno . ") " . $stmt->error;
                // }

                // if (!$stmt->execute()) {
                //     echo "Execute failed: (" . $stmt->errno . ") " . $stmt->error;
                // }

                // if (!($rows = $stmt->get_result())) {
                //     echo "Getting result set failed: (" . $stmt->errno . ") " . $stmt->error;
                // }
            }
        }
    }

    function assert_user ($condition, $msg) {
        if (!$condition) {
            throw new UserError($msg);
        }
    }

    class UserError extends Exception {
        public function __construct($message, $code = 0, Exception $previous = null) {
            parent::__construct($message, $code, $previous);
        }
    }

    // Script Starts here
    if ($argv && $argv[0] && realpath($argv[0]) === __FILE__) {
        // set_error_handler(function () { /* ignore notices/warnings */ });
        try {
            assert_user(count($argv) > 2, 
                "
                Please provide both wordpress installation path and domain name

                Try 'php <script> <wp_installation_path> <domain>'
                "
            );
            $monitor = new WordPressMonitor($argv[1], $argv[2]);
            $monitor->start_test();
        } catch (UserError $e) {
            // TODO stderr
            echo $e->getMessage(), "\n";
            exit;
        }
    }
?>
