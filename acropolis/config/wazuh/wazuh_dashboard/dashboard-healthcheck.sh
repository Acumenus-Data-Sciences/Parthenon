#!/bin/sh
set -eu

curl -sk --connect-timeout 5 --max-time 15 \
    -u "${INDEXER_USERNAME}:${INDEXER_PASSWORD}" \
    https://localhost:5601/api/status >/dev/null

token="$(curl -sk --connect-timeout 5 --max-time 15 \
    -u "${API_USERNAME}:${API_PASSWORD}" \
    https://wazuh.manager:55000/security/user/authenticate?raw=true)"

case "$token" in
    ""|*"Wazuh Internal Error"*|*"Unauthorized"*|*"Invalid token"*)
        printf 'Wazuh manager API authentication failed\n' >&2
        exit 1
        ;;
esac

if [ "${#token}" -lt 40 ]; then
    printf 'Wazuh manager API returned an invalid token\n' >&2
    exit 1
fi

curl -sk --connect-timeout 5 --max-time 15 \
    -H "Authorization: Bearer $token" \
    "https://wazuh.manager:55000/agents?limit=1" |
    grep -q '"error": 0'
