import type { CSSProperties, ReactNode } from "react";
import type { Language } from "../i18n";
import type { Story } from "../model";

export const fmt = (n: number) => Math.round(n).toLocaleString("en-US");
export const style = (values: Record<string, string | number>) => values as CSSProperties;
export const discussionUrl = (id: number) => `https://news.ycombinator.com/item?id=${id}`;
export const weekday = (year: number, month: number, day: number, language: Language) =>
  new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en-US", { weekday: "long", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, day)),
  );

export function domain(story: Story): string {
  try {
    const url = new URL(story.url);
    if (url.protocol === "https:" || url.protocol === "http:") return url.hostname;
  } catch {}
  return "news.ycombinator.com";
}

export function Title({ title }: { title: string }): ReactNode {
  const match = /^(Show HN|Ask HN): (.*)$/.exec(title);
  return match ? (
    <>
      <span className="tag">{match[1]}</span>
      {match[2]}
    </>
  ) : (
    title
  );
}

export function Arrow({ direction = "down" }: { direction?: "down" | "right" | "left" }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path
        d={
          direction === "down"
            ? "M8 2.5v11M3.5 9 8 13.5 12.5 9"
            : direction === "right"
              ? "M2.5 8h11M9 3.5 13.5 8 9 12.5"
              : "M13.5 8h-11M7 3.5 2.5 8 7 12.5"
        }
      />
    </svg>
  );
}

export function Points({ score }: { score: number }) {
  return (
    <span className="pts">
      <i className="tri" />
      {fmt(score)}
    </span>
  );
}
