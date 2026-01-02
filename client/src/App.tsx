import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "@/pages/Home";
import Login from "@/pages/Login"; // Import Login
import MobileHome from "@/pages/MobileHome"; // Import MobileHome
import LeafletTest from "@/pages/LeafletTest"; //Import LeafletTest
import { auth } from "@/lib/auth"; // Import auth utility
import { useLocation } from "wouter";
import { useEffect } from "react";


// Protected Route Wrapper
function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (!auth.isAuthenticated()) {
      setLocation("/login");
    }
  }, [location, setLocation]);

  if (!auth.isAuthenticated()) {
    return null; // Or a loading spinner while redirecting
  }

  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/mobile" component={MobileHome} />
      <Route path="/leaflet" component={LeafletTest} />
      <Route path="/">
        <ProtectedRoute component={Home} />
      </Route>
      <Route path="/404" component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  console.log("APP COMPONENT RENDERING"); // DEBUG LOG
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
