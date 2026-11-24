/**
 * Whether a browser runs on an iPhone, iPad or iPod. iPadOS asks for desktop
 * pages by reporting a Mac, so a Mac with more than one touch point is one
 * too.
 */
export function isAppleTouchDevice(
  userAgent: string,
  platform = '',
  maxTouchPoints = 0,
): boolean {
  return (
    /iPhone|iPad|iPod/.test(userAgent) ||
    (platform === 'MacIntel' && maxTouchPoints > 1)
  );
}
