import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ImpersonationProvider } from "@/contexts/ImpersonationContext";
import { Layout } from "@/components/Layout";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import TimeReports from "./pages/TimeReports";
import Planning from "./pages/Planning";
import Deviations from "./pages/Deviations";
import SelfChecks from "./pages/SelfChecks";
import SalaryOverview from "./pages/SalaryOverview";
import WorkOrders from "./pages/WorkOrders";
import ChangePassword from "./pages/ChangePassword";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Contacts from "./pages/Contacts";
import Documents from "./pages/Documents";
import AdminProjects from "./pages/admin/Projects";
import AdminUsers from "./pages/admin/Users";
import AdminJobRoles from "./pages/admin/JobRoles";
import AdminMaterialTypes from "./pages/admin/MaterialTypes";
import AdminPlanning from "./pages/admin/Planning";
import AdminTimeAttestations from "./pages/admin/TimeAttestations";
import AdminDeviations from "./pages/admin/Deviations";
import AdminSelfChecks from "./pages/admin/SelfChecks";
import AdminOBSettings from "./pages/admin/OBSettings";
import AdminInvoiceSettings from "./pages/admin/InvoiceSettings";
import AdminPriceList from "./pages/admin/PriceList";
import AdminActivityLog from "./pages/admin/ActivityLog";
import AdminDocuments from "./pages/admin/Documents";
import AdminTimeReportSettings from "./pages/admin/TimeReportSettings";
import AdminMenuSettings from "./pages/admin/MenuSettings";
import AdminStatistics from "./pages/admin/Statistics";
import AdminWorkOrders from "./pages/admin/WorkOrders";
import AdminHub from "./pages/admin/AdminHub";
import AdminCustomers from "./pages/admin/Customers";
import AdminWeldingReports from "./pages/admin/WeldingReports";
import AdminOffers from "./pages/admin/Offers";
import AdminSalaries from "./pages/admin/Salaries";
import WeldingReport from "./pages/WeldingReport";
import SuperAdminDashboard from "./pages/superadmin/Dashboard";
import NotFound from "./pages/NotFound";
import AdminBilling from "./pages/admin/Billing";
import AdminInvoiceMarking from "./pages/admin/InvoiceMarking";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
    </div>;
  }
  
  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  
  return <>{children}</>;
};

const FeatureRoute = ({ feature, children }: { feature?: string; children: React.ReactNode }) => {
  const { hasFeature, isSuperAdmin, isImpersonated, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const shouldFilter = !isSuperAdmin || isImpersonated;
  if (!feature || !shouldFilter) return <>{children}</>;
  if (!hasFeature(feature)) return <Navigate to="/" replace />;
  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <ImpersonationProvider>
          <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <Dashboard />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/time-reports"
                element={
                  <ProtectedRoute>
                    <FeatureRoute feature="time_reports">
                      <Layout>
                        <TimeReports />
                      </Layout>
                    </FeatureRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/work-orders"
                element={
                  <ProtectedRoute>
                    <FeatureRoute feature="work_orders">
                      <Layout>
                        <WorkOrders />
                      </Layout>
                    </FeatureRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/planning"
                element={
                  <ProtectedRoute>
                    <FeatureRoute feature="planning">
                      <Layout>
                        <Planning />
                      </Layout>
                    </FeatureRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/deviations"
                element={
                  <ProtectedRoute>
                    <FeatureRoute feature="deviations">
                      <Layout>
                        <Deviations />
                      </Layout>
                    </FeatureRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/self-checks"
                element={
                  <ProtectedRoute>
                    <FeatureRoute feature="self_checks">
                      <Layout>
                        <SelfChecks />
                      </Layout>
                    </FeatureRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/salary-overview"
                element={
                  <ProtectedRoute>
                    <FeatureRoute feature="salary_overview">
                      <Layout>
                        <SalaryOverview />
                      </Layout>
                    </FeatureRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/change-password"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <ChangePassword />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/contacts"
                element={
                  <ProtectedRoute>
                    <FeatureRoute feature="contacts">
                      <Layout>
                        <Contacts />
                      </Layout>
                    </FeatureRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/documents"
                element={
                  <ProtectedRoute>
                    <FeatureRoute feature="documents">
                      <Layout>
                        <Documents />
                      </Layout>
                    </FeatureRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/welding-report"
                element={
                  <ProtectedRoute>
                    <FeatureRoute feature="welding_reports">
                      <Layout>
                        <WeldingReport />
                      </Layout>
                    </FeatureRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/welding-reports"
                element={
                  <ProtectedRoute>
                    <FeatureRoute feature="welding_reports">
                      <Layout>
                        <AdminWeldingReports />
                      </Layout>
                    </FeatureRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/customers"
                element={
                  <ProtectedRoute>
                    <FeatureRoute feature="customers">
                      <Layout>
                        <AdminCustomers />
                      </Layout>
                    </FeatureRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/projects"
                element={
                  <ProtectedRoute>
                    <FeatureRoute feature="projects">
                      <Layout>
                        <AdminProjects />
                      </Layout>
                    </FeatureRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/users"
                element={
                  <ProtectedRoute>
                    <FeatureRoute feature="admin_users">
                      <Layout>
                        <AdminUsers />
                      </Layout>
                    </FeatureRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/job-roles"
                element={
                  <ProtectedRoute>
                    <FeatureRoute feature="job_roles">
                      <Layout>
                        <AdminJobRoles />
                      </Layout>
                    </FeatureRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/material-types"
                element={
                  <ProtectedRoute>
                    <FeatureRoute feature="material_types">
                      <Layout>
                        <AdminMaterialTypes />
                      </Layout>
                    </FeatureRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/planning"
                element={
                  <ProtectedRoute>
                    <FeatureRoute feature="planning">
                      <Layout>
                        <AdminPlanning />
                      </Layout>
                    </FeatureRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/attestations"
                element={
                  <ProtectedRoute>
                    <FeatureRoute feature="attestation">
                      <Layout>
                        <AdminTimeAttestations />
                      </Layout>
                    </FeatureRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/billing"
                element={
                  <ProtectedRoute>
                    <FeatureRoute feature="billing">
                      <Layout>
                        <AdminBilling />
                      </Layout>
                    </FeatureRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/invoice-marking"
                element={
                  <ProtectedRoute>
                    <FeatureRoute feature="invoice_marking">
                      <Layout>
                        <AdminInvoiceMarking />
                      </Layout>
                    </FeatureRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/deviations"
                element={
                  <ProtectedRoute>
                    <FeatureRoute feature="deviations">
                      <Layout>
                        <AdminDeviations />
                      </Layout>
                    </FeatureRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/self-checks"
                element={
                  <ProtectedRoute>
                    <FeatureRoute feature="self_checks">
                      <Layout>
                        <AdminSelfChecks />
                      </Layout>
                    </FeatureRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/ob-settings"
                element={
                  <ProtectedRoute>
                    <FeatureRoute feature="ob_settings">
                      <Layout>
                        <AdminOBSettings />
                      </Layout>
                    </FeatureRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/invoice-settings"
                element={
                  <ProtectedRoute>
                    <FeatureRoute feature="invoice_settings">
                      <Layout>
                        <AdminInvoiceSettings />
                      </Layout>
                    </FeatureRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/price-list"
                element={
                  <ProtectedRoute>
                    <FeatureRoute feature="price_list">
                      <Layout>
                        <AdminPriceList />
                      </Layout>
                    </FeatureRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/documents"
                element={
                  <ProtectedRoute>
                    <FeatureRoute feature="documents">
                      <Layout>
                        <AdminDocuments />
                      </Layout>
                    </FeatureRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/time-report-settings"
                element={
                  <ProtectedRoute>
                    <FeatureRoute feature="time_report_settings">
                      <Layout>
                        <AdminTimeReportSettings />
                      </Layout>
                    </FeatureRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/activity-log"
                element={
                  <ProtectedRoute>
                    <FeatureRoute feature="activity_log">
                      <Layout>
                        <AdminActivityLog />
                      </Layout>
                    </FeatureRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/menu-settings"
                element={
                  <ProtectedRoute>
                    <FeatureRoute feature="menu_settings">
                      <Layout>
                        <AdminMenuSettings />
                      </Layout>
                    </FeatureRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/statistics"
                element={
                  <ProtectedRoute>
                    <FeatureRoute feature="statistics">
                      <Layout>
                        <AdminStatistics />
                      </Layout>
                    </FeatureRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/work-orders"
                element={
                  <ProtectedRoute>
                    <FeatureRoute feature="work_orders">
                      <Layout>
                        <AdminWorkOrders />
                      </Layout>
                    </FeatureRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/hub"
                element={
                  <ProtectedRoute>
                    <FeatureRoute feature="admin_hub">
                      <Layout>
                        <AdminHub />
                      </Layout>
                    </FeatureRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/offers"
                element={
                  <ProtectedRoute>
                    <FeatureRoute feature="offers">
                      <Layout>
                        <AdminOffers />
                      </Layout>
                    </FeatureRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/salaries"
                element={
                  <ProtectedRoute>
                    <FeatureRoute feature="salaries">
                      <Layout>
                        <AdminSalaries />
                      </Layout>
                    </FeatureRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/superadmin"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <SuperAdminDashboard />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </ImpersonationProvider>
        </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
