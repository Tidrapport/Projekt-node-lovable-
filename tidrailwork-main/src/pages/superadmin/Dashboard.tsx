import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiFetch } from "@/api/client";
import { login, getMe, logout } from "@/api/auth";
import { toast } from "sonner";
import { Building2, Users, Copy, Eye, Plus, Trash2, CreditCard, Settings, ExternalLink } from "lucide-react";

type SubscriptionPlan = 'free' | 'core' | 'pro' | 'enterprise';

interface Company {
  id: string;
  name: string;
  slug: string;
  company_code: string;
  created_at: string;
  user_count?: number;
  subscription_plan: SubscriptionPlan;
  billing_email: string | null;
  monthly_price_per_user: number | null;
  billing_start_date: string | null;
}

interface CompanyUser {
  id: string;
  full_name: string;
  email?: string;
  role: string;
  created_at: string;
}

const PLAN_PRICES: Record<SubscriptionPlan, number> = {
  free: 0,
  core: 99,
  pro: 199,
  enterprise: 399
};

const PLAN_LABELS: Record<SubscriptionPlan, string> = {
  free: 'Gratis',
  core: 'Core',
  pro: 'Pro',
  enterprise: 'Enterprise'
};

const SuperAdminDashboard = () => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [companyUsers, setCompanyUsers] = useState<CompanyUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [showNewCompanyDialog, setShowNewCompanyDialog] = useState(false);
  const [showSubscriptionDialog, setShowSubscriptionDialog] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [newCompanySlug, setNewCompanySlug] = useState("");
  const [newCompanyPlan, setNewCompanyPlan] = useState<SubscriptionPlan>("core");
  const [newCompanyBillingEmail, setNewCompanyBillingEmail] = useState("");
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    try {
      const companiesData = await apiFetch(`/companies?order=created_at`);

      // Get user counts for each company
      const companiesWithCounts = await Promise.all(
        (companiesData || []).map(async (company: any) => {
          const profiles = await apiFetch(`/profiles?company_id=${company.id}`);
          const count = profiles ? profiles.length : 0;
          return {
            ...company,
            user_count: count || 0,
            subscription_plan: company.subscription_plan as SubscriptionPlan,
          };
        })
      );

      setCompanies(companiesWithCounts);
    } catch (error) {
      console.error('Error fetching companies:', error);
      toast.error('Kunde inte hämta företag');
    } finally {
      setLoading(false);
    }
  };

  const fetchCompanyUsers = async (company: Company) => {
    setSelectedCompany(company);
    setLoadingUsers(true);
    
    try {
      const profiles = await apiFetch(`/profiles?company_id=${company.id}`);
      const usersWithRoles = await Promise.all((profiles || []).map(async (profile: any) => {
        const roleData = await apiFetch(`/user-roles?user_id=${profile.id}`);
        const roles = (roleData || []).map((r: any) => r.role).join(', ') || 'user';
        return { ...profile, role: roles, email: '' };
      }));

      setCompanyUsers(usersWithRoles);
    } catch (error) {
      console.error('Error fetching company users:', error);
      toast.error('Kunde inte hämta användare');
    } finally {
      setLoadingUsers(false);
    }
  };

  const copyCompanyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Företagskod kopierad!');
  };

  const createCompany = async () => {
    if (!newCompanyName.trim() || !newCompanySlug.trim()) {
      toast.error('Fyll i alla fält');
      return;
    }

    setCreating(true);
    try {
      // Ask backend to create a company (backend can generate company_code)
      await apiFetch('/companies', {
        method: 'POST',
        json: {
          name: newCompanyName,
          slug: newCompanySlug.toLowerCase().replace(/\s+/g, '-'),
          subscription_plan: newCompanyPlan,
          billing_email: newCompanyBillingEmail || null,
          monthly_price_per_user: PLAN_PRICES[newCompanyPlan],
          billing_start_date: new Date().toISOString().split('T')[0]
        }
      });

      toast.success('Företag skapat!');
      setShowNewCompanyDialog(false);
      setNewCompanyName("");
      setNewCompanySlug("");
      setNewCompanyPlan("core");
      setNewCompanyBillingEmail("");
      fetchCompanies();
    } catch (error: any) {
      console.error('Error creating company:', error);
      toast.error(error.message || 'Kunde inte skapa företag');
    } finally {
      setCreating(false);
    }
  };

  const openSubscriptionDialog = (company: Company) => {
    setEditingCompany(company);
    setShowSubscriptionDialog(true);
  };

  const updateSubscription = async () => {
    if (!editingCompany) return;

    setSaving(true);
    try {
      await apiFetch(`/companies/${editingCompany.id}`, {
        method: 'PUT',
        json: {
          subscription_plan: editingCompany.subscription_plan,
          billing_email: editingCompany.billing_email,
          monthly_price_per_user: PLAN_PRICES[editingCompany.subscription_plan]
        }
      });

      toast.success('Prenumeration uppdaterad!');
      setShowSubscriptionDialog(false);
      setEditingCompany(null);
      fetchCompanies();
    } catch (error: any) {
      console.error('Error updating subscription:', error);
      toast.error(error.message || 'Kunde inte uppdatera prenumeration');
    } finally {
      setSaving(false);
    }
  };

  const deleteCompany = async (companyId: string, companyName: string) => {
    if (!confirm(`Är du säker på att du vill ta bort ${companyName}? Detta går inte att ångra.`)) {
      return;
    }

    try {
      await apiFetch(`/companies/${companyId}`, { method: 'DELETE' });

      toast.success('Företag borttaget');
      fetchCompanies();
      if (selectedCompany?.id === companyId) {
        setSelectedCompany(null);
        setCompanyUsers([]);
      }
    } catch (error: any) {
      console.error('Error deleting company:', error);
      toast.error(error.message || 'Kunde inte ta bort företag');
    }
  };

  const calculateMonthlyRevenue = () => {
    return companies.reduce((sum, c) => {
      const price = PLAN_PRICES[c.subscription_plan] || 0;
      return sum + (price * (c.user_count || 0));
    }, 0);
  };

  const getPlanBadgeVariant = (plan: SubscriptionPlan) => {
    switch (plan) {
      case 'enterprise': return 'default';
      case 'pro': return 'default';
      case 'core': return 'secondary';
      default: return 'outline';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Super Admin</h1>
        <p className="text-muted-foreground">Hantera alla företag, prenumerationer och fakturering</p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            onClick={() => window.open('https://adminhub.lovable.app', '_blank')}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            AdminHub
          </Button>
          <Dialog open={showNewCompanyDialog} onOpenChange={setShowNewCompanyDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nytt företag
              </Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Skapa nytt företag</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Företagsnamn</Label>
                <Input 
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  placeholder="Företag AB"
                />
              </div>
              <div className="space-y-2">
                <Label>Slug (URL-vänligt namn)</Label>
                <Input 
                  value={newCompanySlug}
                  onChange={(e) => setNewCompanySlug(e.target.value)}
                  placeholder="foretag-ab"
                />
              </div>
              <div className="space-y-2">
                <Label>Prenumerationsplan</Label>
                <Select value={newCompanyPlan} onValueChange={(v) => setNewCompanyPlan(v as SubscriptionPlan)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Gratis (0 kr/användare)</SelectItem>
                    <SelectItem value="core">Core (99 kr/användare)</SelectItem>
                    <SelectItem value="pro">Pro (199 kr/användare)</SelectItem>
                    <SelectItem value="enterprise">Enterprise (399 kr/användare)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Faktura-email</Label>
                <Input 
                  type="email"
                  value={newCompanyBillingEmail}
                  onChange={(e) => setNewCompanyBillingEmail(e.target.value)}
                  placeholder="faktura@foretag.se"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowNewCompanyDialog(false)}>
                Avbryt
              </Button>
              <Button onClick={createCompany} disabled={creating}>
                {creating ? 'Skapar...' : 'Skapa företag'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Totalt antal företag
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              <span className="text-2xl font-bold">{companies.length}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Totalt antal användare
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <span className="text-2xl font-bold">
                {companies.reduce((sum, c) => sum + (c.user_count || 0), 0)}
              </span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Månatlig intäkt
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-green-500" />
              <span className="text-2xl font-bold">{calculateMonthlyRevenue().toLocaleString('sv-SE')} kr</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Betalande företag
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-green-500" />
              <span className="text-2xl font-bold">
                {companies.filter(c => c.subscription_plan !== 'free').length}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Companies List */}
      <Card>
        <CardHeader>
          <CardTitle>Alla företag</CardTitle>
          <CardDescription>Hantera företag, prenumerationer och användare</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Företag</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Användare</TableHead>
                <TableHead>Månadsintäkt</TableHead>
                <TableHead>Företagskod</TableHead>
                <TableHead>Skapat</TableHead>
                <TableHead>Åtgärder</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {companies.map((company) => (
                <TableRow 
                  key={company.id}
                  className={selectedCompany?.id === company.id ? 'bg-muted' : ''}
                >
                  <TableCell className="font-medium">
                    <div>
                      {company.name}
                      {company.billing_email && (
                        <p className="text-xs text-muted-foreground">{company.billing_email}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getPlanBadgeVariant(company.subscription_plan)}>
                      {PLAN_LABELS[company.subscription_plan]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{company.user_count || 0}</Badge>
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">
                      {((company.user_count || 0) * PLAN_PRICES[company.subscription_plan]).toLocaleString('sv-SE')} kr
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <code className="bg-muted px-2 py-1 rounded text-sm">
                        {company.company_code}
                      </code>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => copyCompanyCode(company.company_code)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>
                    {new Date(company.created_at).toLocaleDateString('sv-SE')}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => fetchCompanyUsers(company)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Visa
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => openSubscriptionDialog(company)}
                      >
                        <Settings className="h-4 w-4 mr-1" />
                        Plan
                      </Button>
                      <Button 
                        variant="destructive" 
                        size="icon"
                        onClick={() => deleteCompany(company.id, company.name)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Subscription Dialog */}
      <Dialog open={showSubscriptionDialog} onOpenChange={setShowSubscriptionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hantera prenumeration - {editingCompany?.name}</DialogTitle>
          </DialogHeader>
          {editingCompany && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Prenumerationsplan</Label>
                <Select 
                  value={editingCompany.subscription_plan} 
                  onValueChange={(v) => setEditingCompany({...editingCompany, subscription_plan: v as SubscriptionPlan})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Gratis (0 kr/användare)</SelectItem>
                    <SelectItem value="core">Core (99 kr/användare)</SelectItem>
                    <SelectItem value="pro">Pro (199 kr/användare)</SelectItem>
                    <SelectItem value="enterprise">Enterprise (399 kr/användare)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Faktura-email</Label>
                <Input 
                  type="email"
                  value={editingCompany.billing_email || ''}
                  onChange={(e) => setEditingCompany({...editingCompany, billing_email: e.target.value})}
                  placeholder="faktura@foretag.se"
                />
              </div>
              <div className="bg-muted p-4 rounded-lg">
                <p className="text-sm font-medium">Beräknad månatlig kostnad</p>
                <p className="text-2xl font-bold">
                  {((editingCompany.user_count || 0) * PLAN_PRICES[editingCompany.subscription_plan]).toLocaleString('sv-SE')} kr
                </p>
                <p className="text-xs text-muted-foreground">
                  {editingCompany.user_count || 0} användare × {PLAN_PRICES[editingCompany.subscription_plan]} kr
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSubscriptionDialog(false)}>
              Avbryt
            </Button>
            <Button onClick={updateSubscription} disabled={saving}>
              {saving ? 'Sparar...' : 'Spara'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Company Users */}
      {selectedCompany && (
        <Card>
          <CardHeader>
            <CardTitle>Användare i {selectedCompany.name}</CardTitle>
            <CardDescription>
              Plan: <Badge variant={getPlanBadgeVariant(selectedCompany.subscription_plan)}>{PLAN_LABELS[selectedCompany.subscription_plan]}</Badge>
              {' '} • Företagskod: <code className="bg-muted px-2 py-1 rounded">{selectedCompany.company_code}</code>
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingUsers ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin h-6 w-6 border-4 border-primary border-t-transparent rounded-full" />
              </div>
            ) : companyUsers.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                Inga användare i detta företag
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Namn</TableHead>
                    <TableHead>Roll</TableHead>
                    <TableHead>Registrerad</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {companyUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.full_name}</TableCell>
                      <TableCell>
                        <Badge variant={user.role.includes('admin') ? 'default' : 'secondary'}>
                          {user.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(user.created_at).toLocaleDateString('sv-SE')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SuperAdminDashboard;