<?php
// Just a simple script to verify syntax
$dir = 'backend/database/migrations';
$files = scandir($dir);
foreach ($files as $file) {
    if (strpos($file, '.php') !== false) {
        exec("php -l " . $dir . "/" . $file, $output, $return);
        if ($return !== 0) {
            echo "Syntax error in $file\n";
        }
    }
}
