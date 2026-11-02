import { DOCUMENT, Injectable, inject } from '@angular/core';
import { INVOKE } from '../platform/platform-api';

export interface FileFilter {
  name: string;
  extensions: string[];
}

export interface OpenedFile {
  name: string;
  text: string;
}

/**
 * Saving and opening user files (prompt 002). Desktop: system dialogs + Rust writes atomically.
 * Web: download link / file input. `null` = the user cancelled.
 */
export abstract class FilesApi {
  /** Returns the file name that was written, or null if cancelled. */
  abstract saveText(defaultName: string, text: string, filter: FileFilter): Promise<string | null>;
  abstract saveBytes(
    defaultName: string,
    bytes: Uint8Array,
    filter: FileFilter,
  ): Promise<string | null>;
  abstract openText(filter: FileFilter): Promise<OpenedFile | null>;
}

@Injectable()
export class TauriFilesApi extends FilesApi {
  private readonly invoke = inject(INVOKE);

  private async pickSave(defaultName: string, filter: FileFilter): Promise<string | null> {
    const { save } = await import('@tauri-apps/plugin-dialog');
    return save({ defaultPath: defaultName, filters: [filter] });
  }

  async saveText(defaultName: string, text: string, filter: FileFilter): Promise<string | null> {
    const path = await this.pickSave(defaultName, filter);
    return path ? this.invoke<string>('files_write_text', { path, text }) : null;
  }

  async saveBytes(
    defaultName: string,
    bytes: Uint8Array,
    filter: FileFilter,
  ): Promise<string | null> {
    const path = await this.pickSave(defaultName, filter);
    return path ? this.invoke<string>('files_write_bytes', { path, bytes: [...bytes] }) : null;
  }

  async openText(filter: FileFilter): Promise<OpenedFile | null> {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const path = await open({ multiple: false, directory: false, filters: [filter] });
    if (typeof path !== 'string') return null;
    const text = await this.invoke<string>('files_read_text', { path });
    return { name: path.split(/[\\\\/]/).pop() ?? path, text };
  }
}

@Injectable()
export class WebFilesApi extends FilesApi {
  private readonly doc = inject(DOCUMENT);

  private download(name: string, blob: Blob): string {
    const url = URL.createObjectURL(blob);
    const a = this.doc.createElement('a');
    a.href = url;
    a.download = name;
    a.rel = 'noopener';
    this.doc.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return name;
  }

  saveText(defaultName: string, text: string): Promise<string | null> {
    return Promise.resolve(
      this.download(defaultName, new Blob([text], { type: 'application/json' })),
    );
  }

  saveBytes(defaultName: string, bytes: Uint8Array): Promise<string | null> {
    return Promise.resolve(this.download(defaultName, new Blob([bytes as BlobPart])));
  }

  openText(filter: FileFilter): Promise<OpenedFile | null> {
    return new Promise((resolve) => {
      const input = this.doc.createElement('input');
      input.type = 'file';
      input.accept = filter.extensions.map((e) => `.${e}`).join(',');
      input.addEventListener('change', async () => {
        const file = input.files?.[0];
        resolve(file ? { name: file.name, text: await file.text() } : null);
      });
      input.addEventListener('cancel', () => resolve(null));
      input.click();
    });
  }
}
