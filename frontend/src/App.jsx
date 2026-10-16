import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider } from '@/lib/AuthContext';
import ScrollToTop from './components/ScrollToTop';
import ThemeWrapper from '@/components/ThemeWrapper';

// Public pages
import Home from '@/pages/Home';
import BrowseAuctions from '@/pages/BrowseAuctions';
import AuctionDetails from '@/pages/AuctionDetails';
import UpcomingAuctions from '@/pages/UpcomingAuctions';
import CompletedAuctions from '@/pages/CompletedAuctions';
import HowItWorks from '@/pages/HowItWorks';
import BuyerSafety from '@/pages/BuyerSafety';
import SellerInformation from '@/pages/SellerInformation';
import FAQ from '@/pages/FAQ';
import Contact from '@/pages/Contact';
import PrivacyPolicy from '@/pages/PrivacyPolicy';
import Terms from '@/pages/Terms';

// Garage sale / house clearance events
import GarageSales from '@/pages/GarageSales';
import GarageSaleEvent from '@/pages/GarageSaleEvent';
import SellGarageSale from '@/pages/SellGarageSale';

// Buyer self-service
import Watchlist from '@/pages/Watchlist';
import MyBids from '@/pages/MyBids';
import MyTransactions from '@/pages/MyTransactions';
import TransactionDetail from '@/pages/TransactionDetail';

// Security
import SecuritySettings from '@/pages/SecuritySettings';
import VerifyTwoFactor from '@/pages/VerifyTwoFactor';
import VerifyIdentity from '@/pages/VerifyIdentity';

// Auth pages
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';

// Admin pages
import AdminDashboard from '@/pages/admin/AdminDashboard';
import AdminListings from '@/pages/admin/AdminListings';
import AdminAccounts from '@/pages/admin/AdminAccounts';
import AdminSettings from '@/pages/admin/AdminSettings';
import AdminVerifications from '@/pages/admin/AdminVerifications';
import AdminPayments from '@/pages/admin/AdminPayments';

// Auctioneer
import AuctioneerDashboard from '@/pages/auctioneer/AuctioneerDashboard';
import ManageEvent from '@/pages/auctioneer/ManageEvent';
import GoLive from '@/pages/GoLive';
import AuctioneerRoute from '@/components/AuctioneerRoute';

// Layouts & guards
import PublicLayout from '@/components/layout/PublicLayout';
import AdminLayout from '@/components/layout/AdminLayout';
import AdminRoute from '@/components/AdminRoute';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Navigate } from 'react-router-dom';

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <ThemeWrapper>
        <Router>
          <ScrollToTop />
          <Routes>
            {/* Public marketplace — no account required */}
            <Route element={<PublicLayout />}>
              <Route path="/" element={<Home />} />
              <Route path="/auctions" element={<BrowseAuctions />} />
              <Route path="/auctions/:id" element={<AuctionDetails />} />
              <Route path="/upcoming" element={<UpcomingAuctions />} />
              <Route path="/completed" element={<CompletedAuctions />} />
              <Route path="/how-it-works" element={<HowItWorks />} />
              <Route path="/buyer-safety" element={<BuyerSafety />} />
              <Route path="/sellers" element={<SellerInformation />} />
              <Route path="/faq" element={<FAQ />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/privacy" element={<PrivacyPolicy />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/garage-sales" element={<GarageSales />} />
              <Route path="/garage-sales/:id" element={<GarageSaleEvent />} />
              <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
                <Route path="/watchlist" element={<Watchlist />} />
                <Route path="/sell-garage-sale" element={<SellGarageSale />} />
                <Route path="/my-bids" element={<MyBids />} />
                <Route path="/my-transactions" element={<MyTransactions />} />
                <Route path="/transactions/:id" element={<TransactionDetail />} />
                <Route path="/security" element={<SecuritySettings />} />
                <Route path="/verify-2fa" element={<VerifyTwoFactor />} />
                <Route path="/verify" element={<VerifyIdentity />} />
              </Route>
            </Route>

            {/* Authentication */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* Admin console — admin role required */}
            <Route element={<AdminRoute />}>
              <Route element={<AdminLayout />}>
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/admin/listings" element={<AdminListings />} />
                <Route path="/admin/accounts" element={<AdminAccounts />} />
                <Route path="/admin/settings" element={<AdminSettings />} />
                <Route path="/admin/verifications" element={<AdminVerifications />} />
                <Route path="/admin/payments" element={<AdminPayments />} />
              </Route>
            </Route>

            {/* Auctioneer console — auctioneer or admin role required */}
            <Route element={<AuctioneerRoute />}>
              <Route path="/auctioneer" element={<AuctioneerDashboard />} />
              <Route path="/auctioneer/manage/:id" element={<ManageEvent />} />
              <Route path="/go-live" element={<GoLive />} />
            </Route>

            <Route path="*" element={<PageNotFound />} />
          </Routes>
          <Toaster />
        </Router>
        </ThemeWrapper>
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App