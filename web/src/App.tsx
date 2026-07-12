import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from "react";
import { API_BASE_URL } from "./api/lusiyuan-api";
import { AdminShell, type AdminSection } from "./components/admin/AdminShell";
import { getStoredAdminToken, setStoredAdminToken } from "./utils/storage";

const ChatPage = lazy(() => import("./components/ChatPage").then((module) => ({ default: module.ChatPage })));
const ConfigCenterPage = lazy(() =>
  import("./components/admin/ConfigCenterPage").then((module) => ({ default: module.ConfigCenterPage }))
);
const ConversationHistoryPage = lazy(() =>
  import("./components/admin/ConversationHistoryPage").then((module) => ({ default: module.ConversationHistoryPage }))
);
const DashboardPage = lazy(() =>
  import("./components/admin/DashboardPage").then((module) => ({ default: module.DashboardPage }))
);
const ExpressionLearningPage = lazy(() =>
  import("./components/admin/ExpressionLearningPage").then((module) => ({ default: module.ExpressionLearningPage }))
);
const IslandHomePage = lazy(() =>
  import("./components/admin/IslandHomePage").then((module) => ({ default: module.IslandHomePage }))
);
const MemoryAdminPage = lazy(() =>
  import("./components/admin/MemoryAdminPage").then((module) => ({ default: module.MemoryAdminPage }))
);
const DreamPage = lazy(() =>
  import("./components/admin/OpsPage").then((module) => ({ default: module.DreamPage }))
);
const OperationsPage = lazy(() =>
  import("./components/admin/OperationsPage").then((module) => ({ default: module.OperationsPage }))
);
const PlatformsPage = lazy(() =>
  import("./components/admin/PlatformsPage").then((module) => ({ default: module.PlatformsPage }))
);
const XiaohongshuPlatformPage = lazy(() =>
  import("./components/admin/PlatformsPage").then((module) => ({ default: module.XiaohongshuPlatformPage }))
);
const RelationshipStatePage = lazy(() =>
  import("./components/admin/RelationshipStatePage").then((module) => ({ default: module.RelationshipStatePage }))
);
const RuntimeStatePage = lazy(() =>
  import("./components/admin/RuntimeStatePage").then((module) => ({ default: module.RuntimeStatePage }))
);
const SkillsAdminPage = lazy(() =>
  import("./components/admin/SkillsAdminPage").then((module) => ({ default: module.SkillsAdminPage }))
);
const ToolsAdminPage = lazy(() =>
  import("./components/admin/ToolsAdminPage").then((module) => ({ default: module.ToolsAdminPage }))
);

const sections: AdminSection[] = [
  "island",
  "overview",
  "runtime",
  "relationships",
  "memory",
  "conversations",
  "learning",
  "chat",
  "dream",
  "ops",
  "skills",
  "platforms",
  "tools",
  "settings",
];

interface AdminRoute {
  section: AdminSection;
  platformId?: string;
  skillId?: string;
  relationshipId?: string;
  conversationPersonId?: string;
  memoryPersonId?: string;
}

function PageLoading() {
  return (
    <section className="mx-auto max-w-5xl rounded-lg border border-[#d9e2ec] bg-white px-5 py-8 text-sm font-medium text-[#617188] shadow-[0_18px_48px_rgba(91,117,150,0.13)]">
      页面加载中…
    </section>
  );
}

function pathForSection(section: AdminSection): string {
  return section === "overview" ? "/admin" : `/admin/${section}`;
}

function readRouteFromLocation(): AdminRoute {
  const legacyHashValue = window.location.hash.replace(/^#\/?/, "");
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
  if (path.startsWith("/admin/skills/")) {
    return {
      section: "skills",
      skillId: path.slice("/admin/skills/".length),
    };
  }
  if (path.startsWith("/admin/relationships/")) {
    return {
      section: "relationships",
      relationshipId: path.slice("/admin/relationships/".length),
    };
  }
  if (path.startsWith("/admin/conversations/person/")) {
    return {
      section: "conversations",
      conversationPersonId: path.slice("/admin/conversations/person/".length),
    };
  }

  const value = path.startsWith("/admin/")
    ? path.slice("/admin/".length)
    : path === "/admin" || path === "" || path === "/"
      ? "overview"
      : "";
  if (value === "logs") {
    window.history.replaceState(null, "", pathForSection("tools"));
    return { section: "tools" };
  }
  return {
    section: sections.includes(value as AdminSection) ? (value as AdminSection) : "overview",
    memoryPersonId:
      value === "memory"
        ? new URLSearchParams(window.location.search).get("person") ?? undefined
        : undefined,
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

  const handleOpenSkill = useCallback((skillId: string) => {
    window.history.pushState(null, "", `/admin/skills/${skillId}`);
    setRoute({ section: "skills", skillId });
  }, []);

  const handleOpenSkillList = useCallback(() => {
    window.history.pushState(null, "", pathForSection("skills"));
    setRoute({ section: "skills" });
  }, []);

  const handleOpenRelationship = useCallback((relationshipId: string) => {
    window.history.pushState(null, "", `/admin/relationships/${relationshipId}`);
    setRoute({ section: "relationships", relationshipId });
  }, []);

  const handleOpenRelationshipList = useCallback(() => {
    window.history.pushState(null, "", pathForSection("relationships"));
    setRoute({ section: "relationships" });
  }, []);

  const handleOpenConversationPerson = useCallback((personId: string) => {
    window.history.pushState(null, "", `/admin/conversations/person/${personId}`);
    setRoute({ section: "conversations", conversationPersonId: personId });
  }, []);

  const handleOpenMemoryPerson = useCallback((personId: string) => {
    window.history.pushState(null, "", `/admin/memory?person=${encodeURIComponent(personId)}`);
    setRoute({ section: "memory", memoryPersonId: personId });
  }, []);

  function handleAdminTokenChange(token: string) {
    setAdminToken(token);
    setStoredAdminToken(token);
  }

  const content = useMemo(() => {
    if (route.section === "island") {
      return <IslandHomePage onNavigate={handleNavigate} />;
    }

    if (route.section === "overview") {
      return <DashboardPage adminToken={adminToken} />;
    }

    if (route.section === "chat") {
      return <ChatPage adminToken={adminToken} />;
    }

    if (route.section === "runtime") {
      return <RuntimeStatePage adminToken={adminToken} />;
    }

    if (route.section === "relationships") {
      return (
        <RelationshipStatePage
          adminToken={adminToken}
          selectedRelationshipId={route.relationshipId}
          onOpenRelationship={handleOpenRelationship}
          onBackToRelationshipList={handleOpenRelationshipList}
          onOpenConversationPerson={handleOpenConversationPerson}
          onOpenMemoryPerson={handleOpenMemoryPerson}
        />
      );
    }

    if (route.section === "conversations") {
      return (
        <ConversationHistoryPage
          adminToken={adminToken}
          personId={route.conversationPersonId}
          onOpenPerson={handleOpenConversationPerson}
          onOpenRelationship={handleOpenRelationship}
        />
      );
    }

    if (route.section === "memory") {
      return <MemoryAdminPage adminToken={adminToken} focusPersonId={route.memoryPersonId} />;
    }

    if (route.section === "skills") {
      return (
        <SkillsAdminPage
          adminToken={adminToken}
          selectedSkillId={route.skillId}
          onOpenSkill={handleOpenSkill}
          onBackToList={handleOpenSkillList}
        />
      );
    }

    if (route.section === "learning") {
      return <ExpressionLearningPage adminToken={adminToken} />;
    }

    if (route.section === "dream") {
      return <DreamPage adminToken={adminToken} />;
    }

    if (route.section === "ops") {
      return <OperationsPage adminToken={adminToken} />;
    }

    if (route.section === "platforms") {
      if (route.platformId === "xiaohongshu") {
        return (
          <XiaohongshuPlatformPage
            adminToken={adminToken}
            onBack={() => handleNavigate("platforms")}
            onOpenSkill={handleOpenSkill}
          />
        );
      }
      return <PlatformsPage onOpenPlatform={handleOpenPlatform} />;
    }

    if (route.section === "tools") {
      return <ToolsAdminPage adminToken={adminToken} />;
    }

    return <ConfigCenterPage adminToken={adminToken} />;
  }, [
    route,
    adminToken,
    handleNavigate,
    handleOpenPlatform,
    handleOpenSkill,
    handleOpenSkillList,
    handleOpenRelationship,
    handleOpenRelationshipList,
    handleOpenConversationPerson,
  ]);

  return (
    <AdminShell
      activeSection={route.section}
      adminToken={adminToken}
      apiBaseUrl={API_BASE_URL}
      onAdminTokenChange={handleAdminTokenChange}
      onNavigate={handleNavigate}
    >
      <Suspense fallback={<PageLoading />}>{content}</Suspense>
    </AdminShell>
  );
}
