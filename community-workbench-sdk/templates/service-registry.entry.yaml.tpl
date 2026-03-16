__TOOL_ID__:
  endpoint: /flows/__ROUTE_SLUG__
  description: __DESCRIPTION__
  mcp_tools:
    - __TOOL_ID___catalog
  input:
    - source_key
    - payload
  output:
    - summary
    - panels
    - artifacts
  validation:
    - registration gated by __ENV_PREFIX___ENABLED
    - writes require explicit confirmation before execution tools are added
  ui_hints:
    title: __DISPLAY_NAME__
    summary: __DESCRIPTION__
    accent: slate
    repository: null
    workspace: __DOMAIN__-workbench
