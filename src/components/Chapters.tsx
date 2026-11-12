import type { CalendarDay, YearStories } from "../model";
import { discussionUrl, domain, fmt, Points, style, Title, weekday } from "./shared";

function originalUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.href : null;
  } catch {
    return null;
  }
}

export function Chapters({
  years,
  date,
  currentYear,
  activeYear,
}: {
  years: YearStories[];
  date: CalendarDay;
  currentYear: number;
  activeYear: number | null;
}) {
  return (
    <>
      {years.map((year, idx) => {
        const lead = year.stories[0];
        const original = originalUrl(lead.url);
        const totalScore = year.stories.reduce((a, s) => a + s.score, 0);
        const totalComments = year.stories.reduce((a, s) => a + s.comments, 0);
        return (
          <section
            className={`chapter${activeYear === year.year ? " is-active" : ""}`}
            id={`y${year.year}`}
            data-year={year.year}
            aria-label={`${year.year} 年`}
            key={year.year}
          >
            <div className="ch-side">
              <div className="ch-top" data-rv>
                <span className="ago">{currentYear - year.year} 年前</span>
                <span className="mono">
                  {weekday(year.year, date.month, date.day)} · {String(idx + 1).padStart(2, "0")} /{" "}
                  {years.length}
                </span>
              </div>
              <div className="ch-year" data-rv style={style({ "--i": 1 })} data-y={year.year}>
                {year.year}
              </div>
              <h3 className="ch-era" data-rv style={style({ "--i": 2 })}>
                这一天的故事
              </h3>
              <p className="ch-desc" data-rv style={style({ "--i": 3 })}>
                按帖子在归档中的分数排序，回看这一天的讨论。
              </p>
              <div className="ch-kw" data-rv style={style({ "--i": 4 })}>
                <span className="chip hot">前 {year.stories.length} 条</span>
                <span className="chip">{fmt(totalScore)} 分</span>
                <span className="chip">{fmt(totalComments)} 评论</span>
              </div>
            </div>
            <div className="ch-main">
              <article className="lead" data-rv style={style({ "--i": 2 })} data-spot>
                <div className="lead-top">
                  <span className="lead-rank mono">
                    <b>N° 01</b>
                    <span>当日榜首</span>
                  </span>
                  <Points score={lead.score} />
                </div>
                <h3>
                  <a className="lead-link" href={discussionUrl(lead.id)} target="_blank" rel="noreferrer">
                    <Title title={lead.title} />
                  </a>
                </h3>
                <div className="meta">
                  <span>
                    <b>{domain(lead)}</b>
                  </span>
                  <span>by {lead.author || "未知"}</span>
                  <span>
                    <b>{fmt(lead.comments)}</b> 评论
                  </span>
                  {original && (
                    <a className="source-link" href={original} target="_blank" rel="noreferrer">
                      阅读原文 ↗
                    </a>
                  )}
                </div>
                <div className="note">
                  <span className="mono">旁注</span>
                  <span>分数与评论数来自归档快照，不代表当时的首页排名。</span>
                </div>
              </article>
              <ol className="stories">
                {year.stories.slice(1).map((story, i) => (
                  <li data-rv style={style({ "--i": i + 3 })} key={story.id}>
                    <a className="story" href={discussionUrl(story.id)} target="_blank" rel="noreferrer">
                      <span className="s-rank">{String(i + 2).padStart(2, "0")}</span>
                      <span>
                        <span className="s-title">
                          <Title title={story.title} />
                        </span>
                        <span className="s-sub">
                          {domain(story)} · {story.author || "未知"} · {fmt(story.comments)} 评论
                        </span>
                      </span>
                      <span className="s-right">
                        <Points score={story.score} />
                        <span
                          className="meter"
                          style={style({
                            "--i": i + 3,
                            "--v": lead.score > 0 ? Math.max(0, story.score / lead.score) : 0,
                          })}
                        >
                          <i />
                        </span>
                      </span>
                    </a>
                  </li>
                ))}
              </ol>
            </div>
          </section>
        );
      })}
    </>
  );
}
