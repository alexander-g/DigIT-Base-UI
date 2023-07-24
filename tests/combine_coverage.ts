#!./deno.sh run --allow-read=tests/


const coverage_raw:string = Deno.readTextFileSync(Deno.args[0])
let   all_total           = 0;
let   all_covered         = 0;
for(const line of coverage_raw.split('\n')) {
    if(line.startsWith('cover ')){
        const filename = line.split('file://')[1].split(' ...')[0]
        const covered  = Number( line.slice(line.lastIndexOf('(')+1, line.lastIndexOf('/')) )
        const total    = Number( line.slice(line.lastIndexOf('/')+1, line.lastIndexOf(')') ) )

        all_total     += total;
        all_covered   += covered;
    }
}

const coverage = Number(all_covered/all_total)
console.log(`Coverage: ${ (coverage*100).toFixed(1) }% [${all_covered}/${all_total}]`)
