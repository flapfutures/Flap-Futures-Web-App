import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WalletProvider } from "@/components/WalletProvider";
import Home from "@/pages/home";
import DashboardShell from "@/pages/dashboard-shell";
import Dev88 from "@/pages/dev88";
import Whitepaper from "@/pages/whitepaper";
import NotFound from "@/pages/not-found";
import { useAnalytics } from "@/hooks/useAnalytics";

function Tracker() {
  useAnalytics();
  return null;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/dashboard" component={DashboardShell} />
      <Route path="/perps"><Redirect to="/dashboard#futures" /></Route>
      <Route path="/futures"><Redirect to="/dashboard#futures" /></Route>
      <Route path="/apply"><Redirect to="/dashboard#apply" /></Route>
      <Route path="/dashboard/market/:id">
        {(params) => <Redirect to={`/dashboard#market-${params.id}`} />}
      </Route>
      <Route path="/admin/:tokenId">
        {(params) => <Redirect to={`/dashboard#admin-${params.tokenId}`} />}
      </Route>
      <Route path="/dev88" component={Dev88} />
      <Route path="/whitepaper" component={Whitepaper} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WalletProvider>
        <TooltipProvider>
          <Toaster />
          <Tracker />
          <Router />
        </TooltipProvider>
      </WalletProvider>
    </QueryClientProvider>
  );
}

export default App;
