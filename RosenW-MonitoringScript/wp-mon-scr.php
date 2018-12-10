<?php
    const CONFIG_PATH = "/etc/wordpress/";

    // Script Starts here
    if ($argv && $argv[0] && realpath($argv[0]) === __FILE__) {
        $files = scandir(CONFIG_PATH);
        $apps = new stdClass();
        foreach ($files as $file) {
            if (substr($file, -4) === '.php' && strpos($file, "config-") === 0) {
                $domain = substr($file, 7, -4);
                $apps->$domain = json_decode(exec(sprintf("php ./read-config.php %s", $domain)));
            }
        }

        fwrite(STDOUT, json_encode(generateMonJson($apps), JSON_PRETTY_PRINT));
    }

    function generateMonJson ($apps) {
        return [
            'version' => '3.0',
            'update_interval' => 60,
            'applications' => $apps
        ];
    }
?>

