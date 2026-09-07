import { createContext } from "react";

/** True inside PlatformStampShell so nested IdentityCard/ChromeBox skip a second navy rail. */
export const StampNestContext = createContext(false);
