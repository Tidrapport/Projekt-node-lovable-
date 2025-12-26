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
import SalaryOverview from "./pages/SalaryOverview";
import WorkOrders from "./pages/WorkOrders";
import ChangePassword from "./pages/ChangePassword";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Contacts from "./pages/Contacts";
import TdokAi from "./pages/TdokAi";
import AdminProjects from "./pages/admin/Projects";
import AdminUsers from "./pages/admin/Users";
import AdminJobRoles from "./pages/admin/JobRoles";
import AdminMaterialTypes from "./pages/admin/MaterialTypes";
import AdminDashboard from "./pages/admin/Dashboard";
import AdminPlanning from "./pages/admin/Planning";
import AdminTimeAttestations from "./pages/admin/TimeAttestations";
import AdminDeviations from "./pages/admin/Deviations";
import AdminOBSettings from "./pages/admin/OBSettings";
import AdminInvoiceSettings from "./pages/admin/InvoiceSettings";
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
                    <Layout>
                      <TimeReports />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/work-orders"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <WorkOrders />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/planning"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <Planning />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/deviations"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <Deviations />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/salary-overview"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <SalaryOverview />
                    </Layout>
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
                    <Layout>
                      <Contacts />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/tdok-ai"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <TdokAi />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/welding-report"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <WeldingReport />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/welding-reports"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <AdminWeldingReports />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/customers"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <AdminCustomers />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/projects"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <AdminProjects />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/users"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <AdminUsers />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/job-roles"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <AdminJobRoles />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/material-types"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <AdminMaterialTypes />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/dashboard"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <AdminDashboard />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/planning"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <AdminPlanning />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/attestations"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <AdminTimeAttestations />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/billing"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <AdminBilling />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/deviations"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <AdminDeviations />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/ob-settings"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <AdminOBSettings />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/invoice-settings"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <AdminInvoiceSettings />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/statistics"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <AdminStatistics />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/work-orders"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <AdminWorkOrders />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/hub"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <AdminHub />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/offers"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <AdminOffers />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/salaries"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <AdminSalaries />
                    </Layout>
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
