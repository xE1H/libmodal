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
  toModalWriteStream,
} from "./streams.ts";

export type LookupOptions = {
  environment?: string;
  createIfMissing?: boolean;
};

export type SandboxCreateOptions = {
  cpu?: number; // in physical cores
  memory?: number; // in MB
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

    this.stdin = toModalWriteStream(inputStreamSb(sandboxId));
    this.stdout = toModalReadStream(
      ReadableStream.from(
        outputStreamSb(sandboxId, FileDescriptor.FILE_DESCRIPTOR_STDOUT)
      )
    );
    this.stderr = toModalReadStream(
      ReadableStream.from(
        outputStreamSb(sandboxId, FileDescriptor.FILE_DESCRIPTOR_STDERR)
      )
    );
  }

  async exec(
    command: string[],
    options?: ExecOptions & { mode?: "text" }
  ): Promise<ContainerProcess<string>>;

  async exec(
    command: string[],
    options: ExecOptions & { mode: "binary" }
  ): Promise<ContainerProcess<Uint8Array>>;

  async exec(
    command: string[],
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
      command,
    });

    return new ContainerProcess(resp.execId, options);
  }

  async terminate(): Promise<void> {
    await client.sandboxTerminate({ sandboxId: this.sandboxId });
    this.#taskId = undefined; // Reset task ID after termination
  }

  async wait(): Promise<number> {
    while (true) {
      const resp = await client.sandboxWait({
        sandboxId: this.sandboxId,
        timeout: 55,
      });
      if (resp.result) {
        return resp.result.exitcode;
      }
    }
  }
}

class ContainerProcess<R extends string | Uint8Array = any> {
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

    this.stdin = toModalWriteStream(inputStreamCp<R>(execId));

    const stdoutStream = ReadableStream.from(
      stdout === "pipe"
        ? outputStreamCp(execId, FileDescriptor.FILE_DESCRIPTOR_STDOUT)
        : []
    );
    const stderrStream = ReadableStream.from(
      stderr === "pipe"
        ? outputStreamCp(execId, FileDescriptor.FILE_DESCRIPTOR_STDERR)
        : []
    );

    if (mode === "text") {
      this.stdout = toModalReadStream(
        stdoutStream.pipeThrough(new TextDecoderStream())
      ) as ModalReadStream<R>;
      this.stderr = toModalReadStream(
        stderrStream.pipeThrough(new TextDecoderStream())
      ) as ModalReadStream<R>;
    } else {
      this.stdout = toModalReadStream(stdoutStream) as ModalReadStream<R>;
      this.stderr = toModalReadStream(stderrStream) as ModalReadStream<R>;
    }
  }

  /** Wait for process completion and return the exit code. */
  async wait(): Promise<number> {
    while (true) {
      const resp = await client.containerExecWait({
        execId: this.#execId,
        timeout: 55,
      });
      if (resp.completed) {
        return resp.exitCode ?? 0;
      }
    }
  }
}

// Like _StreamReader with object_type == "sandbox".
async function* outputStreamSb(
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
async function* outputStreamCp(
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

function inputStreamSb(sandboxId: string): WritableStream<string> {
  let index = 1;
  return new WritableStream<string>({
    async write(chunk, controller) {
      await client.sandboxStdinWrite({
        sandboxId,
        input: encodeIfString(chunk),
        index,
      });
      index++;
    },
    async close() {
      await client.sandboxStdinWrite({
        sandboxId,
        index,
        eof: true,
      });
    },
  });
}

function inputStreamCp<R extends string | Uint8Array>(
  execId: string
): WritableStream<R> {
  let messageIndex = 1;
  return new WritableStream<R>({
    async write(chunk, controller) {
      await client.containerExecPutInput({
        execId,
        input: {
          message: encodeIfString(chunk),
          messageIndex,
        },
      });
      messageIndex++;
    },
    async close() {
      await client.containerExecPutInput({
        execId,
        input: {
          messageIndex,
          eof: true,
        },
      });
    },
  });
}

function encodeIfString(chunk: Uint8Array | string): Uint8Array {
  return typeof chunk === "string" ? new TextEncoder().encode(chunk) : chunk;
}
