import { useEffect } from "react";

declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        ready(): void;
        expand(): void;
        close(): void;
        initData: string;
        initDataUnsafe: {
          user?: {
            id: number;
            first_name: string;
            last_name?: string;
            username?: string;
          };
        };
        colorScheme: "light" | "dark";
        themeParams: Record<string, string>;
        BackButton: {
          show(): void;
          hide(): void;
          onClick(cb: () => void): void;
          offClick(cb: () => void): void;
        };
      };
    };
  }
}

export function useTelegram() {
  const tg = window.Telegram?.WebApp;

  useEffect(() => {
    tg?.ready();
    tg?.expand();
  }, [tg]);

  return {
    tg,
    user: tg?.initDataUnsafe?.user,
    initData: tg?.initData ?? "",
    colorScheme: tg?.colorScheme ?? "light",
  };
}
