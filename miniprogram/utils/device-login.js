const DEVICE_KEY_STORAGE = "loginDeviceKey";

function isValidDeviceKey(value) {
  return typeof value === "string" && /^[0-9a-f]{64}$/.test(value) && new Set(value).size >= 8;
}

function readStoredDeviceKey(wxApi = wx) {
  try {
    const value = wxApi.getStorageSync(DEVICE_KEY_STORAGE);
    return isValidDeviceKey(value) ? value : "";
  } catch (_) {
    return "";
  }
}

function saveDeviceKey(wxApi = wx, value) {
  if (!isValidDeviceKey(value)) return false;
  try {
    wxApi.setStorageSync(DEVICE_KEY_STORAGE, value);
    return true;
  } catch (_) {
    return false;
  }
}

function miniDeviceInfo(wxApi = wx) {
  const device = typeof wxApi.getDeviceInfo === "function"
    ? wxApi.getDeviceInfo()
    : (typeof wxApi.getSystemInfoSync === "function" ? wxApi.getSystemInfoSync() : {});
  const base = typeof wxApi.getAppBaseInfo === "function" ? wxApi.getAppBaseInfo() : {};
  const officialCategory = `${device.deviceType || ""} ${device.deviceCategory || ""}`;
  const description = `${officialCategory} ${device.model || ""} ${device.system || ""} ${device.platform || ""}`;
  const deviceType = /ipad|tablet|\bpad\b|matepad/i.test(description)
    ? "tablet"
    : /windows|mac|devtools/i.test(description)
      ? "desktop"
      : "mobile";

  return {
    deviceType,
    displayName: `${device.brand || "微信"} ${device.model || "设备"}`.trim(),
    operatingSystem: String(device.system || device.platform || "").trim(),
    clientVersion: String(base.version || base.SDKVersion || "").trim()
  };
}

module.exports = { readStoredDeviceKey, saveDeviceKey, miniDeviceInfo };
