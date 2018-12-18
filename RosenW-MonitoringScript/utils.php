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

    function check_ownership ($path, $owner) {
        $files = scandir($path);

        foreach ($files as $file) {
            if ($file === "." || $file === "..") {
                continue;
            }

            $new_path = $path . DIRECTORY_SEPARATOR . $file;
            if (is_dir($new_path)) {
                if (posix_getpwuid(fileowner($new_path))['name'] !== $owner || !check_ownership($new_path, $owner)) {
                    return false;
                }
            } elseif (is_file($new_path)) {
                if (posix_getpwuid(fileowner($new_path))['name'] !== $owner) {
                    return false;
                }
            }
        }

        return true;
    }

    function check_groups ($path, $group) {
        $files = scandir($path);

        foreach ($files as $file) {
            if ($file === "." || $file === "..") {
                continue;
            }

            $new_path = $path . DIRECTORY_SEPARATOR . $file;
            if (is_dir($new_path)) {
                if (posix_getpwuid(filegroup($new_path))['name'] !== $group || !check_ownership($new_path, $group)) {
                    return false;
                }
            } elseif (is_file($new_path)) {
                if (posix_getpwuid(filegroup($new_path))['name'] !== $group) {
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

        $config = str_replace("<fperm>", $arr['files']['permissions']['file_perm'], $config);
        $config = str_replace("<dperm>", $arr['files']['permissions']['dir_perm'], $config);
        $config = str_replace("<owner>", $arr['files']['owner'], $config);
        $config = str_replace("<group>", $arr['files']['group'], $config);
        return $config;
    }
?>