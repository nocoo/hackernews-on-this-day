import type { Language, Messages } from "../i18n";
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
  language,
  text,
}: {
  years: YearStories[];
  date: CalendarDay;
  currentYear: number;
  activeYear: number | null;
  language: Language;
  text: Messages;
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
            aria-label={text.year(year.year)}
            key={year.year}
          >
            <div className="ch-side">
              <div className="ch-top" data-rv>
                <span className="ago">{text.yearsAgo(currentYear - year.year)}</span>
                <span className="mono">
                  {weekday(year.year, date.month, date.day, language)} · {String(idx + 1).padStart(2, "0")} /{" "}
                  {years.length}
                </span>
              </div>
              <div className="ch-year" data-rv style={style({ "--i": 1 })} data-y={year.year}>
                {year.year}
              </div>
              <h3 className="ch-era" data-rv style={style({ "--i": 2 })}>
                {text.chapterHeading}
              </h3>
              <p className="ch-desc" data-rv style={style({ "--i": 3 })}>
                {text.chapterDescription}
              </p>
              <div className="ch-kw" data-rv style={style({ "--i": 4 })}>
                <span className="chip hot">{text.topStories(year.stories.length)}</span>
                <span className="chip">
                  {fmt(totalScore)} {text.points(totalScore)}
                </span>
                <span className="chip">
                  {fmt(totalComments)} {text.comments(totalComments)}
                </span>
              </div>
            </div>
            <div className="ch-main">
              <article className="lead" data-rv style={style({ "--i": 2 })} data-spot>
                <div className="lead-top">
                  <span className="lead-rank mono">
                    <b>N° 01</b>
                    <span>{text.topStory}</span>
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
                  <span>by {lead.author || text.unknownAuthor}</span>
                  <span>
                    <b>{fmt(lead.comments)}</b> {text.comments(lead.comments)}
                  </span>
                  {original && (
                    <a className="source-link" href={original} target="_blank" rel="noreferrer">
                      {text.readOriginal}
                    </a>
                  )}
                </div>
                <div className="note">
                  <span className="mono">{text.note}</span>
                  <span>{text.noteText}</span>
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
                          {domain(story)} · {story.author || text.unknownAuthor} · {fmt(story.comments)}{" "}
                          {text.comments(story.comments)}
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
