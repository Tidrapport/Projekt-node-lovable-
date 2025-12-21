import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/api/client";
import { login, getMe, logout } from "@/api/auth";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { Mail, ArrowLeft, CheckCircle } from "lucide-react";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim()) {
      toast.error("Ange din e-postadress");
      return;
    }

    setLoading(true);
    try {
      await apiFetch("/auth/forgot-password", {
        method: "POST",
        json: { email: email.trim(), redirectTo: `${window.location.origin}/reset-password` },
      });

      setEmailSent(true);
      toast.success("Återställningslänk skickad!");
    } catch (error: any) {
      console.error("Error sending reset email:", error);
      toast.error(error.message || "Kunde inte skicka återställningslänk");
    } finally {
      setLoading(false);
    }
  };

  if (emailSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center space-y-2">
            <CheckCircle className="h-16 w-16 mx-auto text-green-500" />
            <h1 className="text-3xl font-bold font-heading">E-post skickad</h1>
            <p className="text-muted-foreground">
              Kontrollera din inkorg för återställningslänken
            </p>
          </div>

          <Card className="shadow-elevated">
            <CardContent className="pt-6">
              <div className="space-y-4 text-center">
                <p className="text-sm text-muted-foreground">
                  Vi har skickat ett e-postmeddelande till <span className="font-medium">{email}</span> med en länk för att återställa ditt lösenord.
                </p>
                <p className="text-sm text-muted-foreground">
                  Om du inte får e-postmeddelandet inom några minuter, kontrollera din skräppost.
                </p>
                <Link to="/auth">
                  <Button variant="outline" className="w-full mt-4">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Tillbaka till inloggning
                  </Button>
                </Link>
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
          <Mail className="h-16 w-16 mx-auto text-primary" />
          <h1 className="text-3xl font-bold font-heading">Glömt lösenord?</h1>
          <p className="text-muted-foreground">
            Ange din e-postadress så skickar vi en återställningslänk
          </p>
        </div>

        <Card className="shadow-elevated">
          <CardHeader>
            <CardTitle>Återställ lösenord</CardTitle>
            <CardDescription>
              Ange e-postadressen kopplad till ditt konto
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-post</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="din@epost.se"
                  required
                  disabled={loading}
                />
              </div>
              
              <Button type="submit" className="w-full bg-gradient-primary" disabled={loading}>
                {loading ? "Skickar..." : "Skicka återställningslänk"}
              </Button>
              
              <Link to="/auth">
                <Button type="button" variant="ghost" className="w-full">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Tillbaka till inloggning
                </Button>
              </Link>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ForgotPassword;
