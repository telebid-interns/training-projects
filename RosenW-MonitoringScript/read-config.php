<?php
    @include "./utils.php";

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

    function generate_json ($domain, $items, $config) {
        return json_encode([
            "name" => sprintf("WP settings checklist for domain %s", $domain),
            "items" => [
                "registration_disabled" => [
                    "name" => "WP Checklist: Registration disabled",
                    "type" => "bool",
                    "value" => $items["registration_disabled"]["value"],
                    "timestamp" => $items["registration_disabled"]["ts"],
                    "triggers" => $config["triggers"]["registration_disabled"]
                ],
                "comments_disabled" => [
                    "name" => "WP Checklist: Comments disabled",
                    "type" => "bool",
                    "value" => $items["comments_disabled"]["value"],
                    "timestamp" => $items["comments_disabled"]["ts"],
                    "triggers" => $config["triggers"]["comments_disabled"]
                ],
                "acao_header_not_asterisk" => [
                    "name" => "WP Checklist: xmlrpc response header Access-Control-Allow-Origin not *",
                    "type" => "bool",
                    "value" => $items["acao_header_not_asterisk"]["value"],
                    "timestamp" => $items["acao_header_not_asterisk"]["ts"],
                    "triggers" => $config["triggers"]["acao_header_not_asterisk"]
                ],
                "content_directory_permissions" => [
                    "name" => sprintf("WP Checklist: Directory permissions in %s set (files: %s, dirs: %s)", $items["content_dir_permissions"]["path"], $items["content_dir_permissions"]["fperm"], $items["content_dir_permissions"]["dperm"]),
                    "type" => "bool",
                    "value" => $items["content_dir_permissions"]["value"],
                    "timestamp" => $items["content_dir_permissions"]["ts"],
                    "triggers" => $config["triggers"]["content_directory_permissions"]
                ],
                "login_basic_auth" => [
                    "name" => "WP Checklist: Additional basic auth enabled on /wp-login.php",
                    "type" => "bool",
                    "value" => $items["login_basic_auth_enabled"]["value"],
                    "timestamp" => $items["login_basic_auth_enabled"]["ts"],
                    "triggers" => $config["triggers"]["login_basic_auth"]
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

    function generate_user_error_json ($domain = "", $code, $msg) {
        $resol = "No resol specified";

        if ($code === 5001) {
            $resol = "Check in /etc/wordpress if config files are named properly";
        }

        if ($code === 5002) {
            $resol = sprintf("Create config file /etc/wordpress/config-%s.php", $domain);
        }

        if ($code === 5003) {
            $resol = sprintf("Define DB_HOST, DB_NAME, DB_PASSWORD and DB_USER in /etc/wordpress/config-%s.php", $domain);
        }

        if ($code === 5004) {
            $resol = sprintf("Check if defined database credentials are correct in /etc/wordpress/config-%s.php", $domain);
        }

        if ($code === 5005) {
            $resol = "Check if the table prefix is correct";
        }

        if ($code === 5007) {
            $resol = sprintf("Define WP_CONTENT_DIR in /etc/wordpress/config-%s.php", $domain);
        }

        return json_encode([
            "name" => sprintf("WP settings checklist for domain %s", $domain),
            "items" => [
                "error" => [
                    "name" => "User Error",
                    "type" => "bool",
                    "value" => 0,
                    "timestamp" => time(),
                    "triggers" => [
                        "trig1" => [
                            "descr" => $msg,
                            "prior" => "warn",
                            "range" => [0, 0],
                            "resol" => $resol
                        ]
                    ]
                ]
            ]
        ]);
    }

    // Script Starts here
    if ($argv && $argv[0] && realpath($argv[0]) === __FILE__) {
        $domain = "";

        for ($i=0; $i < count($argv); $i++) {
            if ($argv[$i] === "--domain") {
                $domain = $argv[$i+1];
            }
        }

        try {
            assert_user($domain, "Domain not provided", 5001);

            $config_file = sprintf("/etc/wordpress/config-%s.php", $domain);
            assert_user(@include $config_file, sprintf("Could not find %s", $config_file), 5002);

            assert_user(
                defined("DB_HOST") || 
                defined("DB_NAME") ||
                defined("DB_PASSWORD") ||
                defined("DB_USER"), 
                "Database credentials not defined", 
                5003
            );

            isset($table_prefix) or $table_prefix = "wp_";

            $placeholder_values = [
                'prefix' => $table_prefix,
                'wp-content-path' => WP_CONTENT_DIR
            ];

            $config = json_decode(replace_placeholders(file_get_contents("./wp-mon-scr-config.json"), $placeholder_values), true);
            $fperm = $config['permissions']['file_perm'];
            $dperm = $config['permissions']['dir_perm'];

            $conn = @new mysqli(DB_HOST, DB_USER, DB_PASSWORD, DB_NAME);
            assert_user(is_null($conn->connect_error), "Could not connect to Database", 5004);

            $expected = [ 
                "users_can_register" => [
                    "value" => "0",
                    "item_name" => "registration_disabled"
                ], 
                "default_comment_status" => [
                    "value" => "closed",
                    "item_name" => "comments_disabled" 
                ] 
            ];

            $items = [];

            foreach ($expected as $opt_name => $val_item_pair) {
                $result = $conn->query(sprintf("SELECT option_value FROM %soptions WHERE option_name = '%s'", $table_prefix, $opt_name));

                assert_user($result, sprintf("Could not find option_name value in table %soptions", $table_prefix), 5005);
                
                $row = mysqli_fetch_assoc($result);

                $items[$val_item_pair["item_name"]] = [];
                $items[$val_item_pair["item_name"]]["value"] = (int) ($row["option_value"] === $val_item_pair["value"]);
                $items[$val_item_pair["item_name"]]["ts"] = time();
            }

            $user_count_rows = $conn->query(sprintf("SELECT COUNT(*) AS count FROM %susers", $table_prefix));
            $items["users"]["value"] = mysqli_fetch_assoc($user_count_rows)["count"];
            $items["users"]["ts"] = time();

            $items["acao_header_not_asterisk"]["value"] = 1;
            $items["acao_header_not_asterisk"]["ts"] = time();

            $options = array(
                'http' => array(
                    'header'  => 
                        "Content-type: application/x-www-form-urlencoded\r\n" . 
                        "Origin: http://www.fake-domain.org\r\n",
                    'method'  => 'POST',
                    'content' => '<methodCall><methodName>pingback.ping</methodName><params><param><value><string>http://ros.bg</string></value></param></params></methodCall>'
                )
            );
            $context  = stream_context_create($options);

            $stream = fopen(sprintf("http://%s/xmlrpc.php", $domain), 'r', false, $context);
            $headers = stream_get_meta_data($stream)['wrapper_data'];
            foreach ($headers as $header) {
                if ($header === "Access-Control-Allow-Origin: *") {
                    $items["acao_header_not_asterisk"]["value"] = 0;
                }
            }

            $http_response = explode(" ", get_headers(sprintf("http://%s/wp-login.php", $domain))[0])[1];

            $items["login_basic_auth_enabled"]["value"] = (int) ($http_response === "401");
            $items["login_basic_auth_enabled"]["ts"] = time();

            assert_user(defined("WP_CONTENT_DIR"), "WP_CONTENT_DIR not defined", 5007);
            assert_user(is_dir(WP_CONTENT_DIR), sprintf("%s not found", WP_CONTENT_DIR), 5008);
            $items["content_dir_permissions"]["value"] = (int) check_permissions(WP_CONTENT_DIR, $dperm, $fperm);
            $items["content_dir_permissions"]["ts"] = time();
            $items["content_dir_permissions"]["dperm"] = $dperm;
            $items["content_dir_permissions"]["fperm"] = $fperm;
            $items["content_dir_permissions"]["path"] = WP_CONTENT_DIR;

            fwrite(STDOUT, generate_json($domain, $items, $config));
        } catch (UserError $err) {
            if (!$domain) {
                $domain = "no-domain-provided";
            }

            fwrite(STDOUT, generate_user_error_json($domain, $err->getCode(), $err->getMessage()));
        }
    }
?>
