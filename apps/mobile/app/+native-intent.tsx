export async function redirectSystemPath({ path, initial }: { path: string; initial: boolean }) {
  if (path && (path.includes('dataUrl=') || path.includes('annotaShareKey'))) {
    console.log('[NativeIntent] Intercepted share intent deep link, redirecting to root (/). Path:', path);
    return '/';
  }
  return path;
}
