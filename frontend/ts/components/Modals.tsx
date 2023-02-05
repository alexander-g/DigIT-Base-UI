import { preact } from "../dep.ts"
import { SettingsModal } from "./Settings.tsx"


export function Modals(): preact.JSX.Element {
    return <>
        <SettingsModal />
    </>
}
