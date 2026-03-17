"""Agency tools sub-package — individual callable tools for Abby's agency module.

Each tool in this package wraps a specific Laravel API operation and is
registered with the ToolRegistry.  Tools declare a risk level (low / medium /
high) which controls whether execution requires explicit user approval.
"""
