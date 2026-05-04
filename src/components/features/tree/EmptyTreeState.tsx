"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";

interface EmptyTreeStateProps {
  mode: "noTree" | "emptyTree";
}

export function EmptyTreeState({ mode }: EmptyTreeStateProps) {
  const t = useTranslations("treePage");

  const title = mode === "noTree" ? t("noTreeTitle") : t("emptyTitle");
  const description =
    mode === "noTree" ? t("noTreeDescription") : t("emptyDescription");
  const actionLabel = mode === "noTree" ? t("noTreeAction") : t("emptyAction");

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-20">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-5 rounded-2xl border-2 border-dashed border-gray-200 bg-white px-8 py-12 text-center shadow-sm">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50">
            {mode === "emptyTree" ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.75}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-8 w-8 text-emerald-600"
                aria-hidden="true"
              >
                <circle cx="9" cy="7" r="4" />
                <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
                <line x1="19" y1="8" x2="19" y2="14" />
                <line x1="22" y1="11" x2="16" y2="11" />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.75}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-8 w-8 text-emerald-600"
                aria-hidden="true"
              >
                <circle cx="12" cy="5" r="2" />
                <circle cx="5" cy="19" r="2" />
                <circle cx="19" cy="19" r="2" />
                <line x1="12" y1="7" x2="5" y2="17" />
                <line x1="12" y1="7" x2="19" y2="17" />
                <line x1="5" y1="17" x2="19" y2="17" />
              </svg>
            )}
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
            <p className="text-sm leading-relaxed text-gray-500">{description}</p>
          </div>

          {mode === "noTree" ? (
            <Link
              href="/setup-root"
              className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
                aria-hidden="true"
              >
                <circle cx="9" cy="7" r="4" />
                <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
                <line x1="19" y1="8" x2="19" y2="14" />
                <line x1="22" y1="11" x2="16" y2="11" />
              </svg>
              {actionLabel}
            </Link>
          ) : (
            <p className="mt-1 text-xs font-medium text-emerald-800" aria-live="polite">
              {actionLabel}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
