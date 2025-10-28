import { DashboardSidebar } from "@/components/DashboardSidebar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const Settings = () => {
  return (
    <div className="flex min-h-screen w-full">
      <DashboardSidebar />

      <main className="flex-1 p-8">
        <div className="max-w-2xl">
          <h1 className="text-3xl font-bold mb-2">Account Settings</h1>
          <p className="text-muted-foreground mb-8">Manage your account preferences</p>

          <div className="space-y-6">
            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-4">Profile Information</h2>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Full Name</Label>
                  <Input id="name" defaultValue="David Johnson" className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="email">Work Email</Label>
                  <Input
                    id="email"
                    type="email"
                    defaultValue="david@construction-inc.com"
                    className="mt-1"
                    disabled
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Email cannot be changed
                  </p>
                </div>
                <div>
                  <Label htmlFor="company">Organization</Label>
                  <Input
                    id="company"
                    defaultValue="Construction Inc."
                    className="mt-1"
                    disabled
                  />
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-4">Security</h2>
              <Button variant="outline">Change Password</Button>
            </Card>

            <div className="flex gap-3">
              <Button>Save Changes</Button>
              <Button variant="outline">Cancel</Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Settings;
