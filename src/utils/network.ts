// src/utils/network.ts
import NetInfo from "@react-native-community/netinfo";

export const isOnline = async () => {
  const s = await NetInfo.fetch();
  return Boolean(s.isConnected && s.isInternetReachable !== false);
};

export const onReconnectOnce = (cb: () => void) => {
  const sub = NetInfo.addEventListener((s) => {
    if (s.isConnected && s.isInternetReachable !== false) {
      sub(); // unsubscribe
      cb();
    }
  });
  return sub;
};
