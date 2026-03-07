import React from "react";
import BlogSidebar from "@theme-original/BlogSidebar";

/**
 * Wraps the default BlogSidebar to pin the "Introducing Parthenon" post
 * at the top of the sidebar, regardless of date ordering.
 */
export default function BlogSidebarWrapper(props) {
  const PINNED_PERMALINK = "/blog/introducing-parthenon";

  if (props.sidebar?.items) {
    const pinned = [];
    const rest = [];

    for (const item of props.sidebar.items) {
      if (item.permalink === PINNED_PERMALINK) {
        pinned.push({ ...item, title: `\u{1F4CC} ${item.title}` });
      } else {
        rest.push(item);
      }
    }

    return (
      <BlogSidebar
        {...props}
        sidebar={{ ...props.sidebar, items: [...pinned, ...rest] }}
      />
    );
  }

  return <BlogSidebar {...props} />;
}
