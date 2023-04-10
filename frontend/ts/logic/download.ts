import { InputResultPair, Result }  from "./files.ts";
import { Instance }                 from "../logic/boxes.ts";
import * as util                    from "../util.ts";
import { validate_instance }        from "./boxes.ts";



/** filename, detections */
type csv_line_type = [string, string]

export function format_results_as_csv(files:readonly InputResultPair[]): string {
    const header: csv_line_type   = ['#filename', 'detections']
    const lines:  csv_line_type[] = []
    for(const pair of files) {
        const result: Readonly<Result> = pair.result;
        if(result.status != 'processed')
            continue;
        
        lines.push( [pair.input.name, format_instances_as_csv(result.instances ?? [])] )
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


/** Export the results of processed files to JSON format */
export function export_results(files:InputResultPair[]): File[] {
    return files.map(export_result_to_file).filter(Boolean) as File[];
}

/** Export the processing result of an AppFile to a File object.
 *  @param file - AppFile object with a processed Result.
 *  @returns New File object with the processing results in JSON format, or null if the file has not been processed yet or failed processing.
*/
export function export_result_to_file(pair:InputResultPair): File|null {
    const result:Result = pair.result;
    if(result.status != 'processed') {
        return null;
    }
    const result_json:string = JSON.stringify(result.instances, undefined, 2)
    const result_name:string = pair.input.name + '.result.json'
    return new File([result_json], result_name, {type: "application/json"})
}


function validate_result(x:unknown): Result|null {
    if(util.is_array_of_type(x, validate_instance) ){
        return new Result('processed', {instances: x})
    }
    else return null;
}

/** Load a previously exported result from a file. 
 *  @returns Result or null if the file is invalid. */
export async function import_result_from_file(file:File): Promise<Result|null> {
    const raw_data:unknown = JSON.parse(await file.text())
    return validate_result(raw_data)
}


