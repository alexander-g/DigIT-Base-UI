import { AppFile, Result }          from "../state.ts";
import { Instance }                 from "../logic/boxes.ts";




/** filename, detections */
type csv_line_type = [string, string]

export function format_results_as_csv(files:readonly AppFile[]): string {
    const header: csv_line_type   = ['#filename', 'detections']
    const lines:  csv_line_type[] = []
    for(const file of files) {
        const result: Readonly<Result> = file.result;
        if(result.status != 'processed')
            continue;
        
        lines.push( [file.name, format_instances_as_csv(result.instances ?? [])] )
    }
    return [header].concat(lines).map((line:csv_line_type) => line.join(', ')).join('\n')
}

export function format_instances_as_csv(instances:readonly Instance[]): string {
    const labels:string[]  = instances.map( (inst:Instance) => inst.label )
    const classes:string[] = Array.from(new Set(labels)).sort()
    const countedlabels: string[] = [];
    for(const c of classes) {
        const count:number = labels.filter( (l:string) => (l==c) ).length;
        countedlabels.push( `${c} (x${count})` )
    }
    return countedlabels.join(' / ')
}


// export function format_single_result_as_json(result:Result): string {

// }


// export function load_result_from_json(jsondata:string): Result {

// }

