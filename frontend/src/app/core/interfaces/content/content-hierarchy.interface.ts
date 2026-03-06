export interface FolderNode {
  files: string[];
  subdirs: { [name: string]: FolderNode };
}
