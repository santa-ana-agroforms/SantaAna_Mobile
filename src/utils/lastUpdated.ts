// utils/lastUpdated.ts
let lastUpdatedEpoch: number | null = null;

export const setLastUpdatedNow = () => {
  lastUpdatedEpoch = Date.now();
};

export const getLastUpdatedDate = (): Date | null => {
  return lastUpdatedEpoch ? new Date(lastUpdatedEpoch) : null;
};
