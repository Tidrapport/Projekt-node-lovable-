import { useState, useEffect } from "react";
import { apiFetch } from "@/api/client";
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
import { Plus, Edit, Trash2, FileText, Eye, Building2, Download, Send } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { sv } from "date-fns/locale";
import { generateOfferPDF, OfferCompany } from "@/lib/offerPdf";
import { ensureArray } from "@/lib/ensureArray";

interface Customer {
  id: string;
  name: string;
  customer_number?: string | null;
  org_number: string | null;
  address: string | null;
  postal_code: string | null;
  city: string | null;
  contact_person: string | null;
  contact_email: string | null;
  contact_phone: string | null;
}

type ApiCustomer = {
  id: string | number;
  name?: string | null;
  customer_number?: string | null;
  orgnr?: string | null;
  org_number?: string | null;
  invoice_address1?: string | null;
  invoice_address2?: string | null;
  postal_code?: string | null;
  city?: string | null;
  contact_name?: string | null;
  contact_person?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
};

type ApiCompany = {
  id?: string | number | null;
  name?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  postal_code?: string | null;
  city?: string | null;
  country?: string | null;
  phone?: string | null;
  org_number?: string | null;
  orgnr?: string | null;
  logo_url?: string | null;
  billing_email?: string | null;
  bankgiro?: string | null;
  bic_number?: string | null;
  iban_number?: string | null;
  vat_number?: string | null;
  f_skatt?: number | null;
  invoice_payment_terms?: string | null;
  invoice_our_reference?: string | null;
  invoice_late_interest?: string | null;
};

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
  line_items?: OfferItem[];
}

type OfferItem = {
  id: string;
  source: "custom" | "job_role" | "material";
  source_id?: string | null;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
};

type JobRoleOption = {
  id: string;
  name: string;
  rate: number;
  unit: string;
};

type MaterialOption = {
  id: string;
  name: string;
  unit: string;
  price: number;
};

type PriceListJobRole = {
  id: string | number;
  name?: string | null;
  day_rate?: number | null;
  evening_rate?: number | null;
  night_rate?: number | null;
  weekend_rate?: number | null;
  overtime_weekday_rate?: number | null;
  overtime_weekend_rate?: number | null;
  per_diem_rate?: number | null;
  travel_time_rate?: number | null;
};

type PriceListMaterial = {
  id: string | number;
  name?: string | null;
  price?: number | null;
  unit?: string | null;
};

type PriceListResponse = {
  year?: number;
  job_roles?: PriceListJobRole[];
  material_types?: PriceListMaterial[];
};

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

const getOfferStorageKey = (companyId?: string | null) =>
  `tidrailwork_offers:${companyId || "default"}`;

const loadOffersFromStorage = (companyId?: string | null) => {
  if (typeof window === "undefined") return [];
  const key = getOfferStorageKey(companyId);
  const raw = window.localStorage.getItem(key);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((offer) => ({
      ...offer,
      include_vat: offer?.include_vat !== false,
    }));
  } catch {
    return [];
  }
};

const saveOffersToStorage = (companyId: string | null | undefined, offers: Offer[]) => {
  if (typeof window === "undefined") return;
  const key = getOfferStorageKey(companyId);
  window.localStorage.setItem(key, JSON.stringify(offers));
};

const normalizeCustomer = (customer: ApiCustomer): Customer => {
  const address = [customer.invoice_address1, customer.invoice_address2]
    .filter(Boolean)
    .join(", ");
  return {
    id: String(customer.id),
    name: customer.name || "",
    customer_number: customer.customer_number || null,
    org_number: customer.org_number || customer.orgnr || null,
    address: address || null,
    postal_code: customer.postal_code || null,
    city: customer.city || null,
    contact_person: customer.contact_person || customer.contact_name || null,
    contact_email: customer.contact_email || null,
    contact_phone: customer.contact_phone || null,
  };
};

const normalizeCompany = (company: ApiCompany | null) => {
  if (!company) return null;
  return {
    name: company.name || "",
    org_number: company.org_number || company.orgnr || null,
    logo_url: company.logo_url || null,
    billing_email: company.billing_email || null,
    address_line1: company.address_line1 || null,
    address_line2: company.address_line2 || null,
    postal_code: company.postal_code || null,
    city: company.city || null,
    country: company.country || null,
    phone: company.phone || null,
    bankgiro: company.bankgiro || null,
    bic_number: company.bic_number || null,
    iban_number: company.iban_number || null,
    vat_number: company.vat_number || null,
    f_skatt: company.f_skatt ?? null,
    invoice_payment_terms: company.invoice_payment_terms || null,
    invoice_our_reference: company.invoice_our_reference || null,
    invoice_late_interest: company.invoice_late_interest || null,
  };
};

const generateOfferNumber = (offers: Offer[]) => {
  const year = new Date().getFullYear();
  const regex = new RegExp(`${year}\\D*(\\d+)`);
  let max = 0;
  offers.forEach((offer) => {
    const match = offer.offer_number.match(regex);
    if (match) {
      const value = Number(match[1]);
      if (Number.isFinite(value)) max = Math.max(max, value);
    }
  });
  const next = max + 1;
  return `${year}${String(next).padStart(2, "0")}`;
};

const createOfferId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `offer_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
};

const createOfferItemId = () =>
  `offer_item_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const parseNumber = (value: unknown) => {
  if (typeof value === "string" && value.trim() === "") return 0;
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const pickJobRoleRate = (role: PriceListJobRole) => {
  const candidates = [
    role.day_rate,
    role.evening_rate,
    role.night_rate,
    role.weekend_rate,
    role.overtime_weekday_rate,
    role.overtime_weekend_rate,
    role.per_diem_rate,
    role.travel_time_rate,
  ];
  for (const value of candidates) {
    const num = parseNumber(value);
    if (num > 0) return num;
  }
  return 0;
};

const normalizeOfferItems = (items?: OfferItem[]) =>
  (items || []).map((item) => ({
    ...item,
    id: item.id || createOfferItemId(),
    quantity: parseNumber(item.quantity),
    unit_price: parseNumber(item.unit_price),
    unit: item.unit || "",
    description: item.description || "",
  }));

const toBase64 = (bytes: Uint8Array) => {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.slice(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
};

export default function AdminOffers() {
  const { user, companyId } = useAuth();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [company, setCompany] = useState<OfferCompany | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);
  const [editingOffer, setEditingOffer] = useState<Offer | null>(null);
  const [sendingOfferId, setSendingOfferId] = useState<string | null>(null);
  const [offerItems, setOfferItems] = useState<OfferItem[]>([]);
  const [jobRoleOptions, setJobRoleOptions] = useState<JobRoleOption[]>([]);
  const [materialOptions, setMaterialOptions] = useState<MaterialOption[]>([]);
  const [selectedJobRoleId, setSelectedJobRoleId] = useState("");
  const [jobRoleQuantity, setJobRoleQuantity] = useState("1");
  const [jobRoleUnit, setJobRoleUnit] = useState("h");
  const [jobRoleUnitPrice, setJobRoleUnitPrice] = useState("");
  const [selectedMaterialId, setSelectedMaterialId] = useState("");
  const [materialQuantity, setMaterialQuantity] = useState("1");
  const [materialUnit, setMaterialUnit] = useState("");
  const [materialUnitPrice, setMaterialUnitPrice] = useState("");
  const [customItem, setCustomItem] = useState({
    description: "",
    quantity: "1",
    unit: "st",
    unitPrice: "",
  });

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
    setLoading(true);
    const storedOffers = loadOffersFromStorage(companyId).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    setOffers(storedOffers);

    try {
      const [customersData, companiesData] = await Promise.all([
        apiFetch<ApiCustomer[]>("/customers?order=name").catch(() => []),
        apiFetch<ApiCompany[]>("/companies").catch(() => []),
      ]);
      const normalizedCustomers = (Array.isArray(customersData) ? customersData : [])
        .map(normalizeCustomer);
      setCustomers(normalizedCustomers);
      const companyList = Array.isArray(companiesData) ? companiesData : [];
      const selectedCompany = companyId
        ? companyList.find((item) => String(item.id) === String(companyId))
        : companyList[0];
      setCompany(normalizeCompany(selectedCompany || null));
    } catch (error) {
      console.error("Error fetching offer data:", error);
      toast.error("Kunde inte hämta offerter");
    }
    await fetchItemOptions();
    setLoading(false);
  };

  const resetItemInputs = () => {
    setSelectedJobRoleId("");
    setJobRoleQuantity("1");
    setJobRoleUnit("h");
    setJobRoleUnitPrice("");
    setSelectedMaterialId("");
    setMaterialQuantity("1");
    setMaterialUnit("");
    setMaterialUnitPrice("");
    setCustomItem({
      description: "",
      quantity: "1",
      unit: "st",
      unitPrice: "",
    });
  };

  const fetchItemOptions = async () => {
    const year = new Date().getFullYear();
    let jobRoles: JobRoleOption[] = [];
    let materials: MaterialOption[] = [];

    try {
      const priceList = await apiFetch<PriceListResponse>(`/price-list?year=${year}`);
      const jobRolesData = ensureArray<PriceListJobRole>(priceList?.job_roles);
      const materialData = ensureArray<PriceListMaterial>(priceList?.material_types);

      jobRoles = jobRolesData.map((role) => ({
        id: String(role.id),
        name: role.name || "Yrkesroll",
        rate: pickJobRoleRate(role),
        unit: "h",
      }));

      materials = materialData.map((material) => ({
        id: String(material.id),
        name: material.name || "Tillägg",
        unit: material.unit || "st",
        price: parseNumber(material.price),
      }));
    } catch (error) {
      console.warn("Price list missing for offers:", error);
    }

    if (!jobRoles.length) {
      try {
        const jobRolesData = await apiFetch<any[]>("/job-roles?order=name");
        jobRoles = ensureArray(jobRolesData).map((role: any) => ({
          id: String(role.id),
          name: role.name || "Yrkesroll",
          rate: 0,
          unit: "h",
        }));
      } catch (error) {
        console.warn("Job roles missing for offers:", error);
      }
    }

    if (!materials.length) {
      try {
        const materialData = await apiFetch<any[]>("/material-types?order=name");
        materials = ensureArray(materialData).map((material: any) => ({
          id: String(material.id),
          name: material.name || "Tillägg",
          unit: material.unit || "st",
          price: 0,
        }));
      } catch (error) {
        console.warn("Material types missing for offers:", error);
      }
    }

    setJobRoleOptions(jobRoles);
    setMaterialOptions(materials);
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
    setOfferItems([]);
    resetItemInputs();
    setEditingOffer(null);
  };

  const openEditDialog = (offer: Offer) => {
    setEditingOffer(offer);
    setOfferItems(normalizeOfferItems(offer.line_items));
    resetItemInputs();
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
      include_vat: offer.include_vat !== false,
    });
    setDialogOpen(true);
  };

  const handleSelectJobRole = (value: string) => {
    setSelectedJobRoleId(value);
    const role = jobRoleOptions.find((item) => item.id === value);
    setJobRoleUnit(role?.unit || "h");
    setJobRoleUnitPrice(role?.rate ? String(role.rate) : "");
  };

  const handleSelectMaterial = (value: string) => {
    setSelectedMaterialId(value);
    const material = materialOptions.find((item) => item.id === value);
    setMaterialUnit(material?.unit || "st");
    setMaterialUnitPrice(material?.price ? String(material.price) : "");
  };

  const addOfferItem = (item: Omit<OfferItem, "id">) => {
    setOfferItems((prev) => [...prev, { ...item, id: createOfferItemId() }]);
  };

  const handleAddJobRole = () => {
    if (!selectedJobRoleId) {
      toast.error("Välj en yrkesroll.");
      return;
    }
    const role = jobRoleOptions.find((item) => item.id === selectedJobRoleId);
    if (!role) {
      toast.error("Yrkesrollen hittades inte.");
      return;
    }
    const quantity = parseNumber(jobRoleQuantity) || 1;
    const unitPrice = parseNumber(jobRoleUnitPrice || role.rate);
    const unit = jobRoleUnit.trim() || role.unit || "h";

    addOfferItem({
      source: "job_role",
      source_id: role.id,
      description: role.name,
      quantity,
      unit,
      unit_price: unitPrice,
    });

    setSelectedJobRoleId("");
    setJobRoleQuantity("1");
    setJobRoleUnit("h");
    setJobRoleUnitPrice("");
  };

  const handleAddMaterial = () => {
    if (!selectedMaterialId) {
      toast.error("Välj ett tillägg/material.");
      return;
    }
    const material = materialOptions.find((item) => item.id === selectedMaterialId);
    if (!material) {
      toast.error("Materialet hittades inte.");
      return;
    }
    const quantity = parseNumber(materialQuantity) || 1;
    const unitPrice = parseNumber(materialUnitPrice || material.price);
    const unit = materialUnit.trim() || material.unit || "st";

    addOfferItem({
      source: "material",
      source_id: material.id,
      description: material.name,
      quantity,
      unit,
      unit_price: unitPrice,
    });

    setSelectedMaterialId("");
    setMaterialQuantity("1");
    setMaterialUnit("");
    setMaterialUnitPrice("");
  };

  const handleAddCustomItem = () => {
    if (!customItem.description.trim()) {
      toast.error("Ange en beskrivning.");
      return;
    }
    const quantity = parseNumber(customItem.quantity) || 1;
    const unitPrice = parseNumber(customItem.unitPrice);
    const unit = customItem.unit.trim() || "st";

    addOfferItem({
      source: "custom",
      source_id: null,
      description: customItem.description.trim(),
      quantity,
      unit,
      unit_price: unitPrice,
    });

    setCustomItem({ description: "", quantity: "1", unit: "st", unitPrice: "" });
  };

  const updateOfferItem = (id: string, updates: Partial<OfferItem>) => {
    setOfferItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
  };

  const removeOfferItem = (id: string) => {
    setOfferItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!companyId || !user) return;

    try {
      if (editingOffer) {
        const updatedOffers = offers.map((offer) =>
          offer.id === editingOffer.id
            ? {
                ...offer,
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
                include_vat: formData.include_vat !== false,
                line_items: offerItems,
              }
            : offer
        );
        setOffers(updatedOffers);
        saveOffersToStorage(companyId, updatedOffers);
        toast.success("Offert uppdaterad");
      } else {
        const offerNumber = generateOfferNumber(offers);
        const newOffer: Offer = {
          id: createOfferId(),
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
          created_at: new Date().toISOString(),
          status: "draft",
          include_vat: formData.include_vat !== false,
          line_items: offerItems,
        };
        const nextOffers = [newOffer, ...offers];
        setOffers(nextOffers);
        saveOffersToStorage(companyId, nextOffers);
        toast.success("Offert skapad");
      }

      setDialogOpen(false);
      resetForm();
    } catch (error: any) {
      console.error("Error saving offer:", error);
      toast.error("Kunde inte spara offert");
    }
  };

  const handleCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!companyId) return;

    try {
      const payload = {
        company_id: companyId,
        name: customerFormData.name,
        orgnr: customerFormData.org_number || null,
        invoice_address1: customerFormData.address || null,
        invoice_address2: null,
        postal_code: customerFormData.postal_code || null,
        city: customerFormData.city || null,
        contact_name: customerFormData.contact_person || null,
        contact_email: customerFormData.contact_email || null,
        contact_phone: customerFormData.contact_phone || null,
      };
      const created = await apiFetch<ApiCustomer>("/customers", { method: "POST", json: payload });

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
      const normalized = normalizeCustomer(created);
      setCustomers([...customers, normalized]);
      setFormData({ ...formData, customer_id: normalized.id });
    } catch (error: any) {
      console.error("Error creating customer:", error);
      toast.error("Kunde inte skapa kund");
    }
  };

  const updateOfferStatus = async (offerId: string, status: string) => {
    try {
      const updatedOffers = offers.map((offer) =>
        offer.id === offerId ? { ...offer, status } : offer
      );
      setOffers(updatedOffers);
      saveOffersToStorage(companyId, updatedOffers);
      toast.success(`Offert markerad som ${statusLabels[status]?.toLowerCase()}`);
    } catch (error: any) {
      console.error("Error updating status:", error);
      toast.error("Kunde inte uppdatera status");
    }
  };

  const deleteOffer = async (offerId: string) => {
    if (!confirm("Är du säker på att du vill ta bort denna offert?")) return;

    try {
      const updatedOffers = offers.filter((offer) => offer.id !== offerId);
      setOffers(updatedOffers);
      saveOffersToStorage(companyId, updatedOffers);
      toast.success("Offert borttagen");
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
      const normalizedOffer = { ...offer, include_vat: offer.include_vat !== false };
      // Generate PDF using the `offert_test_with_vat2.pdf` template and trigger browser download.
      await generateOfferPDF(normalizedOffer, customer || null, company, { download: true, templatePath: "/offert_test_with_vat2.pdf" });
      toast.success("Offert nedladdad");
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Kunde inte generera PDF");
    }
  };

  const buildOfferRows = (offer: Offer) => {
    const rows: Array<{ Description: string; Price?: number; Quantity?: number; Unit?: string }> = [];
    if (offer.line_items && offer.line_items.length > 0) {
      offer.line_items.forEach((item) => {
        rows.push({
          Description: item.description || "Artikel",
          Price: parseNumber(item.unit_price),
          Quantity: parseNumber(item.quantity),
          Unit: item.unit || "st",
        });
      });
      if (offer.travel_rate_per_km) {
        rows.push({
          Description: "Reseersättning",
          Price: Number(offer.travel_rate_per_km),
          Quantity: 1,
          Unit: "km",
        });
      }
      if (offer.per_diem_full) {
        rows.push({
          Description: "Hel traktamente",
          Price: Number(offer.per_diem_full),
          Quantity: 1,
          Unit: "dag",
        });
      }
      if (offer.per_diem_half) {
        rows.push({
          Description: "Halv traktamente",
          Price: Number(offer.per_diem_half),
          Quantity: 1,
          Unit: "dag",
        });
      }
      return rows;
    }
    if (offer.fixed_price) {
      rows.push({
        Description: "Fast pris",
        Price: Number(offer.fixed_price),
        Quantity: 1,
        Unit: "st",
      });
    }
    const hourlyRows = [
      { label: "Timpris dag", value: offer.hourly_rate_day },
      { label: "Timpris kväll", value: offer.hourly_rate_evening },
      { label: "Timpris natt", value: offer.hourly_rate_night },
      { label: "Timpris helg", value: offer.hourly_rate_weekend },
    ];
    hourlyRows.forEach((row) => {
      if (!row.value) return;
      rows.push({
        Description: row.label,
        Price: Number(row.value),
        Quantity: offer.estimated_hours ? Number(offer.estimated_hours) : 1,
        Unit: "h",
      });
    });
    if (offer.travel_rate_per_km) {
      rows.push({
        Description: "Reseersättning",
        Price: Number(offer.travel_rate_per_km),
        Quantity: 1,
        Unit: "km",
      });
    }
    if (offer.per_diem_full) {
      rows.push({
        Description: "Hel traktamente",
        Price: Number(offer.per_diem_full),
        Quantity: 1,
        Unit: "dag",
      });
    }
    if (offer.per_diem_half) {
      rows.push({
        Description: "Halv traktamente",
        Price: Number(offer.per_diem_half),
        Quantity: 1,
        Unit: "dag",
      });
    }
    if (!rows.length) {
      rows.push({
        Description: offer.title || "Offert",
        Price: 0,
        Quantity: 1,
        Unit: "st",
      });
    }
    return rows;
  };

  const handleSendToFortnox = async (offer: Offer) => {
    if (!companyId) {
      toast.error("Välj företag innan du skickar till Fortnox.");
      return;
    }
    if (!company) {
      toast.error("Företagsuppgifter saknas för PDF.");
      return;
    }
    const customer = getCustomerById(offer.customer_id);
    if (!customer) {
      toast.error("Välj en kund för offerten.");
      return;
    }
    if (!customer.customer_number) {
      toast.error("Kunden saknar Fortnox kundnummer.");
      return;
    }
    setSendingOfferId(offer.id);
    try {
      const offerDate = offer.created_at
        ? format(new Date(offer.created_at), "yyyy-MM-dd")
        : format(new Date(), "yyyy-MM-dd");
      const payload = {
        CustomerNumber: customer.customer_number,
        OfferDate: offerDate,
        Comments: offer.description || offer.title || "",
        OurReference: user?.full_name || user?.email || "",
        OfferRows: buildOfferRows(offer),
      };
      const normalizedOffer = { ...offer, include_vat: offer.include_vat !== false };
      const pdfBytes = await generateOfferPDF(normalizedOffer, customer, company, { download: false });
      const pdfBase64 = toBase64(pdfBytes);
      const safeNumber = offer.offer_number.replace(/[^a-zA-Z0-9._-]/g, "_");
      const filename = `offert_${safeNumber || "offert"}.pdf`;
      const result = await apiFetch<{ offer_forwarded?: boolean; pdf_forwarded?: boolean; message?: string }>(
        "/admin/fortnox/push_offer",
        {
          method: "POST",
          json: { company_id: companyId, offer: payload, pdf_base64: pdfBase64, filename },
        }
      );
      if (result?.offer_forwarded || result?.pdf_forwarded) {
        toast.success("Offert skickad till Fortnox.");
      } else {
        toast.success(result?.message || "Offert sparad lokalt (ingen Fortnox-token).");
      }
    } catch (error: any) {
      console.error("Error sending offer to Fortnox:", error);
      toast.error(error?.message || "Kunde inte skicka offert till Fortnox");
    } finally {
      setSendingOfferId(null);
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

              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-base">Artiklar</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Yrkesroller</p>
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                      <div className="space-y-1 md:col-span-2">
                        <Label>Yrkesroll</Label>
                        <Select value={selectedJobRoleId} onValueChange={handleSelectJobRole}>
                          <SelectTrigger>
                            <SelectValue placeholder="Välj yrkesroll..." />
                          </SelectTrigger>
                          <SelectContent>
                            {jobRoleOptions.map((role) => (
                              <SelectItem key={role.id} value={role.id}>
                                {role.name}
                                {role.rate ? ` (${role.rate} SEK)` : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label>Antal</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.1"
                          value={jobRoleQuantity}
                          onChange={(e) => setJobRoleQuantity(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Enhet</Label>
                        <Input
                          value={jobRoleUnit}
                          onChange={(e) => setJobRoleUnit(e.target.value)}
                          placeholder="h"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Á-pris</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={jobRoleUnitPrice}
                          onChange={(e) => setJobRoleUnitPrice(e.target.value)}
                        />
                      </div>
                      <div>
                        <Button type="button" variant="secondary" onClick={handleAddJobRole}>
                          Lägg till
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium">Tillägg & material</p>
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                      <div className="space-y-1 md:col-span-2">
                        <Label>Tillägg</Label>
                        <Select value={selectedMaterialId} onValueChange={handleSelectMaterial}>
                          <SelectTrigger>
                            <SelectValue placeholder="Välj tillägg..." />
                          </SelectTrigger>
                          <SelectContent>
                            {materialOptions.map((material) => (
                              <SelectItem key={material.id} value={material.id}>
                                {material.name}
                                {material.unit ? ` (${material.unit})` : ""}
                                {material.price ? ` • ${material.price} SEK` : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label>Antal</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.1"
                          value={materialQuantity}
                          onChange={(e) => setMaterialQuantity(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Enhet</Label>
                        <Input
                          value={materialUnit}
                          onChange={(e) => setMaterialUnit(e.target.value)}
                          placeholder="st"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Á-pris</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={materialUnitPrice}
                          onChange={(e) => setMaterialUnitPrice(e.target.value)}
                        />
                      </div>
                      <div>
                        <Button type="button" variant="secondary" onClick={handleAddMaterial}>
                          Lägg till
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium">Egen artikel</p>
                    <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
                      <div className="space-y-1 md:col-span-2">
                        <Label>Beskrivning</Label>
                        <Input
                          value={customItem.description}
                          onChange={(e) =>
                            setCustomItem({ ...customItem, description: e.target.value })
                          }
                          placeholder="t.ex. Specialarbete"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Antal</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.1"
                          value={customItem.quantity}
                          onChange={(e) =>
                            setCustomItem({ ...customItem, quantity: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Enhet</Label>
                        <Input
                          value={customItem.unit}
                          onChange={(e) =>
                            setCustomItem({ ...customItem, unit: e.target.value })
                          }
                          placeholder="st"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Á-pris</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={customItem.unitPrice}
                          onChange={(e) =>
                            setCustomItem({ ...customItem, unitPrice: e.target.value })
                          }
                        />
                      </div>
                      <div>
                        <Button type="button" variant="secondary" onClick={handleAddCustomItem}>
                          Lägg till
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium">Tillagda artiklar</p>
                    {offerItems.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Inga artiklar tillagda ännu.
                      </p>
                    ) : (
                      <div className="border rounded-md overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Beskrivning</TableHead>
                              <TableHead>Antal</TableHead>
                              <TableHead>Enhet</TableHead>
                              <TableHead>Á-pris</TableHead>
                              <TableHead>Summa</TableHead>
                              <TableHead className="text-right">Åtgärd</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {offerItems.map((item) => {
                              const lineTotal = parseNumber(item.quantity) * parseNumber(item.unit_price);
                              return (
                                <TableRow key={item.id}>
                                  <TableCell className="min-w-[220px]">
                                    <Input
                                      value={item.description}
                                      onChange={(e) =>
                                        updateOfferItem(item.id, { description: e.target.value })
                                      }
                                    />
                                  </TableCell>
                                  <TableCell className="w-28">
                                    <Input
                                      type="number"
                                      min="0"
                                      step="0.1"
                                      value={String(item.quantity)}
                                      onChange={(e) =>
                                        updateOfferItem(item.id, {
                                          quantity: parseNumber(e.target.value),
                                        })
                                      }
                                    />
                                  </TableCell>
                                  <TableCell className="w-24">
                                    <Input
                                      value={item.unit}
                                      onChange={(e) =>
                                        updateOfferItem(item.id, { unit: e.target.value })
                                      }
                                    />
                                  </TableCell>
                                  <TableCell className="w-32">
                                    <Input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={String(item.unit_price)}
                                      onChange={(e) =>
                                        updateOfferItem(item.id, {
                                          unit_price: parseNumber(e.target.value),
                                        })
                                      }
                                    />
                                  </TableCell>
                                  <TableCell className="w-32">
                                    {lineTotal
                                      ? lineTotal.toLocaleString("sv-SE", {
                                          minimumFractionDigits: 2,
                                          maximumFractionDigits: 2,
                                        })
                                      : "-"}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => removeOfferItem(item.id)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

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

              {selectedOffer.line_items && selectedOffer.line_items.length > 0 && (
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-base">Artiklar</CardTitle>
                  </CardHeader>
                  <CardContent className="py-2">
                    <div className="border rounded-md overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Beskrivning</TableHead>
                            <TableHead>Antal</TableHead>
                            <TableHead>Enhet</TableHead>
                            <TableHead>Á-pris</TableHead>
                            <TableHead>Summa</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedOffer.line_items.map((item, index) => {
                            const lineTotal = parseNumber(item.quantity) * parseNumber(item.unit_price);
                            return (
                              <TableRow key={item.id || `${selectedOffer.id}-${index}`}>
                                <TableCell className="font-medium">{item.description}</TableCell>
                                <TableCell>{item.quantity}</TableCell>
                                <TableCell>{item.unit}</TableCell>
                                <TableCell>{item.unit_price}</TableCell>
                                <TableCell>
                                  {lineTotal
                                    ? lineTotal.toLocaleString("sv-SE", {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                      })
                                    : "-"}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}

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
                  <Button
                    className="bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => handleSendToFortnox(selectedOffer)}
                    disabled={sendingOfferId === selectedOffer.id}
                  >
                    <Send className="mr-2 h-4 w-4" />
                    Skicka till Fortnox
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
