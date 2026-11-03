import { getDocsNav } from "@/components/site/docs/content";
import { DocsMobileBar } from "@/components/site/docs/MobileBar";
import { DocsSearchProvider, SearchTrigger } from "@/components/site/docs/Search";
import { DocsSidebar } from "@/components/site/docs/Sidebar";
import "@/components/site/docs/docs.css";

/**
 * The docs frame inside the site layout (navigation and footer come from there): the sidebar on wide
 * screens, the docs bar and menu on phones, and the search dialog. Pages render the article and
 * "On this page" themselves. Content lives in src/content/docs (see its README).
 */
export default function DocsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const nav = getDocsNav();
  return (
    <div className="d-layout">
      <DocsSearchProvider>
        <DocsMobileBar nav={nav} />
        <div className="d-shell">
          <div className="d-sidebar">
            <div className="d-sidebar__inner">
              <SearchTrigger />
              <DocsSidebar nav={nav} />
            </div>
          </div>
          <div className="d-main">{children}</div>
        </div>
      </DocsSearchProvider>
    </div>
  );
}
