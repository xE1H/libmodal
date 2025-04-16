import { client } from "./client.ts";
import { ModalReadStream, ModalWriteStream } from "./streams.ts";

export type LookupOptions = {
  environment?: string;
};

export class App {
  appId: string;

  constructor(appId: string) {
    this.appId = appId;
  }

  /** Lookup a deployed app by name. */
  static async lookup(name: string, options: LookupOptions = {}): Promise<App> {
    const resp = await client.appGetOrCreate({
      appName: name,
      environmentName: options.environment,
    });
    return new App(resp.appId);
  }

  async createSandbox(image: Image): Promise<Sandbox> {
    return new Sandbox();
  }
}

export class Image {
  imageId: string;

  constructor(imageId: string) {
    this.imageId = imageId;
  }

  static async fromRegistry(tag: string): Promise<Image> {
    return new Image("im-123");
  }
}

// Stdin is always present, but this option allow you to drop stdout or stderr
// if you don't need them. The default is "pipe", matching Node.js behavior.
//
// If behavior is set to "ignore", the output streams will be empty.
export type StdioBehavior = "pipe" | "ignore";

export class Sandbox {
  stdin: ModalWriteStream<string>;
  stdout: ModalReadStream<string>;
  stderr: ModalReadStream<string>;

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
