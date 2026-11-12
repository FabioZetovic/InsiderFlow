import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { Layout } from './components/Layout';
import { Skeleton } from './components/ui';

// Route-level code splitting: each page (and its chart library usage) loads on demand.
const Login = lazy(() => import('./pages/Login').then((m) => ({ default: m.Login })));
const Register = lazy(() => import('./pages/Register').then((m) => ({ default: m.Register })));
const Insiders = lazy(() => import('./pages/Insiders').then((m) => ({ default: m.Insiders })));
const MemberDetail = lazy(() => import('./pages/MemberDetail').then((m) => ({ default: m.MemberDetail })));
const SectorDetail = lazy(() => import('./pages/SectorDetail').then((m) => ({ default: m.SectorDetail })));
const TickerDetail = lazy(() => import('./pages/TickerDetail').then((m) => ({ default: m.TickerDetail })));
const Leaderboard = lazy(() => import('./pages/Leaderboard').then((m) => ({ default: m.Leaderboard })));
const Signals = lazy(() => import('./pages/Signals').then((m) => ({ default: m.Signals })));
const Trades = lazy(() => import('./pages/Trades').then((m) => ({ default: m.Trades })));
const Feed = lazy(() => import('./pages/Feed').then((m) => ({ default: m.Feed })));
const Compare = lazy(() => import('./pages/Compare').then((m) => ({ default: m.Compare })));
const MarketFlow = lazy(() => import('./pages/MarketFlow').then((m) => ({ default: m.MarketFlow })));

function RedirectWithSearch({ to }: { to: string }) {
  const { search } = useLocation();
  return <Navigate to={to + search} replace />;
}

function PageFallback() {
  return (
    <div className="space-y-4 p-4">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-72 w-full" />
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/" element={<Navigate to="/insiders" replace />} />
            <Route path="/insiders" element={<Insiders />} />
            <Route path="/insiders/member/:member" element={<MemberDetail />} />
            <Route path="/insiders/sector/:sector" element={<SectorDetail />} />
            <Route path="/insiders/ticker/:ticker" element={<TickerDetail />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/signals" element={<Signals />} />
            <Route path="/trades" element={<Trades />} />
            {/* Old URL: keep links like /corporate?view=corporate working */}
            <Route path="/corporate" element={<RedirectWithSearch to="/trades" />} />
            <Route path="/feed" element={<Feed />} />
            <Route path="/compare" element={<Compare />} />
            <Route path="/market" element={<MarketFlow />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
