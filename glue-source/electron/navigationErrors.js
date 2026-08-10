export function isExpectedNavigationAbort(error) {
  const message = error instanceof Error ? error.message : String(error);
  return error?.code === 'ERR_ABORTED' || message.includes('ERR_ABORTED') || message.includes('(-3)');
}
