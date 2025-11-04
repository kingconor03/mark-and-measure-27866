import { LayoutDashboard, Settings, Shield, FileText, Award } from "lucide-react";
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useOrganisation } from "@/hooks/useOrganisation";
import { useSidebarCounts } from "@/hooks/useSidebarCounts";
import { Badge } from "@/components/ui/badge";

export const DashboardSidebar = () => {
  const { isPlatformAdmin } = useOrganisation();
  const { counts } = useSidebarCounts();

  return (
    <aside className="w-64 h-screen bg-sidebar border-r border-sidebar-border flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-sidebar-border">
        <h1 className="text-2xl font-bold text-primary">BladeMark</h1>
        <p className="text-xs text-muted-foreground mt-1">Web Edition</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4">
        <ul className="space-y-1">
          <li>
            <NavLink
              to="/dashboard"
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-4 py-3 rounded-md transition-colors text-sm font-medium",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                )
              }
            >
              <LayoutDashboard className="h-5 w-5" />
              Dashboard
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-4 py-3 rounded-md transition-colors text-sm font-medium",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                )
              }
            >
              <Settings className="h-5 w-5" />
              Account Settings
            </NavLink>
          </li>
          {isPlatformAdmin && (
            <>
              <li>
                <NavLink
                  to="/quotes"
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 px-4 py-3 rounded-md transition-colors text-sm font-medium",
                      isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                    )
                  }
                >
                  <FileText className="h-5 w-5" />
                  <span className="flex-1">Quote Requests</span>
                  {(counts.quotes_new || 0) + (counts.quotes_awaiting_docs || 0) + (counts.quotes_in_progress || 0) > 0 && (
                    <Badge variant="secondary" className="ml-auto">
                      {(counts.quotes_new || 0) + (counts.quotes_awaiting_docs || 0) + (counts.quotes_in_progress || 0)}
                    </Badge>
                  )}
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/certifications"
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 px-4 py-3 rounded-md transition-colors text-sm font-medium",
                      isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                    )
                  }
                >
                  <Award className="h-5 w-5" />
                  <span className="flex-1">Certifications</span>
                  {(counts.certs_new || 0) + (counts.certs_pending || 0) + (counts.certs_awaiting_docs || 0) > 0 && (
                    <Badge variant="secondary" className="ml-auto">
                      {(counts.certs_new || 0) + (counts.certs_pending || 0) + (counts.certs_awaiting_docs || 0)}
                    </Badge>
                  )}
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/admin"
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 px-4 py-3 rounded-md transition-colors text-sm font-medium",
                      isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                    )
                  }
                >
                  <Shield className="h-5 w-5" />
                  Admin Portal
                </NavLink>
              </li>
            </>
          )}
        </ul>
      </nav>
    </aside>
  );
};
