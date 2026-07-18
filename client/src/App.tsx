import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import { useEffect } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import ReferralAttribution from "./components/ReferralAttribution";
import { ThemeProvider } from "./contexts/ThemeContext";
import { TextSizeProvider } from "./contexts/TextSizeContext";
import Home from "./pages/Home";
import DailyGame from "./pages/DailyGame";
import GameResult from "./pages/GameResult";
import Leaderboard from "./pages/Leaderboard";
import ResearchHub from "./pages/ResearchHub";
import LearningHub from "./pages/LearningHub";
import LessonPage from "./pages/LessonPage";
import ArchiveGame from "./pages/ArchiveGame";
import PlayerProfile from "./pages/PlayerProfile";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminCreateGame from "./pages/admin/AdminCreateGame";
import AdminEditGame from "./pages/admin/AdminEditGame";
import AdminPublishResult from "./pages/admin/AdminPublishResult";
import AdminPlayers from "./pages/admin/AdminPlayers";
import AdminAuditLog from "./pages/admin/AdminAuditLog";
import AdminEndOfDay from "./pages/admin/AdminEndOfDay";
import MyDashboard from "./pages/MyDashboard";
import TermsOfUse from "./pages/legal/TermsOfUse";
import PrivacyPolicy from "./pages/legal/PrivacyPolicy";
import Disclaimer from "./pages/legal/Disclaimer";
import ResponsibleGaming from "./pages/legal/ResponsibleGaming";
import EmailLanding from "./pages/EmailLanding";
import Demo from "./pages/Demo";
import Feedback from "./pages/Feedback";

function ScrollToTop() {
  const [location] = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [location]);
  return null;
}

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
      <Route path="/learn" component={LearningHub} />
      <Route path="/learn/:lessonId" component={LessonPage} />
      <Route path="/profile" component={PlayerProfile} />
      <Route path="/dashboard" component={MyDashboard} />
      <Route path="/demo" component={Demo} />
      <Route path="/feedback" component={Feedback} />
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

      <Route path="/email-landing" component={EmailLanding} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light" switchable>
        <TextSizeProvider>
          <TooltipProvider>
            <Toaster richColors position="top-right" />
            <ScrollToTop />
            <ReferralAttribution />
            <Router />
          </TooltipProvider>
        </TextSizeProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
