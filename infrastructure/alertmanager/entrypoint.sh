#!/bin/sh
# Renders alertmanager.yml from the template, then execs Alertmanager.
# With no Telegram credentials the receiver has no integrations: alerts stay
# visible in Prometheus/Alertmanager but are not delivered (spec 7 §5).
set -eu

TMPL=/etc/alertmanager/alertmanager.yml.tmpl
OUT=${ALERTMANAGER_CONFIG_OUT:-/tmp/alertmanager.yml}

token=${ALERTMANAGER_TELEGRAM_BOT_TOKEN:-}
chat=${ALERTMANAGER_TELEGRAM_CHAT_ID:-}

if [ -n "$token" ] && [ -n "$chat" ]; then
  case "$chat" in
    -[0-9]*|[0-9]*) ;;
    *) echo "ALERTMANAGER_TELEGRAM_CHAT_ID must be an integer" >&2; exit 1 ;;
  esac
  receiver="  - name: default
    telegram_configs:
      - bot_token: '$token'
        chat_id: $chat
        parse_mode: HTML
        send_resolved: true
        message: '{{ template \"meterhub.telegram\" . }}'"
  echo "alertmanager: Telegram delivery enabled"
else
  receiver="  - name: default"
  echo "alertmanager: Telegram credentials not set, delivery disabled (alerts visible in the UI only)"
fi

: > "$OUT"
while IFS= read -r line; do
  if [ "$line" = "@RECEIVER@" ]; then
    printf '%s\n' "$receiver" >> "$OUT"
  else
    printf '%s\n' "$line" >> "$OUT"
  fi
done < "$TMPL"

exec /bin/alertmanager --config.file="$OUT" --storage.path=/alertmanager "$@"
