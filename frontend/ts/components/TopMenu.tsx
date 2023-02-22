import { JSX } from "../dep.ts"
import { SettingsButton } from "./Settings.tsx"
import { page_wide_css } from "./styles.ts";


function Logo(): JSX.Element {
    return <div class="header item" style="padding-top:0; padding-bottom:0">
    <img class="logo" src="logo.svg" />
  </div>
}



export function TopMenu(): JSX.Element {
    return <div class="ui container menu page-wide" style={page_wide_css}>
        <Logo />
        <SettingsButton />
    </div>
}
