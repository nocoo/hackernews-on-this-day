import { useEffect, useRef, useState } from "react";
import { calendarYear, dateLabel, dayOfYear, shiftDay } from "./calendar";
import { Atmosphere, Embers } from "./components/Atmosphere";
import { Chapters } from "./components/Chapters";
import { Machine } from "./components/Machine";
import { Arrow, fmt, style, weekday } from "./components/shared";
import { Trend } from "./components/Trend";
import { useArchive } from "./viewmodels/useArchive";

function Counter({ value }: { value: number }) {
  const [shown, setShown] = useState(value);
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(value);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / 1500);
      setShown(Math.round(value * (1 - (1 - k) ** 4)));
      if (k < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return <>{fmt(shown)}</>;
}

export default function App() {
  const vm = useArchive();
  const { date, today, isToday, years, archive, error, loading, shift, random, setDate, refresh } = vm;
  const root = document.documentElement;
  const [theme, setTheme] = useState(() =>
    matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark",
  );
  const [activeYear, setActiveYear] = useState<number | null>(null);
  const [pastHero, setPastHero] = useState(false);
  const [progress, setProgress] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const nav = useRef<HTMLButtonElement>(null);
  const transitionTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [switching, setSwitching] = useState(false);
  const currentYear = new Date().getUTCFullYear();
  const dayYear = calendarYear(date, currentYear);
  const daysInYear = (Date.UTC(dayYear + 1, 0, 1) - Date.UTC(dayYear, 0, 1)) / 86400000;
  const title = dateLabel(date);
  const tomorrow = dateLabel(shiftDay(date, 1));
  const stories = years.flatMap((year) => year.stories);
  const currentArchive = archive?.month === date.month && archive?.day === date.day;
  const ready = !loading && !error && currentArchive;
  const range = years.length ? `${years.at(-1)?.year} — ${years[0].year}` : "—";

  useEffect(() => {
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
  }, [theme]);
  useEffect(() => {
    document.title = `${title} · Hacker News 历史上的今天`;
  }, [title]);
  useEffect(() => {
    if (!ready) return;
    root.classList.add("js");
    const reveal = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.setAttribute("data-revealed", "");
            reveal.unobserve(entry.target);
          }
        }),
      { rootMargin: "0px 0px -12% 0px" },
    );
    document.querySelectorAll(".chapter, #chart, .insight").forEach((el) => {
      reveal.observe(el);
    });
    const spy = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveYear(Number((entry.target as HTMLElement).dataset.year));
        }),
      { rootMargin: "-42% 0px -52% 0px" },
    );
    document.querySelectorAll(".chapter").forEach((el) => {
      spy.observe(el);
    });
    return () => {
      reveal.disconnect();
      spy.disconnect();
      root.classList.remove("js");
    };
  }, [ready]);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      setProgress(window.scrollY / Math.max(1, root.scrollHeight - innerHeight));
      setScrolled(window.scrollY > 12);
      const r = document.getElementById("years")?.getBoundingClientRect();
      setPastHero(Boolean(r && r.top < innerHeight * 0.6 && r.bottom > innerHeight * 0.55));
      if (r && r.top > innerHeight * 0.6) setActiveYear(null);
    };
    const scroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    window.addEventListener("scroll", scroll, { passive: true });
    update();
    return () => {
      window.removeEventListener("scroll", scroll);
      cancelAnimationFrame(frame);
    };
  }, []);
  useEffect(() => {
    const spot = (event: PointerEvent) => {
      const el = (event.target as Element).closest<HTMLElement>("[data-spot]");
      if (!el) return;
      const rect = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${event.clientX - rect.left}px`);
      el.style.setProperty("--my", `${event.clientY - rect.top}px`);
    };
    document.addEventListener("pointermove", spot, { passive: true });
    return () => document.removeEventListener("pointermove", spot);
  }, []);
  const toggleTheme = (x: number, y: number) => {
    const next = theme === "dark" ? "light" : "dark";
    if (!document.startViewTransition || matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setTheme(next);
      return;
    }
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    document
      .startViewTransition(() => {
        root.dataset.theme = next;
        root.style.colorScheme = next;
        setTheme(next);
      })
      .ready.then(() =>
        root.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
          { duration: 700, easing: "cubic-bezier(.2,.8,.2,1)", pseudoElement: "::view-transition-new(root)" },
        ),
      )
      .catch(() => {});
  };
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        /^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test((event.target as Element).tagName)
      )
        return;
      const key = event.key.toLowerCase();
      if (key === "t") toggleTheme(innerWidth - 60, 32);
      if (key === "j" || key === "k") {
        const index = years.findIndex((y) => y.year === activeYear);
        const next = index < 0 ? 0 : Math.max(0, Math.min(years.length - 1, index + (key === "j" ? 1 : -1)));
        if (years[next])
          document.getElementById(`y${years[next].year}`)?.scrollIntoView({ behavior: "smooth" });
      }
    };
    document.addEventListener("keydown", keydown);
    return () => document.removeEventListener("keydown", keydown);
  });
  useEffect(() => () => clearTimeout(transitionTimer.current), []);
  const selectDay = (action: () => void) => {
    clearTimeout(transitionTimer.current);
    setSwitching(true);
    transitionTimer.current = setTimeout(
      () => {
        window.scrollTo({ top: 0, behavior: "auto" });
        action();
        setSwitching(false);
      },
      matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 280,
    );
  };
  const dateDigits = (number: number, offset: number) =>
    String(number)
      .split("")
      .map((ch, index) => (
        <span key={["first", "second"][index]} style={style({ "--k": index + offset })}>
          {ch}
        </span>
      ));
  const digitsOffset = String(date.month).length;

  return (
    <>
      <Atmosphere />
      <header className={`nav${scrolled ? " scrolled" : ""}`}>
        <div className="nav-in">
          <div className="brand">
            <span className="logo" aria-hidden="true">
              Y
            </span>
            <span className="brand-t">
              <b>Hacker News</b>
              <i />
              <span>历史上的今天</span>
            </span>
          </div>
          <fieldset className="stepper" aria-label="切换日期">
            <button
              className="st-btn"
              type="button"
              aria-label="前一天"
              title="前一天"
              onClick={() => selectDay(() => shift(-1))}
            >
              <Arrow direction="left" />
            </button>
            <button
              className="st-date"
              type="button"
              title="回到今天"
              onClick={() => selectDay(() => setDate(today))}
            >
              <span>{title}</span>
              <span className="st-today" hidden={!isToday}>
                今天
              </span>
            </button>
            <button
              className="st-btn"
              type="button"
              aria-label="后一天"
              title="后一天"
              onClick={() => selectDay(() => shift(1))}
            >
              <Arrow direction="right" />
            </button>
            <i className="st-sep" />
            <button
              className="st-btn"
              type="button"
              aria-label="随机一天"
              title="随机一天"
              onClick={() => selectDay(random)}
            >
              ↝
            </button>
          </fieldset>
          <div className="nav-r">
            <span className="mock" title="基于公开数据集的历史快照">
              真实数据
            </span>
            <button
              ref={nav}
              className="theme"
              type="button"
              aria-label="切换明暗主题"
              title="切换主题 (T)"
              onClick={() => {
                const r = nav.current?.getBoundingClientRect();
                toggleTheme(r ? r.left + r.width / 2 : innerWidth - 60, r ? r.top + r.height / 2 : 32);
              }}
            >
              <svg
                className="i-sun"
                aria-hidden="true"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              >
                <circle cx="8" cy="8" r="3" />
                <path d="M8 1.2v1.6M8 13.2v1.6M1.2 8h1.6M13.2 8h1.6M3.2 3.2l1.1 1.1M11.7 11.7l1.1 1.1M3.2 12.8l1.1-1.1M11.7 4.3l1.1-1.1" />
              </svg>
              <svg
                className="i-moon"
                aria-hidden="true"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M13.5 9.6A5.8 5.8 0 0 1 6.4 2.5a5.8 5.8 0 1 0 7.1 7.1Z" />
              </svg>
            </button>
          </div>
        </div>
        <i className="progress" style={style({ "--p": progress })} />
      </header>
      <main id="main" className={switching ? "switching" : undefined}>
        <section className="hero" id="hero">
          <Embers />
          <div className="wrap">
            <div className="hero-top" data-enter>
              <div className="eyebrow mono">
                Hacker News<span>· On This Day · {range}</span>
              </div>
              <div className="doy mono">
                <i className="yearbar" style={style({ "--doy": dayOfYear(date, dayYear) / daysInYear })} />
                <span>
                  N° <b>{dayOfYear(date, dayYear)}</b> / {daysInYear}
                </span>
              </div>
            </div>
            <h1 className="hero-title">
              <span className="ht-cn">
                历史上的<em>{isToday ? "今天" : "这一天"}</em>
              </span>
              <span className="ht-date" role="img" aria-label={title} key={title}>
                <span className="d-num">{dateDigits(date.month, 0)}</span>
                <span className="d-unit">月</span>
                <span className="d-num">{dateDigits(date.day, digitsOffset)}</span>
                <span className="d-unit">日</span>
              </span>
            </h1>
            <div className="hero-foot">
              <div data-enter style={style({ "--d": 700 })}>
                <p className="lede">
                  <b>同一天，一年一页。</b>回看过去十五年每年的这一天，Hacker News 按分数排序的前五条帖子。
                </p>
                <div className="cta">
                  <button
                    className="btn btn-primary"
                    type="button"
                    disabled={!ready || !years.length}
                    onClick={() =>
                      document.getElementById(`y${years[0]?.year}`)?.scrollIntoView({ behavior: "smooth" })
                    }
                  >
                    开始回看 <Arrow />
                  </button>
                  <button className="btn btn-ghost" type="button" onClick={() => selectDay(random)}>
                    随机一天 <span aria-hidden="true">↻</span>
                  </button>
                </div>
              </div>
              <dl className="facts" data-enter style={style({ "--d": 820 })}>
                <div>
                  <dt className="mono">日期 · UTC</dt>
                  <dd>
                    {title}
                    {isToday ? ` · ${weekday(currentYear, date.month, date.day)}` : ""}
                  </dd>
                </div>
                <div>
                  <dt className="mono">跨度</dt>
                  <dd>{ready ? `${years.length} 年 · ${range}` : "加载中"}</dd>
                </div>
                <div>
                  <dt className="mono">收录</dt>
                  <dd>{ready ? `每年前 5 · 共 ${stories.length} 条` : "加载中"}</dd>
                </div>
              </dl>
            </div>
            {loading && (
              <div className="loading" role="status">
                正在翻阅历史…
              </div>
            )}
            {error && (
              <div className="error-panel" role="alert">
                {error}{" "}
                <button type="button" className="btn btn-ghost" onClick={refresh}>
                  重试
                </button>
              </div>
            )}
            {ready && !years.length && <div className="error-panel">这一天没有符合条件的帖子。</div>}
            {ready && archive.missingYears.length > 0 && (
              <div className="error-panel" role="status">
                部分年份的数据文件缺失：{archive.missingYears.join("、")}。展示的结果不完整。
              </div>
            )}
            {ready && years.length > 0 && (
              <>
                <Machine key={title} years={years} date={date} currentYear={currentYear} />
                <div className="stats" data-enter style={style({ "--d": 1060 })}>
                  {[
                    [years.length, "年里的同一天"],
                    [stories.length, "条当日头条"],
                    [stories.reduce((a, s) => a + s.score, 0), "累计分数"],
                    [stories.reduce((a, s) => a + s.comments, 0), "条评论"],
                  ].map(([value, label]) => (
                    <div className="stat" key={label}>
                      <b>
                        <Counter value={Number(value)} />
                      </b>
                      <span>{label}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </section>
        {ready && years.length > 0 && (
          <>
            <section className="years" id="years">
              <div className="wrap">
                <div className="sec-head">
                  <div>
                    <div className="mono">01 — 逐年回看</div>
                    <h2>一年一页，往回翻。</h2>
                  </div>
                  <p>
                    从最近一年开始，按 <span className="kbd">J</span>
                    <span className="kbd">K</span> 可以逐年跳转。
                  </p>
                </div>
                <Chapters years={years} date={date} currentYear={currentYear} activeYear={activeYear} />
              </div>
            </section>
            <Trend years={years} />
          </>
        )}
      </main>
      <footer className="foot">
        <div className="wrap">
          <div className="foot-main">
            <h2>
              明天<em>见</em>。
            </h2>
            <div className="foot-cta">
              <p>历史每天翻一页。</p>
              <button className="btn btn-ghost" type="button" onClick={() => selectDay(() => shift(1))}>
                看看 {tomorrow} <Arrow direction="right" />
              </button>
            </div>
          </div>
          <div className="colophon">
            <span>Hacker News · 历史上的今天</span>
            <span>
              数据来自{" "}
              <a
                href="https://huggingface.co/datasets/open-index/hacker-news"
                target="_blank"
                rel="noreferrer"
              >
                open-index/hacker-news
              </a>
              （ODC-By）；分数与评论数是归档快照，并非当时首页排名。与 Y Combinator 无关。
            </span>
            <span>
              <span className="kbd">J</span>
              <span className="kbd">K</span> 逐年 · <span className="kbd">T</span> 主题
            </span>
          </div>
        </div>
      </footer>
      <nav className={`rail${pastHero ? " visible" : ""}`} aria-label="年份导航">
        {ready &&
          years.map((year) => (
            <button
              key={year.year}
              type="button"
              className={activeYear === year.year ? "on" : ""}
              aria-label={`跳到 ${year.year} 年`}
              onClick={() => document.getElementById(`y${year.year}`)?.scrollIntoView({ behavior: "smooth" })}
            >
              <span>{year.year}</span>
            </button>
          ))}
      </nav>
    </>
  );
}
