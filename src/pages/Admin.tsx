import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useOrganisation } from "@/hooks/useOrganisation";
import { useSidebarCounts } from "@/hooks/useSidebarCounts";
import { OrganisationsManager } from "@/components/admin/OrganisationsManager";
import { OrgMembersManager } from "@/components/admin/OrgMembersManager";
import { QuoteRequestsManager } from "@/components/admin/QuoteRequestsManager";
import { CertRequestsManager } from "@/components/admin/CertRequestsManager";
import { Loader2, Building2, Users, FileText, Award, LayoutDashboard } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function Admin() {
  const navigate = useNavigate();
  const { isPlatformAdmin, loading, currentOrg } = useOrganisation();
  const { counts } = useSidebarCounts();
  const [activeTab, setActiveTab] = useState("overview");
  const [currentUserId, setCurrentUserId] = useState<string>("");

  useEffect(() => {
    if (!loading && !isPlatformAdmin) {
      navigate("/dashboard");
      toast.error("Unauthorized access");
    }
  }, [isPlatformAdmin, loading, navigate]);

  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);
    };
    getCurrentUser();
  }, []);

  const sidebarItems = [
    {
      id: "overview",
      label: "Overview",
      icon: LayoutDashboard,
    },
    {
      id: "organisations",
      label: "Organisations",
      icon: Building2,
      children: [
        { id: "all-orgs", label: "All Organisations" },
        { id: "add-org", label: "Add Organisation" },
      ],
    },
    {
      id: "users",
      label: "Users",
      icon: Users,
      children: [
        { id: "members", label: "Members by Organisation" },
        { id: "invite-user", label: "Invite User" },
      ],
    },
    {
      id: "quotes",
      label: "Quotes",
      icon: FileText,
      badge: (counts.quotes_new || 0) + (counts.quotes_awaiting_docs || 0) + (counts.quotes_in_progress || 0),
      children: [
        { id: "all-quotes", label: "All Requests" },
        { id: "quotes-awaiting", label: "Awaiting Docs", badge: counts.quotes_awaiting_docs },
        { id: "quotes-progress", label: "In Progress", badge: counts.quotes_in_progress },
        { id: "quotes-completed", label: "Completed" },
        { id: "quotes-rejected", label: "Rejected" },
      ],
    },
    {
      id: "certifications",
      label: "Certifications",
      icon: Award,
      badge: (counts.certs_new || 0) + (counts.certs_pending || 0) + (counts.certs_awaiting_docs || 0),
      children: [
        { id: "all-certs", label: "All Requests" },
        { id: "certs-pending", label: "Pending Review", badge: counts.certs_pending },
        { id: "certs-approved", label: "Approved" },
        { id: "certs-rejected", label: "Rejected" },
      ],
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isPlatformAdmin) {
    return null;
  }

  const renderContent = () => {
    switch (activeTab) {
      case "overview":
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Platform Overview</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border bg-card p-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-muted-foreground">Pending Quotes</h3>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="mt-2 text-2xl font-bold">
                  {(counts.quotes_new || 0) + (counts.quotes_awaiting_docs || 0) + (counts.quotes_in_progress || 0)}
                </div>
              </div>
              <div className="rounded-lg border bg-card p-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-muted-foreground">Pending Certifications</h3>
                  <Award className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="mt-2 text-2xl font-bold">
                  {(counts.certs_new || 0) + (counts.certs_pending || 0) + (counts.certs_awaiting_docs || 0)}
                </div>
              </div>
            </div>
          </div>
        );

      case "all-orgs":
      case "add-org":
        return <OrganisationsManager />;

      case "members":
      case "invite-user":
        return currentOrg ? (
          <OrgMembersManager orgId={currentOrg.id} orgName={currentOrg.name} currentUserId={currentUserId} />
        ) : <div>Select an organisation to manage members</div>;

      case "all-quotes":
        return <QuoteRequestsManager />;

      case "quotes-awaiting":
        return <QuoteRequestsManager defaultStatus="awaiting_docs" />;

      case "quotes-progress":
        return <QuoteRequestsManager defaultStatus="in_progress" />;

      case "quotes-completed":
        return <QuoteRequestsManager defaultStatus="completed" />;

      case "quotes-rejected":
        return <QuoteRequestsManager defaultStatus="rejected" />;

      case "all-certs":
        return <CertRequestsManager />;

      case "certs-pending":
        return <CertRequestsManager defaultStatus="in_progress" />;

      case "certs-approved":
        return <CertRequestsManager defaultStatus="approved" />;

      case "certs-rejected":
        return <CertRequestsManager defaultStatus="rejected" />;

      default:
        return <div>Select an option from the sidebar</div>;
    }
  };

  return (
    <div className="min-h-screen flex w-full bg-background">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-card flex-shrink-0">
        <div className="p-6 border-b">
          <h1 className="text-xl font-bold">Platform Admin</h1>
          <p className="text-sm text-muted-foreground">BladePile Management</p>
        </div>
        <nav className="p-4 space-y-2">
          {sidebarItems.map((item) => (
            <div key={item.id}>
              <button
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  activeTab === item.id
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted text-foreground"
                )}
              >
                <div className="flex items-center gap-2">
                  <item.icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && item.badge > 0 && (
                  <Badge variant="secondary" className="ml-auto">
                    {item.badge}
                  </Badge>
                )}
              </button>
              {item.children && (
                <div className="ml-6 mt-1 space-y-1">
                  {item.children.map((child) => (
                    <button
                      key={child.id}
                      onClick={() => setActiveTab(child.id)}
                      className={cn(
                        "w-full flex items-center justify-between px-3 py-1.5 rounded-md text-sm transition-colors",
                        activeTab === child.id
                          ? "bg-muted font-medium"
                          : "hover:bg-muted/50 text-muted-foreground"
                      )}
                    >
                      <span>{child.label}</span>
                      {child.badge !== undefined && child.badge > 0 && (
                        <Badge variant="outline" className="ml-auto text-xs">
                          {child.badge}
                        </Badge>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="container mx-auto py-8 px-6">
          {renderContent()}
        </div>
      </main>
    </div>
  );
}