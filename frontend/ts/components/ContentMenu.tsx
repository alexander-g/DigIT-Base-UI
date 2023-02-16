import { preact, signals }          from "../dep.ts";
import type { AppFileState }        from "../state.ts";
import * as detection               from "../logic/detection.ts";



type ContentMenuProps = {
  file: AppFileState;
};

/** A menu bar for every image, containing control buttons */
export function ContentMenu(props: ContentMenuProps): preact.JSX.Element {
  return (
    <div
      class = "ui bottom attached secondary icon menu"
      style = "border-top-width:0px; margin-bottom:0px;"
    >
      <PlayButton file={props.file} />
      <ViewMenu />
      <DownloadButton file={props.file} />
    </div>
  );
}




type PlayButtonProps = {
  file:      AppFileState;
  callback?: (f: AppFileState) => void;
};

/** Button to trigger the processing of a single input file */
function PlayButton(props: PlayButtonProps): preact.JSX.Element {
  const callback: () => void = (props.callback ?? detection.process_image).bind(
    null,
    props.file,
  );

  return (
    <a
      class         =   "process item"
      onClick       =   {callback}
      data-tooltip  =   "Process Image"
      data-position =   "bottom left"
    >
      <i class="play icon"></i>
    </a>
  );
}




function ViewMenu(): preact.JSX.Element {
  return (
    <div class="ui simple dropdown icon item view-menu-button">
      <i class="eye icon"></i>
      {/* {{ view_menu(**view_menu_kwargs) | indent(8)}} */}
    </div>
  );
}




/** Button to trigger the download of a single result.
 *  Disabled if the corresponding input file has not been processed yet.
 *  //TODO: also disable when processing a batch of files.
 */
function DownloadButton(props: { file: AppFileState }): preact.JSX.Element {
  const disabled: string = props.file.$result.value ? "" : "disabled";
  return (
    <a
      class         =   {"download item " + disabled}
      onClick       =   {console.warn}
      data-tooltip  =   "Download Result"
      data-position =   "bottom left"
    >
      <i class="download icon"></i>
    </a>
  );
}
