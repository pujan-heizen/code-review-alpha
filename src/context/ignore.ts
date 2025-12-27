/**
 * Ignore rules for workspace scanning / reading. These are intentionally conservative
 * to avoid leaking secrets or pulling huge/binary/generated content into the model context.
 *
 * Inspired by `github-pr-review/src/constants/files.ts`.
 */

const IGNORED_FILE_PATTERNS: RegExp[] = [
  // Lock files
  /package-lock\.json$/i,
  /yarn\.lock$/i,
  /pnpm-lock\.yaml$/i,
  /composer\.lock$/i,
  /gemfile\.lock$/i,
  /poetry\.lock$/i,
  /pipfile\.lock$/i,

  // Environment / secrets
  /(^|\/)\.env(\..+)?$/i,
  /(^|\/)\.environment$/i,
  /\.(pem|key)$/i,
  /id_rsa/i,
  /id_ed25519/i,

  // Build outputs & dependencies
  /(^|\/)(dist|build|out|target|bin)(\/|$)/i,
  /(^|\/)node_modules(\/|$)/i,
  /(^|\/)vendor(\/|$)/i,
  /(^|\/)__pycache__(\/|$)/i,

  // IDE / git
  /(^|\/)\.git(\/|$)/i,
  /(^|\/)\.vscode(\/|$)/i,
  /(^|\/)\.idea(\/|$)/i,

  // Coverage / generated
  /(^|\/)coverage(\/|$)/i,
  /\.generated\./i,
  /\.auto\./i,

  // Media / binary formats
  /\.(png|jpg|jpeg|gif|svg|ico|webp)$/i,
  /\.(mp4|mov|avi|mkv|webm)$/i,
  /\.(mp3|wav|ogg|flac)$/i,
  /\.(pdf|doc|docx|xls|xlsx|ppt|pptx)$/i,
  /\.(zip|tar|gz|rar|7z)$/i,
  /\.(woff|woff2|ttf|otf|eot)$/i,
];

export function shouldIgnorePath(path: string): boolean {
  const normalized = path.replaceAll("\\", "/");
  return IGNORED_FILE_PATTERNS.some((re) => re.test(normalized));
}

export function isProbablyBinaryPath(path: string): boolean {
  return (
    /\.(png|jpg|jpeg|gif|webp|pdf|zip|tar|gz|rar|7z|woff2?|ttf|otf|eot|mp3|mp4|mov|avi|mkv)$/i.test(
      path,
    ) || /\.(exe|dylib|so|dll|class|jar)$/i.test(path)
  );
}
