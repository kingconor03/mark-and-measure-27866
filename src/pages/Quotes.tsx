import { useOrganisation } from "@/hooks/useOrganisation";
import { Navigate } from "react-router-dom";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { QuoteRequestsManager } from "@/components/admin/QuoteRequestsManager";

export default function Quotes() {
  const { isPlatformAdmin, loading } = useOrganisation();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isPlatformAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="flex h-screen bg-background">
      <DashboardSidebar />
      <main className="flex-1 overflow-auto">
        <div className="container mx-auto p-6">
          <div className="mb-6">
            <h1 className="text-3xl font-bold">Quote Requests</h1>
            <p className="text-muted-foreground mt-2">
              Manage all quote requests routed to BladePile for processing
            </p>
          </div>
          <QuoteRequestsManager defaultStatus="all" />
        </div>
      </main>
    </div>
  );
}
