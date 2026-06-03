import { NativeModule } from "expo"

export interface ArchiveEntryDto {
  path: string
  content: string
}

export interface ExpenseBuddyUtilsNativeModule extends NativeModule {
  zipTextEntriesAsync(entries: ArchiveEntryDto[]): Promise<string>
  unzipTextEntriesAsync(archiveBase64: string): Promise<ArchiveEntryDto[]>
}
