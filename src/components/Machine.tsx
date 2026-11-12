import { useEffect, useState } from "react";
import type { Language, Messages } from "../i18n";
import type { CalendarDay, YearStories } from "../model";
import { Arrow, domain, fmt, style, Title, weekday } from "./shared";

export function Machine({
  years,
  date,
  currentYear,
  language,
  text,
}: {
  years: YearStories[];
  date: CalendarDay;
  currentYear: number;
  language: Language;
  text: Messages;
}) {
  const chrono = [...years].reverse();
  const [index, setIndex] = useState(chrono.length - 1);
  const [playing, setPlaying] = useState(() => !matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [hovering, setHovering] = useState(false);
  useEffect(() => {
    if (!playing || hovering || chrono.length < 2) return;
    const timer = setInterval(() => {
      if (!document.hidden) setIndex((i) => (i - 1 + chrono.length) % chrono.length);
    }, 3000);
    return () => clearInterval(timer);
  }, [playing, hovering, chrono.length]);
  const selected = chrono[Math.min(index, chrono.length - 1)];
  if (!selected) return null;
  const first = selected.stories[0];
  const scores = chrono.map((y) => y.stories[0].score);
  const min = Math.min(...scores),
    max = Math.max(...scores);
  const pick = (clientX: number, ruler: HTMLElement) => {
    const rect = ruler.getBoundingClientRect();
    const padding = Number.parseFloat(getComputedStyle(ruler).paddingLeft);
    const next = Math.floor((clientX - rect.left - padding) / ((rect.width - padding * 2) / chrono.length));
    setIndex(Math.max(0, Math.min(chrono.length - 1, next)));
  };
  return (
    <div
      className={`machine${playing ? "" : " paused"}`}
      data-enter
      style={style({ "--d": 940 })}
      data-spot
      onPointerEnter={() => setHovering(true)}
      onPointerLeave={() => setHovering(false)}
    >
      <div className="m-head">
        <button
          className="m-play mono"
          type="button"
          aria-pressed={playing}
          onClick={() => setPlaying(!playing)}
        >
          <i className="m-dot" />
          <span>{playing ? text.autoplay : text.paused}</span>
        </button>
        <div className="mono">
          {text.yearsAgo(currentYear - selected.year)} ·{" "}
          {weekday(selected.year, date.month, date.day, language)}
        </div>
      </div>
      <div className="m-body">
        <div className="odo" aria-hidden="true">
          {String(selected.year)
            .split("")
            .map((ch, n) => (
              <div
                key={["thousands", "hundreds", "tens", "ones"][n]}
                className={`odo-col${n > 1 ? " hot" : ""}`}
                style={style({ "--v": ch, "--n": 3 - n })}
              >
                {"0123456789".split("").map((c) => (
                  <span key={c}>{c}</span>
                ))}
              </div>
            ))}
        </div>
        <div className="m-info" aria-live="polite" key={selected.year}>
          <div className="m-kicker mono swap">
            <span>{text.topStory}</span>
            <b>{text.sortedByScore}</b>
          </div>
          <h2 className="m-title swap">
            <Title title={first.title} />
          </h2>
          <div className="m-meta swap">
            <span>
              <b>▲ {fmt(first.score)}</b> {text.points(first.score)}
            </span>
            <span>
              <b>{fmt(first.comments)}</b> {text.comments(first.comments)}
            </span>
            <span>{domain(first)}</span>
            <span>by {first.author || text.unknownAuthor}</span>
          </div>
          <button
            className="m-go"
            type="button"
            onClick={() =>
              document.getElementById(`y${selected.year}`)?.scrollIntoView({ behavior: "smooth" })
            }
          >
            {text.goYear} <Arrow />
          </button>
        </div>
      </div>
      <fieldset
        className="ruler"
        aria-label={text.chooseYear}
        style={style({ "--year-count": chrono.length })}
        onPointerDown={(event) => {
          setPlaying(false);
          pick(event.clientX, event.currentTarget);
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (event.pointerType === "mouse" || event.buttons) pick(event.clientX, event.currentTarget);
        }}
        onKeyDown={(event) => {
          if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
          event.preventDefault();
          setPlaying(false);
          const next = Math.max(
            0,
            Math.min(chrono.length - 1, index + (event.key === "ArrowRight" ? 1 : -1)),
          );
          setIndex(next);
          event.currentTarget.querySelectorAll<HTMLButtonElement>(".tick")[next]?.focus();
        }}
      >
        <i className="needle" style={style({ "--i": Math.min(index, chrono.length - 1) })} />
        {chrono.map((year, i) => (
          <button
            key={year.year}
            className={`tick${i === index ? " on" : ""}`}
            type="button"
            aria-label={text.year(year.year)}
            aria-pressed={i === index}
            style={style({
              "--h": `${16 + Math.round(((year.stories[0].score - min) / Math.max(1, max - min)) * 46)}px`,
            })}
            onPointerEnter={(event) => {
              if (event.pointerType === "mouse") setIndex(i);
            }}
            onFocus={() => setIndex(i)}
            onClick={() => {
              setIndex(i);
              setPlaying(false);
            }}
          >
            <i />
            <span className="yf">{year.year}</span>
            <span className="yy">’{String(year.year).slice(2)}</span>
          </button>
        ))}
      </fieldset>
    </div>
  );
}
