import { TelegramClient, Api } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import { computeCheck } from "telegram/Password.js";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";

export interface AuthResult {
  success: boolean;
  needs2FA?: boolean;
  error?: string;
}

export class AuthFlow {
  private client: TelegramClient | null = null;
  private phoneCodeHash = "";

  isStarted(): boolean {
    return this.client !== null && this.phoneCodeHash !== "";
  }

  async startAuth(phoneNumber: string): Promise<AuthResult> {
    try {
      this.client = new TelegramClient(
        new StringSession(""),
        config.telegramApiId,
        config.telegramApiHash,
        { connectionRetries: 5 },
      );
      await this.client.connect();

      const result = await this.client.sendCode(
        {
          apiId: config.telegramApiId,
          apiHash: config.telegramApiHash,
        },
        phoneNumber,
      );
      this.phoneCodeHash = result.phoneCodeHash;
      return { success: true };
    } catch (error) {
      logger.error({ error }, "Failed to start auth");
      return { success: false, error: String(error) };
    }
  }

  async submitCode(phoneNumber: string, code: string): Promise<AuthResult> {
    if (!this.client) {
      return { success: false, error: "Auth not started" };
    }

    try {
      await this.client.invoke(
        new Api.auth.SignIn({
          phoneNumber,
          phoneCodeHash: this.phoneCodeHash,
          phoneCode: code,
        }),
      );
      return { success: true };
    } catch (error: any) {
      if (error.errorMessage === "SESSION_PASSWORD_NEEDED") {
        return { success: false, needs2FA: true };
      }
      logger.error({ error }, "Failed to submit code");
      const msg = error.errorMessage;
      if (msg === "PHONE_CODE_EXPIRED") {
        return { success: false, error: "Код истёк. Нажми /connect и введи новый код быстрее." };
      }
      if (msg === "PHONE_CODE_INVALID") {
        return { success: false, error: "Неверный код. Проверь, что вводишь последний полученный код." };
      }
      return { success: false, error: String(error) };
    }
  }

  async submit2FA(password: string): Promise<AuthResult> {
    if (!this.client) {
      return { success: false, error: "Auth not started" };
    }

    try {
      const passwordInfo = await this.client.invoke(
        new Api.account.GetPassword(),
      );
      const passwordCheck = await computeCheck(passwordInfo, password);
      await this.client.invoke(
        new Api.auth.CheckPassword({ password: passwordCheck }),
      );
      return { success: true };
    } catch (error) {
      logger.error({ error }, "Failed to submit 2FA");
      return { success: false, error: String(error) };
    }
  }

  getSessionString(): string {
    if (!this.client) throw new Error("Auth not started");
    return this.client.session.save() as unknown as string;
  }

  getClient(): TelegramClient | null {
    return this.client;
  }

  async destroy(): Promise<void> {
    if (this.client) {
      await this.client.disconnect();
      this.client = null;
    }
  }
}
