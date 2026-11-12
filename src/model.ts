export interface Story {
  id: number;
  title: string;
  author: string;
  score: number;
  comments: number;
  url: string;
}

export interface YearStories {
  year: number;
  stories: Story[];
}

export interface DayArchive {
  month: number;
  day: number;
  years: YearStories[];
  missingYears: number[];
}

export interface CalendarDay {
  month: number;
  day: number;
}
