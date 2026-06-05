const smtp2goSendEndpoint = "https://api.smtp2go.com/v3/email/send";

export type Smtp2goEnv = {
  SMTP2GO_API_KEY?: string;
  POD_TRACKER_EMAIL_FROM?: string;
  POD_TRACKER_EMAIL_REPLY_TO?: string;
  POD_TRACKER_EMAIL_DELIVERY_MODE?: string;
  NODE_ENV?: string;
};

export type TransactionalEmail = {
  to: string;
  subject: string;
  textBody: string;
  htmlBody?: string;
};

export type TransactionalEmailDelivery = {
  send(message: TransactionalEmail): Promise<void>;
};

type Smtp2goConfig = {
  apiKey: string;
  sender: string;
  replyTo?: string;
};

type Smtp2goPayload = {
  sender: string;
  to: string[];
  subject: string;
  text_body: string;
  html_body?: string;
  custom_headers?: Array<{ header: string; value: string }>;
};

export function createSmtp2goEmailDeliveryFromEnv(
  env: Smtp2goEnv = process.env,
  fetchImpl: typeof fetch = fetch,
): TransactionalEmailDelivery {
  if (isNoopEmailDeliveryMode(env)) {
    return createNoopEmailDelivery();
  }

  const config = readSmtp2goConfig(env);

  return createSmtp2goEmailDelivery(config, fetchImpl);
}

export function createNoopEmailDelivery(): TransactionalEmailDelivery {
  return {
    async send() {
      return undefined;
    },
  };
}

export function createSmtp2goEmailDelivery(
  config: Smtp2goConfig,
  fetchImpl: typeof fetch = fetch,
): TransactionalEmailDelivery {
  return {
    async send(message) {
      const payload = createSmtp2goPayload(config, message);
      const response = await fetchImpl(smtp2goSendEndpoint, {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          "X-Smtp2go-Api-Key": config.apiKey,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("SMTP2GO email delivery failed");
      }

      const responseBody = (await response.json().catch(() => null)) as {
        data?: { failed?: number };
      } | null;

      if ((responseBody?.data?.failed ?? 0) > 0) {
        throw new Error("SMTP2GO email delivery failed");
      }
    },
  };
}

export function readSmtp2goConfig(env: Smtp2goEnv): Smtp2goConfig {
  const apiKey = env.SMTP2GO_API_KEY?.trim();
  const sender = env.POD_TRACKER_EMAIL_FROM?.trim();
  const replyTo = env.POD_TRACKER_EMAIL_REPLY_TO?.trim();

  if (!apiKey) {
    throw new Error("SMTP2GO_API_KEY is required for transactional email");
  }

  if (!sender) {
    throw new Error("POD_TRACKER_EMAIL_FROM is required for transactional email");
  }

  return {
    apiKey,
    sender,
    ...(replyTo ? { replyTo } : {}),
  };
}

function isNoopEmailDeliveryMode(env: Smtp2goEnv) {
  const mode = env.POD_TRACKER_EMAIL_DELIVERY_MODE?.trim().toLowerCase();

  if (!mode) {
    return false;
  }

  if (mode !== "test") {
    throw new Error("Unsupported POD_TRACKER_EMAIL_DELIVERY_MODE");
  }

  if (env.NODE_ENV === "production") {
    throw new Error("Test email delivery mode is not allowed in production");
  }

  return true;
}

export function createSmtp2goPayload(
  config: Smtp2goConfig,
  message: TransactionalEmail,
): Smtp2goPayload {
  const payload: Smtp2goPayload = {
    sender: config.sender,
    to: [message.to],
    subject: message.subject,
    text_body: message.textBody,
  };

  if (message.htmlBody) {
    payload.html_body = message.htmlBody;
  }

  if (config.replyTo) {
    payload.custom_headers = [{ header: "Reply-To", value: config.replyTo }];
  }

  return payload;
}
