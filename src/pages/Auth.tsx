import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Loader2, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { features } from "@/config/features";

const Auth = () => {
  const [mode, setMode] = useState<"login" | "signup" | "reset">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      // In org mode, redirect to onboarding to check org membership
      if (features.orgEnabled) {
        navigate("/onboarding");
      } else {
        navigate("/dashboard");
      }
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === "reset") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth`,
        });
        
        if (error) {
          toast.error(error.message);
        } else {
          toast.success("Password reset email sent! Check your inbox.");
          setMode("login");
        }
      } else {
        const { error } = mode === "login" 
          ? await signIn(email, password)
          : await signUp(email, password);

        if (error) {
          toast.error(error.message);
        } else {
          toast.success(mode === "login" ? "Welcome back!" : "Account created successfully!");
          // Navigation handled by useEffect watching user state
        }
      }
    } catch (error) {
      toast.error("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Card className="w-full max-w-md p-8 shadow-lg">
        {/* Logo & Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary mb-2">BladeMark</h1>
          <p className="text-sm text-muted-foreground">Web Edition</p>
        </div>

        {/* Auth Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {features.orgEnabled && mode === "signup" && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Use your company email. You'll be added to your organization or can create a new one.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Work Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="david@construction-inc.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          {mode !== "reset" && (
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                minLength={6}
              />
            </div>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === "reset" ? "Send Reset Email" : mode === "login" ? "Log In" : "Sign Up"}
          </Button>
        </form>

        {/* Secondary Actions */}
        <div className="mt-6 space-y-3">
          <div className="text-center text-sm">
            <button
              type="button"
              onClick={() => setMode(mode === "login" ? "signup" : "login")}
              className="text-primary hover:underline"
              disabled={loading}
            >
              {mode === "login" 
                ? "Don't have an account? Sign up"
                : "Already have an account? Log in"}
            </button>
          </div>
          {mode === "login" && (
            <div className="text-center text-sm">
              <button
                type="button"
                onClick={() => setMode("reset")}
                className="text-muted-foreground hover:text-primary hover:underline"
                disabled={loading}
              >
                Forgot password?
              </button>
            </div>
          )}
          {mode === "reset" && (
            <div className="text-center text-sm">
              <button
                type="button"
                onClick={() => setMode("login")}
                className="text-muted-foreground hover:text-primary hover:underline"
                disabled={loading}
              >
                Back to login
              </button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default Auth;
