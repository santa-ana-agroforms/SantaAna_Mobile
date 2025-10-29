// src/utils/network.ts
import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";

const makeUnsub = (ret: unknown): (() => void) => {
  if (typeof ret === "function") return ret as () => void;
  if (ret && typeof (ret as any).remove === "function") {
    return () => (ret as any).remove();
  }
  return () => {}; // no-op
};

const online = (s: NetInfoState) =>
  Boolean(s.isConnected && (s.isInternetReachable == null ? true : s.isInternetReachable));

export const isOnline = async () => {
  const s = await NetInfo.fetch();
  return online(s);
};

export const onReconnectOnce = (cb: () => void) => {
  let canceled = false;

  // 1) chequeo inmediato
  NetInfo.fetch()
    .then((s) => {
      if (!canceled && online(s)) cb();
    })
    .catch(() => {});

  // 2) escuchar cambios hasta que haya red y soltar
  const ret = NetInfo.addEventListener((s) => {
    if (!canceled && online(s)) {
      unsub();
      cb();
    }
  });
  const unsub = makeUnsub(ret);

  return () => {
    canceled = true;
    unsub();
  };
};
