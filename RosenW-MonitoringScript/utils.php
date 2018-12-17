<?php
    function check_permissions ($path, $dperm, $fperm) {
        $files = scandir($path);

        foreach ($files as $file) {
            if ($file === "." || $file === "..") {
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

    function generateMonJson ($apps) {
        return [
            'version' => '3.0',
            'update_interval' => 60,
            'applications' => $apps
        ];
    }

    function replace_placeholders ($config, $values) {
        $arr = json_decode(file_get_contents("./wp-mon-scr-config.json"), true);
        if (array_key_exists('prefix', $values)) {	
	        $config = str_replace("<wp-prefix>", $values['prefix'], $config);
        }

        if (array_key_exists('wp-content-path', $values)) {	
	    	$config = str_replace("<wp-content-path>", $values['wp-content-path'], $config);
        }

        $config = str_replace("<fperm>", $arr['permissions']['file_perm'], $config);
        $config = str_replace("<dperm>", $arr['permissions']['dir_perm'], $config);
        return $config;
    }
?>