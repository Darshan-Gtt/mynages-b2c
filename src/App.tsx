import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useDb } from './lib/store';
import { useMe } from './lib/session';
import { DeviceFrame, TabsLayout } from './components/Shell';
import { EditorProvider } from './components/editors/Editors';
import { AuthPage } from './pages/Auth';
import { OnboardingPage } from './pages/Onboarding';
import { HomePage } from './pages/Home';
import { AssetsPage, ArchivedPage } from './pages/Assets';
import { Asset360Page, AssetPdfPage } from './pages/Asset360';
import { TasksPage } from './pages/Tasks';
import { SearchPage, NotificationsPage } from './pages/SearchNotif';
import { MorePage, ModuleGate } from './pages/More';
import { FamilyPage, MemberPage } from './pages/Family';
import { ContactsPage, DocumentsPage, HealthPage, InsurancePage, MaintenancePage, QrPage, SavingsPage, WarrantiesPage } from './pages/Modules';
import { ReportPage, ReportsPage } from './pages/Reports';
import { SettingsPage, SettingsSubPage } from './pages/Settings';

/** Applies the theme preference (light / dark / follow phone). */
function useTheme() {
  const theme = useDb().settings.theme;
  useEffect(() => {
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    };
    apply();
    if (theme !== 'auto') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);
}

function ScrollTop() {
  const { pathname } = useLocation();
  useEffect(() => { document.getElementById('screen')?.scrollTo({ top: 0 }); }, [pathname]);
  return null;
}

function Routed() {
  const db = useDb();
  const me = useMe();
  if (!me) return <AuthPage />;
  if (!db.settings.onboarded && me.role === 'owner') return <OnboardingPage />;
  return (
    <EditorProvider>
      <ScrollTop />
      <Routes>
        <Route path="/assets/:id/pdf" element={<AssetPdfPage />} />
        <Route element={<TabsLayout />}>
          <Route index element={<HomePage />} />
          <Route path="assets" element={<AssetsPage />} />
          <Route path="assets/archived" element={<ArchivedPage />} />
          <Route path="assets/:id" element={<Asset360Page />} />
          <Route path="tasks" element={<TasksPage />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="more" element={<MorePage />} />
          <Route path="more/family" element={<FamilyPage />} />
          <Route path="more/family/:id" element={<MemberPage />} />
          <Route path="more/documents" element={<DocumentsPage />} />
          <Route path="more/insurance" element={<ModuleGate mod="insurance"><InsurancePage /></ModuleGate>} />
          <Route path="more/warranties" element={<ModuleGate mod="warranties"><WarrantiesPage /></ModuleGate>} />
          <Route path="more/maintenance" element={<ModuleGate mod="maintenance"><MaintenancePage /></ModuleGate>} />
          <Route path="more/contacts" element={<ContactsPage />} />
          <Route path="more/savings" element={<ModuleGate mod="savings"><SavingsPage /></ModuleGate>} />
          <Route path="more/health" element={<ModuleGate mod="health"><HealthPage /></ModuleGate>} />
          <Route path="more/reports" element={<ModuleGate mod="reports"><ReportsPage /></ModuleGate>} />
          <Route path="more/reports/:id" element={<ModuleGate mod="reports"><ReportPage /></ModuleGate>} />
          <Route path="more/qr" element={<ModuleGate mod="qr"><QrPage /></ModuleGate>} />
          <Route path="more/settings" element={<SettingsPage />} />
          <Route path="more/settings/:section" element={<SettingsSubPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </EditorProvider>
  );
}

export default function App() {
  useTheme();
  return <DeviceFrame><Routed /></DeviceFrame>;
}
