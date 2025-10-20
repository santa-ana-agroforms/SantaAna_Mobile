import { FormSessionsState } from "@/forms/state/formSessionSlice";
import { TypedUseSelectorHook, useDispatch, useSelector } from "react-redux";
import type { AppDispatch } from "./index";

export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<{
  formSession: FormSessionsState;
}> = useSelector;
