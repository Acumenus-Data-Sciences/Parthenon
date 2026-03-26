import { useState } from "react";
import { ProjectListView } from "./ProjectListView";
import ProjectDetailView from "./ProjectDetailView";

export default function IngestionDashboardPage() {
  const [activeProjectId, setActiveProjectId] = useState<number | null>(null);

  if (activeProjectId !== null) {
    return (
      <ProjectDetailView
        projectId={activeProjectId}
        onBack={() => setActiveProjectId(null)}
      />
    );
  }

  return <ProjectListView onSelectProject={setActiveProjectId} />;
}
