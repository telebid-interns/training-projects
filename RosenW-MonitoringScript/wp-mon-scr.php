<?php
    const CONFIG_PATH = "/etc/wordpress/";

    // Script Starts here
    if ($argv && $argv[0] && realpath($argv[0]) === __FILE__) {
        $files = scandir(CONFIG_PATH);
        foreach ($files as $file) {
            if (substr($file, -4) === '.php' && strpos($file, "config-") === 0) {
                $site = substr($file, 7, -4);
                fwrite(STDOUT, PHP_EOL . sprintf("Result for %s", $site) . PHP_EOL);
                fwrite(STDOUT, exec(sprintf("php ./read-config.php %s", $site)) . PHP_EOL);
            }
        }
    }
?>
