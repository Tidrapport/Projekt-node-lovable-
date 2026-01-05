import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/api/client";
import { ensureArray } from "@/lib/ensureArray";
import { useAuth } from "@/contexts/AuthContext";
import { Users, Phone, Mail, Search, Crown } from "lucide-react";

interface Contact {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  role?: string | null;
  employee_type: 'anställd' | 'platschef' | 'inhyrd' | 'arbetsledare' | null;
  isAdmin: boolean;
}

const EMPLOYEE_TYPE_LABELS: Record<string, string> = {
  'anställd': 'Anställd',
  'platschef': 'Platschef',
  'inhyrd': 'Inhyrd',
  'arbetsledare': 'Arbetsledare',
};

const Contacts = () => {
  const { companyId } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (!companyId) return;
    fetchContacts();
  }, [companyId]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchContacts = async () => {
    setLoading(true);
    try {
      const profiles = await apiFetch(`/contacts${companyId ? `?company_id=${companyId}` : ""}`);
      const contactsWithRoles = ensureArray(profiles).map((profile: any) => {
        const role = (profile.role || "").toLowerCase();
        const isAdmin = role === "admin" || role === "super_admin";
        return { ...profile, isAdmin };
      });
      setContacts(contactsWithRoles || []);
    } catch (error) {
      console.error("Error fetching contacts:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredContacts = contacts.filter(contact =>
    (contact.full_name || contact.email || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.phone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getDisplayName = (contact: Contact) => {
    const name = (contact.full_name || "").trim();
    if (name) return name;
    const email = (contact.email || "").trim();
    if (email) return email;
    return "Okänd";
  };

  const getEmployeeTypeBadgeVariant = (type: string | null) => {
    switch (type) {
      case 'platschef':
        return 'default';
      case 'inhyrd':
        return 'secondary';
      case 'arbetsledare':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h2 className="text-3xl font-bold font-heading flex items-center gap-2">
          <Users className="h-8 w-8" />
          Kontaktlista
        </h2>
        <p className="text-muted-foreground">Kollegor på ditt företag</p>
      </div>

      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Sök på namn, telefon eller e-post..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {filteredContacts.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>{searchTerm ? "Inga kontakter matchade din sökning" : "Inga kontakter ännu"}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredContacts.map((contact) => (
            <Card key={contact.id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-lg font-semibold text-primary">
                      {getDisplayName(contact).charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-semibold truncate">{getDisplayName(contact)}</h3>
                      {contact.isAdmin && (
                        <Badge variant="default" className="bg-amber-500 hover:bg-amber-600">
                          <Crown className="h-3 w-3 mr-1" />
                          Chef
                        </Badge>
                      )}
                      <Badge variant={getEmployeeTypeBadgeVariant(contact.employee_type)}>
                        {EMPLOYEE_TYPE_LABELS[contact.employee_type || 'anställd'] || 'Anställd'}
                      </Badge>
                    </div>

                    <div className="text-sm text-muted-foreground flex items-center gap-2 mt-2">
                      <Phone className="h-4 w-4" />
                      {contact.phone ? (
                        <a href={`tel:${contact.phone}`} className="hover:text-primary">
                          {contact.phone}
                        </a>
                      ) : (
                        <span>Saknas</span>
                      )}
                    </div>

                    <div className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                      <Mail className="h-4 w-4" />
                      {contact.email ? (
                        <a href={`mailto:${contact.email}`} className="hover:text-primary">
                          {contact.email}
                        </a>
                      ) : (
                        <span>Saknas</span>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Contacts;
