import { Injectable } from '@angular/core';
import { FilesApi, type OpenedFile } from '../src/files/files-api';

/** In-memory `FilesApi` for specs. Never import from production code. */
@Injectable()
export class FakeFilesApi extends FilesApi {
  saved: { name: string; text?: string; bytes?: Uint8Array }[] = [];
  nextOpen: OpenedFile | null = null;

  saveText(defaultName: string, text: string): Promise<string | null> {
    this.saved.push({ name: defaultName, text });
    return Promise.resolve(defaultName);
  }

  saveBytes(defaultName: string, bytes: Uint8Array): Promise<string | null> {
    this.saved.push({ name: defaultName, bytes });
    return Promise.resolve(defaultName);
  }

  openText(): Promise<OpenedFile | null> {
    return Promise.resolve(this.nextOpen);
  }
}
