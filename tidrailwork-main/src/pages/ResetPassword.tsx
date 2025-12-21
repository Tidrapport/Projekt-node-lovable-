import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/api/client";
import { login, getMe, logout } from "@/api/auth";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { KeyRound, Eye, EyeOff, CheckCircle } from "lucide-react";

const ResetPassword = () => {
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isValidSession, setIsValidSession] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    // Check if there's a valid recovery session
    const checkSession = async () => {
      // Supabase used to put a recovery access token in the URL hash.
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get("access_token");
      const type = hashParams.get("type");

      if (type === "recovery" && accessToken) {
        // Persist token for subsequent calls to the backend
        localStorage.setItem("access_token", accessToken);
        setIsValidSession(true);
      } else {
        // Fallback: check localStorage for an existing token
        const token = localStorage.getItem("access_token");
        if (token) setIsValidSession(true);
      }

      setCheckingSession(false);
    };

    checkSession();
  }, []);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newPassword.trim() || !confirmPassword.trim()) {
      toast.error("Fyll i alla fält");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Lösenorden matchar inte");
      return;
    }

    if (newPassword.length < 6) {
      toast.error("Lösenordet måste vara minst 6 tecken");
      return;
    }

    setLoading(true);
    try {
      // Call backend to update the user's password
      await apiFetch("/auth/me", { method: "PUT", json: { password: newPassword } });

      setSuccess(true);
      toast.success("Lösenordet har återställts!");

      // Sign out and redirect to login after a delay
      setTimeout(async () => {
        await logout();
        navigate("/auth");
      }, 2000);
    } catch (error: any) {
      console.error("Error resetting password:", error);
      toast.error(error.message || "Kunde inte återställa lösenordet");
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center space-y-2">
            <KeyRound className="h-16 w-16 mx-auto text-primary" />
            <h1 className="text-3xl font-bold font-heading">Återställ lösenord</h1>
            <p className="text-muted-foreground">Kontrollerar session...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isValidSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center space-y-2">
            <KeyRound className="h-16 w-16 mx-auto text-destructive" />
            <h1 className="text-3xl font-bold font-heading">Ogiltig länk</h1>
            <p className="text-muted-foreground">
              Återställningslänken är ogiltig eller har gått ut
            </p>
          </div>

          <Card className="shadow-elevated">
            <CardContent className="pt-6">
              <div className="space-y-4 text-center">
                <p className="text-sm text-muted-foreground">
                  Vänligen begär en ny återställningslänk för att återställa ditt lösenord.
                </p>
                <Button 
                  onClick={() => navigate("/forgot-password")} 
                  className="w-full bg-gradient-primary"
                >
                  Begär ny länk
                </Button>
                <Button 
                  onClick={() => navigate("/auth")} 
                  variant="ghost" 
                  className="w-full"
                >
                  Tillbaka till inloggning
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center space-y-2">
            <CheckCircle className="h-16 w-16 mx-auto text-green-500" />
            <h1 className="text-3xl font-bold font-heading">Lösenord återställt</h1>
            <p className="text-muted-foreground">
              Du kan nu logga in med ditt nya lösenord
            </p>
          </div>

          <Card className="shadow-elevated">
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">
                  Du omdirigeras automatiskt till inloggningssidan...
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <KeyRound className="h-16 w-16 mx-auto text-primary" />
          <h1 className="text-3xl font-bold font-heading">Nytt lösenord</h1>
          <p className="text-muted-foreground">
            Ange ditt nya lösenord nedan
          </p>
        </div>

        <Card className="shadow-elevated">
          <CardHeader>
            <CardTitle>Återställ lösenord</CardTitle>
            <CardDescription>
              Välj ett nytt lösenord för ditt konto
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">Nytt lösenord</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minst 6 tecken"
                    required
                    disabled={loading}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Bekräfta lösenord</Label>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Ange samma lösenord igen"
                    required
                    disabled={loading}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              
              <Button type="submit" className="w-full bg-gradient-primary" disabled={loading}>
                {loading ? "Sparar..." : "Spara nytt lösenord"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ResetPassword;
