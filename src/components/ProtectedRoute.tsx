import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useOrganisation } from "@/hooks/useOrganisation";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireOrg?: boolean;
}

export const ProtectedRoute = ({ children, requireOrg = true }: ProtectedRouteProps) => {
  const { user, loading: authLoading } = useAuth();
  const { currentOrg, loading: orgLoading } = useOrganisation();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Wait for auth to load
    if (authLoading) return;

    // Not authenticated - redirect to auth with return path
    if (!user) {
      navigate(`/auth?returnTo=${encodeURIComponent(location.pathname)}`);
      return;
    }

    // Wait for org data to load
    if (orgLoading) return;

    // If org is required but user has none - redirect to create org
    if (requireOrg && !currentOrg) {
      navigate("/create-organization");
      return;
    }

    // If user has org but is on create-organization page - redirect to dashboard
    if (currentOrg && location.pathname === "/create-organization") {
      navigate("/dashboard");
      return;
    }
  }, [user, currentOrg, authLoading, orgLoading, requireOrg, navigate, location.pathname]);

  // Show loading while checking auth and org status
  if (authLoading || orgLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    return null;
  }

  // Org required but not found
  if (requireOrg && !currentOrg) {
    return null;
  }

  // All checks passed - render children
  return <>{children}</>;
};
