export async function openLocalTarget({
  tabs,
  localServer,
  desktopWindow,
  setActiveTarget,
  getDesktopState,
}) {
  const existingTab = tabs.getTab('local');
  if (existingTab && localServer.getLocalServerUrl()) {
    await desktopWindow.showTarget(await localServer.getResolvedTarget());
    return getDesktopState();
  }

  const pendingTarget = localServer.getPendingTarget();
  tabs.upsertTarget(pendingTarget);
  setActiveTarget(pendingTarget);
  desktopWindow.emitDesktopState();

  const target = await localServer.getResolvedTarget();
  await desktopWindow.showTarget(target);
  return getDesktopState();
}
