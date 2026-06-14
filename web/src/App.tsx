import { useCallback, useEffect, useMemo, useState } from "react";
import { API_BASE_URL } from "./api/lusiyuan-api";
import { AdminShell, type AdminSection } from "./components/admin/AdminShell";
import { ConfigCenterPage } from "./components/admin/ConfigCenterPage";
import { DashboardPage } from "./components/admin/DashboardPage";
import { MemoryAdminPage } from "./components/admin/MemoryAdminPage";
import { DreamPage, ReflectionPage } from "./components/admin/OpsPage";
import { PlatformsPage, XiaohongshuPlatformPage } from "./components/admin/PlatformsPage";
import { RelationshipStatePage } from "./components/admin/RelationshipStatePage";
import { RuntimeStatePage } from "./components/admin/RuntimeStatePage";
import { ToolsAdminPage } from "./components/admin/ToolsAdminPage";
import { ChatPage } from "./components/ChatPage";
import { getStoredAdminToken, setStoredAdminToken } from "./utils/storage";

const sections: AdminSection[] = [
  "overview",
  "runtime",
  "relationships",
  "memory",
  "reflection",
  "dream",
  "platforms",
  "tools",
  "chat",
  "settings",
];

interface AdminRoute {
  section: AdminSection;
  platformId?: string;
}

function pathForSection(section: AdminSection): string {
  return section === "overview" ? "/admin" : `/admin/${section}`;
}

function readRouteFromLocation(): AdminRoute {
  const legacyHashValue = window.location.hash.replace(/^#\/?/, "");
  if (legacyHashValue === "ops") {
    window.history.replaceState(null, "", pathForSection("reflection"));
    return { section: "reflection" };
  }
  if (legacyHashValue === "logs") {
    window.history.replaceState(null, "", pathForSection("tools"));
    return { section: "tools" };
  }
  if (sections.includes(legacyHashValue as AdminSection)) {
    const section = legacyHashValue as AdminSection;
    window.history.replaceState(null, "", pathForSection(section));
    return { section };
  }

  const path = window.location.pathname.replace(/\/+$/, "");
  if (path.startsWith("/admin/platforms/")) {
    return {
      section: "platforms",
      platformId: path.slice("/admin/platforms/".length),
    };
  }

  const value = path.startsWith("/admin/")
    ? path.slice("/admin/".length)
    : path === "/admin" || path === "" || path === "/"
      ? "overview"
      : "";
  if (value === "ops") {
    window.history.replaceState(null, "", pathForSection("reflection"));
    return { section: "reflection" };
  }
  if (value === "logs") {
    window.history.replaceState(null, "", pathForSection("tools"));
    return { section: "tools" };
  }
  return {
    section: sections.includes(value as AdminSection) ? (value as AdminSection) : "overview",
  };
}

export default function App() {
  const [route, setRoute] = useState<AdminRoute>(readRouteFromLocation);
  const [adminToken, setAdminToken] = useState(getStoredAdminToken);

  useEffect(() => {
    const onPopState = () => setRoute(readRouteFromLocation());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const handleNavigate = useCallback((section: AdminSection) => {
    window.history.pushState(null, "", pathForSection(section));
    setRoute({ section });
  }, []);

  const handleOpenPlatform = useCallback((platformId: string) => {
    window.history.pushState(null, "", `/admin/platforms/${platformId}`);
    setRoute({ section: "platforms", platformId });
  }, []);

  function handleAdminTokenChange(token: string) {
    setAdminToken(token);
    setStoredAdminToken(token);
  }

  const content = useMemo(() => {
    if (route.section === "overview") {
      return <DashboardPage adminToken={adminToken} />;
    }

    if (route.section === "chat") {
      return <ChatPage />;
    }

    if (route.section === "runtime") {
      return <RuntimeStatePage adminToken={adminToken} />;
    }

    if (route.section === "relationships") {
      return <RelationshipStatePage adminToken={adminToken} />;
    }

    if (route.section === "memory") {
      return <MemoryAdminPage adminToken={adminToken} />;
    }

    if (route.section === "reflection") {
      return <ReflectionPage adminToken={adminToken} />;
    }

    if (route.section === "dream") {
      return <DreamPage adminToken={adminToken} />;
    }

    if (route.section === "platforms") {
      if (route.platformId === "xiaohongshu") {
        return <XiaohongshuPlatformPage onBack={() => handleNavigate("platforms")} />;
      }
      return <PlatformsPage onOpenPlatform={handleOpenPlatform} />;
    }

    if (route.section === "tools") {
      return <ToolsAdminPage adminToken={adminToken} />;
    }

    return <ConfigCenterPage adminToken={adminToken} />;
  }, [route, adminToken, handleNavigate, handleOpenPlatform]);

  return (
    <AdminShell
      activeSection={route.section}
      adminToken={adminToken}
      apiBaseUrl={API_BASE_URL}
      onAdminTokenChange={handleAdminTokenChange}
      onNavigate={handleNavigate}
    >
      {content}
    </AdminShell>
  );
}
