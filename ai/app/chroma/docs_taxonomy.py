"""Helpers for deriving cluster-friendly metadata from repository docs paths."""

from pathlib import Path

IGNORED_DOC_PATH_PARTS = {
    "node_modules",
    ".docusaurus",
    "build",
    "build-root",
    "dist",
    ".next",
    ".vitepress",
}

_DOC_CATEGORY_BY_ROOT = {
    "abby-seed": "abby_seed",
    "architecture": "architecture",
    "blog": "blog",
    "commons": "commons",
    "compliance": "compliance",
    "data-dictionary": "data_dictionary",
    "devlog": "devlog",
    "docs": "docs",
    "handoffs": "handoffs",
    "irsf-nhs": "irsf_nhs",
    "ops": "operations",
    "poseidon": "poseidon",
    "research": "research",
    "superpowers": "superpowers",
}

_DOC_WORKSPACE_BY_ROOT = {
    "abby-seed": "abby",
    "architecture": "platform",
    "blog": "website",
    "commons": "commons",
    "compliance": "compliance",
    "data-dictionary": "platform",
    "devlog": "platform",
    "docs": "platform",
    "handoffs": "platform",
    "irsf-nhs": "irsf_nhs",
    "ops": "operations",
    "poseidon": "poseidon",
    "research": "platform",
    "superpowers": "superpowers",
}

_DOC_PAGE_TYPE_BY_ROOT = {
    "abby-seed": "seed_content",
    "architecture": "architecture",
    "blog": "blog_post",
    "data-dictionary": "reference",
    "handoffs": "handoff",
    "irsf-nhs": "project_note",
    "ops": "runbook",
    "poseidon": "project_note",
    "research": "research_note",
}

_DOC_PAGE_TYPE_BY_ROOT_AND_SECTION = {
    ("commons", "abby-components"): "component_reference",
    ("devlog", "architecture"): "architecture",
    ("devlog", "modules"): "module_note",
    ("devlog", "phases"): "roadmap_phase",
    ("devlog", "plans"): "plan",
    ("devlog", "process"): "process_note",
    ("devlog", "releases"): "release_notes",
    ("devlog", "specs"): "design_spec",
    ("devlog", "strategy"): "strategy_note",
    ("superpowers", "plans"): "plan",
    ("superpowers", "specs"): "design_spec",
}


def should_skip_docs_path(relative_path: str) -> bool:
    """Return True when the path points at generated/vendor docs content."""
    parts = {part.lower() for part in Path(relative_path).parts}
    return any(part in parts for part in IGNORED_DOC_PATH_PARTS)


def derive_docs_taxonomy(relative_path: str) -> dict[str, str]:
    """Infer category/page/workspace metadata for authored markdown docs."""
    normalized_path = str(relative_path).strip()
    if not normalized_path or should_skip_docs_path(normalized_path):
        return {}

    path = Path(normalized_path)
    parts = [part for part in path.parts if part]
    if not parts:
        return {}

    lower_parts = [part.lower() for part in parts]
    root = lower_parts[0] if len(lower_parts) > 1 else "docs"
    nested_dirs = lower_parts[1:-1] if len(lower_parts) > 1 else []
    first_section = nested_dirs[0] if nested_dirs else ""
    file_stem = path.stem.lower()

    taxonomy: dict[str, str] = {}

    category = _DOC_CATEGORY_BY_ROOT.get(root, root.replace("-", "_"))
    if category:
        taxonomy["category"] = category

    if first_section:
        taxonomy["subcategory"] = first_section.replace("-", "_")

    workspace = _DOC_WORKSPACE_BY_ROOT.get(root)
    if workspace:
        taxonomy["workspace"] = workspace

    page_type = _DOC_PAGE_TYPE_BY_ROOT_AND_SECTION.get((root, first_section))
    if page_type is None:
        page_type = _DOC_PAGE_TYPE_BY_ROOT.get(root)
    if page_type is None and root == "commons" and "workspace" in file_stem and "spec" in file_stem:
        page_type = "workspace_spec"
    if page_type is None and root == "compliance":
        page_type = "evidence_log" if "evidence" in lower_parts else "policy"
    if page_type:
        taxonomy["page_type"] = page_type

    return taxonomy
