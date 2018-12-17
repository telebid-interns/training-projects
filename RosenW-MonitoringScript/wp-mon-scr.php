<?php
    const CONFIG_PATH = "/etc/wordpress/";
    @include "./utils.php";

    // Script Starts here
    if ($argv && $argv[0] && realpath($argv[0]) === __FILE__) {
        $files = scandir(CONFIG_PATH);
        $apps = new stdClass();
        foreach ($files as $file) {
            if (substr($file, -4) === '.php' && strpos($file, "config-") === 0) {
                $domain = substr($file, 7, -4);
                if (@fopen(sprintf("http://%s/", $domain), "r")) {
                    $apps->$domain = json_decode(exec(sprintf("php ./read-config.php --domain %s", $domain)));
                }
            }
        }

        $config = json_decode(replace_placeholders(file_get_contents("./wp-mon-scr-config.json"), []), true);
        $fperm = $config['permissions']['file_perm'];
        $dperm = $config['permissions']['dir_perm'];

        $apps->usr_share_wordpress = [
            "name" => "WP Checklist for /usr/share/wordpress",
            "items" => [
                "permissions" => [
                    "name" => sprintf("WP Checklist: Directory permissions in /usr/share/wordpress set (files: %s, dirs: %s)", $fperm, $dperm),
                    "type" => "bool",
                    "value" => (int) check_permissions("/usr/share/wordpress", $dperm, $fperm),
                    "timestamp" => time(),
                    "triggers" => $config["triggers"]["wp_directory_permissions"]
                ]
            ]
        ];

        fwrite(STDOUT, json_encode(generateMonJson($apps)));
    }
?>

