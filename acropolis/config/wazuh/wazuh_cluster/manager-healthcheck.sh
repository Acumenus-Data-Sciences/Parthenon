#!/bin/sh
set -eu

required_daemons="
wazuh-modulesd
wazuh-monitord
wazuh-logcollector
wazuh-remoted
wazuh-syscheckd
wazuh-analysisd
wazuh-execd
wazuh-db
wazuh-authd
wazuh-apid
"

status_output="$(/var/ossec/bin/wazuh-control status 2>&1 || true)"
missing_required=0

for daemon in $required_daemons; do
    if ! printf '%s\n' "$status_output" | grep -q "$daemon is running"; then
        missing_required=1
    fi
done

if [ "$missing_required" -ne 0 ] || [ -e /var/ossec/var/run/wazuh-modulesd.failed ]; then
    rm -f /var/ossec/var/run/wazuh-modulesd.failed
    /var/ossec/bin/wazuh-control start >/tmp/wazuh-manager-healthcheck-start.log 2>&1 || true
    sleep 5
    status_output="$(/var/ossec/bin/wazuh-control status 2>&1 || true)"
fi

for daemon in $required_daemons; do
    if ! printf '%s\n' "$status_output" | grep -q "$daemon is running"; then
        printf '%s is not running\n' "$daemon" >&2
        exit 1
    fi
done

token="$(curl -sk --connect-timeout 5 --max-time 15 \
    -u "${API_USERNAME}:${API_PASSWORD}" \
    https://localhost:55000/security/user/authenticate?raw=true)"

case "$token" in
    ""|*"Wazuh Internal Error"*|*"Unauthorized"*|*"Invalid token"*)
        printf 'Wazuh API authentication failed\n' >&2
        exit 1
        ;;
esac

if [ "${#token}" -lt 40 ]; then
    printf 'Wazuh API returned an invalid token\n' >&2
    exit 1
fi

curl -sk --connect-timeout 5 --max-time 15 \
    -H "Authorization: Bearer $token" \
    "https://localhost:55000/agents?limit=1" |
    grep -q '"error": 0'
