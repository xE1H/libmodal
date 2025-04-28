import {
  NetworkAccess_NetworkAccessType,
  ObjectCreationType,
} from "../proto/modal_proto/api";
import { client } from "./client";
import { environmentName } from "./config";
import { Image } from "./image";
import { Sandbox } from "./sandbox";

export type LookupOptions = {
  environment?: string;
  createIfMissing?: boolean;
};

export type SandboxCreateOptions = {
  cpu?: number; // in physical cores
  memory?: number; // in MiB
  timeout?: number; // in seconds
  command?: string[]; // default is ["sleep", "48h"]
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
      environmentName: environmentName(options.environment),
      objectCreationType: options.createIfMissing
        ? ObjectCreationType.OBJECT_CREATION_TYPE_CREATE_IF_MISSING
        : ObjectCreationType.OBJECT_CREATION_TYPE_UNSPECIFIED,
    });
    return new App(resp.appId);
  }

  async createSandbox(
    image: Image,
    options: SandboxCreateOptions = {},
  ): Promise<Sandbox> {
    const createResp = await client.sandboxCreate({
      appId: this.appId,
      definition: {
        // Sleep default is implicit in image builder version <=2024.10
        entrypointArgs: options.command ?? ["sleep", "48h"],
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
