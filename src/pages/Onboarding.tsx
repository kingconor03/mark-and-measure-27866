import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useOrganisation } from "@/hooks/useOrganisation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

const Onboarding = () => {
  const { user } = useAuth();
  const { findOrganisationByDomain, addMemberToOrg, createOrganisation, refetch } = useOrganisation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [matchedOrg, setMatchedOrg] = useState<any>(null);
  const [needsApproval, setNeedsApproval] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }

    checkUserOrganisation();
  }, [user]);

  const checkUserOrganisation = async () => {
    if (!user?.email) return;

    try {
      const org = await findOrganisationByDomain(user.email);
      
      if (org) {
        // Found matching org - add user as viewer pending approval
        setMatchedOrg(org);
        const { error } = await addMemberToOrg(org.id, user.id, 'viewer');
        
        if (error) {
          toast.error("Error joining organization");
        } else {
          setNeedsApproval(true);
          toast.success(`Added to ${org.name} as Viewer. Contact an admin to upgrade your role.`);
          // Refetch and redirect after brief delay
          setTimeout(() => {
            refetch();
            navigate("/dashboard");
          }, 2000);
        }
      }
    } catch (error) {
      console.error("Error checking organisation:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrg = async () => {
    if (!user?.email || !orgName.trim()) {
      toast.error("Please enter an organization name");
      return;
    }

    setCreating(true);
    const domain = user.email.split('@')[1];
    
    const { error } = await createOrganisation(orgName.trim(), domain);
    
    if (error) {
      toast.error(`Failed to create organization: ${error}`);
      setCreating(false);
    } else {
      toast.success("Organization created successfully!");
      navigate("/dashboard");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (needsApproval) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Pending Approval</CardTitle>
            <CardDescription>
              You've been added to {matchedOrg?.name} as a Viewer
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Your account has been created and linked to your organization. 
              Contact an administrator to upgrade your permissions.
            </p>
            <Button onClick={() => navigate("/dashboard")} className="w-full">
              Continue to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Create Your Organization</CardTitle>
          <CardDescription>
            No organization found for your domain. Create one to get started.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="orgName">Organization Name</Label>
            <Input
              id="orgName"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="Acme Corporation"
              disabled={creating}
            />
          </div>
          
          <div className="space-y-2">
            <Label>Your Domain</Label>
            <Input
              value={user?.email?.split('@')[1] || ''}
              disabled
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground">
              This will be your organization's primary domain
            </p>
          </div>

          <Button 
            onClick={handleCreateOrg} 
            disabled={creating || !orgName.trim()}
            className="w-full"
          >
            {creating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Organization'
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Onboarding;
