import { useCallback, useEffect, useState } from "react";
import { browserLanguage, type LanguagePreference, messages } from "../i18n";

const key = "hntoday-language";

function readPreference(): LanguagePreference {
  try {
    const value = localStorage.getItem(key);
    return value === "zh" || value === "en" ? value : "auto";
  } catch {
    return "auto";
  }
}

function detectLanguage() {
  return browserLanguage(navigator.languages.length ? navigator.languages : [navigator.language]);
}

export function useLanguage() {
  const [preference, setPreference] = useState<LanguagePreference>(readPreference);
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
  const choose = useCallback((value: LanguagePreference) => {
    setPreference(value);
    try {
      if (value === "auto") localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    } catch {}
  }, []);
  const language = preference === "auto" ? detected : preference;
  return { language, preference, choose, text: messages[language] };
}
