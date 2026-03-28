import { ProjectListView } from "./ProjectListView";
import ProjectDetailView from "./ProjectDetailView";

interface IngestionDashboardPageProps {
  activeProjectId: number | null;
  onActiveProjectChange: (id: number | null) => void;
}

export default function IngestionDashboardPage({
  activeProjectId,
  onActiveProjectChange,
}: IngestionDashboardPageProps) {
  if (activeProjectId !== null) {
    return (
      <ProjectDetailView
        projectId={activeProjectId}
        onBack={() => onActiveProjectChange(null)}
      />
    );
  }

  return <ProjectListView onSelectProject={onActiveProjectChange} />;
}
