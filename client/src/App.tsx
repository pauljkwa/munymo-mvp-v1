import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import DailyGame from "./pages/DailyGame";
import GameResult from "./pages/GameResult";
import Leaderboard from "./pages/Leaderboard";
import ResearchHub from "./pages/ResearchHub";
import ArchiveGame from "./pages/ArchiveGame";
import PlayerProfile from "./pages/PlayerProfile";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminCreateGame from "./pages/admin/AdminCreateGame";
import AdminEditGame from "./pages/admin/AdminEditGame";
import AdminPublishResult from "./pages/admin/AdminPublishResult";
import AdminPlayers from "./pages/admin/AdminPlayers";
import AdminAuditLog from "./pages/admin/AdminAuditLog";
import AdminEndOfDay from "./pages/admin/AdminEndOfDay";
import EvolutionOfMunymo from "./pages/EvolutionOfMunymo";
import TermsOfUse from "./pages/legal/TermsOfUse";
import PrivacyPolicy from "./pages/legal/PrivacyPolicy";
import Disclaimer from "./pages/legal/Disclaimer";
import ResponsibleGaming from "./pages/legal/ResponsibleGaming";

function Router() {
  return (
    <Switch>
      {/* Public */}
      <Route path="/" component={Home} />
      <Route path="/game" component={DailyGame} />
      <Route path="/game/:id/result" component={GameResult} />
      <Route path="/leaderboard" component={Leaderboard} />
      <Route path="/research" component={ResearchHub} />
      <Route path="/research/:id" component={ArchiveGame} />
      <Route path="/profile" component={PlayerProfile} />
      <Route path="/evolution" component={EvolutionOfMunymo} />
      <Route path="/terms" component={TermsOfUse} />
      <Route path="/privacy" component={PrivacyPolicy} />
      <Route path="/disclaimer" component={Disclaimer} />
      <Route path="/responsible-gaming" component={ResponsibleGaming} />

      {/* Admin */}
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/admin/games/new" component={AdminCreateGame} />
      <Route path="/admin/games/:id/edit" component={AdminEditGame} />
      <Route path="/admin/games/:id/result" component={AdminPublishResult} />
      <Route path="/admin/players" component={AdminPlayers} />
      <Route path="/admin/audit" component={AdminAuditLog} />
      <Route path="/admin/end-of-day" component={AdminEndOfDay} />

      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light" switchable>
        <TooltipProvider>
          <Toaster richColors position="top-right" />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
