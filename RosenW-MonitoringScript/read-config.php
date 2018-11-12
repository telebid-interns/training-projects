<?php
    function throw_usr_err ($msg) {
        fwrite(STDOUT, sprintf("Error: %s" . PHP_EOL, $msg));
        exit(1);
    }

    // Script Starts here
    if ($argv && $argv[0] && realpath($argv[0]) === __FILE__) {
        count($argv) > 1 or throw_usr_err("\n\tPlease provide domain name as first argument\n\n\tTry 'php <script> <domain>'\n");

        $config_file = sprintf('/etc/wordpress/config-%s.php', $argv[1]);
        (@include $config_file) or throw_usr_err (sprintf("Could not find %s", $config_file));

        defined('DB_HOST') or throw_usr_err(sprintf("DB_HOST not defined in %s", $config_file));
        defined('DB_NAME') or throw_usr_err(sprintf("DB_NAME not defined in %s", $config_file));
        defined('DB_PASSWORD') or throw_usr_err(sprintf("DB_PASSWORD not defined in %s", $config_file));
        defined('DB_USER') or throw_usr_err(sprintf("DB_USER not defined in %s", $config_file));

        isset($table_prefix) or $table_prefix = 'wp_';

        $conn = @new mysqli(DB_HOST, DB_USER, DB_PASSWORD, DB_NAME);
        is_null($conn->connect_error) or throw_usr_err(sprintf("Could not connect to Database", $config_file));

        $option_expected_dict = [
            'users_can_register' => '0',
            'default_comment_status' => 'closed'
        ];

        $option_actual_dict = [];

        $has_differences = false;

        foreach ($option_expected_dict as $option => $value) {
            $result = $conn->query(sprintf("SELECT option_value FROM %soptions WHERE option_name = '%s'", $table_prefix, $option)) or throw_usr_err(sprintf("Could not find option_name value in table %soptions, please check if %s is your wordpress table prefix", $table_prefix, $table_prefix));

            while ($row = mysqli_fetch_assoc($result)) {
                fwrite(STDERR, sprintf("%s: %s" . PHP_EOL, $option, $row['option_value']));
                if ($value !== $row['option_value']) $has_differences = true;
            }
        }

        if ($has_differences) {
            fwrite(STDOUT, "0");
            exit(0);
        }

        fwrite(STDOUT, "1");
    }
?>