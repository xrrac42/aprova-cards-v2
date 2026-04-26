import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useSearchParams } from "react-router-dom";
import ErrorBoundary from "@/components/ErrorBoundary";
import LoginPage from "./pages/LoginPage";
import { PaymentCheckout } from "./components/PaymentCheckout";
import { StudentSignUpFlow } from "./components/StudentSignUpFlow";

// Lazy load all non-login routes
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminMentors = lazy(() => import("./pages/admin/AdminMentors"));
const AdminProducts = lazy(() => import("./pages/admin/AdminProducts"));
const AdminReports = lazy(() => import("./pages/admin/AdminReports"));
const AdminStudents = lazy(() => import("./pages/admin/AdminStudents"));
const AdminUpload = lazy(() => import("./pages/admin/AdminUpload"));
const CreateProduct = lazy(() => import("./pages/admin/CreateProduct"));
const ProductManager = lazy(() => import("./pages/admin/ProductManager"));
const AdminMentorDetail = lazy(() => import("./pages/admin/AdminMentorDetail"));
const Customization = lazy(() => import("./pages/admin/Customization"));
const SystemHealth = lazy(() => import("./pages/admin/SystemHealth"));
const CardQuality = lazy(() => import("./pages/admin/CardQuality"));
const AdminFeedbacks = lazy(() => import("./pages/admin/AdminFeedbacks"));

const MentorDashboard = lazy(() => import("./pages/mentor/MentorDashboard"));
const MentorStudents = lazy(() => import("./pages/mentor/MentorStudents"));
const MentorCustomization = lazy(() => import("./pages/mentor/MentorCustomization"));
const MentorReports = lazy(() => import("./pages/mentor/MentorReports"));

const StudentHome = lazy(() => import("./pages/student/StudentHome"));
const StudySession = lazy(() => import("./pages/student/StudySession"));
const SessionConfig = lazy(() => import("./pages/student/SessionConfig"));
const EndSession = lazy(() => import("./pages/student/EndSession"));
const Reports = lazy(() => import("./pages/student/Reports"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const LazyFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
  </div>
);

const CheckoutRoute = () => {
  const [searchParams] = useSearchParams();

  // Invite-code flow: /checkout?code=xxx
  if (searchParams.get("code")) {
    return <StudentSignUpFlow />;
  }

  const studentEmail = searchParams.get("studentEmail");
  const productId = searchParams.get("productId");
  const amountCentsParam = searchParams.get("amountCents");
  const amountCents = amountCentsParam ? Number(amountCentsParam) : NaN;

  if (!studentEmail || !productId || !Number.isFinite(amountCents)) {
    return <Navigate to="/login" replace />;
  }

  return (
    <PaymentCheckout
      studentEmail={studentEmail}
      productId={productId}
      amountCents={amountCents}
    />
  );
};

const App = () => (
  <ErrorBoundary>
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Suspense fallback={<LazyFallback />}>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login/:slug?" element={<LoginPage />} />

          {/* Admin */}
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/mentores" element={<AdminMentors />} />
          <Route path="/admin/mentor/:mentorId" element={<AdminMentorDetail />} />
          <Route path="/admin/produtos" element={<AdminProducts />} />
          <Route path="/admin/produtos/novo" element={<CreateProduct />} />
          <Route path="/admin/produtos/editar/:id" element={<CreateProduct />} />
          <Route path="/admin/produto/:id" element={<ProductManager />} />
          <Route path="/admin/upload" element={<AdminUpload />} />
          <Route path="/admin/alunos" element={<AdminStudents />} />
          <Route path="/admin/relatorios" element={<AdminReports />} />
          <Route path="/admin/saude" element={<SystemHealth />} />
          <Route path="/admin/qualidade" element={<CardQuality />} />
          <Route path="/admin/feedbacks" element={<AdminFeedbacks />} />
          <Route path="/admin/personalizacao" element={<Customization />} />
          <Route path="/checkout" element={<CheckoutRoute />} />
          <Route path="/convite" element={<StudentSignUpFlow />} />

          {/* Student — StudySession gets its own Suspense to prevent remounts */}
          <Route path="/aluno" element={<StudentHome />} />
          <Route path="/aluno/sessao/:disciplineId" element={<SessionConfig />} />
          <Route path="/aluno/estudo/:disciplineId" element={
            <Suspense fallback={<LazyFallback />}>
              <StudySession />
            </Suspense>
          } />
          <Route path="/aluno/fim-de-sessao" element={<EndSession />} />
          <Route path="/aluno/relatorios" element={<Reports />} />

          {/* Mentor */}
          <Route path="/mentor" element={<MentorDashboard />} />
          <Route path="/mentor/alunos" element={<MentorStudents />} />
          <Route path="/mentor/personalizacao" element={<MentorCustomization />} />
          <Route path="/mentor/relatorios" element={<MentorReports />} />

          <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
