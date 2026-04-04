"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import {
  FlaskConical,
  LayoutDashboard,
  FolderOpen,
  Building2,
  Compass,
  Download,
  Info,
  Menu,
  X,
  Moon,
  Sun,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Nav items
// ---------------------------------------------------------------------------

const NAV_ITEMS = [
  { href: "/dashboard",    label: "Dashboard",    icon: LayoutDashboard },
  { href: "/projects",     label: "Projects",     icon: FolderOpen      },
  { href: "/institutions", label: "Institutions", icon: Building2       },
  { href: "/explore",      label: "Explore",      icon: Compass         },
  { href: "/export",       label: "Export",       icon: Download        },
  { href: "/about",        label: "About",        icon: Info            },
] as const;

// ---------------------------------------------------------------------------
// Theme toggle hook
// ---------------------------------------------------------------------------

function useTheme() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggle = useCallback(() => {
    const next = !dark;
    setDark(next);
    if (next) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [dark]);

  return { dark, toggle };
}

// ---------------------------------------------------------------------------
// Sidebar component
// ---------------------------------------------------------------------------

export function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { dark, toggle } = useTheme();

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  // Prevent body scroll when mobile sidebar is open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      {/* ------------------------------------------------------------------ */}
      {/* Mobile header bar (visible on < lg)                                 */}
      {/* ------------------------------------------------------------------ */}
      <div className="fixed top-0 left-0 right-0 z-40 flex h-14 items-center justify-between border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 lg:hidden">
        <div className="flex items-center gap-2">
          <FlaskConical className="h-5 w-5 text-primary-700 dark:text-primary-500" aria-hidden />
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-tight">
            FWF Open Science Monitor
          </span>
        </div>
        <button
          onClick={() => setOpen(true)}
          aria-label="Open navigation menu"
          aria-expanded={open}
          aria-controls="sidebar"
          className="rounded-md p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {/* Mobile top-bar spacer */}
      <div className="h-14 lg:hidden flex-shrink-0" aria-hidden />

      {/* ------------------------------------------------------------------ */}
      {/* Overlay backdrop (mobile only)                                       */}
      {/* ------------------------------------------------------------------ */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          aria-hidden
          onClick={() => setOpen(false)}
        />
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Sidebar panel                                                        */}
      {/* ------------------------------------------------------------------ */}
      <aside
        id="sidebar"
        role="navigation"
        aria-label="Main navigation"
        className={[
          // Base
          "fixed top-0 left-0 z-50 flex h-full w-64 flex-col",
          "bg-gray-50 dark:bg-gray-900",
          "border-r border-gray-200 dark:border-gray-800",
          // Desktop: always visible
          "lg:translate-x-0 lg:z-30",
          // Mobile: slide in/out
          open ? "translate-x-0" : "-translate-x-full",
          "transition-transform duration-200 ease-in-out lg:transition-none",
        ].join(" ")}
      >
        {/* Header */}
        <div className="flex h-16 flex-shrink-0 items-center justify-between px-4 border-b border-gray-200 dark:border-gray-800">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 min-w-0 group"
            aria-label="FWF Open Science Monitor — go to dashboard"
          >
            <FlaskConical
              className="h-6 w-6 flex-shrink-0 text-primary-700 dark:text-primary-500 group-hover:text-primary-600 transition-colors"
              aria-hidden
            />
            <span className="text-sm font-bold text-gray-900 dark:text-gray-100 leading-tight truncate group-hover:text-primary-700 dark:group-hover:text-primary-400 transition-colors">
              FWF Open Science Monitor
            </span>
          </Link>
          {/* Mobile close */}
          <button
            onClick={() => setOpen(false)}
            aria-label="Close navigation menu"
            className="lg:hidden ml-2 flex-shrink-0 rounded-md p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto py-4 px-3" aria-label="Primary navigation">
          <ul role="list" className="space-y-0.5">
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
              const isActive =
                href === "/dashboard"
                  ? pathname === "/dashboard" || pathname === "/"
                  : pathname.startsWith(href);

              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={isActive ? "page" : undefined}
                    className={[
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400"
                        : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100",
                    ].join(" ")}
                  >
                    <Icon
                      className={[
                        "h-4 w-4 flex-shrink-0",
                        isActive
                          ? "text-primary-600 dark:text-primary-400"
                          : "text-gray-400 dark:text-gray-500",
                      ].join(" ")}
                      aria-hidden
                    />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-800 px-4 py-3">
          {/* Theme toggle */}
          <button
            onClick={toggle}
            aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100 transition-colors mb-2"
          >
            {dark ? (
              <Sun className="h-4 w-4 flex-shrink-0 text-gray-400" aria-hidden />
            ) : (
              <Moon className="h-4 w-4 flex-shrink-0 text-gray-400" aria-hidden />
            )}
            {dark ? "Light mode" : "Dark mode"}
          </button>

          <p className="text-xs text-gray-400 dark:text-gray-600 leading-relaxed">
            Data:{" "}
            <a
              href="https://openapi.fwf.ac.at"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-gray-600 dark:hover:text-gray-400"
            >
              FWF Open API
            </a>
            {" · "}
            <a
              href="https://creativecommons.org/publicdomain/zero/1.0/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-gray-600 dark:hover:text-gray-400"
            >
              CC0 License
            </a>
          </p>
        </div>
      </aside>
    </>
  );
}
