<?php
    const DEFAULT_DIR_PERMISSIONS = '755';
    const DEFAULT_FILE_PERMISSIONS = '644';

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
                            "range" => [0, 0],
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
                            "range" => [0, 0],
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
                            "descr" => "WordPress admin page accessible",
                            "prior" => "warn",
                            "range" => [0, 0],
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
                            "descr" => sprintf("WordPress Permissions %s for dirs %s for files", $items['permissions']['dperm'], $items['permissions']['fperm']),
                            "prior" => "warn",
                            "range" => [0, 0],
                            "resol" => sprintf("Fix files/dirs permissions in /usr/share/wordpress should be %s for dirs, %s for files", $items['permissions']['dperm'], $items['permissions']['fperm'])
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

    function check_permissions ($path, $dperm, $fperm) {
        $files = scandir($path);

        foreach ($files as $file) {
            if ($file === '.' || $file === '..') {
                continue;
            }

            $new_path = $path . DIRECTORY_SEPARATOR . $file;
            if (is_dir($new_path)) {
                if (decoct(fileperms($new_path) & 0777) !== $dperm || !check_permissions($new_path, $dperm, $fperm)) {
                    return false;
                }
            } elseif (is_file($new_path)) {
                if (decoct(fileperms($new_path) & 0777) !== $fperm) {
                    return false;
                }
            }
        }

        return true;
    }

    // Script Starts here
    if ($argv && $argv[0] && realpath($argv[0]) === __FILE__) {
        $fperm = DEFAULT_FILE_PERMISSIONS;
        $dperm = DEFAULT_DIR_PERMISSIONS;
        $domain = "";

        for ($i=0; $i < count($argv); $i++) {
            if ($argv[$i] === "--fileperm") {
                $fperm = $argv[$i+1];
            }

            if ($argv[$i] === "--dirperm") {
                $dperm = $argv[$i+1];
            }

            if ($argv[$i] === "--domain") {
                $domain = $argv[$i+1];
            }
        }

        try {
            assert_user($domain, "Domain not provided", 5001);

            $config_file = sprintf('/etc/wordpress/config-%s.php', $domain);
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
                $items[$opt_name]['value'] = (int) ($row['option_value'] === $opt_value);
                $items[$opt_name]['ts'] = time();
            }

            $user_count_rows = $conn->query(sprintf("SELECT COUNT(*) AS count FROM %susers", $table_prefix));
            $items['users']['value'] = mysqli_fetch_assoc($user_count_rows)['count'];
            $items['users']['ts'] = time();

            $http_response = explode(" ", get_headers(sprintf("http://%s/wp-admin/", $domain))[0])[1];

            $items['wp_admin_accessible']['value'] = (int) ($http_response !== '200');
            $items['wp_admin_accessible']['ts'] = time();

            assert_user(is_dir('/usr/share/wordpress'), 'Path to WordPress "/usr/share/wordpress" not found', 5006);
            $items['permissions']['value'] = (int) check_permissions('/usr/share/wordpress', $dperm, $fperm);
            $items['permissions']['ts'] = time();
            $items['permissions']['dperm'] = $dperm;
            $items['permissions']['fperm'] = $fperm;

            fwrite(STDOUT, generate_json($domain, $items));
        } catch (UserError $err) {
            if (!$domain) {
                $domain = 'no-domain-provided';
            }

            fwrite(STDOUT, generate_error_json($domain, $err->getCode(), $err->getMessage()));
        }
    }
?>

