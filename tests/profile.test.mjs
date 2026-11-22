import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const section=fs.readFileSync(path.join(repo,'org-profile/BLASTRADIUS_SECTION.md'),'utf8');
const preview=fs.readFileSync(path.join(repo,'org-profile/README.preview.md'),'utf8');
const original=preview.replace(section,'');
const script=path.join(repo,'org-profile/apply-to-clone.mjs');
const gitBlobHash=content=>{
  const body=Buffer.from(content,'utf8');
  return createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${body.length}\0`),body])).digest('hex');
};
function prepare(t,readme){
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'br-org-profile-'));
  t.after(()=>fs.rmSync(temp,{recursive:true,force:true}));
  const clone=path.join(temp,'.github');
  fs.mkdirSync(path.join(clone,'profile'),{recursive:true});
  const file=path.join(clone,'profile/README.md');
  fs.writeFileSync(file,readme);
  return {clone,file};
}
function apply(clone){return spawnSync(process.execPath,[script,clone],{encoding:'utf8'});}

test('Org profile: current GitHub baseline produces exact BlastRadius → Deploom → SelfReview preview',t=>{
  // Captured blob identity; update intentionally when the organization's README changes.
  // Git blob identity is measured on canonical LF bytes; Windows checkout may
  // convert the working copy to CRLF without changing the object in Git.
  assert.equal(gitBlobHash(original.replace(/\r\n/g,'\n')),'3cfdbaf7fe676d1a524ecf1d0e02c4d06c45259a');
  const {clone,file}=prepare(t,original);
  const done=apply(clone);
  assert.equal(done.status,0,done.stderr);
  const actual=fs.readFileSync(file,'utf8');
  assert.equal(actual,preview);
  assert.deepEqual([...actual.matchAll(/^## (BlastRadius|Deploom|SelfReview)$/gm)].map(m=>m[1]),
    ['BlastRadius','Deploom','SelfReview']);
  const again=apply(clone);
  assert.notEqual(again.status,0,'Duplicate insertion should be rejected');
  assert.equal(fs.readFileSync(file,'utf8'),actual,'Duplicate refusal must not mutate the profile');
});

test('Org profile: unexpected original structure is rejected without edits',t=>{
  const original='# Unrelated organization\n';
  const {clone,file}=prepare(t,original);
  const result=apply(clone);
  assert.notEqual(result.status,0);
  assert.equal(fs.readFileSync(file,'utf8'),original);
});

// Keep canonical Git evidence independent of platform line-ending conversion.
test('Org profile: LF and CRLF working copies have the same normalized baseline identity',()=>{
  const lf=preview.replace(section,'').replace(/\r\n/g,'\n');
  const crlf=lf.replace(/\n/g,'\r\n');
  assert.notEqual(gitBlobHash(crlf),gitBlobHash(lf));
  assert.equal(gitBlobHash(crlf.replace(/\r\n/g,'\n')),gitBlobHash(lf));
});
