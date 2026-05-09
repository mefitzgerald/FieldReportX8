let _locked = false;

export const acquireCamera = (): boolean => {
  if (_locked) return false;
  _locked = true;
  return true;
};

export const releaseCamera = (): void => {
  _locked = false;
};
