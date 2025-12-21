import { useState, useEffect } from "react";
import { apiFetch } from "@/api/client";
import { login, getMe, logout } from "@/api/auth";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Edit, Trash2, FileText, Eye, Building2, Download } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { sv } from "date-fns/locale";
import { generateOfferPDF } from "@/lib/offerPdf";

interface Customer {
  id: string;
  name: string;
  org_number: string | null;
  address: string | null;
  postal_code: string | null;
  city: string | null;
  contact_person: string | null;
  contact_email: string | null;
  contact_phone: string | null;
}

interface Offer {
  id: string;
  offer_number: string;
  title: string;
  description: string | null;
  status: string;
  valid_until: string | null;
  pricing_type: string;
  fixed_price: number | null;
  hourly_rate_day: number | null;
  hourly_rate_evening: number | null;
  hourly_rate_night: number | null;
  hourly_rate_weekend: number | null;
  travel_rate_per_km: number | null;
  per_diem_full: number | null;
  per_diem_half: number | null;
  estimated_hours: number | null;
  terms: string | null;
  notes: string | null;
  created_at: string;
  customer_id: string | null;
  customer?: Customer;
  include_vat: boolean;
}

const statusColors: Record<string, string> = {
  draft: "bg-gray-500",
  sent: "bg-blue-500",
  accepted: "bg-green-500",
  rejected: "bg-red-500",
  expired: "bg-yellow-500",
};

const statusLabels: Record<string, string> = {
  draft: "Utkast",
  sent: "Skickad",
  accepted: "Accepterad",
  rejected: "Avvisad",
  expired: "Utgången",
};

export default function AdminOffers() {
  const { user, companyId } = useAuth();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [company, setCompany] = useState<{ name: string; org_number: string | null; logo_url: string | null; billing_email: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);
  const [editingOffer, setEditingOffer] = useState<Offer | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    customer_id: "",
    title: "",
    description: "",
    valid_until: "",
    pricing_type: "hourly",
    fixed_price: "",
    hourly_rate_day: "",
    hourly_rate_evening: "",
    hourly_rate_night: "",
    hourly_rate_weekend: "",
    travel_rate_per_km: "",
    per_diem_full: "290",
    per_diem_half: "145",
    estimated_hours: "",
    terms: "",
    notes: "",
    include_vat: true,
  });

  // Customer form state
  const [customerFormData, setCustomerFormData] = useState({
    name: "",
    org_number: "",
    address: "",
    postal_code: "",
    city: "",
    contact_person: "",
    contact_email: "",
    contact_phone: "",
  });

  useEffect(() => {
    fetchData();
  }, [companyId]);

  const fetchData = async () => {
    if (!companyId) return;

    setLoading(true);

    // Fetch offers
    const { data: offersData, error: offersError } = await supabase
      .from("offers")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });

    if (offersError) {
      console.error("Error fetching offers:", offersError);
      toast.error("Kunde inte hämta offerter");
    } else {
      setOffers(offersData || []);
    }

    // Fetch customers
    const { data: customersData, error: customersError } = await supabase
      .from("customers")
      .select("*")
      .eq("company_id", companyId)
      .order("name");

    if (customersError) {
      console.error("Error fetching customers:", customersError);
    } else {
      setCustomers(customersData || []);
    }

    // Fetch company info
    const { data: companyData, error: companyError } = await supabase
      .from("companies")
      .select("name, org_number, logo_url, billing_email")
      .eq("id", companyId)
      .single();

    if (companyError) {
      console.error("Error fetching company:", companyError);
    } else {
      setCompany(companyData);
    }

    setLoading(false);
  };

  const resetForm = () => {
    setFormData({
      customer_id: "",
      title: "",
      description: "",
      valid_until: "",
      pricing_type: "hourly",
      fixed_price: "",
      hourly_rate_day: "",
      hourly_rate_evening: "",
      hourly_rate_night: "",
      hourly_rate_weekend: "",
      travel_rate_per_km: "",
      per_diem_full: "290",
      per_diem_half: "145",
      estimated_hours: "",
      terms: "",
      notes: "",
      include_vat: true,
    });
    setEditingOffer(null);
  };

  const openEditDialog = (offer: Offer) => {
    setEditingOffer(offer);
    setFormData({
      customer_id: offer.customer_id || "",
      title: offer.title,
      description: offer.description || "",
      valid_until: offer.valid_until || "",
      pricing_type: offer.pricing_type,
      fixed_price: offer.fixed_price?.toString() || "",
      hourly_rate_day: offer.hourly_rate_day?.toString() || "",
      hourly_rate_evening: offer.hourly_rate_evening?.toString() || "",
      hourly_rate_night: offer.hourly_rate_night?.toString() || "",
      hourly_rate_weekend: offer.hourly_rate_weekend?.toString() || "",
      travel_rate_per_km: offer.travel_rate_per_km?.toString() || "",
      per_diem_full: offer.per_diem_full?.toString() || "290",
      per_diem_half: offer.per_diem_half?.toString() || "145",
      estimated_hours: offer.estimated_hours?.toString() || "",
      terms: offer.terms || "",
      notes: offer.notes || "",
      include_vat: offer.include_vat,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!companyId || !user) return;

    try {
      if (editingOffer) {
        // Update existing offer
        const { error } = await supabase
          .from("offers")
          .update({
            customer_id: formData.customer_id || null,
            title: formData.title,
            description: formData.description || null,
            valid_until: formData.valid_until || null,
            pricing_type: formData.pricing_type,
            fixed_price: formData.fixed_price ? parseFloat(formData.fixed_price) : null,
            hourly_rate_day: formData.hourly_rate_day ? parseFloat(formData.hourly_rate_day) : null,
            hourly_rate_evening: formData.hourly_rate_evening ? parseFloat(formData.hourly_rate_evening) : null,
            hourly_rate_night: formData.hourly_rate_night ? parseFloat(formData.hourly_rate_night) : null,
            hourly_rate_weekend: formData.hourly_rate_weekend ? parseFloat(formData.hourly_rate_weekend) : null,
            travel_rate_per_km: formData.travel_rate_per_km ? parseFloat(formData.travel_rate_per_km) : null,
            per_diem_full: formData.per_diem_full ? parseFloat(formData.per_diem_full) : null,
            per_diem_half: formData.per_diem_half ? parseFloat(formData.per_diem_half) : null,
            estimated_hours: formData.estimated_hours ? parseFloat(formData.estimated_hours) : null,
            terms: formData.terms || null,
            notes: formData.notes || null,
            include_vat: formData.include_vat,
          })
          .eq("id", editingOffer.id);

        if (error) throw error;
        toast.success("Offert uppdaterad");
      } else {
        // Generate offer number
        const { data: offerNumber, error: numberError } = await supabase
          .rpc("generate_offer_number", { p_company_id: companyId });

        if (numberError) throw numberError;

        // Create new offer
        const { error } = await supabase.from("offers").insert({
          company_id: companyId,
          offer_number: offerNumber,
          customer_id: formData.customer_id || null,
          title: formData.title,
          description: formData.description || null,
          valid_until: formData.valid_until || null,
          pricing_type: formData.pricing_type,
          fixed_price: formData.fixed_price ? parseFloat(formData.fixed_price) : null,
          hourly_rate_day: formData.hourly_rate_day ? parseFloat(formData.hourly_rate_day) : null,
          hourly_rate_evening: formData.hourly_rate_evening ? parseFloat(formData.hourly_rate_evening) : null,
          hourly_rate_night: formData.hourly_rate_night ? parseFloat(formData.hourly_rate_night) : null,
          hourly_rate_weekend: formData.hourly_rate_weekend ? parseFloat(formData.hourly_rate_weekend) : null,
          travel_rate_per_km: formData.travel_rate_per_km ? parseFloat(formData.travel_rate_per_km) : null,
          per_diem_full: formData.per_diem_full ? parseFloat(formData.per_diem_full) : null,
          per_diem_half: formData.per_diem_half ? parseFloat(formData.per_diem_half) : null,
          estimated_hours: formData.estimated_hours ? parseFloat(formData.estimated_hours) : null,
          terms: formData.terms || null,
          notes: formData.notes || null,
          created_by: user.id,
          status: "draft",
          include_vat: formData.include_vat,
        });

        if (error) throw error;
        toast.success("Offert skapad");
      }

      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      console.error("Error saving offer:", error);
      toast.error("Kunde inte spara offert");
    }
  };

  const handleCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!companyId) return;

    try {
      const { data, error } = await supabase
        .from("customers")
        .insert({
          company_id: companyId,
          name: customerFormData.name,
          org_number: customerFormData.org_number || null,
          address: customerFormData.address || null,
          postal_code: customerFormData.postal_code || null,
          city: customerFormData.city || null,
          contact_person: customerFormData.contact_person || null,
          contact_email: customerFormData.contact_email || null,
          contact_phone: customerFormData.contact_phone || null,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success("Kund skapad");
      setCustomerDialogOpen(false);
      setCustomerFormData({
        name: "",
        org_number: "",
        address: "",
        postal_code: "",
        city: "",
        contact_person: "",
        contact_email: "",
        contact_phone: "",
      });
      
      // Add to customers list and select it
      setCustomers([...customers, data]);
      setFormData({ ...formData, customer_id: data.id });
    } catch (error: any) {
      console.error("Error creating customer:", error);
      toast.error("Kunde inte skapa kund");
    }
  };

  const updateOfferStatus = async (offerId: string, status: string) => {
    try {
      const { error } = await supabase
        .from("offers")
        .update({ status })
        .eq("id", offerId);

      if (error) throw error;
      toast.success(`Offert markerad som ${statusLabels[status]?.toLowerCase()}`);
      fetchData();
    } catch (error: any) {
      console.error("Error updating status:", error);
      toast.error("Kunde inte uppdatera status");
    }
  };

  const deleteOffer = async (offerId: string) => {
    if (!confirm("Är du säker på att du vill ta bort denna offert?")) return;

    try {
      const { error } = await supabase
        .from("offers")
        .delete()
        .eq("id", offerId);

      if (error) throw error;
      toast.success("Offert borttagen");
      fetchData();
    } catch (error: any) {
      console.error("Error deleting offer:", error);
      toast.error("Kunde inte ta bort offert");
    }
  };

  const getCustomerById = (id: string | null) => {
    if (!id) return null;
    return customers.find((c) => c.id === id);
  };

  const handleDownloadPDF = async (offer: Offer) => {
    if (!company) {
      toast.error("Företagsuppgifter saknas");
      return;
    }
    const customer = getCustomerById(offer.customer_id);
    try {
      await generateOfferPDF(offer, customer || null, company);
      toast.success("Offert nedladdad");
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Kunde inte generera PDF");
    }
  };

  const renderOfferTable = (status: string[]) => {
    const filteredOffers = offers.filter((o) => status.includes(o.status));

    if (filteredOffers.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          Inga offerter att visa
        </div>
      );
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Offertnr</TableHead>
            <TableHead>Titel</TableHead>
            <TableHead>Kund</TableHead>
            <TableHead>Giltig t.o.m.</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Skapad</TableHead>
            <TableHead className="text-right">Åtgärder</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredOffers.map((offer) => {
            const customer = getCustomerById(offer.customer_id);
            return (
              <TableRow key={offer.id}>
                <TableCell className="font-mono">{offer.offer_number}</TableCell>
                <TableCell className="font-medium">{offer.title}</TableCell>
                <TableCell>{customer?.name || "-"}</TableCell>
                <TableCell>
                  {offer.valid_until
                    ? format(new Date(offer.valid_until), "d MMM yyyy", { locale: sv })
                    : "-"}
                </TableCell>
                <TableCell>
                  <Badge className={statusColors[offer.status]}>
                    {statusLabels[offer.status]}
                  </Badge>
                </TableCell>
                <TableCell>
                  {format(new Date(offer.created_at), "d MMM yyyy", { locale: sv })}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setSelectedOffer(offer);
                        setViewDialogOpen(true);
                      }}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(offer)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteOffer(offer.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Offerter</h1>
          <p className="text-muted-foreground">Skapa och hantera kundofferter</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Ny offert
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingOffer ? "Redigera offert" : "Skapa ny offert"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Kund</Label>
                  <div className="flex gap-2">
                    <Select
                      value={formData.customer_id}
                      onValueChange={(value) =>
                        setFormData({ ...formData, customer_id: value })
                      }
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Välj kund..." />
                      </SelectTrigger>
                      <SelectContent>
                        {customers.map((customer) => (
                          <SelectItem key={customer.id} value={customer.id}>
                            {customer.name}
                            {customer.org_number && ` (${customer.org_number})`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Dialog open={customerDialogOpen} onOpenChange={setCustomerDialogOpen}>
                      <DialogTrigger asChild>
                        <Button type="button" variant="outline" size="icon">
                          <Plus className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Lägg till ny kund</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleCustomerSubmit} className="space-y-4">
                          <div className="space-y-2">
                            <Label>Företagsnamn *</Label>
                            <Input
                              required
                              value={customerFormData.name}
                              onChange={(e) =>
                                setCustomerFormData({
                                  ...customerFormData,
                                  name: e.target.value,
                                })
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Organisationsnummer</Label>
                            <Input
                              value={customerFormData.org_number}
                              onChange={(e) =>
                                setCustomerFormData({
                                  ...customerFormData,
                                  org_number: e.target.value,
                                })
                              }
                              placeholder="123456-7890"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Adress</Label>
                            <Input
                              value={customerFormData.address}
                              onChange={(e) =>
                                setCustomerFormData({
                                  ...customerFormData,
                                  address: e.target.value,
                                })
                              }
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-2">
                              <Label>Postnummer</Label>
                              <Input
                                value={customerFormData.postal_code}
                                onChange={(e) =>
                                  setCustomerFormData({
                                    ...customerFormData,
                                    postal_code: e.target.value,
                                  })
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Ort</Label>
                              <Input
                                value={customerFormData.city}
                                onChange={(e) =>
                                  setCustomerFormData({
                                    ...customerFormData,
                                    city: e.target.value,
                                  })
                                }
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label>Kontaktperson</Label>
                            <Input
                              value={customerFormData.contact_person}
                              onChange={(e) =>
                                setCustomerFormData({
                                  ...customerFormData,
                                  contact_person: e.target.value,
                                })
                              }
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-2">
                              <Label>E-post</Label>
                              <Input
                                type="email"
                                value={customerFormData.contact_email}
                                onChange={(e) =>
                                  setCustomerFormData({
                                    ...customerFormData,
                                    contact_email: e.target.value,
                                  })
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Telefon</Label>
                              <Input
                                value={customerFormData.contact_phone}
                                onChange={(e) =>
                                  setCustomerFormData({
                                    ...customerFormData,
                                    contact_phone: e.target.value,
                                  })
                                }
                              />
                            </div>
                          </div>
                          <div className="flex justify-end gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => setCustomerDialogOpen(false)}
                            >
                              Avbryt
                            </Button>
                            <Button type="submit">Spara kund</Button>
                          </div>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Giltig t.o.m.</Label>
                  <Input
                    type="date"
                    value={formData.valid_until}
                    onChange={(e) =>
                      setFormData({ ...formData, valid_until: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Titel *</Label>
                <Input
                  required
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  placeholder="t.ex. Spårarbete Sundsvall"
                />
              </div>

              <div className="space-y-2">
                <Label>Beskrivning</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Beskriv arbetet som ska utföras..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Pristyp</Label>
                <Select
                  value={formData.pricing_type}
                  onValueChange={(value) =>
                    setFormData({ ...formData, pricing_type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hourly">Timdebitering</SelectItem>
                    <SelectItem value="fixed">Fast pris</SelectItem>
                    <SelectItem value="both">Båda alternativen</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {(formData.pricing_type === "fixed" ||
                formData.pricing_type === "both") && (
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-base">Fast pris</CardTitle>
                  </CardHeader>
                  <CardContent className="py-2">
                    <div className="space-y-2">
                      <Label>Fast pris (SEK)</Label>
                      <Input
                        type="number"
                        value={formData.fixed_price}
                        onChange={(e) =>
                          setFormData({ ...formData, fixed_price: e.target.value })
                        }
                        placeholder="0"
                      />
                    </div>
                  </CardContent>
                </Card>
              )}

              {(formData.pricing_type === "hourly" ||
                formData.pricing_type === "both") && (
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-base">Timpriser per skifttyp</CardTitle>
                  </CardHeader>
                  <CardContent className="py-2 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Dag (SEK/tim)</Label>
                        <Input
                          type="number"
                          value={formData.hourly_rate_day}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              hourly_rate_day: e.target.value,
                            })
                          }
                          placeholder="0"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Kväll (SEK/tim)</Label>
                        <Input
                          type="number"
                          value={formData.hourly_rate_evening}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              hourly_rate_evening: e.target.value,
                            })
                          }
                          placeholder="0"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Natt (SEK/tim)</Label>
                        <Input
                          type="number"
                          value={formData.hourly_rate_night}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              hourly_rate_night: e.target.value,
                            })
                          }
                          placeholder="0"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Helg (SEK/tim)</Label>
                        <Input
                          type="number"
                          value={formData.hourly_rate_weekend}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              hourly_rate_weekend: e.target.value,
                            })
                          }
                          placeholder="0"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Uppskattat antal timmar</Label>
                      <Input
                        type="number"
                        value={formData.estimated_hours}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            estimated_hours: e.target.value,
                          })
                        }
                        placeholder="0"
                      />
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-base">Tilläggskostnader</CardTitle>
                </CardHeader>
                <CardContent className="py-2">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Reseersättning (SEK/km)</Label>
                      <Input
                        type="number"
                        value={formData.travel_rate_per_km}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            travel_rate_per_km: e.target.value,
                          })
                        }
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Hel traktamente (SEK)</Label>
                      <Input
                        type="number"
                        value={formData.per_diem_full}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            per_diem_full: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Halv traktamente (SEK)</Label>
                      <Input
                        type="number"
                        value={formData.per_diem_half}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            per_diem_half: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="include_vat"
                  checked={formData.include_vat}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, include_vat: checked === true })
                  }
                />
                <Label htmlFor="include_vat" className="cursor-pointer">
                  Lägg till 25% moms på offerten
                </Label>
              </div>

              <div className="space-y-2">
                <Label>Villkor</Label>
                <Textarea
                  value={formData.terms}
                  onChange={(e) =>
                    setFormData({ ...formData, terms: e.target.value })
                  }
                  placeholder="Betalningsvillkor, leveranstider etc..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Interna anteckningar</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                  placeholder="Interna noteringar (visas ej för kund)..."
                  rows={2}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setDialogOpen(false);
                    resetForm();
                  }}
                >
                  Avbryt
                </Button>
                <Button type="submit">
                  {editingOffer ? "Uppdatera" : "Skapa offert"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="draft" className="space-y-4">
        <TabsList>
          <TabsTrigger value="draft">Utkast</TabsTrigger>
          <TabsTrigger value="sent">Skickade</TabsTrigger>
          <TabsTrigger value="accepted">Accepterade</TabsTrigger>
          <TabsTrigger value="all">Alla</TabsTrigger>
        </TabsList>

        <TabsContent value="draft">
          <Card>
            <CardContent className="pt-6">
              {renderOfferTable(["draft"])}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sent">
          <Card>
            <CardContent className="pt-6">
              {renderOfferTable(["sent"])}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="accepted">
          <Card>
            <CardContent className="pt-6">
              {renderOfferTable(["accepted"])}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="all">
          <Card>
            <CardContent className="pt-6">
              {renderOfferTable(["draft", "sent", "accepted", "rejected", "expired"])}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* View Offer Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Offert {selectedOffer?.offer_number}
            </DialogTitle>
          </DialogHeader>
          {selectedOffer && (
            <div className="space-y-6">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-xl font-semibold">{selectedOffer.title}</h3>
                  {selectedOffer.description && (
                    <p className="text-muted-foreground mt-1">
                      {selectedOffer.description}
                    </p>
                  )}
                </div>
                <Badge className={statusColors[selectedOffer.status]}>
                  {statusLabels[selectedOffer.status]}
                </Badge>
              </div>

              {selectedOffer.customer_id && (
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Kund
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="py-2">
                    {(() => {
                      const customer = getCustomerById(selectedOffer.customer_id);
                      if (!customer) return <p>-</p>;
                      return (
                        <div className="space-y-1 text-sm">
                          <p className="font-medium">{customer.name}</p>
                          {customer.org_number && <p>Org.nr: {customer.org_number}</p>}
                          {customer.address && <p>{customer.address}</p>}
                          {(customer.postal_code || customer.city) && (
                            <p>
                              {customer.postal_code} {customer.city}
                            </p>
                          )}
                          {customer.contact_person && (
                            <p>Kontakt: {customer.contact_person}</p>
                          )}
                          {customer.contact_email && (
                            <p>E-post: {customer.contact_email}</p>
                          )}
                          {customer.contact_phone && (
                            <p>Tel: {customer.contact_phone}</p>
                          )}
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-base">Prissättning</CardTitle>
                </CardHeader>
                <CardContent className="py-2 space-y-3">
                  {(selectedOffer.pricing_type === "fixed" ||
                    selectedOffer.pricing_type === "both") &&
                    selectedOffer.fixed_price && (
                      <div>
                        <p className="text-sm text-muted-foreground">Fast pris</p>
                        <p className="font-semibold">
                          {selectedOffer.fixed_price.toLocaleString("sv-SE")} SEK
                        </p>
                      </div>
                    )}

                  {(selectedOffer.pricing_type === "hourly" ||
                    selectedOffer.pricing_type === "both") && (
                    <div className="grid grid-cols-2 gap-4">
                      {selectedOffer.hourly_rate_day && (
                        <div>
                          <p className="text-sm text-muted-foreground">Dag</p>
                          <p className="font-medium">
                            {selectedOffer.hourly_rate_day} SEK/tim
                          </p>
                        </div>
                      )}
                      {selectedOffer.hourly_rate_evening && (
                        <div>
                          <p className="text-sm text-muted-foreground">Kväll</p>
                          <p className="font-medium">
                            {selectedOffer.hourly_rate_evening} SEK/tim
                          </p>
                        </div>
                      )}
                      {selectedOffer.hourly_rate_night && (
                        <div>
                          <p className="text-sm text-muted-foreground">Natt</p>
                          <p className="font-medium">
                            {selectedOffer.hourly_rate_night} SEK/tim
                          </p>
                        </div>
                      )}
                      {selectedOffer.hourly_rate_weekend && (
                        <div>
                          <p className="text-sm text-muted-foreground">Helg</p>
                          <p className="font-medium">
                            {selectedOffer.hourly_rate_weekend} SEK/tim
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {selectedOffer.estimated_hours && (
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Uppskattat antal timmar
                      </p>
                      <p className="font-medium">{selectedOffer.estimated_hours} tim</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {(selectedOffer.travel_rate_per_km ||
                selectedOffer.per_diem_full ||
                selectedOffer.per_diem_half) && (
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-base">Tilläggskostnader</CardTitle>
                  </CardHeader>
                  <CardContent className="py-2">
                    <div className="grid grid-cols-3 gap-4">
                      {selectedOffer.travel_rate_per_km && (
                        <div>
                          <p className="text-sm text-muted-foreground">
                            Reseersättning
                          </p>
                          <p className="font-medium">
                            {selectedOffer.travel_rate_per_km} SEK/km
                          </p>
                        </div>
                      )}
                      {selectedOffer.per_diem_full && (
                        <div>
                          <p className="text-sm text-muted-foreground">
                            Hel traktamente
                          </p>
                          <p className="font-medium">
                            {selectedOffer.per_diem_full} SEK
                          </p>
                        </div>
                      )}
                      {selectedOffer.per_diem_half && (
                        <div>
                          <p className="text-sm text-muted-foreground">
                            Halv traktamente
                          </p>
                          <p className="font-medium">
                            {selectedOffer.per_diem_half} SEK
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {selectedOffer.terms && (
                <div>
                  <p className="text-sm font-medium mb-1">Villkor</p>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {selectedOffer.terms}
                  </p>
                </div>
              )}

              {selectedOffer.notes && (
                <div className="bg-muted/50 p-3 rounded-lg">
                  <p className="text-sm font-medium mb-1">Interna anteckningar</p>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {selectedOffer.notes}
                  </p>
                </div>
              )}

              <div className="flex justify-between items-center pt-4 border-t">
                <div className="text-sm text-muted-foreground">
                  {selectedOffer.valid_until && (
                    <p>
                      Giltig t.o.m.:{" "}
                      {format(new Date(selectedOffer.valid_until), "d MMMM yyyy", {
                        locale: sv,
                      })}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => handleDownloadPDF(selectedOffer)}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Ladda ner PDF
                  </Button>
                  {selectedOffer.status === "draft" && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        updateOfferStatus(selectedOffer.id, "sent");
                        setViewDialogOpen(false);
                      }}
                    >
                      Markera som skickad
                    </Button>
                  )}
                  {selectedOffer.status === "sent" && (
                    <>
                      <Button
                        variant="outline"
                        onClick={() => {
                          updateOfferStatus(selectedOffer.id, "rejected");
                          setViewDialogOpen(false);
                        }}
                      >
                        Avvisad
                      </Button>
                      <Button
                        onClick={() => {
                          updateOfferStatus(selectedOffer.id, "accepted");
                          setViewDialogOpen(false);
                        }}
                      >
                        Accepterad
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}