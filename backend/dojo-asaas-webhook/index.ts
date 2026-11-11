import {handlers} from '../dojo-billing/runtime.ts';
Deno.serve(handlers.webhook);
