import React, { createContext, useContext, useMemo, useState } from "react";
import { View, LayoutChangeEvent, ViewProps } from "react-native";

type Box = { width: number; height: number };
const LayoutCtx = createContext<Box | null>(null);

export function useContainerLayout(required = true) {
  const v = useContext(LayoutCtx);
  if (required && !v) throw new Error("useContainerLayout must be used inside <ContainerSizer>");
  return v;
}

export default function ContainerSizer({ children, ...rest }: React.PropsWithChildren<ViewProps>) {
  const [box, setBox] = useState<Box>({ width: 0, height: 0 });

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width !== box.width || height !== box.height) setBox({ width, height });
    rest.onLayout?.(e);
  };

  const value = useMemo(() => box, [box.width, box.height]);

  return (
    <View {...rest} onLayout={onLayout}>
      <LayoutCtx.Provider value={value}>{box.width ? children : null}</LayoutCtx.Provider>
    </View>
  );
}
