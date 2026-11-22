#!/usr/bin/env node
// Run against an already cloned levencode-labs/.github checkout; no network, auth,
// Git commands, credential handling or implicit publishing is performed here.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const repo=process.argv[2];
if(!repo)throw Error('Usage: node org-profile/apply-to-clone.mjs /path/to/.github');
const target=path.join(path.resolve(repo),'profile','README.md');
const source=fs.readFileSync(target,'utf8');
const section=fs.readFileSync(path.join(here,'BLASTRADIUS_SECTION.md'),'utf8');
if(source.includes('## BlastRadius'))throw Error('BlastRadius already appears; refusing duplicate insertion');
if(!source.includes('## Deploom')||!source.includes('## SelfReview'))throw Error('Unexpected profile structure; refusing destructive replacement');
const updated=source.replace('## Deploom',section+'## Deploom');
// Atomic local replacement. Review the diff before committing.
const temp=target+'.blastradius.tmp';fs.writeFileSync(temp,updated,{flag:'wx'});fs.renameSync(temp,target);
console.log('Updated '+target+'; review git diff and publish through your normal GitHub process.');
