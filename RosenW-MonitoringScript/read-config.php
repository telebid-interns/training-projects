<?php
    class UserError extends Exception {
        public function __construct ($message, $code = 0, Exception $previous = null) {
            parent::__construct($message, $code, $previous);
        }
    }

    function assert_user ($condition, $msg, $code) {
        if (!$condition) {
            throw new UserError($msg, $code);
        }
    }

    function generate_json ($domain, $items) {
        return json_encode([
            "items" => [
                "registration_allowed" => [
                    "name" => "WP Checklist: Registration",
                    "type" => "bool",
                    "value" => $items["users_can_register"]["value"],
                    "timestamp" => $items["users_can_register"]["ts"],
                    "triggers" => [
                        "trig1" => [
                            "descr" => "WordPress Registration allowed",
                            "prior" => "warn",
                            "range" => [1, 1],
                            "resol" => "Turn off user registration from the WP admin panel or change in database table '<wp-prefix>options' set 'option_value' to 0 where 'option_name' is 'users_can_register'"
                        ],
                    ]
                ],
                "comments_allowed" => [
                    "name" => "WP Checklist: Comments",
                    "type" => "bool",
                    "value" => $items["default_comment_status"]["value"],
                    "timestamp" => $items["default_comment_status"]["ts"],
                    "triggers" => [
                        "trig1" => [
                            "descr" => "WordPress Comments allowed",
                            "prior" => "warn",
                            "range" => [1, 1],
                            "resol" => "Turn off comments from the WP admin panel or change in database table '<wp-prefix>options' set 'option_value' to 'closed' where 'option_name' is 'default_comment_status'"
                        ],
                    ]
                ],
                "wp_admin_accessible" => [
                    "name" => "WP Checklist: admin page accessible",
                    "type" => "bool",
                    "value" => $items['wp_admin_accessible']['value'],
                    "timestamp" => $items["wp_admin_accessible"]["ts"],
                    "triggers" => [
                        "trig1" => [
                            "descr" => "WordPress Comments allowed",
                            "prior" => "warn",
                            "range" => [1, 1],
                            "resol" => "Forbid access to the admin panel"
                        ],
                    ]
                ],
                "wp_directory_permissions" => [
                    "name" => "WP Checklist: Directory permissions",
                    "type" => "bool",
                    "value" => $items['permissions']['value'],
                    "timestamp" => $items["permissions"]["ts"],
                    "triggers" => [
                        "trig1" => [
                            "descr" => "WordPress Permissions 755 for dirs 644 for files",
                            "prior" => "warn",
                            "range" => [0, 0],
                            "resol" => "Fix files/dirs permissions in /usr/share/wordpress should be 755 for dirs, 644 for files"
                        ],
                    ]
                ],
                "users" => [
                    "name" => "User Count",
                    "type" => "int",
                    "value" => $items["users"]["value"],
                    "timestamp" => $items["users"]["ts"]
                ]
            ]
        ]);
    }

    function generate_error_json ($domain, $code, $msg) {
        $resol = "No resol specified";

        if ($code === 5001) {
            $resol = "Check in /etc/wordpress if config files are named properly";
        }

        if ($code === 5002) {
            $resol = sprintf("Create config file %s", sprintf("/etc/wordpress/config-%s.php", $domain));
        }

        if ($code === 5003) {
            $resol = sprintf("Define DB_HOST, DB_NAME, DB_PASSWORD and DB_USER in %s", sprintf("/etc/wordpress/config-%s.php", $domain));
        }

        if ($code === 5004) {
            $resol = sprintf("Check if defined database credentials are correct in %s", sprintf("/etc/wordpress/config-%s.php", $domain));
        }

        if ($code === 5005) {
            $resol = "Check if the table prefix is correct";
        }

        return json_encode([
            "items" => [
                "error" => [
                    "name" => "User Error",
                    "type" => "bool",
                    "value" => 1,
                    "timestamp" => time(),
                    "triggers" => [
                        "trig1" => [
                            "descr" => $msg,
                            "prior" => "warn",
                            "range" => [1, 1],
                            "resol" => $resol
                        ]
                    ]
                ]
            ]
        ]);
    }

    function check_permissions ($path) {
        $files = scandir($path);

        foreach ($files as $file) {
            if ($file === '.' || $file === '..') {
                continue;
            }

            $new_path = $path . DIRECTORY_SEPARATOR . $file;
            if (is_dir($new_path)) {
                if (decoct(fileperms($new_path) & 0777) !== '755' || !check_permissions($new_path)) {
                    return false;
                }
            } elseif (is_file($new_path)) {
                if (decoct(fileperms($new_path) & 0777) !== '644') {
                    return false;
                }
            }
        }

        return true;
    }

    // Script Starts here
    if ($argv && $argv[0] && realpath($argv[0]) === __FILE__) {
        try {
            assert_user(count($argv) > 1, "Domain not provided", 5001);
            $config_file = sprintf('/etc/wordpress/config-%s.php', $argv[1]);
            assert_user(@include $config_file, sprintf("Could not find %s", $config_file), 5002);

            assert_user(
                defined('DB_HOST') || 
                defined('DB_NAME') ||
                defined('DB_PASSWORD') ||
                defined('DB_USER'), 
                "Database credentials not defined", 
                5003
            );

            isset($table_prefix) or $table_prefix = 'wp_';

            $conn = @new mysqli(DB_HOST, DB_USER, DB_PASSWORD, DB_NAME);
            assert_user(is_null($conn->connect_error), "Could not connect to Database", 5004);

            $expected = [ 'users_can_register' => '0', 'default_comment_status' => 'closed' ];

            $items = [];

            foreach ($expected as $opt_name => $opt_value) {
                $result = $conn->query(sprintf("SELECT option_value FROM %soptions WHERE option_name = '%s'", $table_prefix, $opt_name));

                assert_user($result, sprintf("Could not find option_name value in table %soptions", $table_prefix), 5005);
                
                $row = mysqli_fetch_assoc($result);

                $items[$opt_name] = [];
                $items[$opt_name]['value'] = (int) !($row['option_value'] === $opt_value);
                $items[$opt_name]['ts'] = time();
            }

            $user_count_rows = $conn->query(sprintf("SELECT COUNT(*) AS count FROM %susers", $table_prefix));
            $items['users']['value'] = mysqli_fetch_assoc($user_count_rows)['count'];
            $items['users']['ts'] = time();

            $http_response = explode(" ", get_headers(sprintf("http://%s/wp-admin/", $argv[1]))[0])[1];

            $items['wp_admin_accessible']['value'] = (int) ($http_response === '200');
            $items['wp_admin_accessible']['ts'] = time();

            assert_user(is_dir('/usr/share/wordpress'), 'Path to WordPress "/usr/share/wordpress" not found', 5006);
            $items['permissions']['value'] = (int) check_permissions('/usr/share/wordpress');
            $items['permissions']['ts'] = time();

            fwrite(STDOUT, generate_json($argv[1], $items));
        } catch (UserError $err) {
            $domain = 'no-domain-provided';
            if (count($argv) > 1) {
                $domain = $argv[1];
            }

            fwrite(STDOUT, generate_error_json($domain, $err->getCode(), $err->getMessage()));
        }
    }
?>

