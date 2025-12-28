import * as vscode from "vscode";

// Minimal typings for the built-in VS Code Git extension API.
interface GitExtension {
  readonly enabled: boolean;
  getAPI(version: number): GitAPI;
}

interface GitAPI {
  readonly repositories: Repository[];
}

interface Repository {
  readonly rootUri: vscode.Uri;
  readonly state: RepositoryState;
  diff(cached?: boolean): Promise<string>;
}

interface RepositoryState {
  readonly workingTreeChanges: Change[];
  readonly indexChanges: Change[];
  readonly mergeChanges: Change[];
}

interface Change {
  readonly uri: vscode.Uri;
}

export interface GitDiffResult {
  unstagedDiff: string;
  stagedFiles: vscode.Uri[];
  unstagedFiles: vscode.Uri[];
  totalLines: number;
}

export class GitManager {
  private gitExtension?: GitExtension;

  private getGitAPI(): GitAPI | undefined {
    const ext = vscode.extensions.getExtension<GitExtension>("vscode.git");
    if (!ext) return undefined;

    // Ensure the extension is activated.
    if (!ext.isActive) {
      void ext.activate().then((exports) => {
        this.gitExtension = exports;
      });
    } else {
      this.gitExtension = ext.exports;
    }

    const api = (this.gitExtension ?? ext.exports)?.getAPI(1);
    return api;
  }

  private getRepository(): Repository | undefined {
    const api = this.getGitAPI();
    if (!api || api.repositories.length === 0) return undefined;
    return api.repositories[0];
  }

  isGitAvailable(): boolean {
    return this.getGitAPI() !== undefined;
  }

  hasRepository(): boolean {
    return this.getRepository() !== undefined;
  }

  hasUncommittedChanges(): boolean {
    const repo = this.getRepository();
    if (!repo) return false;
    const s = repo.state;
    return (
      s.workingTreeChanges.length > 0 || s.indexChanges.length > 0 || s.mergeChanges.length > 0
    );
  }

  async getUnstagedChanges(): Promise<GitDiffResult> {
    const repo = this.getRepository();
    if (!repo) {
      throw new Error("No Git repository found in the current workspace.");
    }

    const unstagedDiff = await repo.diff(false);
    const stagedFiles = repo.state.indexChanges.map((c) => c.uri);
    const unstagedFiles = repo.state.workingTreeChanges.map((c) => c.uri);

    return {
      unstagedDiff: unstagedDiff ?? "",
      stagedFiles,
      unstagedFiles,
      totalLines: (unstagedDiff ?? "").split("\n").length,
    };
  }
}
