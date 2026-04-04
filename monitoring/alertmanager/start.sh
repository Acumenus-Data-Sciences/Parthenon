#!/bin/sh
set -eu

config_path=/etc/alertmanager/alertmanager.yml
receiver_name=null
mattermost_webhook_url=${MATTERMOST_WEBHOOK_URL:-}
grafana_alerts_url=${GRAFANA_ALERTS_URL:-https://parthenon.acumenus.net/grafana/alerting/list}

case "$mattermost_webhook_url" in
  http://localhost*|https://localhost*|http://127.0.0.1*|https://127.0.0.1*)
    mattermost_webhook_url=$(printf '%s' "$mattermost_webhook_url" | sed 's#://localhost#://host.docker.internal#; s#://127.0.0.1#://host.docker.internal#')
    ;;
esac

cat > "$config_path" <<EOF
global:
  resolve_timeout: 5m

route:
  group_by: ['alertname', 'service', 'queue']
  group_wait: 15s
  group_interval: 5m
  repeat_interval: 4h
  receiver: '${receiver_name}'

receivers:
  - name: 'null'
EOF

if [ -n "$mattermost_webhook_url" ]; then
  receiver_name=mattermost

  cat > "$config_path" <<EOF
global:
  resolve_timeout: 5m

route:
  group_by: ['alertname', 'service', 'queue']
  group_wait: 15s
  group_interval: 5m
  repeat_interval: 4h
  receiver: '${receiver_name}'

receivers:
  - name: 'null'
  - name: 'mattermost'
    slack_configs:
      - send_resolved: true
        api_url: '${mattermost_webhook_url}'
EOF

  if [ -n "${MATTERMOST_CHANNEL:-}" ]; then
    printf "        channel: '%s'\n" "$MATTERMOST_CHANNEL" >> "$config_path"
  fi

  if [ -n "${MATTERMOST_USERNAME:-}" ]; then
    printf "        username: '%s'\n" "$MATTERMOST_USERNAME" >> "$config_path"
  fi

  if [ -n "${MATTERMOST_ICON_EMOJI:-}" ]; then
    printf "        icon_emoji: '%s'\n" "$MATTERMOST_ICON_EMOJI" >> "$config_path"
  fi

  cat >> "$config_path" <<'EOF'
        title: '{{ .Status | toUpper }}{{ if and (eq .Status "firing") .CommonLabels.severity }} {{ .CommonLabels.severity | toUpper }}{{ end }}: {{ .CommonLabels.alertname }}{{ if gt (len .Alerts) 1 }} ({{ len .Alerts }} alerts){{ end }}'
        title_link: '__GRAFANA_ALERTS_URL__'
        color: '{{ if eq .Status "resolved" }}good{{ else if eq .CommonLabels.severity "critical" }}danger{{ else if eq .CommonLabels.severity "warning" }}warning{{ else }}#439FE0{{ end }}'
        text: 'Status: `{{ .Status }}`{{ if .CommonLabels.severity }}{{ "\n" }}Severity: `{{ .CommonLabels.severity }}`{{ end }}{{ if .CommonLabels.service }}{{ "\n" }}Service: `{{ .CommonLabels.service }}`{{ end }}{{ if .CommonLabels.queue }}{{ "\n" }}Queue: `{{ .CommonLabels.queue }}`{{ end }}{{ "\n" }}Grafana: __GRAFANA_ALERTS_URL__{{ range .Alerts }}{{ "\n" }}• {{ if .Annotations.summary }}{{ .Annotations.summary }}{{ else if .Labels.summary }}{{ .Labels.summary }}{{ else }}{{ .Labels.alertname }}{{ end }}{{ if .Annotations.description }}: {{ .Annotations.description }}{{ else if .Labels.description }}: {{ .Labels.description }}{{ end }}{{ end }}'
EOF

  escaped_grafana_alerts_url=$(printf '%s\n' "$grafana_alerts_url" | sed 's/[\/&]/\\&/g')
  sed -i "s/__GRAFANA_ALERTS_URL__/${escaped_grafana_alerts_url}/g" "$config_path"
fi

exec /bin/alertmanager \
  --config.file="$config_path" \
  --storage.path=/alertmanager \
  --web.listen-address=:9093 \
  --cluster.listen-address=
