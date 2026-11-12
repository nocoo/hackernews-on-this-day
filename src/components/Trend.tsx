import { useState } from "react";
import type { YearStories } from "../model";
import { fmt, Points, style } from "./shared";

export function Trend({ years }: { years: YearStories[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const chrono = [...years].reverse();
  if (!chrono.length) return null;
  const values = chrono.map((y) => y.stories[0].score);
  const max = Math.max(...values),
    min = Math.min(...values);
  const lo = Math.min(0, min * 0.5),
    hi = Math.max(lo + 1, max * 1.05);
  const points = chrono.map((year, i) => ({
    x: 34 + (i * 932) / Math.max(1, chrono.length - 1),
    y: 44 + (1 - (year.stories[0].score - lo) / (hi - lo)) * 222,
    year,
  }));
  let path = `M${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i],
      p1 = points[i],
      p2 = points[i + 1],
      p3 = points[i + 2] || p2,
      t = 0.17;
    path += ` C${p1.x + (p2.x - p0.x) * t},${p1.y + (p2.y - p0.y) * t} ${p2.x - (p3.x - p1.x) * t},${p2.y - (p3.y - p1.y) * t} ${p2.x},${p2.y}`;
  }
  const peak = points.reduce((a, b) => (b.year.stories[0].score > a.year.stories[0].score ? b : a));
  const selected = hover === null ? null : points[hover];
  const all = years.flatMap((y) => y.stories);
  const show = all.filter((s) => /^Show HN:/i.test(s.title)).length;
  const ask = all.filter((s) => /^Ask HN:/i.test(s.title)).length;
  const hot = years.reduce((a, b) => (b.stories[0].score > a.stories[0].score ? b : a));
  const quiet = years.reduce((a, b) => (b.stories[0].score < a.stories[0].score ? b : a));
  const cards = [
    ["最热的一年", hot.year, `榜首获得 ${fmt(hot.stories[0].score)} 分。`],
    ["最安静的一年", quiet.year, `榜首获得 ${fmt(quiet.stories[0].score)} 分。`],
    ["Show HN", `×${show}`, "榜单中 Show HN 帖子的数量。"],
    ["Ask HN", `×${ask}`, "榜单中 Ask HN 帖子的数量。"],
  ] as const;
  return (
    <section className="trend" id="trend">
      <div className="wrap">
        <div className="sec-head">
          <div>
            <div className="mono">02 — 一条时间线</div>
            <h2>同一天，热度的起伏。</h2>
          </div>
          <p>每年这一天榜首帖子的分数。把指针移到任意一年，看看当时大家在聊什么。</p>
        </div>
        <div className={`chart${selected ? " hover" : ""}`} id="chart" data-rv>
          <div className="chart-head">
            <span className="mono">当日榜首 · 分数</span>
            <span className="mono">
              {chrono[0].year} — {chrono.at(-1)?.year}
            </span>
          </div>
          <div className="chart-scroll">
            <div
              className="chart-box"
              onPointerLeave={() => setHover(null)}
              role="slider"
              tabIndex={0}
              aria-label="当日榜首分数，使用左右方向键选择年份，回车跳转"
              aria-valuemin={0}
              aria-valuemax={points.length - 1}
              aria-valuenow={hover ?? 0}
              aria-valuetext={`${(selected ?? points[0]).year.year} 年，${(selected ?? points[0]).year.stories[0].score} 分`}
              onFocus={() => setHover((value) => value ?? 0)}
              onBlur={() => setHover(null)}
              onKeyDown={(event) => {
                if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                  event.preventDefault();
                  setHover((value) =>
                    Math.max(
                      0,
                      Math.min(points.length - 1, (value ?? 0) + (event.key === "ArrowRight" ? 1 : -1)),
                    ),
                  );
                } else if (event.key === "Enter" && selected) {
                  document.getElementById(`y${selected.year.year}`)?.scrollIntoView({ behavior: "smooth" });
                }
              }}
              onPointerMove={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                const x = ((e.clientX - r.left) / r.width) * 1000;
                setHover(
                  Math.max(
                    0,
                    Math.min(
                      points.length - 1,
                      Math.round((x - 34) / (932 / Math.max(1, points.length - 1))),
                    ),
                  ),
                );
              }}
              onClick={() => {
                if (selected)
                  document.getElementById(`y${selected.year.year}`)?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              <svg viewBox="0 0 1000 310" aria-hidden="true">
                <defs>
                  <linearGradient id="areaG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="var(--accent)" stopOpacity=".26" />
                    <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {[0, 1, 2, 3].map((k) => (
                  <g key={k}>
                    <line className="c-grid" x1="34" x2="966" y1={44 + k * 74} y2={44 + k * 74} />
                    {k < 3 && (
                      <text className="c-yl" x="34" y={37 + k * 74}>
                        {fmt(Math.round((hi - (k * (hi - lo)) / 3) / 10) * 10)}
                      </text>
                    )}
                  </g>
                ))}
                <path
                  className="c-area"
                  fill="url(#areaG)"
                  d={`${path} L${points.at(-1)?.x},266 L${points[0].x},266 Z`}
                />
                <line className="c-guide" x1={selected?.x ?? 0} x2={selected?.x ?? 0} y1="30" y2="266" />
                <path className="c-line" pathLength="1" d={path} />
                {points.map((p, i) => (
                  <circle
                    key={p.year.year}
                    className={`c-dot${i === hover ? " on" : ""}`}
                    style={style({ "--i": i })}
                    cx={p.x}
                    cy={p.y}
                    r="3.6"
                  />
                ))}
                <text className="c-peak" textAnchor="middle" x={peak.x} y={peak.y - 16}>
                  峰值 {fmt(peak.year.stories[0].score)}
                </text>
                {points.map((p, i) => (
                  <text
                    key={p.year.year}
                    className={`c-axis${i === hover ? " on" : ""}`}
                    textAnchor="middle"
                    x={p.x}
                    y="298"
                  >
                    {p.year.year}
                  </text>
                ))}
              </svg>
              {selected && (
                <div
                  className="tip"
                  style={{
                    left: `${selected.x / 10}%`,
                    top: `${(selected.y / 310) * 100}%`,
                    transform: `translate(${hover !== null && hover < 2 ? "-12%" : hover !== null && hover > points.length - 3 ? "-88%" : "-50%"},${selected.y / 310 < 0.4 ? "20px" : "calc(-100% - 18px)"})`,
                  }}
                >
                  <div className="tip-y">
                    <b>{selected.year.year}</b>
                    <Points score={selected.year.stories[0].score} />
                  </div>
                  <p>{selected.year.stories[0].title}</p>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="insights">
          {cards.map(([label, value, description], i) => (
            <div className="insight" data-rv data-spot style={style({ "--i": i })} key={label}>
              <span className="mono">{label}</span>
              <b>{value}</b>
              <p>{description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
