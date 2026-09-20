import { createContext } from "react";

/** True inside SectionShell so nested IdentityCard/ChromeBox skip a second frame rail. */
export const StampNestContext = createContext(false);
