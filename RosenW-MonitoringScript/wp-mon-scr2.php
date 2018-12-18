<?php
    const CONFIG_PATH = "/etc/wordpress/";
    const WORDPRESS_PATH = "/usr/share/wordpress";
    include "./utils.php";

    // Script Starts here
    if ($argv && $argv[0] && realpath($argv[0]) === __FILE__) {
        ini_set('default_socket_timeout', 5);
        $files = scandir(CONFIG_PATH);
        $apps = new stdClass();
        foreach ($files as $file) {
            echo $file . PHP_EOL;
            if (substr($file, -4) === '.php' && strpos($file, "config-") === 0) {
                $domain = substr($file, 7, -4);

                $scheme = '';
                $schemes = ['http', 'https'];

                foreach ($schemes as $s) {
                    if (@fopen(sprintf("%s://%s/", $s, $domain), "r")) {
                        $scheme = $s; 
                        break;
                    }
                }

                if ($scheme) {
                    $domain_apps = json_decode(exec(sprintf("php ./read-config.php --domain %s --scheme %s", $domain, $scheme)));

                    foreach ($domain_apps as $key => $value) {
                        $apps->$key = $value;
                    }
                }
            }
        }

        $config = json_decode(replace_placeholders(file_get_contents("./wp-mon-scr-config.json"), []), true);
        $fperm = $config['files']['permissions']['file_perm'];
        $dperm = $config['files']['permissions']['dir_perm'];
        $owner = $config['files']['owner'];
        $group = $config['files']['group'];

        $apps->usr_share_wordpress = [
            "name" => sprintf("WP Checklist: %s", WORDPRESS_PATH),
            "items" => [
                "permissions" => [
                    "name" => sprintf("WP Checklist: Directory permissions in %s set (files: %s, dirs: %s)", WORDPRESS_PATH, $fperm, $dperm),
                    "type" => "bool",
                    "value" => (int) check_permissions(WORDPRESS_PATH, $dperm, $fperm),
                    "timestamp" => time(),
                    "triggers" => $config["triggers"]["wp_directory_permissions"]
                ],
                "owner" => [
                    "name" => sprintf("WP Checklist: Directory owner in %s set to %s", WORDPRESS_PATH, $owner),
                    "type" => "bool",
                    "value" => (int) check_ownership(WORDPRESS_PATH, $owner),
                    "timestamp" => time(),
                    "triggers" => $config["triggers"]["wp_directory_ownership"]
                ],
                "groups" => [
                    "name" => sprintf("WP Checklist: Directory groups in %s set to %s", WORDPRESS_PATH, $group),
                    "type" => "bool",
                    "value" => (int) check_groups(WORDPRESS_PATH, $group),
                    "timestamp" => time(),
                    "triggers" => $config["triggers"]["wp_directory_groups"]
                ]
            ]
        ];

        fwrite(STDOUT, json_encode(generateMonJson($apps)));
    }
?>

