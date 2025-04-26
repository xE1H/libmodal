import { readFile } from "node:fs/promises";
import { ClientType, ModalClientDefinition } from "../proto/modal_proto/api";
import {
  CallOptions,
  ClientError,
  ClientMiddleware,
  ClientMiddlewareCall,
  createChannel,
  createClientFactory,
  Metadata,
  Status,
} from "nice-grpc";
import path from "node:path";
import { homedir } from "node:os";
import { parse as parseToml } from "smol-toml";

/** Raw representation of the .modal.toml file. */
interface Config {
  [profile: string]: {
    server_url?: string;
    token_id?: string;
    token_secret?: string;
    environment?: string;
    active?: boolean;
  };
}

/** Resolved configuration object from `Config` and environment variables. */
interface Profile {
  serverUrl: string;
  tokenId: string;
  tokenSecret: string;
  environment?: string;
}

async function readConfigFile(): Promise<Config> {
  try {
    const configContent = await readFile(path.join(homedir(), ".modal.toml"), {
      encoding: "utf-8",
    });
    return parseToml(configContent) as Config;
  } catch (error: any) {
    if (error.code === "ENOENT") {
      return {} as Config;
    }
    throw new Error(`Failed to read or parse .modal.toml: ${error.message}`);
  }
}

// Top-level await on module startup.
const config: Config = await readConfigFile();

function getProfile(profileName?: string): Profile {
  profileName = profileName || process.env["MODAL_PROFILE"] || undefined;
  if (!profileName) {
    for (const [name, profileData] of Object.entries(config)) {
      if (profileData.active) {
        profileName = name;
        break;
      }
    }
  }
  if (!profileName || !Object.hasOwn(config, profileName)) {
    throw new Error(
      `Profile "${profileName}" not found in .modal.toml. Please set the MODAL_PROFILE environment variable or specify a valid profile.`,
    );
  }
  const profileData = config[profileName];

  let profile: Partial<Profile> = {
    serverUrl:
      process.env["MODAL_SERVER_URL"] ||
      profileData.server_url ||
      "https://api.modal.com:443",
    tokenId: process.env["MODAL_TOKEN_ID"] || profileData.token_id,
    tokenSecret: process.env["MODAL_TOKEN_SECRET"] || profileData.token_secret,
    environment: process.env["MODAL_ENVIRONMENT"] || profileData.environment,
  };
  if (!profile.tokenId || !profile.tokenSecret) {
    throw new Error(
      `Profile "${profileName}" is missing token_id or token_secret. Please set them in .modal.toml or as environment variables.`,
    );
  }
  return profile as Profile; // safe to null-cast because of check above
}

const profile = getProfile(process.env["MODAL_PROFILE"] || undefined);

/** gRPC client middleware to add auth token to request. */
async function* authMiddleware<Request, Response>(
  call: ClientMiddlewareCall<Request, Response>,
  options: CallOptions,
) {
  options.metadata ??= new Metadata();
  options.metadata.set(
    "x-modal-client-type",
    String(ClientType.CLIENT_TYPE_LIBMODAL),
  );
  options.metadata.set("x-modal-client-version", "424242"); // "Client version is required"
  options.metadata.set("x-modal-token-id", profile.tokenId);
  options.metadata.set("x-modal-token-secret", profile.tokenSecret);
  return yield* call.next(call.request, options);
}

type TimeoutOptions = {
  /** Timeout for this call, interpreted as a duration in milliseconds */
  timeout?: number;
};

/** gRPC client middleware to set timeout and retries on a call. */
const timeoutMiddleware: ClientMiddleware<TimeoutOptions> =
  async function* timeoutMiddleware(call, options) {
    if (!options.timeout || options.signal?.aborted) {
      return yield* call.next(call.request, options);
    }

    const { timeout, signal: origSignal, ...restOptions } = options;
    const abortController = new AbortController();
    const abortListener = () => abortController.abort();
    origSignal?.addEventListener("abort", abortListener);

    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      abortController.abort();
    }, timeout);

    try {
      return yield* call.next(call.request, {
        ...restOptions,
        signal: abortController.signal,
      });
    } finally {
      origSignal?.removeEventListener("abort", abortListener);
      clearTimeout(timer);

      if (timedOut) {
        throw new ClientError(
          call.method.path,
          Status.DEADLINE_EXCEEDED,
          `Timed out after ${timeout}ms`,
        );
      }
    }
  };

const channel = createChannel("https://api.modal.com:443");
export const client = createClientFactory()
  .use(authMiddleware)
  .use(timeoutMiddleware)
  .create(ModalClientDefinition, channel);
