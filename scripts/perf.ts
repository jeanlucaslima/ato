/** `npm run perf`: time ATO's pure paths at 500–5,000 tabs (see src/dev/perf.ts). */
import { formatPerf, runPerf } from '../src/dev/perf';

console.log(formatPerf(runPerf()));
