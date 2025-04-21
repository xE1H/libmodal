import {
  NetworkAccess_NetworkAccessType,
  ObjectCreationType,
} from "../proto/modal_proto/api.ts";
import { client } from "./client.ts";
import { ModalReadStream, ModalWriteStream } from "./streams.ts";

export type LookupOptions = {
  environment?: string;
  createIfMissing?: boolean;
};

export type SandboxCreateOptions = {
  cpu?: number; // in physical cores
  memory?: number; // in MB
  timeout?: number; // in seconds
};

export class App {
  readonly appId: string;

  constructor(appId: string) {
    this.appId = appId;
  }

  /** Lookup a deployed app by name, or create if it does not exist. */
  static async lookup(name: string, options: LookupOptions = {}): Promise<App> {
    const resp = await client.appGetOrCreate({
      appName: name,
      environmentName: options.environment,
      objectCreationType: options.createIfMissing
        ? ObjectCreationType.OBJECT_CREATION_TYPE_CREATE_IF_MISSING
        : ObjectCreationType.OBJECT_CREATION_TYPE_UNSPECIFIED,
    });
    return new App(resp.appId);
  }

  async createSandbox(
    image: Image,
    options: SandboxCreateOptions = {}
  ): Promise<Sandbox> {
    const createResp = await client.sandboxCreate({
      appId: this.appId,
      definition: {
        entrypointArgs: ["sleep", "48h"], // Implicit in image builder version <=2024.10
        imageId: image.imageId,
        timeoutSecs: options.timeout ?? 600,
        networkAccess: {
          networkAccessType: NetworkAccess_NetworkAccessType.OPEN,
        },
        resources: {
          // https://modal.com/docs/guide/resources
          milliCpu: Math.round(1000 * (options.cpu ?? 0.125)),
          memoryMb: options.memory ?? 128,
        },
      },
    });

    return new Sandbox(createResp.sandboxId);
  }
}

export class Image {
  readonly imageId: string;

  constructor(imageId: string) {
    this.imageId = imageId;
  }

  static async fromRegistry(tag: string): Promise<Image> {
    return new Image("im-0MT7lcT3Kzh7DxZgVHgSRY"); // TODO
  }
}

// Stdin is always present, but this option allow you to drop stdout or stderr
// if you don't need them. The default is "pipe", matching Node.js behavior.
//
// If behavior is set to "ignore", the output streams will be empty.
export type StdioBehavior = "pipe" | "ignore";

export class Sandbox {
  readonly sandboxId: string;
  stdin: ModalWriteStream<string>;
  stdout: ModalReadStream<string>;
  stderr: ModalReadStream<string>;

  constructor(sandboxId: string) {
    this.sandboxId = sandboxId;
  }

  async exec(
    cmd: string[],
    options?: { stdout?: StdioBehavior; stderr?: StdioBehavior }
  ): Promise<ContainerProcess> {
    return new ContainerProcess("");
  }
}

class ContainerProcess<R = any> {
  stdin: ModalWriteStream<R>;
  stdout: ModalReadStream<R>;
  stderr: ModalReadStream<R>;
  returncode: number | null = null;

  #execId: string;

  constructor(execId: string) {
    this.#execId = execId;
  }

  /** Wait for process completion and returns the `returncode`. */
  async wait(): Promise<number> {
    return 1;
  }
}
