import { BufferSource } from "stream/web";
import {
  FileDescriptor,
  NetworkAccess_NetworkAccessType,
  ObjectCreationType,
} from "../proto/modal_proto/api.ts";
import { client } from "./client.ts";
import {
  ModalReadStream,
  ModalWriteStream,
  toModalReadStream,
} from "./streams.ts";

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

// Specifies the type of data that will be read from the sandbox or container
// process. "text" means the data will be read as UTF-8 text, while "binary"
// means the data will be read as raw bytes (Uint8Array).
export type StreamMode = "text" | "binary";

type ExecOptions = {
  mode?: StreamMode;
  stdout?: StdioBehavior;
  stderr?: StdioBehavior;
};

export class Sandbox {
  readonly sandboxId: string;
  stdin: ModalWriteStream<string>;
  stdout: ModalReadStream<string>;
  stderr: ModalReadStream<string>;

  #taskId: string | undefined;

  constructor(sandboxId: string) {
    this.sandboxId = sandboxId;
  }

  async exec(
    cmd: string[],
    options?: ExecOptions & { mode?: "text" }
  ): Promise<ContainerProcess<string>>;

  async exec(
    cmd: string[],
    options: ExecOptions & { mode: "binary" }
  ): Promise<ContainerProcess<BufferSource>>;

  async exec(
    cmd: string[],
    options?: {
      mode?: StreamMode;
      stdout?: StdioBehavior;
      stderr?: StdioBehavior;
    }
  ): Promise<ContainerProcess> {
    if (this.#taskId === undefined) {
      const resp = await client.sandboxGetTaskId({
        sandboxId: this.sandboxId,
      });
      if (!resp.taskId) {
        throw new Error(
          `Sandbox ${this.sandboxId} does not have a task ID. It may not be running.`
        );
      }
      if (resp.taskResult) {
        throw new Error(
          `Sandbox ${this.sandboxId} has already completed with result: ${resp.taskResult}`
        );
      }
      this.#taskId = resp.taskId;
    }

    const resp = await client.containerExec({
      taskId: this.#taskId,
      command: cmd,
    });

    return new ContainerProcess(resp.execId, options);
  }
}

class ContainerProcess<R extends string | BufferSource = any> {
  stdin: ModalWriteStream<R>;
  stdout: ModalReadStream<R>;
  stderr: ModalReadStream<R>;
  returncode: number | null = null;

  readonly #execId: string;

  constructor(execId: string, options?: ExecOptions) {
    const mode = options?.mode ?? "text";
    const stdout = options?.stdout ?? "pipe";
    const stderr = options?.stderr ?? "pipe";

    this.#execId = execId;

    const stdoutStream =
      stdout === "pipe"
        ? ReadableStream.from(
            outputStreamContainerProcess(
              execId,
              FileDescriptor.FILE_DESCRIPTOR_STDOUT
            )
          )
        : new ReadableStream();

    const stderrStream =
      stderr === "pipe"
        ? ReadableStream.from(
            outputStreamContainerProcess(
              execId,
              FileDescriptor.FILE_DESCRIPTOR_STDERR
            )
          )
        : new ReadableStream();

    if (mode === "text") {
      this.stdout = toModalReadStream(
        stdoutStream.pipeThrough(new TextDecoderStream())
      ) as ModalReadStream<R>;
      this.stderr = toModalReadStream(
        stderrStream.pipeThrough(new TextDecoderStream())
      ) as ModalReadStream<R>;
    } else {
      this.stdout = toModalReadStream(stdoutStream) as any;
      this.stderr = toModalReadStream(stderrStream) as any;
    }
  }

  /** Wait for process completion and returns the `returncode`. */
  async wait(): Promise<number> {
    void this.#execId; // TODO
    return 1;
  }
}

// Like _StreamReader with object_type == "sandbox".
async function* outputStreamSandbox(
  sandboxId: string,
  fileDescriptor: FileDescriptor
): AsyncIterable<string> {
  let lastIndex = "0-0";
  let completed = false;
  let retriesRemaining = 10;
  while (!completed) {
    try {
      const outputIterator = client.sandboxGetLogs({
        sandboxId,
        fileDescriptor,
        timeout: 55,
        lastEntryId: lastIndex,
      });
      for await (const batch of outputIterator) {
        lastIndex = batch.entryId;
        yield* batch.items.map((item) => item.data);
        if (batch.eof) {
          completed = true;
          break;
        }
      }
    } catch (error: any) {
      // TODO: Distinguish retryable gRPC status codes, StreamTerminated, etc.
      if (retriesRemaining > 0) {
        retriesRemaining--;
      } else {
        throw error;
      }
    }
  }
}

// Like _StreamReader with object_type == "container_process".
async function* outputStreamContainerProcess(
  execId: string,
  fileDescriptor: FileDescriptor
): AsyncIterable<Uint8Array> {
  let lastIndex = 0;
  let completed = false;
  let retriesRemaining = 10;
  while (!completed) {
    try {
      const outputIterator = client.containerExecGetOutput({
        execId,
        fileDescriptor,
        timeout: 55,
        getRawBytes: true,
        lastBatchIndex: lastIndex,
      });
      for await (const batch of outputIterator) {
        lastIndex = batch.batchIndex;
        yield* batch.items.map((item) => item.messageBytes);
        if (batch.exitCode !== undefined) {
          // The container process exited. Python code also doesn't handle this
          // exit code, so we don't either right now.
          completed = true;
          break;
        }
      }
    } catch (error: any) {
      // TODO: Distinguish retryable gRPC status codes, StreamTerminated, etc.
      if (retriesRemaining > 0) {
        retriesRemaining--;
      } else {
        throw error;
      }
    }
  }
}
