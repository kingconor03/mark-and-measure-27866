import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useOrganisation } from "@/hooks/useOrganisation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Info, Shield } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const CreateOrganization = () => {
  const { user, signOut } = useAuth();
  const { currentOrg, isPlatformAdmin, createOrganisation, loading: orgLoading } = useOrganisation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [domain, setDomain] = useState("");
  const [checking, setChecking] = useState(false);

  const checkForOrg = async () => {
    setChecking(true);
    // Force a refresh by re-fetching user data
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      // This will trigger useOrganisation to re-fetch
      window.location.reload();
    }
    setChecking(false);
  };

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }

    // Platform admins should never see this page
    if (!orgLoading && isPlatformAdmin) {
      navigate("/dashboard");
      return;
    }

    // If user already has org, redirect to dashboard
    if (!orgLoading && currentOrg) {
      navigate("/dashboard");
      return;
    }

    // Set default domain from user email
    if (user?.email && !domain) {
      setDomain(user.email.split('@')[1]);
    }
  }, [user, currentOrg, isPlatformAdmin, orgLoading, navigate, domain]);

  const handleCreateOrg = async () => {
    if (!user?.email || !orgName.trim() || !domain.trim()) {
      toast.error("Please enter an organization name and domain");
      return;
    }

    setLoading(true);
    
    const { error } = await createOrganisation(orgName.trim(), domain.trim());
    
    if (error) {
      toast.error(`Failed to create organization: ${error}`);
      setLoading(false);
    } else {
      toast.success("Organization created successfully!");
      navigate("/dashboard");
    }
  };

  if (orgLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // If not platform admin, show contact admin message
  if (!isPlatformAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Organization Required</CardTitle>
            <CardDescription>
              You need to be assigned to an organization to continue
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                You're not currently assigned to an organization. If you just signed up with a BladePile email (@bladepile.com.au), 
                click "Check Again" below - you may have already been auto-assigned!
              </AlertDescription>
            </Alert>

            <Button 
              onClick={checkForOrg}
              className="w-full"
              disabled={checking}
            >
              {checking ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Checking...
                </>
              ) : (
                'Check Again'
              )}
            </Button>

            <Button 
              onClick={signOut}
              variant="outline"
              className="w-full"
            >
              Sign Out
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Platform admin can create new organizations
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Create Organization</CardTitle>
          <CardDescription>
            Create a new organization (Platform Admin Only)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription>
              <strong>Platform Admin Mode:</strong> You can create an organization with any domain.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="orgName">Organization Name</Label>
            <Input
              id="orgName"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="Acme Corporation"
              disabled={loading}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="domain">Domain</Label>
            <Input
              id="domain"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="company.com"
              disabled={loading || !isPlatformAdmin}
              className={!isPlatformAdmin ? "bg-muted" : ""}
            />
            <p className="text-xs text-muted-foreground">
              {isPlatformAdmin 
                ? "As a platform admin, you can set any domain" 
                : "This will be your organization's primary domain"}
            </p>
          </div>

          <Button 
            onClick={handleCreateOrg} 
            disabled={loading || !orgName.trim() || !domain.trim()}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Organization'
            )}
          </Button>

          <Button 
            onClick={signOut}
            variant="ghost"
            className="w-full"
          >
            Sign Out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default CreateOrganization;
