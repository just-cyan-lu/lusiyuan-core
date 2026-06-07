import { useEffect, useMemo, useState } from "react";
import { API_BASE_URL } from "./api/lusiyuan-api";
import { AdminShell, type AdminSection } from "./components/admin/AdminShell";
import { DashboardPage } from "./components/admin/DashboardPage";
import { MemoryAdminPage } from "./components/admin/MemoryAdminPage";
import { PlaceholderPage } from "./components/admin/PlaceholderPage";
import { ChatPage } from "./components/ChatPage";
import { getStoredAdminToken, setStoredAdminToken } from "./utils/storage";

const sections: AdminSection[] = [
  "overview",
  "memory",
  "ops",
  "drafts",
  "logs",
  "chat",
  "settings",
];

function pathForSection(section: AdminSection): string {
  return section === "overview" ? "/admin" : `/admin/${section}`;
}

function readSectionFromLocation(): AdminSection {
  const legacyHashValue = window.location.hash.replace(/^#\/?/, "");
  if (sections.includes(legacyHashValue as AdminSection)) {
    const section = legacyHashValue as AdminSection;
    window.history.replaceState(null, "", pathForSection(section));
    return section;
  }

  const path = window.location.pathname.replace(/\/+$/, "");
  const value = path.startsWith("/admin/")
    ? path.slice("/admin/".length)
    : path === "/admin" || path === "" || path === "/"
      ? "overview"
      : "";
  return sections.includes(value as AdminSection) ? (value as AdminSection) : "overview";
}

export default function App() {
  const [activeSection, setActiveSection] = useState<AdminSection>(readSectionFromLocation);
  const [adminToken, setAdminToken] = useState(getStoredAdminToken);

  useEffect(() => {
    const onPopState = () => setActiveSection(readSectionFromLocation());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  function handleNavigate(section: AdminSection) {
    window.history.pushState(null, "", pathForSection(section));
    setActiveSection(section);
  }

  function handleAdminTokenChange(token: string) {
    setAdminToken(token);
    setStoredAdminToken(token);
  }

  const content = useMemo(() => {
    if (activeSection === "overview") {
      return <DashboardPage adminToken={adminToken} />;
    }

    if (activeSection === "chat") {
      return <ChatPage />;
    }

    if (activeSection === "memory") {
      return <MemoryAdminPage adminToken={adminToken} />;
    }

    if (activeSection === "ops") {
      return (
        <PlaceholderPage
          eyebrow="Dream / Reflection"
          title="系统运行与复盘"
          summary="这里会承载 Dream Cycle、Reflection 手动触发、报告查看和运行状态。第一版先保持只读和单次触发，不做复杂调度。"
          items={["Reflection 报告", "Dream Daily Note", "Dream Signal", "Morning Brief"]}
        />
      );
    }

    if (activeSection === "drafts") {
      return (
        <PlaceholderPage
          eyebrow="Draft Desk"
          title="草稿管理"
          summary="草稿会作为内容生产的轻量审核台：查看、批准、拒绝、标记发送。"
          items={["草稿列表", "状态筛选", "详情预览", "状态流转"]}
        />
      );
    }

    if (activeSection === "logs") {
      return (
        <PlaceholderPage
          eyebrow="Observability"
          title="工具调用日志"
          summary="这里用于追踪工具调用、失败原因、耗时和风险等级。先做可读性，再做筛选和详情抽屉。"
          items={["工具名称", "调用状态", "风险等级", "耗时与阻断原因"]}
        />
      );
    }

    return (
      <PlaceholderPage
        eyebrow="Configuration"
        title="配置中心"
        summary="配置第一版先做只读状态：模型、渠道、工具、Dream、Reflection 是否启用。API key 和 token 继续由 .env 管理。"
        items={["模型提供商状态", "渠道连接状态", "功能开关", "安全阈值"]}
      />
    );
  }, [activeSection, adminToken]);

  return (
    <AdminShell
      activeSection={activeSection}
      adminToken={adminToken}
      apiBaseUrl={API_BASE_URL}
      onAdminTokenChange={handleAdminTokenChange}
      onNavigate={handleNavigate}
    >
      {content}
    </AdminShell>
  );
}
