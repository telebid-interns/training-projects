<?php
    function throw_usr_err ($msg) {
        fwrite(STDOUT, sprintf("Error: %s" . PHP_EOL, $msg));
        exit(1);
    }

    function generateJson ($values) {
        $arr = [
            'version' => '3.0',
            'update_interval' => 60,
            'applications' => [
                'wp-settings-mon' => [
                    'name' => 'WordPress Settings Monitoring',
                    'items' => [
                        'registration_allowed' => [
                            'name' => 'WP Registration',
                            'type' => 'bool',
                            'value' => (int) $values['users_can_register'][0],
                            'timestamp' => $values['users_can_register'][1],
                            'triggers' => [
                                'trig1' => [
                                    'descr' => 'WordPress Registration allowed',
                                    'prior' => 'warn',
                                    'range' => [0, 0],
                                    'resol' => 'Turn off user registration from the  admin panel or change in database table "<wp-prefix>options" set "option_value" to 0 where "option_name" is "users_can_register"'
                                ],
                            ]
                        ],
                        'comments_allowed' => [
                            'name' => 'WP Comments',
                            'type' => 'text',
                            'value' => $values['default_comment_status'][0],
                            'timestamp' => $values['default_comment_status'][1],
                            'triggers' => [
                                'trig1' => [
                                    'descr' => 'WordPress Comments allowed',
                                    'prior' => 'warn',
                                    'match' => '^closed$',
                                    'resol' => 'Turn off comments from the admin panel or change in database table "<wp-prefix>options" set "option_value" to "closed" where "option_name" is "default_comment_status"'
                                ],
                            ]
                        ],
                    ]
                ]
            ]
        ];

        return json_encode($arr);
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

        $options = [ 'users_can_register', 'default_comment_status' ];

        $values = [];

        $has_differences = false;

        foreach ($options as $opt) {
            $result = $conn->query(sprintf("SELECT option_value FROM %soptions WHERE option_name = '%s'", $table_prefix, $opt)) or throw_usr_err(sprintf("Could not find option_name value in table %soptions, please check if %s is your wordpress table prefix", $table_prefix, $table_prefix));

            while ($row = mysqli_fetch_assoc($result)) {
                $values[$opt] = [];
                $values[$opt][0] = $row['option_value'];
                $values[$opt][1] = time();
            }
        }

        fwrite(STDOUT, generateJson($values));
    }
?>

