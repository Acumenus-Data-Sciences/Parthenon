# CE-only Anthropic→Ollama proxy for the Parthenon agent copilots.
#
# claude-code-router (musistudio) exposes an Anthropic Messages-API endpoint and
# forwards to an OpenAI-compatible backend (Ollama). python-ai points the Claude
# CLI here via ANTHROPIC_BASE_URL when AGENT_PROVIDER=local. The entrypoint
# renders the router config from env at start so the model/backend are
# deployment-configurable without rebaking the image.
#
# HIGHSEC 4.1: runs as the non-root `routeruser`.
FROM node:22-alpine

# Pin can be tightened by the operator; @latest tracks upstream CCR.
RUN npm install -g @musistudio/claude-code-router

RUN addgroup -S routergroup \
    && adduser -S -G routergroup -h /home/routeruser routeruser

COPY docker/claude-router/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh \
    && mkdir -p /home/routeruser/.claude-code-router \
    && chown -R routeruser:routergroup /home/routeruser

USER routeruser
ENV HOME=/home/routeruser

EXPOSE 8787
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
