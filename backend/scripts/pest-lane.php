#!/usr/bin/env php
<?php

declare(strict_types=1);

$root = dirname(__DIR__);
$junit = tempnam(sys_get_temp_dir(), 'parthenon-pest-');

if ($junit === false) {
    fwrite(STDERR, "Unable to allocate temporary JUnit file.\n");
    exit(2);
}

$command = array_merge([
    PHP_BINARY,
    $root.'/vendor/bin/pest',
], array_slice($argv, 1), [
    '--log-junit',
    $junit,
]);

$descriptorSpec = [
    0 => STDIN,
    1 => STDOUT,
    2 => STDERR,
];

$process = proc_open($command, $descriptorSpec, $pipes, $root);

if (! is_resource($process)) {
    @unlink($junit);
    fwrite(STDERR, "Unable to start Pest.\n");
    exit(2);
}

$status = proc_close($process);

if ($status === 0 || ! is_file($junit)) {
    @unlink($junit);
    exit($status);
}

$report = @simplexml_load_file($junit);
@unlink($junit);

if ($report === false) {
    exit($status);
}

$failures = 0;
$errors = 0;

foreach ($report->testsuite as $suite) {
    $failures += (int) $suite['failures'];
    $errors += (int) $suite['errors'];
}

exit($failures === 0 && $errors === 0 ? 0 : $status);
