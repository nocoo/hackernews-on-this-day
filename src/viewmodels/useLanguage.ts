import { useCallback, useEffect, useState } from "react";
import { browserLanguage, type Language, messages } from "../i18n";

const key = "hntoday-language";

function readPreference(): Language | null {
  try {
    const value = localStorage.getItem(key);
    return value === "zh" || value === "en" ? value : null;
  } catch {
    return null;
  }
}

function detectLanguage() {
  return browserLanguage(navigator.languages.length ? navigator.languages : [navigator.language]);
}

export function useLanguage() {
  const [preference, setPreference] = useState<Language | null>(readPreference);
  const [detected, setDetected] = useState(detectLanguage);
  useEffect(() => {
    const detect = () => setDetected(detectLanguage());
    const sync = (event: StorageEvent) => {
      if (event.key === key || event.key === null) setPreference(readPreference());
    };
    window.addEventListener("languagechange", detect);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("languagechange", detect);
      window.removeEventListener("storage", sync);
    };
  }, []);
  const choose = useCallback((value: Language) => {
    setPreference(value);
    try {
      localStorage.setItem(key, value);
    } catch {}
  }, []);
  const language = preference ?? detected;
  return { language, choose, text: messages[language] };
}
