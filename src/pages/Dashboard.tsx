import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { ProjectCard } from "@/components/ProjectCard";
import { NewProjectModal } from "@/components/NewProjectModal";
import { Button } from "@/components/ui/button";
import { Plus, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useOrganisation } from "@/hooks/useOrganisation";
import { supabase } from "@/integrations/supabase/client";
import { features } from "@/config/features";

const Dashboard = () => {
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { currentOrg, loading: orgLoading } = useOrganisation();
  const navigate = useNavigate();

  useEffect(() => {
    // Wait for org data to load before fetching projects
    if (!orgLoading) {
      fetchProjects();
    }
  }, [orgLoading]);

  const fetchProjects = async () => {
    try {
      let query = supabase
        .from("projects")
        .select("*")
        .order("created_at", { ascending: false });

      // If org mode enabled, filter by current org
      if (features.orgEnabled && currentOrg) {
        query = query.eq("organisation_id", currentOrg.id);
      }

      const { data, error } = await query;

      if (error) throw error;
      setProjects(data || []);
    } catch (error) {
      console.error("Error fetching projects:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full">
      <DashboardSidebar />

      <main className="flex-1 p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Welcome Back</h1>
          <p className="text-muted-foreground">
            {features.orgEnabled && currentOrg 
              ? `${currentOrg.name} - Construction Projects`
              : 'Your Construction Projects'
            }
          </p>
        </div>

        {/* New Project Button */}
        <div className="mb-6">
          <Button onClick={() => setNewProjectOpen(true)} size="lg">
            <Plus className="mr-2 h-5 w-5" />
            New Project
          </Button>
        </div>

        {/* Recent Projects */}
        <section>
          <h2 className="text-xl font-semibold mb-4">Recent Projects</h2>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : projects.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed rounded-lg">
              <p className="text-muted-foreground mb-4">No projects yet</p>
              <Button onClick={() => setNewProjectOpen(true)}>
                Create Your First Project
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {projects.map((project) => (
                <ProjectCard
                  key={project.id}
                  id={project.id}
                  name={project.name}
                  lastModified={`Updated ${new Date(project.updated_at).toLocaleDateString()}`}
                  status={project.status === 'completed' ? 'completed' : 'in-progress'}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      <NewProjectModal 
        open={newProjectOpen} 
        onOpenChange={setNewProjectOpen}
        onProjectCreated={fetchProjects}
      />
    </div>
  );
};

export default Dashboard;
